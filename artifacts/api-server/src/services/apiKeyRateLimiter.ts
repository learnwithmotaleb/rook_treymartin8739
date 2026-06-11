/**
 * API Key Rate Limiter
 *
 * Sliding-window rate limiter backed by the api_key_rate_limits table.
 * Uses 1-minute windows. Returns { allowed, retryAfterMs } for each request.
 * Prunes stale windows lazily (> 2 minutes old) to keep the table small.
 */

import { eq, and, lt } from "drizzle-orm";
import { db, apiKeysTable, apiKeyRateLimitsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import type { Request, Response, NextFunction } from "express";

function currentWindowStart(): Date {
  const now = Date.now();
  return new Date(Math.floor(now / 60_000) * 60_000);
}

export async function checkRateLimit(
  keyId: string,
  limitRpm: number
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const windowStart = currentWindowStart();
  const pruneBeforeMs = new Date(Date.now() - 120_000); // 2 minutes ago

  try {
    // Prune stale windows lazily
    await db
      .delete(apiKeyRateLimitsTable)
      .where(
        and(
          eq(apiKeyRateLimitsTable.keyId, keyId),
          lt(apiKeyRateLimitsTable.windowStart, pruneBeforeMs)
        )
      );

    // Upsert current window count
    const [existing] = await db
      .select()
      .from(apiKeyRateLimitsTable)
      .where(
        and(
          eq(apiKeyRateLimitsTable.keyId, keyId),
          eq(apiKeyRateLimitsTable.windowStart, windowStart)
        )
      );

    if (existing) {
      if (existing.count >= limitRpm) {
        const retryAfterMs = 60_000 - (Date.now() % 60_000);
        return { allowed: false, retryAfterMs };
      }

      await db
        .update(apiKeyRateLimitsTable)
        .set({ count: existing.count + 1 })
        .where(eq(apiKeyRateLimitsTable.id, existing.id));
    } else {
      await db
        .insert(apiKeyRateLimitsTable)
        .values({ keyId, windowStart, count: 1 });
    }

    return { allowed: true, retryAfterMs: 0 };
  } catch (err) {
    logger.warn({ err, keyId }, "Rate limit check failed — allowing request");
    return { allowed: true, retryAfterMs: 0 };
  }
}

/**
 * Express middleware: reads RPM limit from the API key record and enforces it.
 * Must be used after apiKeyAuth middleware (requires req.apiKeyId).
 */
export function rateLimitMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const keyId = req.apiKeyId;
    if (!keyId) {
      next();
      return;
    }

    try {
      const [key] = await db
        .select({ rateLimitRpm: apiKeysTable.rateLimitRpm })
        .from(apiKeysTable)
        .where(eq(apiKeysTable.id, keyId));

      const limit = key?.rateLimitRpm ?? 60;
      const { allowed, retryAfterMs } = await checkRateLimit(keyId, limit);

      if (!allowed) {
        res.status(429).json({
          error: "rate_limit_exceeded",
          message: `Limit is ${limit} requests/minute`,
          retry_after_ms: retryAfterMs,
        });
        return;
      }
    } catch (err) {
      logger.warn({ err }, "Rate limit middleware error — allowing request");
    }

    next();
  };
}
