import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  usersTable,
  subscriptionsTable,
  scheduledNotificationsTable,
} from "@workspace/db";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const WEBHOOK_SECRET = process.env["REVENUECAT_WEBHOOK_SECRET"];

router.post("/rc-webhook", async (req, res): Promise<void> => {
  // Optional secret verification — log warning if not configured rather than blocking
  if (WEBHOOK_SECRET) {
    const authHeader = req.headers["authorization"] ?? "";
    const incoming = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (incoming !== WEBHOOK_SECRET) {
      logger.warn("RC webhook received with invalid Authorization header");
      res.status(401).json({ error: "unauthorized" });
      return;
    }
  } else {
    logger.warn("REVENUECAT_WEBHOOK_SECRET not set — accepting RC webhook without verification");
  }

  const body = req.body as {
    api_version?: string;
    event?: {
      type?: string;
      app_user_id?: string;
      original_app_user_id?: string;
      expiration_at_ms?: number;
      purchased_at_ms?: number;
    };
  };

  const event = body.event;
  if (!event?.type) {
    res.status(400).json({ error: "missing event.type" });
    return;
  }

  const clerkId = event.app_user_id ?? event.original_app_user_id;
  if (!clerkId) {
    res.status(400).json({ error: "missing app_user_id" });
    return;
  }

  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);

  if (!user) {
    // User not yet registered in our DB — ack but don't error
    logger.info({ clerkId, eventType: event.type }, "RC webhook: user not found, skipping");
    res.json({ ok: true });
    return;
  }

  const userId = user.id;
  const eventType = event.type;

  logger.info({ userId, eventType }, "RevenueCat webhook received");

  try {
    if (eventType === "TRIAL_STARTED") {
      await handleTrialStarted(userId, event.expiration_at_ms ?? null);
    } else if (eventType === "CANCELLATION" || eventType === "EXPIRATION") {
      await handleCancellationOrExpiration(userId);
    } else if (
      eventType === "INITIAL_PURCHASE" ||
      eventType === "RENEWAL" ||
      eventType === "TRIAL_CONVERTED" ||
      eventType === "UNCANCELLATION"
    ) {
      await handleReactivation(userId);
    }
  } catch (err) {
    logger.error({ err, userId, eventType }, "RC webhook handler error");
    res.status(500).json({ error: "internal" });
    return;
  }

  res.json({ ok: true });
});

async function handleTrialStarted(userId: string, expirationAtMs: number | null): Promise<void> {
  // Schedule a day-5 reminder = expirationAt - 2 days (trial is typically 7 days)
  const baseMs = expirationAtMs ?? Date.now() + 7 * 24 * 60 * 60 * 1000;
  const fireAt = new Date(baseMs - 2 * 24 * 60 * 60 * 1000);

  await db
    .update(subscriptionsTable)
    .set({ status: "trialing", updatedAt: new Date() })
    .where(eq(subscriptionsTable.userId, userId));

  // Cancel any existing trial reminders for this user before inserting a fresh one
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

  logger.info({ userId, fireAt }, "Scheduled trial day-5 reminder");
}

async function handleCancellationOrExpiration(userId: string): Promise<void> {
  await db
    .update(subscriptionsTable)
    .set({ status: "canceled", updatedAt: new Date() })
    .where(eq(subscriptionsTable.userId, userId));

  // Cancel any pending trial reminders — trial is over
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

  // Cancel any existing win-back notifications before scheduling a new one
  await db
    .update(scheduledNotificationsTable)
    .set({ cancelled: true })
    .where(
      and(
        eq(scheduledNotificationsTable.userId, userId),
        eq(scheduledNotificationsTable.type, "win_back_30d"),
        eq(scheduledNotificationsTable.fired, false),
        eq(scheduledNotificationsTable.cancelled, false)
      )
    );

  const fireAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(scheduledNotificationsTable).values({
    userId,
    type: "win_back_30d",
    fireAt,
  });

  logger.info({ userId, fireAt }, "Scheduled 30-day win-back notification");
}

async function handleReactivation(userId: string): Promise<void> {
  await db
    .update(subscriptionsTable)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(subscriptionsTable.userId, userId));

  // Cancel any pending win-back — user resubscribed
  await db
    .update(scheduledNotificationsTable)
    .set({ cancelled: true })
    .where(
      and(
        eq(scheduledNotificationsTable.userId, userId),
        eq(scheduledNotificationsTable.type, "win_back_30d"),
        eq(scheduledNotificationsTable.fired, false),
        eq(scheduledNotificationsTable.cancelled, false)
      )
    );

  logger.info({ userId }, "RC webhook: user reactivated, win-back cancelled");
}

export default router;
