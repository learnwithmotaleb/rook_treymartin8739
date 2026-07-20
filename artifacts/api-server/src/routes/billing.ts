import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable, usersTable, cancellationFeedbackTable } from "@workspace/db";

import { PLAN_CONFIG, normalizeTier } from "../lib/planConfig";
import { getSubscription } from "../services/subscriptionService";

const router: IRouter = Router();

router.get("/billing/subscription", async (req, res): Promise<void> => {
  const userId = req.userId;
  const sub = await getSubscription(userId);
  const limits = PLAN_CONFIG[normalizeTier(sub.tier)];
  res.json({ ...sub, limits });
});

/**
 * POST /billing/revenuecat-sync
 *
 * Called by the mobile app after a RevenueCat purchase, restore, or on launch
 * to keep the server-side subscription record (used for scan-quota checks)
 * in sync with the authoritative RevenueCat state on the device.
 */
const RcSyncBody = z.object({ tier: z.enum(["free", "pro", "premium"]) });

router.post("/billing/revenuecat-sync", async (req, res): Promise<void> => {
  const userId = req.userId;

  const parsed = RcSyncBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "tier must be 'free', 'pro', or 'premium'" });
    return;
  }
  const { tier: validTier } = parsed.data;

  await db
    .insert(subscriptionsTable)
    .values({ userId, tier: validTier, status: "active", billingCycle: "monthly" })
    .onConflictDoUpdate({
      target: [subscriptionsTable.userId],
      set: { tier: validTier, status: "active", updatedAt: new Date() },
    });

  res.json({ tier: validTier, synced: true });
});


const CancellationSurveyBody = z.object({
  reason: z.string().min(1).max(500),
});

router.post("/billing/cancellation-survey", async (req, res): Promise<void> => {
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
});

export default router;
