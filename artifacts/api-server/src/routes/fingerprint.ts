import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { getFingerprintForUser } from "../services/fingerprintService";
import { countSimilarIdentities } from "../services/vectorSearchService";
import { db, identityEmbeddingsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const SimilarBody = z.object({ mediaItemId: z.string().min(1) });

const router: IRouter = Router();

router.get("/fingerprint", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const fingerprint = await getFingerprintForUser(userId);

    res.json({
      totalPhotosIndexed: fingerprint.totalPhotosIndexed,
      totalCaptionsIndexed: fingerprint.totalCaptionsIndexed,
      reelsIndexed: fingerprint.reelsIndexed,
      monitoredAccounts: fingerprint.monitoredAccounts,
      lastUpdated: fingerprint.lastUpdated,
      platforms: fingerprint.platforms,
    });
  } catch (err) {
    req.log.error({ err }, "GET /fingerprint failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/fingerprint/similar
 * Internal endpoint: given a mediaItemId or raw embedding, find how many
 * other users have visually similar identity embeddings.
 * Returns only aggregate counts — never other users' PII.
 */
router.post("/fingerprint/similar", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const bodyParsed = SimilarBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: "mediaItemId is required and must be a non-empty string", details: bodyParsed.error.flatten() });
      return;
    }
    const { mediaItemId } = bodyParsed.data;

    const [row] = await db
      .select({ embeddingJson: identityEmbeddingsTable.embeddingJson, userId: identityEmbeddingsTable.userId })
      .from(identityEmbeddingsTable)
      .where(eq(identityEmbeddingsTable.id, mediaItemId));

    if (!row) {
      res.status(404).json({ error: "Embedding not found" });
      return;
    }

    if (row.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    let embedding: number[];
    try {
      embedding = JSON.parse(row.embeddingJson) as number[];
    } catch {
      res.status(422).json({ error: "Invalid embedding data" });
      return;
    }

    const { matchCount, topSimilarity } = await countSimilarIdentities(embedding, userId);

    res.json({ matchCount, topSimilarity: Math.round(topSimilarity * 100) / 100 });
  } catch (err) {
    logger.error({ err }, "POST /fingerprint/similar failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
