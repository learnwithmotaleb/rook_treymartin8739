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

/**
 * POST /rc-webhook
 *
 * RevenueCat server-to-server webhook. Handles trial and cancellation events to:
 *   - Schedule day-5 trial reminder push notifications
 *   - Schedule 30-day win-back push notifications on cancellation/expiration
 *   - Cancel pending win-back notifications if the user resubscribes
 *
 * Authentication: Bearer token in Authorization header must match
 * REVENUECAT_WEBHOOK_SECRET. If the secret is not configured, ALL requests
 * are rejected (fail-closed) to prevent unauthenticated billing-state changes.
 *
 * RevenueCat dashboard setup: configure the webhook URL to
 *   https://<your-domain>/api/rc-webhook
 * with Authorization secret = REVENUECAT_WEBHOOK_SECRET value.
 */
router.post("/rc-webhook", async (req, res): Promise<void> => {
  const webhookSecret = process.env["REVENUECAT_WEBHOOK_SECRET"];

  if (!webhookSecret) {
    // Fail-closed: reject all requests when secret is not configured.
    // Set REVENUECAT_WEBHOOK_SECRET in Replit Secrets to enable this endpoint.
    logger.error(
      "REVENUECAT_WEBHOOK_SECRET is not set — rc-webhook endpoint is locked. " +
      "Configure the secret in Replit Secrets and restart the server."
    );
    res.status(401).json({ error: "webhook endpoint not configured" });
    return;
  }

  const authHeader = req.headers["authorization"] ?? "";
  const incoming = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (incoming !== webhookSecret) {
    logger.warn({ hasHeader: !!authHeader }, "RC webhook: invalid Authorization header");
    res.status(401).json({ error: "unauthorized" });
    return;
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
    // User not yet registered in our DB — ack but don't error (RC may fire before first login)
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
    } else {
      logger.info({ userId, eventType }, "RC webhook: unhandled event type, ignoring");
    }
  } catch (err) {
    logger.error({ err, userId, eventType }, "RC webhook handler error");
    res.status(500).json({ error: "internal" });
    return;
  }

  res.json({ ok: true });
});

async function handleTrialStarted(userId: string, expirationAtMs: number | null): Promise<void> {
  // Derive the trial end timestamp — fall back to 7 days from now if RC didn't supply it
  const trialEndMs = expirationAtMs ?? (Date.now() + 7 * 24 * 60 * 60 * 1000);
  const trialEndsAt = new Date(trialEndMs);

  // Day-5 reminder fires 2 days before the trial ends
  const fireAt = new Date(trialEndMs - 2 * 24 * 60 * 60 * 1000);

  // Persist trialing status AND trialEndsAt so the mobile countdown banner can render
  await db
    .update(subscriptionsTable)
    .set({ status: "trialing", trialEndsAt, updatedAt: new Date() })
    .where(eq(subscriptionsTable.userId, userId));

  // Cancel any existing trial reminders before inserting a fresh one
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

  // Cancel any existing win-back before scheduling a fresh one
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

  // Cancel any pending win-back — user resubscribed before the 30-day window
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
