import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, subscriptionsTable, cancellationFeedbackTable } from "@workspace/db";

import { PLAN_CONFIG, normalizeTier } from "../lib/planConfig";
import { getSubscription } from "../services/subscriptionService";
import { scheduleTrialReminder } from "../services/schedulerService";

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
 *
 * If the device reports status="trialing" with a trialEndsAt timestamp,
 * this also schedules the day-5 trial reminder (manual path that complements
 * the RC TRIAL_STARTED webhook, in case the webhook fires before the user is
 * registered in our DB or the webhook secret is not yet configured).
 */
const RcSyncBody = z.object({
  tier: z.enum(["free", "pro", "premium"]),
  status: z.enum(["active", "trialing", "canceled"]).optional(),
  trialEndsAt: z.string().datetime({ offset: true }).optional(),
});

router.post("/billing/revenuecat-sync", async (req, res): Promise<void> => {
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

  // Manual trial path: schedule the day-5 reminder when the device reports a trial.
  // This complements the RC webhook (TRIAL_STARTED) for cases where the webhook
  // fires before the user row exists or the secret is not yet set.
  if (isTrialing && trialEndsAtDate) {
    await scheduleTrialReminder(userId, trialEndsAtDate);
  }

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
