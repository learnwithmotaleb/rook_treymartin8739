import { logger } from "../lib/logger";
import { metaFetch } from "../lib/metaFetch";
import {
  db,
  usersTable,
  connectedAccountsTable,
  scheduledNotificationsTable,
  subscriptionsTable,
} from "@workspace/db";
import { lte, and, isNotNull, eq, or, lt } from "drizzle-orm";
import { sendPushToUser } from "./notificationService";
import { startScan } from "./scanOrchestrator";
import { getSubscription } from "./subscriptionService";
import { shouldSkipReviewerBackgroundWork } from "./backgroundReviewerGuard";

const INTERVAL_MS = 15 * 60 * 1000;

// ── Scheduled push notification loop ─────────────────────────────────────────
// Checks for due trial reminders and win-back notifications every 15 minutes.

/**
 * Schedule a day-5 trial reminder for a user. Cancels any existing pending
 * reminder first to avoid duplicates (idempotent). Fires 2 days before trialEndsAt.
 * Called from both the RC webhook handler and the manual revenuecat-sync route.
 */
export async function scheduleTrialReminder(userId: string, trialEndsAt: Date): Promise<void> {
  if (await shouldSkipReviewerBackgroundWork(userId)) return;

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
        if (await shouldSkipReviewerBackgroundWork(row.userId)) continue;
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
        if (await shouldSkipReviewerBackgroundWork(id)) continue;
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
  // Run all three platform refresh loops concurrently on every tick.
  await Promise.allSettled([
    refreshInstagramTokens(),
    refreshXTokens(),
    refreshFacebookTokens(),
  ]);
}

// ── Instagram token refresh ───────────────────────────────────────────────────

