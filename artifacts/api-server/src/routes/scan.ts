import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, scanJobsTable } from "@workspace/db";
import { startScan } from "../services/scanOrchestrator";
import { checkAndIncrementQuota } from "../services/rateLimitService";
import { getSubscription } from "../services/subscriptionService";
import type { Tier } from "../lib/planConfig";

const router: IRouter = Router();

function serializeJob(job: typeof scanJobsTable.$inferSelect) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep,
    threatsFound: job.threatsFound,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}

router.post("/scan", async (req, res): Promise<void> => {
  const userId = req.userId;

  // ── Dedup: return existing running job WITHOUT consuming quota ──────────────
  // Must happen before quota increment so that retries while a job is active
  // never burn the user's monthly/daily allowance or trigger abuse detection.
  const activeJobs = await db
    .select()
    .from(scanJobsTable)
    .where(
      and(
        eq(scanJobsTable.userId, userId),
        eq(scanJobsTable.status, "running")
      )
    );

  if (activeJobs.length > 0 && activeJobs[0]) {
    res.status(200).json(serializeJob(activeJobs[0]));
    return;
  }

  // ── Quota check (only reached when no job is already running) ───────────────
  const sub = await getSubscription(userId);
  const planTier = (sub.tier ?? "free") as Tier;

  // "deep scan" = the full Vision + CSE pipeline fires when API keys are set
  const isDeepScan =
    !!(process.env["GOOGLE_CSE_API_KEY"] || process.env["GOOGLE_VISION_API_KEY"]);

  const quota = await checkAndIncrementQuota(userId, planTier, isDeepScan);

  if (!quota.allowed) {
    const upgradeTier: Tier = planTier === "free" ? "pro" : "premium";
    res.status(429).json({
      error: "scan_limit_reached",
      reason: quota.reason,
      tier: planTier,
      upgradeTo: upgradeTier,
      message:
        quota.reason === "monthly_limit"
          ? `You've used all ${planTier === "free" ? "3" : "15"} scans for this month. Upgrade to ${upgradeTier} for more.`
          : quota.reason === "daily_deep_scan_limit"
          ? `You've used your ${planTier === "free" ? "1" : "5"} deep scan${planTier === "free" ? "" : "s"} for today. Upgrade for more.`
          : "Your account has been temporarily throttled due to unusual scan activity. Contact support.",
    });
    return;
  }

  const bypassCache = req.body?.bypassCache === true;
  const job = await startScan(userId, planTier, { bypassCache });
  res.status(201).json({
    ...serializeJob(job),
    quota: {
      tier: planTier,
      remainingMonth: quota.remainingMonth,
      remainingDay: quota.remainingDay,
    },
  });
});

router.get("/scan/latest", async (req, res): Promise<void> => {
  const userId = req.userId;

  const [job] = await db
    .select()
    .from(scanJobsTable)
    .where(eq(scanJobsTable.userId, userId))
    .orderBy(desc(scanJobsTable.startedAt))
    .limit(1);

  if (!job) {
    res.status(404).json({ error: "No scans found" });
    return;
  }

  res.json(serializeJob(job));
});

router.get("/scan/:jobId", async (req, res): Promise<void> => {
  const userId = req.userId;
  const jobId = Array.isArray(req.params.jobId)
    ? req.params.jobId[0]
    : req.params.jobId;

  if (!jobId) {
    res.status(400).json({ error: "Missing jobId" });
    return;
  }

  const [job] = await db
    .select()
    .from(scanJobsTable)
    .where(
      and(eq(scanJobsTable.id, jobId), eq(scanJobsTable.userId, userId))
    );

  if (!job) {
    res.status(404).json({ error: "Scan job not found" });
    return;
  }

  res.json(serializeJob(job));
});

export default router;
