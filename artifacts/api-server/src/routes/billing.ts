import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, subscriptionsTable, cancellationFeedbackTable } from "@workspace/db";

import { PLAN_CONFIG, normalizeTier } from "../lib/planConfig";
import { getSubscription } from "../services/subscriptionService";
import { scheduleTrialReminder } from "../services/schedulerService";

const router: IRouter = Router();

router.get("/billing/subscription", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const sub = await getSubscription(userId);
    const limits = PLAN_CONFIG[normalizeTier(sub.tier)];
    res.json({ ...sub, limits });
  } catch (err) {
    req.log.error({ err }, "GET /billing/subscription failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /billing/revenuecat-sync
 *
 * Called by the mobile app after a RevenueCat purchase, restore, or on launch
 * to keep the server-side subscription record (used for scan-quota checks)
 * in sync with the authoritative RevenueCat state on the device.
 */
const RcSyncBody = z.object({
  tier: z.enum(["free", "pro", "premium"]),
  status: z.enum(["active", "trialing", "canceled"]).optional(),
  trialEndsAt: z.string().datetime({ offset: true }).optional(),
});

router.post("/billing/revenuecat-sync", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;

    const parsed = RcSyncBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
      return;
    }
    const { tier: validTier, status, trialEndsAt } = parsed.data;

    const isTrialing = status === "trialing" && !!trialEndsAt;
    const resolvedStatus = isTrialing ? "trialing" : (status ?? "active");
    const trialEndsAtDate = isTrialing ? new Date(trialEndsAt!) : undefined;

    await db
      .insert(subscriptionsTable)
      .values({
        userId,
        tier: validTier,
        status: resolvedStatus,
        trialEndsAt: trialEndsAtDate,
        billingCycle: "monthly",
      })
      .onConflictDoUpdate({
        target: [subscriptionsTable.userId],
        set: {
          tier: validTier,
          status: resolvedStatus,
          trialEndsAt: trialEndsAtDate,
          updatedAt: new Date(),
        },
      });

    if (isTrialing && trialEndsAtDate) {
      await scheduleTrialReminder(userId, trialEndsAtDate);
    }

    res.json({ tier: validTier, synced: true });
  } catch (err) {
    req.log.error({ err }, "POST /billing/revenuecat-sync failed");
    res.status(500).json({ error: "Internal server error" });
  }
});


const CancellationSurveyBody = z.object({
  reason: z.string().min(1).max(500),
});

router.post("/billing/cancellation-survey", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;

    const parsed = CancellationSurveyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "reason is required" });
      return;
    }

    await db
      .insert(cancellationFeedbackTable)
      .values({ userId, reason: parsed.data.reason });

    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "POST /billing/cancellation-survey failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
