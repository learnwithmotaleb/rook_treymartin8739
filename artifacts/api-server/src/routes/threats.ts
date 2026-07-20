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
      // Legacy format — plain string array
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

function parseThreat(t: typeof threatsTable.$inferSelect) {
  const evidence = safeParseJson<unknown[]>(t.evidenceJson, []);
  const scoreBreakdown = safeParseJson<Record<string, number>>(
    t.scoreBreakdownJson,
    {}
  );
  const signals = parseSignals(t.detectedSignalsJson);

  return {
    id: t.id,
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
    detectedSignals: signals.flags,
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
  const highConfidence =
    signals.flags.includes("firstScanHighConfidence") ||
    signals.flags.includes("sharedThreatActor");
  return {
    id: t.id,
    type: t.type,
    severity: t.severity,
    platform: t.platform,
    title: t.title,
    description: t.description,
    threatScore: t.threatScore,
    matchedMediaCount: t.matchedMediaCount,
    suspiciousUsername: t.suspiciousUsername,
    resolved: t.resolved,
    resolveAction: t.resolveAction ?? null,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    highConfidence,
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

router.get("/threats", async (req, res): Promise<void> => {
  const userId = req.userId;

  const { severity, resolved, limit = "50", offset = "0" } = req.query as {
    severity?: string;
    resolved?: string;
    limit?: string;
    offset?: string;
  };

  const conditions = [
    eq(threatsTable.userId, userId),
    // Never surface threats that are pending confirmation from a second scan
    eq(threatsTable.hiddenUntilScan, false),
  ];

  if (severity && ["high", "medium", "low"].includes(severity)) {
    conditions.push(eq(threatsTable.severity, severity));
  }

  if (resolved !== undefined) {
    conditions.push(eq(threatsTable.resolved, resolved === "true"));
  }

  const rows = await db
    .select()
    .from(threatsTable)
    .where(and(...conditions))
    .orderBy(desc(threatsTable.createdAt))
    .limit(Math.min(parseInt(limit, 10), 200))
    .offset(Math.max(parseInt(offset, 10), 0));

  res.json(rows.map(parseThreatSummary));
});

router.get("/threats/:threatId", async (req, res): Promise<void> => {
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

  // Gate full evidence behind Premium — free users see only metadata
  const sub = await getSubscription(userId);
  const tier = normalizeTier(sub.tier ?? "free");
  const isFree = tier === "free";

  if (isFree) {
    const signals = parseSignals(threat.detectedSignalsJson);
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
      scoreBreakdown: {},
      detectedSignals: signals.flags,
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

  res.json({ ...parseThreat(threat), isLocked: false, ...(threatActor !== undefined ? { threatActor } : {}) });
});

const BulkResolveBody = z.object({ ids: z.array(z.string()).min(1) });
const ResolveBody = z.object({
  resolveAction: z.enum(["reported_to_platform", "approved", "false_positive", "resolved_manually"]).optional(),
});

router.patch("/threats/bulk-resolve", async (req, res): Promise<void> => {
  const userId = req.userId;

  const parsed = BulkResolveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ids must be a non-empty array of strings" });
    return;
  }
  const { ids } = parsed.data;

  // Fetch platform+username before updating so we can write to suppression table
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

  // Permanently suppress all resolved accounts so they never resurface in scans
  const accountPairs = threatsToResolve.filter((t) => t.platform && t.suspiciousUsername);
  const suppressions = accountPairs.map((t) => ({
    userId,
    platform: t.platform!,
    username: normalizeSuppressUsername(t.suspiciousUsername),
  }));
  if (suppressions.length > 0) {
    await db.insert(suppressedAccountsTable).values(suppressions).onConflictDoNothing();
  }

  // Cascade: resolve any duplicate unresolved threats for the same accounts
  // (handles race condition where a concurrent scan inserted duplicates)
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
});

router.patch("/threats/:threatId/resolve", async (req, res): Promise<void> => {
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

  // Map resolve action to a pHash feedback outcome so the learning system
  // can adjust this user's detection threshold over time.
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

  // Permanently suppress this account so it never resurfaces in future scans
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

    // Cascade: resolve any duplicate unresolved threats for the same account
    // (handles race condition where a concurrent scan inserted duplicates)
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
});

export default router;
