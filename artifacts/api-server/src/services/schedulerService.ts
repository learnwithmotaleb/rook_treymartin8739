import { logger } from "../lib/logger";
import { db, usersTable, connectedAccountsTable } from "@workspace/db";
import { lte, and, isNotNull, eq } from "drizzle-orm";
import { startScan } from "./scanOrchestrator";
import { getSubscription } from "./subscriptionService";

const INTERVAL_MS = 15 * 60 * 1000;

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

    for (const account of staleAccounts) {
      if (!account.accessToken) continue;

      try {
        const url =
          `https://graph.instagram.com/refresh_access_token` +
          `?grant_type=ig_refresh_token&access_token=${encodeURIComponent(account.accessToken)}`;

        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.text();
          logger.warn(
            { accountId: account.id, status: res.status, body: body.slice(0, 200) },
            "Instagram token refresh failed — account may need re-authentication"
          );
          continue;
        }

        const data = await res.json() as { access_token?: string };
        if (data.access_token) {
          await db
            .update(connectedAccountsTable)
            .set({ accessToken: data.access_token, lastSynced: new Date() })
            .where(eq(connectedAccountsTable.id, account.id));
          refreshedIds.push(account.id);
        }
      } catch (err) {
        logger.warn({ err, accountId: account.id }, "Instagram token refresh error");
      }
    }

    if (refreshedIds.length > 0) {
      logger.info({ refreshed: refreshedIds.length }, "Instagram tokens refreshed");
    }
  } catch (err) {
    logger.error({ err }, "Token refresh loop error");
  }
}
