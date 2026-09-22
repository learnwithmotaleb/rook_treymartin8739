import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, desc, gt, sql, inArray } from "drizzle-orm";
import { db, scanJobsTable, threatsTable, usageQuotasTable } from "@workspace/db";
import { startScan } from "../services/scanOrchestrator";
import { checkAndIncrementQuota, getQuotaState, QuotaTrackingError } from "../services/rateLimitService";
import { getSubscription } from "../services/subscriptionService";
import { PLAN_CONFIG, normalizeTier, type Tier } from "../lib/planConfig";
import { isDesignatedReviewer } from "../services/reviewerService";

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
    const designatedReviewer = await isDesignatedReviewer(userId);

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
    // ── Quota check (only reached when no job is already running) ───────────────
    const sub = await getSubscription(userId);
    // normalizeTier maps "pro" → "premium" (pro is sunset; premium limits apply).
    // This matches what GET /scan/quota-state does — consistency is required so
    // the UI quota display and the actual enforcement agree.
    const planTier = designatedReviewer ? "premium" : normalizeTier(sub.tier ?? "free") as Tier;

    const isDeepScan =
      !!(process.env["GOOGLE_CSE_API_KEY"] || process.env["GOOGLE_VISION_API_KEY"]);

    // Serialize the complete reservation (active-job check, quota mutation,
    // and queued-job insert) on the user's row. This closes the race where two
    // requests both pass the old check before either consumes quota.
    const reservation = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
      const activeJobs = await tx.select().from(scanJobsTable).where(and(
        eq(scanJobsTable.userId, userId),
        inArray(
          scanJobsTable.status,
          designatedReviewer
            ? ["queued", "running", "completed"]
            : ["queued", "running"],
        ),
        gt(scanJobsTable.startedAt, eightMinsAgo),
      ));
      if (activeJobs[0]) return { active: activeJobs[0] };

      const mKey = `${new Date().getFullYear()}-${new Date().getMonth() + 1}`;
      const d = new Date();
      const dKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      await tx.insert(usageQuotasTable).values({
        userId, scansThisMonth: 0, deepScansToday: 0, monthKey: mKey, dayKey: dKey,
      }).onConflictDoNothing({ target: usageQuotasTable.userId });
      const [quotaRow] = await tx.select().from(usageQuotasTable)
        .where(eq(usageQuotasTable.userId, userId)).for("update");
      if (!quotaRow) throw new QuotaTrackingError();
      const monthUsed = quotaRow.monthKey === mKey ? quotaRow.scansThisMonth : 0;
      const dayUsed = quotaRow.dayKey === dKey ? quotaRow.deepScansToday : 0;
      const monthlyLimit = planTier === "free" ? 1 : planTier === "pro" ? 15 : -1;
      const dailyLimit = planTier === "free" ? 1 : planTier === "pro" ? 5 : -1;
      const abuseThreshold = planTier === "free" ? 8 : planTier === "pro" ? 20 : 50;
      const reason = quotaRow.flaggedForAbuse ? "flagged_for_abuse"
        : monthlyLimit !== -1 && monthUsed >= monthlyLimit ? "monthly_limit"
        : isDeepScan && dailyLimit !== -1 && dayUsed >= dailyLimit ? "daily_deep_scan_limit"
        : undefined;
      if (reason) return { quota: { allowed: false as const, reason } };
      const newScans = monthUsed + 1;
      const newDeep = dayUsed + (isDeepScan ? 1 : 0);
      const shouldFlag = newScans > abuseThreshold * 3 || newDeep > abuseThreshold;
      await tx.update(usageQuotasTable).set({
        scansThisMonth: newScans,
        deepScansToday: newDeep,
        monthKey: mKey,
        dayKey: dKey,
        flaggedForAbuse: shouldFlag || quotaRow.flaggedForAbuse,
        updatedAt: new Date(),
      }).where(eq(usageQuotasTable.id, quotaRow.id));
      const [created] = await tx.insert(scanJobsTable).values({
        userId, status: "queued", progress: 0, currentStep: "Queued for scanning",
        threatsFound: 0, startedAt: new Date(),
      }).returning();
      if (!created) throw new QuotaTrackingError();
      if (designatedReviewer) {
        // Seed provenance lives on the immutable seed scan job. A threat-level
        // marker alone is not sufficient because older generated clones kept
        // isReviewerSeed=true. Only threats attached to a seed job are valid
        // sources; all other marked rows are legacy/generated output.
        const markedRows = await tx.select({
          threat: threatsTable,
          jobMetadata: scanJobsTable.metadataJson,
        }).from(threatsTable).leftJoin(
          scanJobsTable,
          eq(threatsTable.scanJobId, scanJobsTable.id),
        ).where(and(
          eq(threatsTable.userId, userId),
          sql`${threatsTable.detectedSignalsJson}::jsonb @> '{"isReviewerSeed":true}'::jsonb`,
        ));
        const seeded = markedRows
          .filter((row) => {
            try {
              const metadata = JSON.parse(row.jobMetadata ?? "{}") as Record<string, unknown>;
              return metadata.isReviewerSeed === true;
            } catch {
              return false;
            }
          })
          .map((row) => row.threat);
        const generatedIds = markedRows
          .filter((row) => !seeded.some((seed) => seed.id === row.threat.id))
          .map((row) => row.threat.id);
        // Reviewer fixture output is a stable snapshot, not an append-only
        // history. Replace prior generated clones so repeated legitimate
        // scans never grow the reviewer's alert count.
        await tx.delete(threatsTable).where(and(
          eq(threatsTable.userId, userId),
          sql`${threatsTable.detectedSignalsJson}::jsonb @> '{"isReviewerFixtureClone":true}'::jsonb`,
        ));
        if (generatedIds.length > 0) {
          await tx.delete(threatsTable).where(inArray(threatsTable.id, generatedIds));
        }
        // Keep immutable seed rows as durable provenance but remove them from
        // user-facing feeds once the first reviewer result is materialized.
        // The source rows remain queryable above on every later replacement.
        if (seeded.length > 0) {
          await tx.update(threatsTable)
            .set({ hiddenUntilScan: true })
            .where(inArray(threatsTable.id, seeded.map((seed) => seed.id)));
        }
        if (seeded.length) {
          await tx.insert(threatsTable).values(seeded.map(({ id: _id, createdAt: _createdAt, scanJobId: _oldJob, ...threat }) => {
            let detectedSignalsJson = threat.detectedSignalsJson;
            try {
              const signals = JSON.parse(detectedSignalsJson ?? "{}") as Record<string, unknown>;
              delete signals.isReviewerSeed;
              signals.isReviewerFixtureClone = true;
              detectedSignalsJson = JSON.stringify(signals);
            } catch {
              detectedSignalsJson = JSON.stringify({ isReviewerFixtureClone: true });
            }
            return {
              ...threat,
              detectedSignalsJson,
              hiddenUntilScan: false,
              scanJobId: created.id,
              createdAt: new Date(),
            };
          }));
        }
        const [reviewJob] = await tx.update(scanJobsTable).set({
          status: "completed", progress: 100, currentStep: "complete",
          completedAt: new Date(), threatsFound: seeded.length,
        }).where(eq(scanJobsTable.id, created.id)).returning();
        return {
          reviewer: reviewJob,
          quota: {
            allowed: true as const,
            remainingMonth: monthlyLimit === -1 ? undefined : Math.max(0, monthlyLimit - newScans),
            remainingDay: dailyLimit === -1 ? undefined : Math.max(0, dailyLimit - newDeep),
          },
        };
      }
      return {
        created,
        quota: {
          allowed: true as const,
          remainingMonth: monthlyLimit === -1 ? undefined : Math.max(0, monthlyLimit - newScans),
          remainingDay: dailyLimit === -1 || !isDeepScan ? undefined : Math.max(0, dailyLimit - newDeep),
        },
      };
    });
    if (reservation.active) {
      res.status(200).json(serializeJob(reservation.active));
      return;
    }
    const quota = reservation.quota;
    if (!quota?.allowed) {
      res.status(429).json({
        error: "scan_limit_reached",
        reason: quota?.reason,
        tier: planTier,
        upgradeTo: "premium",
        resetsAt: quota?.reason === "monthly_limit" && planTier === "free" ? nextMonthlyReset() : null,
        message: quota?.reason === "monthly_limit"
          ? `Your free scan for this month has been used. Your next free scan is available ${new Date(nextMonthlyReset()).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`
          : quota?.reason === "daily_deep_scan_limit"
            ? "You've used your deep scan for today. Upgrade to Premium for unlimited daily scans."
            : "Your account has been temporarily throttled due to unusual scan activity. Contact support.",
      });
      return;
    }
    if ("reviewer" in reservation && reservation.reviewer) {
      res.status(201).json({
        ...serializeJob(reservation.reviewer),
        quota: { tier: "premium", remainingMonth: quota.remainingMonth, remainingDay: quota.remainingDay },
      });
      return;
    }

    const job = await startScan(userId, planTier, { bypassCache, existingJob: reservation.created });
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
    const planTier = (await isDesignatedReviewer(userId))
      ? "premium"
      : normalizeTier(sub.tier ?? "free");
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
