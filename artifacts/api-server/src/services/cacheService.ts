/**
 * Scan Cache Service
 *
 * Caches the list of discovered impersonator candidates keyed by a SHA-256
 * hash of the user's connected account fingerprints.  Cache TTL is 72 hours.
 *
 * If another user (or the same user) triggers a scan with identical connected
 * accounts within the cache window, the expensive external API calls are skipped
 * and the previously discovered candidates are returned immediately.
 */

import crypto from "crypto";
import { eq, and, gt } from "drizzle-orm";
import { db, scanCacheTable } from "@workspace/db";
import { logger } from "../lib/logger";

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours — short enough to re-scan same day

/**
 * Build a deterministic cache key from a list of username:platform pairs.
 * Sorts alphabetically so order does not matter.
 */
export function buildScanCacheKey(
  accounts: Array<{ username: string; platform: string }>
): string {
  const fingerprints = accounts
    .map((a) => `${a.username.toLowerCase()}:${a.platform.toLowerCase()}`)
    .sort()
    .join("|");
  return crypto.createHash("sha256").update(fingerprints).digest("hex").slice(0, 48);
}

/** Build a cache key for a single username+platform (used for per-profile dedup). */
export function buildProfileCacheKey(username: string, platform: string): string {
  return crypto
    .createHash("sha256")
    .update(`${username.toLowerCase()}:${platform.toLowerCase()}`)
    .digest("hex")
    .slice(0, 48);
}

export interface CachedScanResult<T = unknown> {
  data: T;
  cachedAt: string;
  expiresAt: string;
  hitCount: number;
}

/** Return a cached result if it exists and has not expired.  Returns null on miss. */
export async function getCached<T = unknown>(
  cacheKey: string
): Promise<CachedScanResult<T> | null> {
  try {
    const [row] = await db
      .select()
      .from(scanCacheTable)
      .where(
        and(
          eq(scanCacheTable.cacheKey, cacheKey),
          gt(scanCacheTable.expiresAt, new Date())
        )
      );

    if (!row) return null;

    // Increment hit counter in the background — non-fatal
    db.update(scanCacheTable)
      .set({ hitCount: row.hitCount + 1, updatedAt: new Date() })
      .where(eq(scanCacheTable.id, row.id))
      .catch(() => {});

    logger.info(
      { cacheKey: cacheKey.slice(0, 16), hitCount: row.hitCount + 1 },
      "Scan cache HIT"
    );

    return {
      data: JSON.parse(row.resultJson) as T,
      cachedAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      hitCount: row.hitCount + 1,
    };
  } catch (err) {
    logger.warn({ err, cacheKey: cacheKey.slice(0, 16) }, "Cache read failed (non-fatal)");
    return null;
  }
}

/** Store a result in the cache.  Upserts if the key already exists. */
export async function setCache<T = unknown>(
  cacheKey: string,
  data: T
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

  try {
    await db
      .insert(scanCacheTable)
      .values({
        cacheKey,
        resultJson: JSON.stringify(data),
        hitCount: 0,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: scanCacheTable.cacheKey,
        set: {
          resultJson: JSON.stringify(data),
          hitCount: 0,
          expiresAt,
          updatedAt: now,
        },
      });

    logger.info({ cacheKey: cacheKey.slice(0, 16), expiresAt }, "Scan cache SET");
  } catch (err) {
    logger.warn({ err, cacheKey: cacheKey.slice(0, 16) }, "Cache write failed (non-fatal)");
  }
}

/** Delete expired cache entries.  Call periodically (e.g. once per day). */
export async function evictExpiredCache(): Promise<number> {
  try {
    const result = await db
      .delete(scanCacheTable)
      .where(eq(scanCacheTable.expiresAt, new Date()))
      .returning({ id: scanCacheTable.id });
    return result.length;
  } catch {
    return 0;
  }
}
