import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, desc, inArray, ne } from "drizzle-orm";
import { db, threatsTable, threatActorsTable, suppressedAccountsTable } from "@workspace/db";
import { recalculateScore } from "../services/scoreService";
import { normalizeSuppressUsername } from "../services/scanOrchestrator";
import {
  recordPhashFeedback,
  type FeedbackOutcome,
} from "../services/phashIntelligenceService";
import { getSubscription } from "../services/subscriptionService";
import { normalizeTier } from "../lib/planConfig";
import { reviewerPhotoEvidenceForResponse } from "../services/reviewerPhotoFixture";


const router: IRouter = Router();

/**
 * Handles both the legacy string-array format and the current structured format
 * for detectedSignalsJson.
 *
 * Legacy format:  string[]  (stored before structured-key migration)
 * Current format: { flags: string[], confirmedVictims?: number,
 *                   crossUserEscalation?: boolean, postDatingDays?: number }
 */
interface StructuredSignals {
  flags: string[];
  confirmedVictims?: number;
  crossUserEscalation?: boolean;
  postDatingDays?: number;
}

function parseSignals(raw: string | null): StructuredSignals {
  if (!raw) return { flags: [] };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { flags: parsed as string[] };
    }
    if (typeof parsed === "object" && parsed !== null && Array.isArray(parsed.flags)) {
      return parsed as StructuredSignals;
    }
    return { flags: [] };
  } catch {
    return { flags: [] };
  }
}

function isSampleThreat(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const signals = JSON.parse(raw) as Record<string, unknown>;
    return signals.isReviewerSeed === true || signals.isReviewerFixtureClone === true;
  } catch {
    return false;
  }
}

interface AccountMeta {
  followers: number;
  following?: number;
  totalPosts?: number;
  accountAgeDays?: number;
  engagementRate?: number;
}

