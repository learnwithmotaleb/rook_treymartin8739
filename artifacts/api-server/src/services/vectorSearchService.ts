/**
 * Vector Search Service
 *
 * Cross-user identity embedding similarity queries.
 *
 * Embeddings are stored as JSON text arrays in identity_embeddings.
 * Similarity is computed in-memory using cosine distance.
 * This is designed for future migration to pgvector HNSW index —
 * the query interface will remain identical after that upgrade.
 *
 * Zero new external API calls. Embeddings are written by fingerprintService
 * during the existing scan pipeline.
 */

import { eq, ne } from "drizzle-orm";
import { db, identityEmbeddingsTable } from "@workspace/db";
import { logger } from "../lib/logger";

export interface SimilarIdentityResult {
  userId: string;
  imageUrl: string;
  similarity: number;
}

// ─── Cosine similarity ────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    magA += (a[i] ?? 0) ** 2;
    magB += (b[i] ?? 0) ** 2;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ─── Write path ───────────────────────────────────────────────────────────────

/**
 * Upsert an embedding for a (userId, imageUrl) pair.
 * Called by fingerprintService after generating an embedding.
 * Silently skips on error — embedding storage is non-fatal.
 */
export async function upsertIdentityEmbedding(
  userId: string,
  imageUrl: string,
  embedding: number[]
): Promise<void> {
  try {
    // Load all rows for this user and find the one matching imageUrl in Node.js
    // (avoids needing a composite unique index for now)
    const userRows = await db
      .select({ id: identityEmbeddingsTable.id, imageUrl: identityEmbeddingsTable.imageUrl })
      .from(identityEmbeddingsTable)
      .where(eq(identityEmbeddingsTable.userId, userId));

    const existing = userRows.find((r) => r.imageUrl === imageUrl);

    if (existing) {
      await db
        .update(identityEmbeddingsTable)
        .set({
          embeddingJson: JSON.stringify(embedding),
          updatedAt: new Date(),
        })
        .where(eq(identityEmbeddingsTable.id, existing.id));
    } else {
      await db
        .insert(identityEmbeddingsTable)
        .values({ userId, imageUrl, embeddingJson: JSON.stringify(embedding) });
    }
  } catch (err) {
    logger.warn({ err, userId, imageUrl: imageUrl.slice(0, 80) }, "Failed to upsert identity embedding");
  }
}

// ─── Query path ───────────────────────────────────────────────────────────────

/**
 * Find the top-K most similar identity embeddings across all users,
 * excluding the querying user's own embeddings.
 *
 * Returns results sorted by similarity descending.
 * Capped at 2000 rows loaded in-memory — sufficient up to ~500 active users
 * with 4 embeddings each. At larger scale, replace with pgvector ANN index.
 */
export async function findSimilarIdentities(
  embedding: number[],
  topK: number,
  excludeUserId: string
): Promise<SimilarIdentityResult[]> {
  try {
    const rows = await db
      .select({
        userId: identityEmbeddingsTable.userId,
        imageUrl: identityEmbeddingsTable.imageUrl,
        embeddingJson: identityEmbeddingsTable.embeddingJson,
      })
      .from(identityEmbeddingsTable)
      .where(ne(identityEmbeddingsTable.userId, excludeUserId))
      .limit(2000);

    const results: SimilarIdentityResult[] = [];

    for (const row of rows) {
      try {
        const storedVector = JSON.parse(row.embeddingJson) as number[];
        const similarity = cosineSimilarity(embedding, storedVector);
        results.push({ userId: row.userId, imageUrl: row.imageUrl, similarity });
      } catch {
        // skip malformed rows
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  } catch (err) {
    logger.warn({ err }, "Cross-user similarity query failed");
    return [];
  }
}

/**
 * Count how many users have embeddings similar to the given vector above a threshold.
 * Returns only the aggregate — no other users' PII exposed.
 */
export async function countSimilarIdentities(
  embedding: number[],
  excludeUserId: string,
  threshold = 0.88
): Promise<{ matchCount: number; topSimilarity: number }> {
  const results = await findSimilarIdentities(embedding, 50, excludeUserId);
  const matches = results.filter((r) => r.similarity >= threshold);
  return {
    matchCount: matches.length,
    topSimilarity: results[0]?.similarity ?? 0,
  };
}
