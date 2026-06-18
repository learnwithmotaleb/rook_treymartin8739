/**
 * requireApiKeyOrAuth — dual-auth middleware
 *
 * Accepts either:
 *   a) A valid Clerk session (sets req.userId via the standard requireAuth flow)
 *   b) A valid ShieldID API key via:
 *        Authorization: Bearer sid_live_xxxx
 *      or
 *        X-ShieldID-API-Key: sid_live_xxxx
 *
 * Used on B2B endpoints like /api/identity/* so both end-user apps and server-to-server
 * integrations can call the same endpoints without separate route handlers.
 *
 * Precedence:
 *   1. Clerk session (checked first — no DB call if Clerk is present)
 *   2. Authorization: Bearer sid_live_xxx
 *   3. X-ShieldID-API-Key: sid_live_xxx header
 *   4. 401 with clear message indicating accepted auth methods
 */

import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, apiKeysTable } from "@workspace/db";
import { logger } from "../lib/logger";

/** Extract a sid_live_ key from either Authorization: Bearer or X-ShieldID-API-Key header. */
function extractApiKey(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer sid_live_")) {
    return authHeader.slice(7).trim();
  }
  const customHeader = req.headers["x-shieldid-api-key"];
  if (typeof customHeader === "string" && customHeader.startsWith("sid_live_")) {
    return customHeader.trim();
  }
  return null;
}

async function resolveApiKey(
  rawKey: string,
  res: Response,
  req: Request,
  next: NextFunction
): Promise<boolean> {
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const [key] = await db
    .select({
      id: apiKeysTable.id,
      userId: apiKeysTable.userId,
      revokedAt: apiKeysTable.revokedAt,
    })
    .from(apiKeysTable)
    .where(eq(apiKeysTable.keyHash, keyHash));

  if (!key) {
    res.status(401).json({ error: "invalid_api_key", message: "API key not found" });
    return true; // handled
  }

  if (key.revokedAt) {
    res.status(401).json({ error: "revoked_api_key", message: "This API key has been revoked" });
    return true; // handled
  }

  req.userId = key.userId;
  req.apiKeyId = key.id;
  req.apiKeyUserId = key.userId;

  // Throttled lastUsedAt update (fire-and-forget)
  db.update(apiKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeysTable.id, key.id))
    .catch((err) => logger.warn({ err }, "requireApiKeyOrAuth: lastUsedAt update failed"));

  next();
  return true; // handled
}

export async function requireApiKeyOrAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // ── Path 1: Clerk session ──────────────────────────────────────────────
    const auth = getAuth(req);
    if (auth?.userId) {
      const clerkUserId = auth.userId;
      const [user] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.clerkId, clerkUserId));

      if (user) {
        req.userId = user.id;
        return next();
      }

      // Clerk auth present but user not yet in DB — JIT provision
      const sessionClaims = auth.sessionClaims as Record<string, unknown> | undefined;
      const name =
        (sessionClaims?.["name"] as string | undefined) ??
        (sessionClaims?.["email"] as string | undefined)?.split("@")[0] ??
        "Shield User";
      const email = (sessionClaims?.["email"] as string | undefined) ?? null;
      const initials = name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("");

      const [newUser] = await db
        .insert(usersTable)
        .values({
          clerkId: clerkUserId,
          name,
          email,
          username: `@${name.toLowerCase().replace(/\s+/g, "")}`,
          avatarInitials: initials,
          securityScore: 72,
          scoreTrend: 0,
        })
        .returning({ id: usersTable.id });

      if (newUser) {
        req.userId = newUser.id;
        logger.info(
          { clerkUserId, userId: newUser.id },
          "requireApiKeyOrAuth: JIT user created"
        );
        return next();
      }
    }

    // ── Path 2: API key (Authorization: Bearer or X-ShieldID-API-Key) ────────
    const rawKey = extractApiKey(req);
    if (rawKey) {
      const handled = await resolveApiKey(rawKey, res, req, next);
      if (handled) return;
    }

    // ── Neither auth method succeeded ─────────────────────────────────────
    res.status(401).json({
      error: "Unauthorized",
      message:
        "Authenticate via Clerk session, Authorization: Bearer sid_live_<key>, or X-ShieldID-API-Key: sid_live_<key>",
    });
  } catch (err) {
    logger.error({ err }, "requireApiKeyOrAuth error");
    res.status(500).json({ error: "Auth error" });
  }
}
