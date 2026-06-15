import { logger } from "../lib/logger";
import { db, usersTable } from "@workspace/db";
import { lte, and, isNotNull } from "drizzle-orm";
import { startScan } from "./scanOrchestrator";
import { getSubscription } from "./subscriptionService";

const INTERVAL_MS = 15 * 60 * 1000;

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
