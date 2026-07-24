import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db, scanJobsTable } from "@workspace/db";
import { startScan } from "../services/scanOrchestrator";
import { checkAndIncrementQuota, getQuotaState } from "../services/rateLimitService";
import { getSubscription } from "../services/subscriptionService";
import type { Tier } from "../lib/planConfig";
import { normalizeTier } from "../lib/planConfig";

const ScanBody = z.object({
  bypassCache: z.boolean().optional().default(false),
}).strict();

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
  try {
    const userId = req.userId;

    // ── Dedup: return existing running job WITHOUT consuming quota ──────────────
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

    const isDeepScan =
      !!(process.env["GOOGLE_CSE_API_KEY"] || process.env["GOOGLE_VISION_API_KEY"]);

    const quota = await checkAndIncrementQuota(userId, planTier, isDeepScan);

    if (!quota.allowed) {
      res.status(429).json({
        error: "scan_limit_reached",
        reason: quota.reason,
        tier: planTier,
        upgradeTo: "premium",
        message:
          quota.reason === "monthly_limit"
            ? "Your free scan for this month has been used. Upgrade to Premium for unlimited scans anytime."
            : quota.reason === "daily_deep_scan_limit"
            ? "You've used your deep scan for today. Upgrade to Premium for unlimited daily scans."
            : "Your account has been temporarily throttled due to unusual scan activity. Contact support.",
      });
      return;
    }

    const bodyParsed = ScanBody.safeParse(req.body ?? {});
    if (!bodyParsed.success) {
      res.status(400).json({ error: "Invalid request body", details: bodyParsed.error.flatten() });
      return;
    }
    const { bypassCache } = bodyParsed.data;
    const job = await startScan(userId, planTier, { bypassCache });
    res.status(201).json({
      ...serializeJob(job),
      quota: {
        tier: planTier,
        remainingMonth: quota.remainingMonth,
        remainingDay: quota.remainingDay,
      },
    });
  } catch (err) {
    req.log.error({ err }, "POST /scan failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/scan/latest", async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    req.log.error({ err }, "GET /scan/latest failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/scan/quota-state", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const sub = await getSubscription(userId);
    const planTier = normalizeTier(sub.tier ?? "free");
    const state = await getQuotaState(userId);

    if (planTier !== "free") {
      res.json({ canScan: true, scansUsed: state?.scansThisMonth ?? 0, scansAllowed: -1, tier: planTier });
      return;
    }

    const scansUsed = state?.scansThisMonth ?? 0;
    const scansAllowed = 1;
    res.json({
      canScan: scansUsed < scansAllowed,
      scansUsed,
      scansAllowed,
      tier: planTier,
      upgradeTo: "premium",
      message: scansUsed >= scansAllowed
        ? "Your free scan for this month has been used. Upgrade to Premium for unlimited scans anytime."
        : null,
    });
  } catch (err) {
    req.log.error({ err }, "GET /scan/quota-state failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/scan/:jobId", async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    req.log.error({ err }, "GET /scan/:jobId failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
