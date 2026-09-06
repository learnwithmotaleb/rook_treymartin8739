import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, desc, gt } from "drizzle-orm";
import { db, scanJobsTable, threatsTable } from "@workspace/db";
import { startScan } from "../services/scanOrchestrator";
import { checkAndIncrementQuota, getQuotaState, QuotaTrackingError } from "../services/rateLimitService";
import { getSubscription } from "../services/subscriptionService";
import { PLAN_CONFIG, normalizeTier, type Tier } from "../lib/planConfig";

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

function nextMonthlyReset(now = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
}

router.post("/scan", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;

    // ── Validate input first — before any quota mutations ──────────────────────
    const bodyParsed = ScanBody.safeParse(req.body ?? {});
    if (!bodyParsed.success) {
      res.status(400).json({ error: "Invalid request body", details: bodyParsed.error.flatten() });
      return;
    }
    const { bypassCache } = bodyParsed.data;

    // ── Dedup: return existing running job WITHOUT consuming quota ──────────────
    // Only consider jobs started within the last 8 minutes as truly "running".
    // Jobs older than that are presumed stuck (server restart / crash mid-scan)
    // and should not block a fresh scan attempt.
    const eightMinsAgo = new Date(Date.now() - 8 * 60 * 1000);
    const activeJobs = await db
      .select()
      .from(scanJobsTable)
      .where(
        and(
          eq(scanJobsTable.userId, userId),
          eq(scanJobsTable.status, "running"),
          gt(scanJobsTable.startedAt, eightMinsAgo)
        )
      );

    if (activeJobs.length > 0 && activeJobs[0]) {
      res.status(200).json(serializeJob(activeJobs[0]));
      return;
    }

    // ── Quota check (only reached when no job is already running) ───────────────
    const sub = await getSubscription(userId);
    // normalizeTier maps "pro" → "premium" (pro is sunset; premium limits apply).
    // This matches what GET /scan/quota-state does — consistency is required so
    // the UI quota display and the actual enforcement agree.
    const planTier = normalizeTier(sub.tier ?? "free") as Tier;

    const isDeepScan =
      !!(process.env["GOOGLE_CSE_API_KEY"] || process.env["GOOGLE_VISION_API_KEY"]);

    const quota = await checkAndIncrementQuota(userId, planTier, isDeepScan);

    if (!quota.allowed) {
      res.status(429).json({
        error: "scan_limit_reached",
        reason: quota.reason,
        tier: planTier,
        upgradeTo: "premium",
        resetsAt: quota.reason === "monthly_limit" && planTier === "free" ? nextMonthlyReset() : null,
        message:
          quota.reason === "monthly_limit"
            ? `Your free scan for this month has been used. Your next free scan is available ${new Date(nextMonthlyReset()).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`
            : quota.reason === "daily_deep_scan_limit"
            ? "You've used your deep scan for today. Upgrade to Premium for unlimited daily scans."
            : "Your account has been temporarily throttled due to unusual scan activity. Contact support.",
      });
      return;
    }

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
    if (err instanceof QuotaTrackingError) {
      res.status(503).json({ error: "quota_unavailable", message: err.message });
      return;
    }
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
      res.json({
        canScan: true,
        scansUsed: state?.scansThisMonth ?? 0,
        scansAllowed: -1,
        tier: planTier,
        imagesPerScan: PLAN_CONFIG[planTier].imagesPerScan,
        resetsAt: null,
      });
      return;
    }

    const scansUsed = state?.scansThisMonth ?? 0;
    const scansAllowed = 1;
    res.json({
      canScan: scansUsed < scansAllowed,
      scansUsed,
      scansAllowed,
      tier: planTier,
      imagesPerScan: PLAN_CONFIG[planTier].imagesPerScan,
      upgradeTo: "premium",
      resetsAt: nextMonthlyReset(),
      message: scansUsed >= scansAllowed
        ? `Your free scan for this month has been used. Your next free scan is available ${new Date(nextMonthlyReset()).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`
        : `1 free scan per month. Resets ${new Date(nextMonthlyReset()).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`,
    });
  } catch (err) {
    req.log.error({ err }, "GET /scan/quota-state failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Return only findings created by one completed scan. This endpoint deliberately
 * exposes redacted summary data (including first-scan low-confidence findings)
 * so the completion screen never mixes its count with historical alerts.
 * Detailed evidence remains available only through the tier-gated threat route.
 */
router.get("/scan/:jobId/results", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
    if (!jobId) {
      res.status(400).json({ error: "Missing jobId" });
      return;
    }

    const [job] = await db
      .select({ id: scanJobsTable.id, status: scanJobsTable.status })
      .from(scanJobsTable)
      .where(and(eq(scanJobsTable.id, jobId), eq(scanJobsTable.userId, userId)));
    if (!job) {
      res.status(404).json({ error: "Scan job not found" });
      return;
    }
    if (job.status !== "completed") {
      res.status(409).json({ error: "Scan is not complete" });
      return;
    }

    const findings = await db
      .select()
      .from(threatsTable)
      .where(and(eq(threatsTable.scanJobId, jobId), eq(threatsTable.userId, userId)))
      .orderBy(desc(threatsTable.createdAt));

    res.json(findings.map((threat) => {
      let evidenceCount = 0;
      try {
        const evidence = JSON.parse(threat.evidenceJson ?? "[]");
        evidenceCount = Array.isArray(evidence) ? evidence.length : 0;
      } catch {
        evidenceCount = 0;
      }
      return {
        id: threat.id,
        scanJobId: threat.scanJobId,
        type: threat.type,
        severity: threat.severity,
        platform: threat.platform,
        title: threat.title,
        description: threat.description,
        threatScore: threat.threatScore,
        matchedMediaCount: threat.matchedMediaCount,
        evidenceCount,
        suspiciousUsername: threat.suspiciousUsername,
        resolved: threat.resolved,
        resolveAction: threat.resolveAction ?? null,
        resolvedAt: threat.resolvedAt?.toISOString() ?? null,
        createdAt: threat.createdAt.toISOString(),
      };
    }));
  } catch (err) {
    req.log.error({ err }, "GET /scan/:jobId/results failed");
    res.status(500).json({ error: "Could not load scan results" });
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
