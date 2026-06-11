/**
 * API Key Authentication Middleware
 *
 * Authenticates requests to /api/v1/* using Bearer token API keys.
 * Keys are stored as SHA-256 hex digests — never in plaintext.
 * Sets req.apiKeyId and req.apiKeyUserId on success.
 */

import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { eq, isNull } from "drizzle-orm";
import { db, apiKeysTable } from "@workspace/db";
import { logger } from "../lib/logger";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      apiKeyId?: string;
      apiKeyUserId?: string;
    }
  }
}

/** Throttle lastUsedAt updates to once per minute per key to reduce write load. */
const lastUsedCache = new Map<string, number>();

export async function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "missing_api_key", message: "Authorization: Bearer <key> required" });
    return;
  }

  const rawKey = authHeader.slice(7).trim();

  if (!rawKey.startsWith("sid_live_")) {
    res.status(401).json({ error: "invalid_api_key", message: "Key must start with sid_live_" });
    return;
  }

  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  try {
    const [key] = await db
      .select()
      .from(apiKeysTable)
      .where(eq(apiKeysTable.keyHash, keyHash));

    if (!key) {
      res.status(401).json({ error: "invalid_api_key", message: "API key not found" });
      return;
    }

    if (key.revokedAt) {
      res.status(401).json({ error: "revoked_api_key", message: "This API key has been revoked" });
      return;
    }

    req.apiKeyId = key.id;
    req.apiKeyUserId = key.userId;

    // Update lastUsedAt at most once per minute per key (reduce write amplification)
    const now = Date.now();
    const last = lastUsedCache.get(key.id) ?? 0;
    if (now - last > 60_000) {
      lastUsedCache.set(key.id, now);
      db.update(apiKeysTable)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeysTable.id, key.id))
        .catch((err) => logger.warn({ err }, "Failed to update lastUsedAt"));
    }

    next();
  } catch (err) {
    logger.error({ err }, "API key auth DB error");
    res.status(500).json({ error: "internal_error" });
  }
}