async function refreshInstagramTokens(): Promise<void> {
  try {
    const thresholdDate = new Date(
      Date.now() - TOKEN_REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
    );

    // Only Instagram supports long-lived token refresh via Graph API.
    const staleAccounts = await db
      .select({
        id: connectedAccountsTable.id,
        userId: connectedAccountsTable.userId,
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
      if (await shouldSkipReviewerBackgroundWork(account.userId)) continue;
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
    logger.error({ err }, "Instagram token refresh loop error");
  }
}

// ── X/Twitter token refresh ───────────────────────────────────────────────────
// X user tokens (OAuth 2.0 PKCE) expire after ~2 hours. The refresh_token is
// valid for 6 months. This loop silently re-ups the access token whenever it is
// within 24 hours of expiry, preventing silent monitoring interruption.

async function refreshXTokens(): Promise<void> {
  const clientId = process.env["TWITTER_CLIENT_ID"];
  const clientSecret = process.env["TWITTER_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return; // X OAuth not configured

  try {
    const windowDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // within 24 hours

    const accounts = await db
      .select({
        id: connectedAccountsTable.id,
        userId: connectedAccountsTable.userId,
        username: connectedAccountsTable.username,
        refreshToken: connectedAccountsTable.refreshToken,
        tokenExpiresAt: connectedAccountsTable.tokenExpiresAt,
        refreshFailCount: connectedAccountsTable.refreshFailCount,
      })
      .from(connectedAccountsTable)
      .where(
        and(
          eq(connectedAccountsTable.platform, "x"),
          isNotNull(connectedAccountsTable.refreshToken),
          or(
            // Expired already
            lt(connectedAccountsTable.tokenExpiresAt, new Date()),
            // Expiring within 24 hours
            lte(connectedAccountsTable.tokenExpiresAt, windowDate)
          )
        )
      );

    if (accounts.length === 0) return;

    logger.info({ count: accounts.length }, "Refreshing X tokens");

    const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    for (const account of accounts) {
      if (!account.refreshToken) continue;
      if (await shouldSkipReviewerBackgroundWork(account.userId)) continue;

      let succeeded = false;

      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise<void>((r) => setTimeout(r, attempt === 1 ? 30_000 : 120_000));
        try {
          const res = await fetch("https://api.twitter.com/2/oauth2/token", {
            method: "POST",
            headers: {
              Authorization: `Basic ${encoded}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: account.refreshToken,
            }).toString(),
            signal: AbortSignal.timeout(10000),
          });

          if (!res.ok) {
            const body = await res.text();
            logger.warn(
              { accountId: account.id, status: res.status, attempt, body: body.slice(0, 200) },
              "X token refresh attempt failed"
            );
            continue;
          }

          const data = (await res.json()) as {
            access_token?: string;
            refresh_token?: string;
            expires_in?: number;
          };

          if (data.access_token) {
            const expiresAt = data.expires_in
              ? new Date(Date.now() + data.expires_in * 1000)
              : new Date(Date.now() + 2 * 60 * 60 * 1000); // default 2h

            await db
              .update(connectedAccountsTable)
              .set({
                accessToken: data.access_token,
                // X rotates refresh tokens on each use — always store the latest
                ...(data.refresh_token && { refreshToken: data.refresh_token }),
                tokenExpiresAt: expiresAt,
                needsReconnect: false,
                refreshFailCount: 0,
                lastSynced: new Date(),
              })
              .where(eq(connectedAccountsTable.id, account.id));

            succeeded = true;
            logger.info({ accountId: account.id, username: account.username }, "X token refreshed");
            break;
          }
        } catch (err) {
          logger.warn({ err, accountId: account.id, attempt }, "X token refresh error");
        }
      }

      if (!succeeded) {
        const newFailCount = (account.refreshFailCount ?? 0) + 1;
        const shouldFlag = newFailCount >= 2;

        await db
          .update(connectedAccountsTable)
          .set({
            refreshFailCount: newFailCount,
            ...(shouldFlag ? { needsReconnect: true } : {}),
          })
          .where(eq(connectedAccountsTable.id, account.id));

        if (shouldFlag) {
          void sendPushToUser(account.userId, {
            title: "X connection expired",
            body: `Reconnect @${account.username} to keep your identity protected.`,
            data: { screen: "manage-accounts" },
          });
          logger.warn(
            { accountId: account.id, userId: account.userId, failCount: newFailCount },
            "X token refresh exhausted (2 cycles) — needsReconnect flagged"
          );
        } else {
          logger.warn(
            { accountId: account.id, failCount: newFailCount },
            "X token refresh failed (cycle 1/2) — will retry next cycle before flagging"
          );
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "X token refresh loop error");
  }
}

// ── Facebook long-lived token renewal ────────────────────────────────────────
// Facebook long-lived tokens last 60 days. This loop renews them 7 days before
// expiry using the fb_exchange_token endpoint, preventing reconnect prompts.

async function refreshFacebookTokens(): Promise<void> {
  const clientId = process.env["FACEBOOK_APP_ID"]?.trim();
  const clientSecret = process.env["FACEBOOK_APP_SECRET"]?.trim();
  if (!clientId || !clientSecret) return; // Facebook OAuth not configured

  try {
    const windowDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // within 7 days

    const accounts = await db
      .select({
        id: connectedAccountsTable.id,
        userId: connectedAccountsTable.userId,
        username: connectedAccountsTable.username,
        accessToken: connectedAccountsTable.accessToken,
        tokenExpiresAt: connectedAccountsTable.tokenExpiresAt,
        refreshFailCount: connectedAccountsTable.refreshFailCount,
      })
      .from(connectedAccountsTable)
      .where(
        and(
          eq(connectedAccountsTable.platform, "facebook"),
          isNotNull(connectedAccountsTable.accessToken),
          or(
            lt(connectedAccountsTable.tokenExpiresAt, new Date()),
            lte(connectedAccountsTable.tokenExpiresAt, windowDate)
          )
        )
      );

    if (accounts.length === 0) return;

    logger.info({ count: accounts.length }, "Refreshing Facebook tokens");

    for (const account of accounts) {
      if (!account.accessToken) continue;
      if (await shouldSkipReviewerBackgroundWork(account.userId)) continue;

      let succeeded = false;

      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise<void>((r) => setTimeout(r, attempt === 1 ? 30_000 : 120_000));
        try {
          // Facebook long-lived token exchange — the current token becomes a new
          // 60-day long-lived token. Works even when the token is not yet expired.
          const url = new URL("https://graph.facebook.com/oauth/access_token");
          url.searchParams.set("grant_type", "fb_exchange_token");
          url.searchParams.set("client_id", clientId);
          url.searchParams.set("client_secret", clientSecret);
          url.searchParams.set("fb_exchange_token", account.accessToken);

          const res = await metaFetch(url.toString());
          if (!res.ok) {
            const body = await res.text();
            logger.warn(
              { accountId: account.id, status: res.status, attempt, body: body.slice(0, 200) },
              "Facebook token renewal attempt failed"
            );
            continue;
          }

          const data = (await res.json()) as {
            access_token?: string;
            expires_in?: number;
            token_type?: string;
          };

          if (data.access_token) {
            const expiresAt = data.expires_in
              ? new Date(Date.now() + data.expires_in * 1000)
              : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // default 60 days

            await db
              .update(connectedAccountsTable)
              .set({
                accessToken: data.access_token,
                tokenExpiresAt: expiresAt,
                needsReconnect: false,
                refreshFailCount: 0,
                lastSynced: new Date(),
              })
              .where(eq(connectedAccountsTable.id, account.id));

            succeeded = true;
            logger.info({ accountId: account.id, username: account.username }, "Facebook token renewed");
            break;
          }
        } catch (err) {
          logger.warn({ err, accountId: account.id, attempt }, "Facebook token renewal error");
        }
      }

      if (!succeeded) {
        const newFailCount = (account.refreshFailCount ?? 0) + 1;
        const shouldFlag = newFailCount >= 2;

        await db
          .update(connectedAccountsTable)
          .set({
            refreshFailCount: newFailCount,
            ...(shouldFlag ? { needsReconnect: true } : {}),
          })
          .where(eq(connectedAccountsTable.id, account.id));

        if (shouldFlag) {
          void sendPushToUser(account.userId, {
            title: "Facebook connection expired",
            body: `Reconnect @${account.username} to keep your identity protected.`,
            data: { screen: "manage-accounts" },
          });
          logger.warn(
            { accountId: account.id, userId: account.userId, failCount: newFailCount },
            "Facebook token refresh exhausted (2 cycles) — needsReconnect flagged"
          );
        } else {
          logger.warn(
            { accountId: account.id, failCount: newFailCount },
            "Facebook token refresh failed (cycle 1/2) — will retry next cycle before flagging"
          );
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "Facebook token refresh loop error");
  }
}

// ── Per-user proactive token refresh ─────────────────────────────────────────
// Called from POST /api/accounts/refresh on app foreground / tab mount.
// Immediately refreshes all of the user's tokens that are within their
// platform's proactive refresh window. Returns the updated account list.

export async function refreshAccountTokensForUser(userId: string): Promise<void> {
  if (await shouldSkipReviewerBackgroundWork(userId)) return;

  const clientIdX = process.env["TWITTER_CLIENT_ID"];
  const clientSecretX = process.env["TWITTER_CLIENT_SECRET"];
  const clientIdFB = process.env["FACEBOOK_APP_ID"]?.trim();
  const clientSecretFB = process.env["FACEBOOK_APP_SECRET"]?.trim();

  const accounts = await db
    .select()
    .from(connectedAccountsTable)
    .where(eq(connectedAccountsTable.userId, userId));

  if (accounts.length === 0) return;

  const now = new Date();
  const xWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const fbWindow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const igThreshold = new Date(now.getTime() - TOKEN_REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  await Promise.allSettled(accounts.map(async (account) => {
    try {
      if (account.platform === "x" && clientIdX && clientSecretX && account.refreshToken) {
        const expiresAt = account.tokenExpiresAt;
        if (!expiresAt || expiresAt <= xWindow) {
          // Refresh X token
          const encoded = Buffer.from(`${clientIdX}:${clientSecretX}`).toString("base64");
          const res = await fetch("https://api.twitter.com/2/oauth2/token", {
            method: "POST",
            headers: {
              Authorization: `Basic ${encoded}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: account.refreshToken,
            }).toString(),
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) {
            const data = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
            if (data.access_token) {
              const newExpiresAt = data.expires_in
                ? new Date(Date.now() + data.expires_in * 1000)
                : new Date(Date.now() + 2 * 60 * 60 * 1000);
              await db.update(connectedAccountsTable).set({
                accessToken: data.access_token,
                ...(data.refresh_token && { refreshToken: data.refresh_token }),
                tokenExpiresAt: newExpiresAt,
                needsReconnect: false,
                refreshFailCount: 0,
                lastSynced: new Date(),
              }).where(eq(connectedAccountsTable.id, account.id));
              logger.info({ accountId: account.id, userId }, "X token proactively refreshed on mount");
            }
          }
        }
      } else if (account.platform === "facebook" && clientIdFB && clientSecretFB && account.accessToken) {
        const expiresAt = account.tokenExpiresAt;
        if (!expiresAt || expiresAt <= fbWindow) {
          const url = new URL("https://graph.facebook.com/oauth/access_token");
          url.searchParams.set("grant_type", "fb_exchange_token");
          url.searchParams.set("client_id", clientIdFB);
          url.searchParams.set("client_secret", clientSecretFB);
          url.searchParams.set("fb_exchange_token", account.accessToken);
          const res = await metaFetch(url.toString());
          if (res.ok) {
            const data = (await res.json()) as { access_token?: string; expires_in?: number };
            if (data.access_token) {
              const newExpiresAt = data.expires_in
                ? new Date(Date.now() + data.expires_in * 1000)
                : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
              await db.update(connectedAccountsTable).set({
                accessToken: data.access_token,
                tokenExpiresAt: newExpiresAt,
                needsReconnect: false,
                refreshFailCount: 0,
                lastSynced: new Date(),
              }).where(eq(connectedAccountsTable.id, account.id));
              logger.info({ accountId: account.id, userId }, "Facebook token proactively renewed on mount");
            }
          }
        }
      } else if (account.platform === "instagram" && account.accessToken) {
        const lastSynced = account.lastSynced;
        if (!lastSynced || lastSynced <= igThreshold) {
          const url =
            `https://graph.instagram.com/refresh_access_token` +
            `?grant_type=ig_refresh_token&access_token=${encodeURIComponent(account.accessToken)}`;
          const res = await metaFetch(url);
          if (res.ok) {
            const data = (await res.json()) as { access_token?: string };
            if (data.access_token) {
              await db.update(connectedAccountsTable).set({
                accessToken: data.access_token,
                lastSynced: new Date(),
                needsReconnect: false,
                refreshFailCount: 0,
              }).where(eq(connectedAccountsTable.id, account.id));
              logger.info({ accountId: account.id, userId }, "Instagram token proactively refreshed on mount");
            }
          }
        }
      }
    } catch (err) {
      // Non-fatal — proactive refresh is best-effort
      logger.warn({ err, accountId: account.id, platform: account.platform }, "Proactive token refresh error (non-fatal)");
    }
  }));
}
