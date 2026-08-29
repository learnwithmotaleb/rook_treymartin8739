import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, cancellationFeedbackTable } from "@workspace/db";

import { PLAN_CONFIG, normalizeTier } from "../lib/planConfig";
import { getSubscription } from "../services/subscriptionService";

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
 * Called by the mobile app after a RevenueCat purchase, restore, or on launch.
 *
 * The app is useful for refreshing its own local RevenueCat state, but it
 * cannot be trusted to authorize server-side quota changes. RevenueCat's
 * signed server-to-server webhook is the sole writer for paid server tiers.
 */
const RcSyncBody = z.object({
  tier: z.enum(["free", "premium"]),
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
    // Parse the established client contract for backwards compatibility, but
    // deliberately do not persist its tier/status values. A modified client
    // could otherwise grant itself Premium access by posting arbitrary JSON.
    void parsed.data;

    const subscription = await getSubscription(userId);
    res.status(202).json({
      tier: normalizeTier(subscription.tier),
      synced: false,
      message: "Subscription changes are applied after RevenueCat verifies the purchase.",
    });
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
