/**
 * Identity Fingerprint Service
 *
 * Manages the visual identity fingerprint for a user's connected accounts.
 *
 * Fingerprint layers (most → least accurate):
 *   1. dHash (perceptual hash) — catches exact/near-exact copies fast
 *   2. AI embeddings — catches cropped, filtered, re-uploaded versions
 *
 * Embedding strategy:
 *   - Describe each photo via GPT-4o vision (identity-focused, not FR)
 *   - Embed the description with text-embedding-3-small (1536 dims)
 *   - Store vectors in visual_fingerprints.color_palette_json
 *   - Compare candidate photos the same way → cosine similarity
 */

import { eq } from "drizzle-orm";
import { db, visualFingerprintsTable, connectedAccountsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

export interface FingerprintStats {
  totalPhotosIndexed: number;
  totalCaptionsIndexed: number;
  reelsIndexed: number;
  monitoredAccounts: number;
  lastUpdated: string | null;
  platforms: string[];
}

interface StoredEmbedding {
  url: string;
  vector: number[];
}

interface EmbeddingStore {
  embeddings: StoredEmbedding[];
  generatedAt: string;
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

// ─── AI Embedding Helpers ─────────────────────────────────────────────────────

const VISION_PROMPT = `Describe the visual identity features of this photo for impersonation detection purposes.
Focus ONLY on: overall composition (portrait/landscape/outdoor/indoor), dominant colors, 
clothing style and colors, hair color and style, background setting, distinctive objects or accessories.
Do NOT identify or name any person. Keep the description under 100 words.
Return only the description text, nothing else.`;

/**
 * Describe a single photo using GPT-4o vision and return the description string.
 * Returns null on failure.
 */
async function describePhoto(imageUrl: string): Promise<string | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
            { type: "text", text: VISION_PROMPT },
          ],
        },
      ],
    });
    const text = response.choices[0]?.message?.content?.trim();
    return text ?? null;
  } catch (err) {
    logger.warn({ err, imageUrl: imageUrl.slice(0, 80) }, "Photo description failed");
    return null;
  }
}

/**
 * Embed a text description using text-embedding-3-small.
 * Returns null on failure.
 */
async function embedText(text: string): Promise<number[] | null> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0]?.embedding ?? null;
  } catch (err) {
    logger.warn({ err }, "Text embedding failed");
    return null;
  }
}

/**
 * Generate an embedding vector for a single image URL.
 * Describes the photo with GPT-4o, then embeds the description.
 * Returns null if either step fails.
 */
export async function generateMediaEmbedding(
  imageUrl: string
): Promise<number[] | null> {
  const description = await describePhoto(imageUrl);
  if (!description) return null;
  return embedText(description);
}

/**
 * Compute cosine similarity between two embedding vectors.
 * Returns 0 if either vector is empty or they have different lengths.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  const dot = a.reduce((sum, ai, i) => sum + ai * (b[i] ?? 0), 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

// ─── Batch embedding for user photos ─────────────────────────────────────────

/**
 * Generate and persist AI embedding vectors for a user's photo URLs.
 * Processes up to `limit` photos (default 20) to stay within cost/time budget.
 * Skips URLs that already have a stored embedding.
 *
 * Embeddings are stored as JSON in visual_fingerprints.color_palette_json.
 */
export async function buildUserPhotoEmbeddings(
  userId: string,
  photoUrls: string[],
  limit = 20
): Promise<void> {
  if (photoUrls.length === 0) return;

  const [fingerprint] = await db
    .select({ id: visualFingerprintsTable.id, colorPaletteJson: visualFingerprintsTable.colorPaletteJson })
    .from(visualFingerprintsTable)
    .where(eq(visualFingerprintsTable.userId, userId));

  // Load existing stored embeddings
  let store: EmbeddingStore = { embeddings: [], generatedAt: new Date().toISOString() };
  if (fingerprint?.colorPaletteJson) {
    try {
      const parsed = JSON.parse(fingerprint.colorPaletteJson) as unknown;
      if (parsed && typeof parsed === "object" && "embeddings" in parsed) {
        store = parsed as EmbeddingStore;
      }
    } catch {
      // ignore malformed JSON — start fresh
    }
  }

  const storedUrls = new Set(store.embeddings.map((e) => e.url));
  const newUrls = photoUrls
    .filter(Boolean)
    .filter((url) => !storedUrls.has(url))
    .slice(0, limit);

  if (newUrls.length === 0) {
    logger.info({ userId }, "All user photo embeddings already stored — skipping");
    return;
  }

  logger.info({ userId, newUrls: newUrls.length }, "Generating AI embeddings for user photos");

  let generated = 0;
  for (const url of newUrls) {
    const vector = await generateMediaEmbedding(url);
    if (vector) {
      store.embeddings.push({ url, vector });
      generated++;
    }
    // Small delay to respect rate limits
    await new Promise<void>((r) => setTimeout(r, 200));
  }

  store.generatedAt = new Date().toISOString();

  // Persist back
  if (fingerprint) {
    await db
      .update(visualFingerprintsTable)
      .set({ colorPaletteJson: JSON.stringify(store) })
      .where(eq(visualFingerprintsTable.userId, userId));
  } else {
    await db.insert(visualFingerprintsTable).values({
      userId,
      totalPhotosIndexed: 0,
      totalCaptionsIndexed: 0,
      reelsIndexed: 0,
      colorPaletteJson: JSON.stringify(store),
    });
  }

  logger.info(
    { userId, generated, total: store.embeddings.length },
    "User photo embeddings stored"
  );
}

/**
 * Load stored embedding vectors for a user.
 */
export async function loadUserEmbeddings(userId: string): Promise<StoredEmbedding[]> {
  const [fingerprint] = await db
    .select({ colorPaletteJson: visualFingerprintsTable.colorPaletteJson })
    .from(visualFingerprintsTable)
    .where(eq(visualFingerprintsTable.userId, userId));

  if (!fingerprint?.colorPaletteJson) return [];

  try {
    const parsed = JSON.parse(fingerprint.colorPaletteJson) as unknown;
    if (parsed && typeof parsed === "object" && "embeddings" in parsed) {
      return (parsed as EmbeddingStore).embeddings;
    }
  } catch {
    // ignore
  }
  return [];
}

// ─── Candidate photo comparison ───────────────────────────────────────────────

export interface EmbeddingSimilarityResult {
  similarity: number;
  matched: boolean;
  matchThreshold: number;
}

/**
 * Compare a candidate profile image against the user's stored embedding vectors.
 * Generates an embedding for the candidate on the fly.
 *
 * Returns null if the candidate image can't be processed.
 */
export async function comparePhotoWithEmbeddings(
  candidateImageUrl: string,
  userEmbeddings: StoredEmbedding[],
  matchThreshold = 0.82
): Promise<EmbeddingSimilarityResult | null> {
  if (userEmbeddings.length === 0) return null;

  const candidateVector = await generateMediaEmbedding(candidateImageUrl);
  if (!candidateVector) return null;

  let bestSimilarity = 0;
  for (const stored of userEmbeddings) {
    const sim = cosineSimilarity(candidateVector, stored.vector);
    if (sim > bestSimilarity) bestSimilarity = sim;
  }

  return {
    similarity: bestSimilarity,
    matched: bestSimilarity >= matchThreshold,
    matchThreshold,
  };
}
