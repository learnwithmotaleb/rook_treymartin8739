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
import { z } from "zod";
import { eq, desc, and, gte } from "drizzle-orm";
import { db, threatActorsTable, threatsTable } from "@workspace/db";
import {
  getIntelligenceStats,
  parseHashCluster,
  parseStringArray,
} from "../services/phashIntelligenceService";
import { logger } from "../lib/logger";

const ActorsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  min_victims: z.coerce.number().int().min(1).default(1),
  platform: z.string().toLowerCase().optional(),
  min_cluster_size: z.coerce.number().int().min(0).default(0),
});

const router: IRouter = Router();

// ─── Platform-wide stats ──────────────────────────────────────────────────────

router.get("/intelligence/stats", async (_req, res): Promise<void> => {
  try {
    const stats = await getIntelligenceStats();
    res.json(stats);
  } catch (err) {
    logger.error({ err }, "GET /intelligence/stats failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Threat actor database ────────────────────────────────────────────────────

router.get("/intelligence/actors", async (req, res): Promise<void> => {
  try {
    const parsed = ActorsQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
      return;
    }
    const { limit, offset, min_victims: minVictims, platform: rawPlatform, min_cluster_size: minClusterSize } = parsed.data;
    const platform = rawPlatform ?? null;

    // Push minVictims filter to SQL; platform and minClusterSize require JSON
    // parsing so they are applied in-memory after fetching.
    const needsInMemoryFilter = platform !== null || minClusterSize > 0;

    let rows;
    if (needsInMemoryFilter) {
      // Over-fetch to account for in-memory filters that may exclude rows.
      // Cap at a reasonable ceiling to avoid unbounded scans.
      const fetchLimit = Math.min(limit * 5 + offset, 500);
      rows = await db
        .select()
        .from(threatActorsTable)
        .where(gte(threatActorsTable.victimCount, minVictims))
        .orderBy(desc(threatActorsTable.confidenceScore))
        .limit(fetchLimit)
        .offset(0);
    } else {
      rows = await db
        .select()
        .from(threatActorsTable)
        .where(gte(threatActorsTable.victimCount, minVictims))
        .orderBy(desc(threatActorsTable.confidenceScore))
        .limit(limit)
        .offset(offset);
    }

    let actors = rows;

    if (platform !== null) {
      actors = actors.filter((a) =>
        parseStringArray(a.platformSetJson).includes(platform)
      );
    }

    if (minClusterSize > 0) {
      actors = actors.filter((a) =>
        parseHashCluster(a.pHashClusterJson).length >= minClusterSize
      );
    }

    const page = needsInMemoryFilter
      ? actors.slice(offset, offset + limit)
      : actors;

    const mapped = page.map((a) => ({
      id: a.id,
      canonicalUsername: a.canonicalUsername,
      victimCount: a.victimCount,
      confidenceScore: a.confidenceScore,
      platforms: parseStringArray(a.platformSetJson),
      hashClusterSize: parseHashCluster(a.pHashClusterJson).length,
      firstSeen: a.firstSeen.toISOString(),
      lastSeen: a.lastSeen.toISOString(),
    }));

    res.json({ actors: mapped, total: mapped.length, limit, offset });
  } catch (err) {
    logger.error({ err }, "GET /intelligence/actors failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/intelligence/actors/:actorId", async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    logger.error({ err }, "GET /intelligence/actors/:actorId failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
