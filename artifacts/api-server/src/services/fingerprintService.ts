/**
 * Identity Fingerprint Service
 *
 * Manages the visual identity fingerprint for a user's connected accounts.
 *
 * The fingerprint aggregates:
 * - Total media items indexed across all connected accounts
 * - Caption/text content indexed
 * - Reel/video thumbnails indexed
 * - Style embeddings (when available)
 *
 * In production, this also manages:
 * - Vector embeddings for each media item (via CLIP or similar CV model)
 * - Perceptual hash signatures for fast duplicate detection
 * - Style/aesthetic embeddings for soft impersonation detection
 *
 * For now, embedding generation is marked as a stub to be wired to a
 * real CV service (e.g., OpenAI Vision, Replicate CLIP, or self-hosted).
 */

import { eq } from "drizzle-orm";
import { db, visualFingerprintsTable, connectedAccountsTable } from "@workspace/db";
import { logger } from "../lib/logger";

export interface FingerprintStats {
  totalPhotosIndexed: number;
  totalCaptionsIndexed: number;
  reelsIndexed: number;
  monitoredAccounts: number;
  lastUpdated: string | null;
  platforms: string[];
}

export async function getFingerprintForUser(
  userId: string
): Promise<FingerprintStats> {
  const [fingerprint] = await db
    .select()
    .from(visualFingerprintsTable)
    .where(eq(visualFingerprintsTable.userId, userId));

  const accounts = await db
    .select()
    .from(connectedAccountsTable)
    .where(eq(connectedAccountsTable.userId, userId));

  const platforms = accounts.map((a) => a.platform);

  if (!fingerprint) {
    const totalPhotos = accounts.reduce((sum, a) => sum + a.photosIndexed, 0);
    const totalCaptions = accounts.reduce(
      (sum, a) => sum + a.captionsIndexed,
      0
    );
    const totalReels = accounts.reduce((sum, a) => sum + a.reelsIndexed, 0);

    return {
      totalPhotosIndexed: totalPhotos,
      totalCaptionsIndexed: totalCaptions,
      reelsIndexed: totalReels,
      monitoredAccounts: accounts.length,
      lastUpdated: null,
      platforms,
    };
  }

  return {
    totalPhotosIndexed: fingerprint.totalPhotosIndexed,
    totalCaptionsIndexed: fingerprint.totalCaptionsIndexed,
    reelsIndexed: fingerprint.reelsIndexed,
    monitoredAccounts: accounts.length,
    lastUpdated: fingerprint.lastUpdated.toISOString(),
    platforms,
  };
}

export async function updateFingerprint(
  userId: string,
  stats: {
    totalPhotosIndexed: number;
    totalCaptionsIndexed: number;
    reelsIndexed: number;
  }
): Promise<void> {
  const [existing] = await db
    .select({ id: visualFingerprintsTable.id })
    .from(visualFingerprintsTable)
    .where(eq(visualFingerprintsTable.userId, userId));

  if (existing) {
    await db
      .update(visualFingerprintsTable)
      .set({ ...stats, lastUpdated: new Date() })
      .where(eq(visualFingerprintsTable.userId, userId));
  } else {
    await db.insert(visualFingerprintsTable).values({
      userId,
      ...stats,
      lastUpdated: new Date(),
    });
  }

  logger.info({ userId, stats }, "Updated identity fingerprint");
}

/**
 * Stub: Generate a perceptual embedding for a media item.
 *
 * In production, wire this to:
 * - OpenAI Vision API for image description/embedding
 * - CLIP model (via Replicate or self-hosted) for image vectors
 * - A perceptual hash library (pHash/dHash) for fast deduplication
 *
 * The embedding is stored as JSON in media_items.embedding_vector.
 */
export async function generateMediaEmbedding(
  _imageUrl: string
): Promise<number[]> {
  // TODO: Replace with real CLIP or Vision API embedding
  // Example with OpenAI Vision:
  //   const response = await openai.chat.completions.create({
  //     model: "gpt-5.4",
  //     messages: [{ role: "user", content: [
  //       { type: "image_url", image_url: { url: imageUrl } },
  //       { type: "text", text: "Describe key visual features for identity matching." }
  //     ]}]
  //   });
  //   return hashTextToVector(response.choices[0].message.content);

  return [];
}

/**
 * Stub: Compare two embeddings for cosine similarity.
 * Returns a value between 0 (no similarity) and 1 (identical).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  const dot = a.reduce((sum, ai, i) => sum + ai * (b[i] ?? 0), 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}
