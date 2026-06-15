import { Router, type IRouter } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db, threatsTable, threatActorsTable } from "@workspace/db";
import { recalculateScore } from "../services/scoreService";


const router: IRouter = Router();

function parseThreat(t: typeof threatsTable.$inferSelect) {
  const evidence = safeParseJson<unknown[]>(t.evidenceJson, []);
  const scoreBreakdown = safeParseJson<Record<string, number>>(
    t.scoreBreakdownJson,
    {}
  );
  const detectedSignals = safeParseJson<string[]>(t.detectedSignalsJson, []);

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
    detectedSignals,
    resolved: t.resolved,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}

function parseThreatSummary(t: typeof threatsTable.$inferSelect) {
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

  const conditions = [eq(threatsTable.userId, userId)];

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
    .limit(Math.min(parseInt(limit, 10), 100))
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

  res.json({ ...parseThreat(threat), ...(threatActor !== undefined ? { threatActor } : {}) });
});

router.patch("/threats/bulk-resolve", async (req, res): Promise<void> => {
  const userId = req.userId;
  const { ids } = req.body as { ids?: string[] };

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids array is required" });
    return;
  }

  await db
    .update(threatsTable)
    .set({ resolved: true, resolvedAt: new Date() })
    .where(and(eq(threatsTable.userId, userId), inArray(threatsTable.id, ids)));

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

  const { resolveAction } = req.body as { resolveAction?: string };

  const validActions = ["reported_to_platform", "approved", "false_positive", "resolved_manually"];
  const action = resolveAction && validActions.includes(resolveAction) ? resolveAction : null;

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

  recalculateScore(userId).catch((err) =>
    req.log.warn({ err }, "Score recalculation failed after resolve")
  );

  res.json(parseThreat(updated));
});

export default router;
