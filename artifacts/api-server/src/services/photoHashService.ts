/**
 * Photo Hash Service — Perceptual Image Fingerprinting
 *
 * Implements dHash (difference hash) for fast, robust detection of stolen
 * or reused profile photos across social platforms.
 *
 * Algorithm:
 *   1. Download image from URL
 *   2. Resize to 9×8 grayscale using sharp (no external API required)
 *   3. Compare adjacent pixels horizontally → 64-bit fingerprint
 *   4. Encode as 16-char hex string
 *
 * Hamming distance thresholds:
 *   0–4  : Near-identical (same photo, minor compression/resize differences)
 *   5–10 : Very similar (cropped, filtered, or lightly edited version)
 *   11–20: Some resemblance but likely different photos
 *   >20  : Different images
 *
 * Similarity score = max(0, 1 - hammingDistance / 64)
 * Threshold for "match" alert: similarity ≥ 0.85 (distance ≤ ~10)
 */

import sharp from "sharp";
import { logger } from "../lib/logger";

const DOWNLOAD_TIMEOUT_MS = 10_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface PhotoHashResult {
  similarity: number;
  hammingDistance: number;
  matched: boolean;
  /** The stored user hash that best matched the candidate. */
  matchedHash?: string;
  /** The candidate's own computed dHash — exposed so callers can reuse it. */
  candidateHash?: string;
}

/**
 * Download an image from a URL and compute its 64-bit dHash.
 * Returns null if the download fails or the image cannot be processed.
 */
export async function computeDHash(imageUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(imageUrl, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      logger.warn({ imageUrl, status: response.status }, "Image download failed");
      return null;
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_BYTES) {
      logger.warn({ imageUrl, contentLength }, "Image too large for hashing, skipping");
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Resize to 9×8 grayscale: 9 wide so we get 8 horizontal comparisons per row
    const { data } = await sharp(buffer)
      .resize(9, 8, { fit: "fill", kernel: "nearest" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Build 64-bit hash: for each of 8 rows, compare 8 adjacent pixel pairs
    let high = 0;
    let low = 0;

    for (let bit = 0; bit < 64; bit++) {
      const row = Math.floor(bit / 8);
      const col = bit % 8;
      const idx = row * 9 + col;
      const leftPixel = data[idx] ?? 0;
      const rightPixel = data[idx + 1] ?? 0;

      if (leftPixel > rightPixel) {
        if (bit < 32) {
          high |= 1 << bit;
        } else {
          low |= 1 << (bit - 32);
        }
      }
    }

    const highHex = (high >>> 0).toString(16).padStart(8, "0");
    const lowHex = (low >>> 0).toString(16).padStart(8, "0");
    return highHex + lowHex;
  } catch (err) {
    logger.warn({ err, imageUrl }, "dHash computation failed");
    return null;
  }
}

/**
 * Compute the Hamming distance between two 16-char hex hashes.
 * Returns 64 (maximum) if hashes are invalid or different lengths.
 */
export function hammingDistance(h1: string, h2: string): number {
  if (!h1 || !h2 || h1.length !== h2.length) return 64;

  let distance = 0;
  for (let i = 0; i < h1.length; i += 2) {
    const byte1 = parseInt(h1.slice(i, i + 2), 16);
    const byte2 = parseInt(h2.slice(i, i + 2), 16);
    let xor = byte1 ^ byte2;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/**
 * Convert Hamming distance to a 0–1 similarity score.
 */
export function hashSimilarity(h1: string, h2: string): number {
  const dist = hammingDistance(h1, h2);
  return Math.max(0, 1 - dist / 64);
}

/**
 * Compute dHash for a list of image URLs.
 * Processes up to `limit` items (default 50) to stay within scan time budget.
 * Returns an array of hex strings (nulls excluded).
 */
export async function computeHashesForUrls(
  imageUrls: string[],
  limit = 50
): Promise<string[]> {
  const hashes: string[] = [];
  const targets = imageUrls.filter(Boolean).slice(0, limit);

  for (const url of targets) {
    const hash = await computeDHash(url);
    if (hash) hashes.push(hash);
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }

  logger.info({ total: targets.length, hashed: hashes.length }, "Photo hashing complete");
  return hashes;
}

/**
 * Compare a single image URL (e.g. a suspected impersonator's profile picture)
 * against a set of stored user photo hashes.
 *
 * Returns the best (highest) similarity found across all stored hashes,
 * along with whether it crosses the match threshold.
 */
export async function compareImageToHashes(
  imageUrl: string,
  storedHashes: string[],
  matchThreshold = 0.84
): Promise<PhotoHashResult> {
  if (storedHashes.length === 0) {
    return { similarity: 0, hammingDistance: 64, matched: false };
  }

  const candidateHash = await computeDHash(imageUrl);
  if (!candidateHash) {
    return { similarity: 0, hammingDistance: 64, matched: false };
  }

  let bestSimilarity = 0;
  let bestDistance = 64;
  let bestHash: string | undefined;

  for (const storedHash of storedHashes) {
    const dist = hammingDistance(candidateHash, storedHash);
    const sim = Math.max(0, 1 - dist / 64);
    if (sim > bestSimilarity) {
      bestSimilarity = sim;
      bestDistance = dist;
      bestHash = storedHash;
    }
  }

  return {
    similarity: bestSimilarity,
    hammingDistance: bestDistance,
    matched: bestSimilarity >= matchThreshold,
    matchedHash: bestHash,
    candidateHash,
  };
}

/**
 * Compare a pre-computed dHash against a set of stored user photo hashes.
 * Use this when the candidate hash was already computed (avoids a second download).
 */
export function compareHashToHashes(
  candidateHash: string,
  storedHashes: string[],
  matchThreshold = 0.84
): PhotoHashResult {
  if (!candidateHash || storedHashes.length === 0) {
    return { similarity: 0, hammingDistance: 64, matched: false, candidateHash };
  }

  let bestSimilarity = 0;
  let bestDistance = 64;
  let bestHash: string | undefined;

  for (const storedHash of storedHashes) {
    const dist = hammingDistance(candidateHash, storedHash);
    const sim = Math.max(0, 1 - dist / 64);
    if (sim > bestSimilarity) {
      bestSimilarity = sim;
      bestDistance = dist;
      bestHash = storedHash;
    }
  }

  return {
    similarity: bestSimilarity,
    hammingDistance: bestDistance,
    matched: bestSimilarity >= matchThreshold,
    matchedHash: bestHash,
    candidateHash,
  };
}