function parseThreat(t: typeof threatsTable.$inferSelect) {
  const evidence = safeParseJson<unknown[]>(t.evidenceJson, []);

  // Parse scoreBreakdownJson as an open object to extract optional accountMeta
  // (stored alongside the numeric breakdown fields since Phase 11).
  const breakdownRaw = safeParseJson<Record<string, unknown>>(t.scoreBreakdownJson, {});
  const { accountMeta: accountMetaRaw, ...scoreBreakdownFields } = breakdownRaw;
  const scoreBreakdown = scoreBreakdownFields as Record<string, number>;
  const accountMeta = (accountMetaRaw as AccountMeta | undefined) ?? null;

  const signals = parseSignals(t.detectedSignalsJson);

  return {
    id: t.id,
    scanJobId: t.scanJobId,
    type: t.type,
    severity: t.severity,
    platform: t.platform,
    title: t.title,
    description: t.description,
    details: t.details,
    aiExplanation: t.aiExplanation,
    threatScore: t.threatScore,
    suspiciousUsername: t.suspiciousUsername,
    matchedMediaCount: t.matchedMediaCount,
    evidence,
    scoreBreakdown,
    /** Impersonator account quality data (followers, posts, age) stored at scan time. */
    accountMeta,
    detectedSignals: signals.flags,
    isSample: isSampleThreat(t.detectedSignalsJson),
    confirmedVictims: signals.confirmedVictims ?? null,
    crossUserEscalation: signals.crossUserEscalation ?? false,
    postDatingDays: signals.postDatingDays ?? null,
    resolved: t.resolved,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}

function parseThreatSummary(t: typeof threatsTable.$inferSelect) {
  const signals = parseSignals(t.detectedSignalsJson);
  const evidenceCount = safeParseJson<unknown[]>(t.evidenceJson, []).length;
  const highConfidence =
    signals.flags.includes("firstScanHighConfidence") ||
    signals.flags.includes("sharedThreatActor");
  return {
    id: t.id,
    scanJobId: t.scanJobId,
    type: t.type,
    severity: t.severity,
    platform: t.platform,
    title: t.title,
    description: t.description,
    threatScore: t.threatScore,
    matchedMediaCount: t.matchedMediaCount,
    evidenceCount,
    suspiciousUsername: t.suspiciousUsername,
    resolved: t.resolved,
    resolveAction: t.resolveAction ?? null,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    highConfidence,
    isSample: isSampleThreat(t.detectedSignalsJson),
    createdAt: t.createdAt.toISOString(),
  };
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const ThreatsQuery = z.object({
  severity: z.enum(["high", "medium", "low"]).optional(),
  resolved: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get("/threats", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;

    const parsed = ThreatsQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
      return;
    }
    const { severity, resolved, limit, offset } = parsed.data;

    const conditions = [
      eq(threatsTable.userId, userId),
      eq(threatsTable.hiddenUntilScan, false),
    ];

    if (severity) conditions.push(eq(threatsTable.severity, severity));
    if (resolved !== undefined) conditions.push(eq(threatsTable.resolved, resolved === "true"));

    const rows = await db
      .select()
      .from(threatsTable)
      .where(and(...conditions))
      .orderBy(desc(threatsTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(rows.map(parseThreatSummary));
  } catch (err) {
    req.log.error({ err }, "GET /threats failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/threats/:threatId", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const threatId = Array.isArray(req.params.threatId)
      ? req.params.threatId[0]
      : req.params.threatId;

    const [threat] = await db
      .select()
      .from(threatsTable)
      .where(
        and(eq(threatsTable.id, threatId), eq(threatsTable.userId, userId))
      );

    if (!threat) {
      res.status(404).json({ error: "Threat not found" });
      return;
    }

    // Normalize explicitly marked reviewer examples in the response only.
    // The persisted row and all history remain untouched on GET.
    const detailThreat = {
      ...threat,
      ...reviewerPhotoEvidenceForResponse(
        threat.evidenceJson,
        threat.detectedSignalsJson,
      ),
    };

    // Gate full evidence behind Premium — free users see only metadata
    const sub = await getSubscription(userId);
    const tier = normalizeTier(sub.tier ?? "free");
    // Free reviewers may inspect marked examples, not unrelated live evidence.
    // A reviewer designation must not silently grant paid access to real alerts.
    const isFree = tier === "free" && !isSampleThreat(threat.detectedSignalsJson);

    if (isFree) {
      const signals = parseSignals(threat.detectedSignalsJson);
      const evidenceCount = safeParseJson<unknown[]>(threat.evidenceJson, []).length;
      res.json({
        id: threat.id,
        type: threat.type,
        severity: threat.severity,
        platform: threat.platform,
        title: threat.title,
        description: null,
        details: null,
        aiExplanation: null,
        threatScore: threat.threatScore,
        suspiciousUsername: threat.suspiciousUsername,
        matchedMediaCount: threat.matchedMediaCount,
        evidence: [],
        evidenceCount,
        confidence: threat.threatScore,
        nextStep: threat.platform
          ? `Report or block this account through ${threat.platform}'s official safety tools.`
          : "Review the affected account and secure it if you do not recognize the activity.",
        scoreBreakdown: {},
        detectedSignals: signals.flags,
        isSample: isSampleThreat(threat.detectedSignalsJson),
        confirmedVictims: signals.confirmedVictims ?? null,
        crossUserEscalation: signals.crossUserEscalation ?? false,
        postDatingDays: signals.postDatingDays ?? null,
        resolved: threat.resolved,
        resolvedAt: threat.resolvedAt?.toISOString() ?? null,
        createdAt: threat.createdAt.toISOString(),
        isLocked: true,
      });
      return;
    }

    // Enrich with shared threat actor intelligence (if linked)
    let threatActor = undefined;
    if (threat.threatActorId) {
      const [actor] = await db
        .select()
        .from(threatActorsTable)
        .where(eq(threatActorsTable.id, threat.threatActorId));

      if (actor) {
        threatActor = {
          id: actor.id,
          victimCount: actor.victimCount,
          platformSpread: safeParseJson<string[]>(actor.platformSetJson, []),
          firstSeen: actor.firstSeen.toISOString(),
          lastSeen: actor.lastSeen.toISOString(),
          confidenceScore: actor.confidenceScore,
        };
      }
    }

    res.json({ ...parseThreat(detailThreat), isLocked: false, ...(threatActor !== undefined ? { threatActor } : {}) });
  } catch (err) {
    req.log.error({ err }, "GET /threats/:threatId failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

const BulkResolveBody = z.object({ ids: z.array(z.string()).min(1) });
const ResolveBody = z.object({
  resolveAction: z.enum(["reported_to_platform", "approved", "false_positive", "resolved_manually"]).optional(),
});

router.patch("/threats/bulk-resolve", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;

    const parsed = BulkResolveBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "ids must be a non-empty array of strings" });
      return;
    }
    const { ids } = parsed.data;

    const threatsToResolve = await db
      .select({
        platform: threatsTable.platform,
        suspiciousUsername: threatsTable.suspiciousUsername,
      })
      .from(threatsTable)
      .where(and(eq(threatsTable.userId, userId), inArray(threatsTable.id, ids)));

    await db
      .update(threatsTable)
      .set({ resolved: true, resolvedAt: new Date() })
      .where(and(eq(threatsTable.userId, userId), inArray(threatsTable.id, ids)));

    const accountPairs = threatsToResolve.filter((t) => t.platform && t.suspiciousUsername);
    const suppressions = accountPairs.map((t) => ({
      userId,
      platform: t.platform!,
      username: normalizeSuppressUsername(t.suspiciousUsername),
    }));
    if (suppressions.length > 0) {
      await db.insert(suppressedAccountsTable).values(suppressions).onConflictDoNothing();
    }

    for (const t of accountPairs) {
      await db
        .update(threatsTable)
        .set({ resolved: true, resolvedAt: new Date() })
        .where(
          and(
            eq(threatsTable.userId, userId),
            eq(threatsTable.platform, t.platform!),
            eq(threatsTable.suspiciousUsername, t.suspiciousUsername!),
            eq(threatsTable.resolved, false)
          )
        );
    }

    recalculateScore(userId).catch((err) =>
      req.log.warn({ err }, "Score recalculation failed after bulk resolve")
    );

    res.json({ resolved: ids.length });
  } catch (err) {
    req.log.error({ err }, "PATCH /threats/bulk-resolve failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/threats/:threatId/resolve", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const threatId = Array.isArray(req.params.threatId)
      ? req.params.threatId[0]
      : req.params.threatId;

    const parsedResolve = ResolveBody.safeParse(req.body);
    if (!parsedResolve.success) {
      res.status(400).json({ error: parsedResolve.error.issues[0]?.message ?? "Invalid resolveAction" });
      return;
    }
    const action = parsedResolve.data.resolveAction ?? null;

    const [updated] = await db
      .update(threatsTable)
      .set({
        resolved: true,
        resolvedAt: new Date(),
        ...(action ? { resolveAction: action } : {}),
      })
      .where(
        and(eq(threatsTable.id, threatId), eq(threatsTable.userId, userId))
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Threat not found" });
      return;
    }

    const feedbackOutcome: FeedbackOutcome =
      action === "false_positive" ? "false_positive"
      : action === "approved" ? "approved_contact"
      : action === "reported_to_platform" ? "true_positive"
      : "resolved_manually";

    recordPhashFeedback(
      userId,
      threatId,
      updated.impersonatorDHash ?? null,
      updated.suspiciousUsername ?? null,
      updated.platform ?? null,
      feedbackOutcome
    ).catch(() => {});

    if (updated.platform && updated.suspiciousUsername) {
      await db
        .insert(suppressedAccountsTable)
        .values({
          userId,
          platform: updated.platform,
          username: normalizeSuppressUsername(updated.suspiciousUsername),
          resolveAction: action ?? undefined,
        })
        .onConflictDoNothing();

      await db
        .update(threatsTable)
        .set({ resolved: true, resolvedAt: new Date() })
        .where(
          and(
            eq(threatsTable.userId, userId),
            eq(threatsTable.platform, updated.platform),
            eq(threatsTable.suspiciousUsername, updated.suspiciousUsername),
            eq(threatsTable.resolved, false),
            ne(threatsTable.id, threatId)
          )
        );
    }

    recalculateScore(userId).catch((err) =>
      req.log.warn({ err }, "Score recalculation failed after resolve")
    );

    res.json(parseThreat(updated));
  } catch (err) {
    req.log.error({ err }, "PATCH /threats/:threatId/resolve failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
