/**
 * Intelligence API
 *
 * Exposes the cross-user threat intelligence graph to authenticated users.
 * All data is anonymised — no individual victim usernames or photo URLs are
 * returned. Designed for enterprise customers and security analysts who need
 * platform-wide threat landscape visibility.
 *
 * Endpoints:
 *   GET /intelligence/stats          — aggregate platform stats
 *   GET /intelligence/actors         — paginated threat actor database
 *   GET /intelligence/actors/:id     — single actor with cluster details
 */

import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, threatActorsTable, threatsTable } from "@workspace/db";
import {
  getIntelligenceStats,
  parseHashCluster,
  parseStringArray,
} from "../services/phashIntelligenceService";

const router: IRouter = Router();

// ─── Platform-wide stats ──────────────────────────────────────────────────────

router.get("/intelligence/stats", async (_req, res): Promise<void> => {
  const stats = await getIntelligenceStats();
  res.json(stats);
});

// ─── Threat actor database ────────────────────────────────────────────────────

router.get("/intelligence/actors", async (req, res): Promise<void> => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10)));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10));
  const minVictims = Math.max(1, parseInt(String(req.query.min_victims ?? "1"), 10));
  const platform = typeof req.query.platform === "string" ? req.query.platform.toLowerCase() : null;
  const minClusterSize = Math.max(0, parseInt(String(req.query.min_cluster_size ?? "0"), 10));

  const rows = await db
    .select()
    .from(threatActorsTable)
    .orderBy(desc(threatActorsTable.confidenceScore))
    .limit(limit + offset) // over-fetch so we can apply in-memory filters
    .offset(0);

  const actors = rows
    .filter((a) => a.victimCount >= minVictims)
    .filter((a) => {
      if (!platform) return true;
      return parseStringArray(a.platformSetJson).includes(platform);
    })
    .filter((a) => {
      if (minClusterSize === 0) return true;
      return parseHashCluster(a.pHashClusterJson).length >= minClusterSize;
    })
    .slice(offset, offset + limit)
    .map((a) => ({
      id: a.id,
      canonicalUsername: a.canonicalUsername,
      victimCount: a.victimCount,
      confidenceScore: a.confidenceScore,
      platforms: parseStringArray(a.platformSetJson),
      hashClusterSize: parseHashCluster(a.pHashClusterJson).length,
      firstSeen: a.firstSeen.toISOString(),
      lastSeen: a.lastSeen.toISOString(),
    }));

  res.json({ actors, total: actors.length, limit, offset });
});

router.get("/intelligence/actors/:actorId", async (req, res): Promise<void> => {
  const actorId = Array.isArray(req.params.actorId)
    ? req.params.actorId[0]
    : req.params.actorId;

  const [actor] = await db
    .select()
    .from(threatActorsTable)
    .where(eq(threatActorsTable.id, actorId!));

  if (!actor) {
    res.status(404).json({ error: "Actor not found" });
    return;
  }

  const activeThreats = await db
    .select({ id: threatsTable.id })
    .from(threatsTable)
    .where(
      and(
        eq(threatsTable.threatActorId, actorId!),
        eq(threatsTable.resolved, false)
      )
    );

  const cluster = parseHashCluster(actor.pHashClusterJson);

  res.json({
    id: actor.id,
    canonicalUsername: actor.canonicalUsername,
    victimCount: actor.victimCount,
    confidenceScore: actor.confidenceScore,
    platforms: parseStringArray(actor.platformSetJson),
    hashClusterSize: cluster.length,
    activeThreats: activeThreats.length,
    firstSeen: actor.firstSeen.toISOString(),
    lastSeen: actor.lastSeen.toISOString(),
  });
});

export default router;
