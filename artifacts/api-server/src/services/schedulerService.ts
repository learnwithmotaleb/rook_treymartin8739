import { logger } from "../lib/logger";
import { metaFetch } from "../lib/metaFetch";
import {
  db,
  usersTable,
  connectedAccountsTable,
  scheduledNotificationsTable,
  subscriptionsTable,
} from "@workspace/db";
import { lte, and, isNotNull, eq } from "drizzle-orm";
import { sendPushToUser } from "./notificationService";
import { startScan } from "./scanOrchestrator";
import { getSubscription } from "./subscriptionService";

const INTERVAL_MS = 15 * 60 * 1000;

// ── Scheduled push notification loop ─────────────────────────────────────────
// Checks for due trial reminders and win-back notifications every 15 minutes.

/**
 * Schedule a day-5 trial reminder for a user. Cancels any existing pending
 * reminder first to avoid duplicates (idempotent). Fires 2 days before trialEndsAt.
 * Called from both the RC webhook handler and the manual revenuecat-sync route.
 */
export async function scheduleTrialReminder(userId: string, trialEndsAt: Date): Promise<void> {
  const fireAt = new Date(trialEndsAt.getTime() - 2 * 24 * 60 * 60 * 1000);

  await db
    .update(scheduledNotificationsTable)
    .set({ cancelled: true })
    .where(
      and(
        eq(scheduledNotificationsTable.userId, userId),
        eq(scheduledNotificationsTable.type, "trial_day5_reminder"),
        eq(scheduledNotificationsTable.fired, false),
        eq(scheduledNotificationsTable.cancelled, false)
      )
    );

  await db.insert(scheduledNotificationsTable).values({
    userId,
    type: "trial_day5_reminder",
    fireAt,
  });

  logger.info({ userId, trialEndsAt, fireAt }, "Scheduled trial day-5 reminder");
}

export function startNotificationSchedulerLoop(): void {
  logger.info("Notification scheduler loop started (15-min interval)");
  const timer = setInterval(runScheduledNotifications, INTERVAL_MS);
  timer.unref();
  // Run once shortly after startup to pick up any already-due notifications.
  setTimeout(runScheduledNotifications, 15_000).unref();
}

async function runScheduledNotifications(): Promise<void> {
  try {
    const dueRows = await db
      .select()
      .from(scheduledNotificationsTable)
      .where(
        and(
          eq(scheduledNotificationsTable.fired, false),
          eq(scheduledNotificationsTable.cancelled, false),
          lte(scheduledNotificationsTable.fireAt, new Date())
        )
      );

    if (dueRows.length === 0) return;

    logger.info({ count: dueRows.length }, "Processing due scheduled notifications");

    for (const row of dueRows) {
      try {
        await fireScheduledNotification(row.id, row.userId, row.type);
      } catch (err) {
        logger.warn({ err, notifId: row.id, type: row.type }, "Scheduled notification failed");
      }
    }
  } catch (err) {
    logger.error({ err }, "Notification scheduler loop error");
  }
}

async function fireScheduledNotification(
  notifId: string,
  userId: string,
  type: string
): Promise<void> {
  // Mark fired first to prevent double-send on retry
  await db
    .update(scheduledNotificationsTable)
    .set({ fired: true })
    .where(eq(scheduledNotificationsTable.id, notifId));

  const [sub] = await db
    .select({ status: subscriptionsTable.status })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .limit(1);

  if (type === "trial_day5_reminder") {
    // Only fire if still in trial
    if (sub?.status !== "trialing") {
      logger.info({ userId }, "Skipping trial reminder — user no longer in trial");
      return;
    }
    await sendPushToUser(userId, {
      title: "⏳ Your Rook protection ends in 2 days",
      body: "Keep your accounts monitored — upgrade to Premium before your trial expires.",
      data: { screen: "subscription" },
    });
    logger.info({ userId }, "Trial day-5 reminder sent");
  } else if (type === "win_back_30d") {
    // Only fire if still cancelled (not resubscribed)
    if (sub?.status === "active" || sub?.status === "trialing") {
      logger.info({ userId }, "Skipping win-back — user already resubscribed");
      return;
    }
    await sendPushToUser(userId, {
      title: "🛡️ Come back to Rook",
      body: "Your identity doesn't stop being a target. Restart monitoring today.",
      data: { screen: "subscription" },
    });
    logger.info({ userId }, "Win-back 30d notification sent");
  }
}

// ── Scheduled scan loop ───────────────────────────────────────────────────────

export function startScheduledScanLoop(): void {
  logger.info("Scheduled scan loop started (15-min interval)");
  const timer = setInterval(runScheduledScans, INTERVAL_MS);
  timer.unref();
}

async function runScheduledScans(): Promise<void> {
  try {
    const dueUsers = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        and(
          isNotNull(usersTable.nextScanDue),
          lte(usersTable.nextScanDue, new Date())
        )
      );

    if (dueUsers.length === 0) return;

    logger.info({ count: dueUsers.length }, "Running scheduled scans");

    for (const { id } of dueUsers) {
      try {
        const sub = await getSubscription(id);
        if (sub.tier === "free") continue;
        await startScan(id, sub.tier);
      } catch (err) {
        logger.warn({ err, userId: id }, "Scheduled scan failed for user");
      }
    }
  } catch (err) {
    logger.error({ err }, "Scheduled scan loop error");
  }
}

