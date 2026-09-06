import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  usersTable,
  subscriptionsTable,
  scheduledNotificationsTable,
} from "@workspace/db";
import { logger } from "../lib/logger.js";
import { scheduleTrialReminder } from "../services/schedulerService.js";

const router: IRouter = Router();
const PREMIUM_PRODUCT_IDS = new Set([
  "premium_monthly_v2",
  "premium_annual_v2",
]);

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
      entitlement_ids?: string[];
      product_id?: string;
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
    logger.info({ clerkId, eventType: event.type }, "RC webhook: user not found, skipping");
    res.json({ ok: true });
    return;
  }

  const userId = user.id;
  const eventType = event.type;

  logger.info({ userId, eventType }, "RevenueCat webhook received");

  try {
    if (eventType === "TRIAL_STARTED") {
      await handleTrialStarted(
        userId,
        event.expiration_at_ms ?? null,
        getTierFromEvent(event),
        getBillingCycleFromEvent(event),
      );
    } else if (eventType === "CANCELLATION") {
      await handleCancellation(userId);
    } else if (eventType === "EXPIRATION") {
      await handleExpiration(userId);
    } else if (
      eventType === "INITIAL_PURCHASE" ||
      eventType === "RENEWAL" ||
      eventType === "TRIAL_CONVERTED" ||
      eventType === "UNCANCELLATION" ||
      eventType === "TRANSFER"
    ) {
      await handleReactivation(
        userId,
        getTierFromEvent(event),
        getBillingCycleFromEvent(event),
      );
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

function getTierFromEvent(event: { entitlement_ids?: string[]; product_id?: string }): "free" | "premium" {
  const productId = event.product_id?.toLowerCase();
  // If RevenueCat supplied a product ID, do not grant Premium from a product
  // outside the two approved Rook Premium SKUs, even if a dashboard mapping is
  // accidentally changed.
  if (productId && !PREMIUM_PRODUCT_IDS.has(productId)) return "free";

  const entitlements = event.entitlement_ids ?? [];
  if (entitlements.includes("premium")) return "premium";
  if (entitlements.includes("pro")) return "premium";

  // Product IDs cover webhook variants where an entitlement list is absent.
  if (productId && PREMIUM_PRODUCT_IDS.has(productId)) return "premium";
  return "free";
}

function getBillingCycleFromEvent(
  event: { product_id?: string },
): "monthly" | "yearly" {
  const productId = event.product_id?.toLowerCase() ?? "";
  return productId === "premium_annual_v2"
    ? "yearly"
    : "monthly";
}

async function handleTrialStarted(
  userId: string,
  expirationAtMs: number | null,
  tier: "free" | "premium",
  billingCycle: "monthly" | "yearly",
): Promise<void> {
  const trialEndMs = expirationAtMs ?? (Date.now() + 7 * 24 * 60 * 60 * 1000);
  const trialEndsAt = new Date(trialEndMs);

  // Upsert: creates the subscription row if it doesn't exist yet
  await db
    .insert(subscriptionsTable)
    .values({ userId, tier, status: "trialing", trialEndsAt, billingCycle })
    .onConflictDoUpdate({
      target: [subscriptionsTable.userId],
      set: { tier, status: "trialing", trialEndsAt, billingCycle, updatedAt: new Date() },
    });

  await scheduleTrialReminder(userId, trialEndsAt);
}

async function handleCancellation(userId: string): Promise<void> {
  // RevenueCat emits CANCELLATION when auto-renew is switched off, not when
  // access ends. Preserve the verified tier until a later EXPIRATION event.
  await db
    .update(subscriptionsTable)
    .set({ status: "canceled", cancelAtPeriodEnd: true, updatedAt: new Date() })
    .where(eq(subscriptionsTable.userId, userId));
}

async function handleExpiration(userId: string): Promise<void> {
  // Upsert: creates the subscription row if it doesn't exist yet
  await db
    .insert(subscriptionsTable)
    .values({ userId, tier: "free", status: "canceled", billingCycle: "monthly" })
    .onConflictDoUpdate({
      target: [subscriptionsTable.userId],
      set: { tier: "free", status: "canceled", cancelAtPeriodEnd: false, updatedAt: new Date() },
    });

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

async function handleReactivation(
  userId: string,
  tier: "free" | "premium",
  billingCycle: "monthly" | "yearly",
): Promise<void> {
  // Upsert: creates the subscription row if it doesn't exist yet
  await db
    .insert(subscriptionsTable)
    .values({ userId, tier, status: "active", billingCycle })
    .onConflictDoUpdate({
      target: [subscriptionsTable.userId],
      set: { tier, status: "active", billingCycle, cancelAtPeriodEnd: false, updatedAt: new Date() },
    });

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