// ── Instagram token refresh loop ──────────────────────────────────────────────
// Instagram long-lived tokens expire after 60 days. This loop runs every 24 h
// and proactively refreshes any token that was last synced 50+ days ago so
// the token is always valid and monitoring never silently stops.

const TOKEN_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TOKEN_REFRESH_THRESHOLD_DAYS = 50;

export function startTokenRefreshLoop(): void {
  logger.info("Token refresh loop started (24-h interval)");
  const timer = setInterval(runTokenRefreshes, TOKEN_REFRESH_INTERVAL_MS);
  timer.unref();
  // Also run once shortly after startup to pick up any already-stale tokens.
  setTimeout(runTokenRefreshes, 30_000).unref();
}

async function runTokenRefreshes(): Promise<void> {
  try {
    const thresholdDate = new Date(
      Date.now() - TOKEN_REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
    );

    // Only Instagram supports long-lived token refresh via Graph API.
    const staleAccounts = await db
      .select({
        id: connectedAccountsTable.id,
        platform: connectedAccountsTable.platform,
        accessToken: connectedAccountsTable.accessToken,
        lastSynced: connectedAccountsTable.lastSynced,
      })
      .from(connectedAccountsTable)
      .where(
        and(
          eq(connectedAccountsTable.platform, "instagram"),
          isNotNull(connectedAccountsTable.accessToken),
          lte(connectedAccountsTable.lastSynced, thresholdDate)
        )
      );

    if (staleAccounts.length === 0) return;

    logger.info({ count: staleAccounts.length }, "Refreshing Instagram tokens");

    const refreshedIds: string[] = [];

    // Exponential-backoff retry delays: immediate → 30 s → 120 s within each
    // 24-hour cycle. needsReconnect is only set after 2 consecutive failed
    // cycles so a single transient API outage does not trigger a re-auth prompt.
    const RETRY_DELAYS_MS = [0, 30_000, 120_000] as const;

    for (const account of staleAccounts) {
      if (!account.accessToken) continue;

      let succeeded = false;

      for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
        if (attempt > 0) {
          await new Promise<void>((resolve) =>
            setTimeout(resolve, RETRY_DELAYS_MS[attempt])
          );
        }
        try {
          const url =
            `https://graph.instagram.com/refresh_access_token` +
            `?grant_type=ig_refresh_token&access_token=${encodeURIComponent(account.accessToken!)}`;

          const res = await metaFetch(url);
          if (!res.ok) {
            const body = await res.text();
            logger.warn(
              { accountId: account.id, status: res.status, attempt, body: body.slice(0, 200) },
              "Instagram token refresh attempt failed"
            );
            continue; // try next attempt
          }

          const data = (await res.json()) as { access_token?: string };
          if (data.access_token) {
            await db
              .update(connectedAccountsTable)
              .set({
                accessToken: data.access_token,
                lastSynced: new Date(),
                needsReconnect: false,
                refreshFailCount: 0, // clear consecutive-failure counter on success
              })
              .where(eq(connectedAccountsTable.id, account.id));
            refreshedIds.push(account.id);
            succeeded = true;
            break;
          }
        } catch (err) {
          logger.warn(
            { err, accountId: account.id, attempt },
            "Instagram token refresh error"
          );
        }
      }

      if (!succeeded) {
        // Increment the consecutive-failure counter.
        // Only flag needsReconnect and notify the user after 2 consecutive
        // failed refresh cycles — one transient failure is tolerated silently.
        const [current] = await db
          .select({ refreshFailCount: connectedAccountsTable.refreshFailCount })
          .from(connectedAccountsTable)
          .where(eq(connectedAccountsTable.id, account.id));

        const newFailCount = (current?.refreshFailCount ?? 0) + 1;
        const shouldFlag = newFailCount >= 2;

        await db
          .update(connectedAccountsTable)
          .set({
            refreshFailCount: newFailCount,
            ...(shouldFlag ? { needsReconnect: true } : {}),
          })
          .where(eq(connectedAccountsTable.id, account.id));

        if (shouldFlag) {
          const [accountFull] = await db
            .select({
              userId: connectedAccountsTable.userId,
              username: connectedAccountsTable.username,
            })
            .from(connectedAccountsTable)
            .where(eq(connectedAccountsTable.id, account.id));

          if (accountFull) {
            void sendPushToUser(accountFull.userId, {
              title: "Instagram connection expired",
              body: `Reconnect @${accountFull.username} to keep your identity protected.`,
              data: { screen: "manage-accounts" },
            });
            logger.warn(
              { accountId: account.id, userId: accountFull.userId, failCount: newFailCount },
              "Instagram token refresh exhausted (2 cycles) — needsReconnect flagged"
            );
          }
        } else {
          logger.warn(
            { accountId: account.id, failCount: newFailCount },
            "Instagram token refresh failed (cycle 1/2) — will retry next cycle before flagging"
          );
        }
      }
    }

    if (refreshedIds.length > 0) {
      logger.info({ refreshed: refreshedIds.length }, "Instagram tokens refreshed");
    }
  } catch (err) {
    logger.error({ err }, "Token refresh loop error");
  }
}
