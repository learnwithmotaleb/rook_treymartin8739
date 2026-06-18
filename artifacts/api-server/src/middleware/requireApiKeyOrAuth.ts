/**
 * requireApiKeyOrAuth — dual-auth middleware
 *
 * Accepts either:
 *   a) A valid Clerk session (sets req.userId via the standard requireAuth flow)
 *   b) A valid ShieldID API key (Bearer sid_live_xxxx, sets req.userId from the key owner)
 *
 * Used on B2B endpoints like /api/identity/* so both end-user apps and server-to-server
 * integrations can call the same endpoints without separate route handlers.
 *
 * Precedence: Clerk session is checked first. If no Clerk auth is present, the
 * Bearer token is checked. If both fail, 401 is returned with a clear message.
 */

import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, apiKeysTable } from "@workspace/db";
import { logger } from "../lib/logger";

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
      // Clerk auth present but user not in DB → let requireAuth create the user
      // Fall through to standard requireAuth behavior would be complex here;
      // instead, create the user JIT.
      const sessionClaims = auth.sessionClaims as Record<string, unknown> | undefined;
      const name = (sessionClaims?.["name"] as string | undefined)
        ?? (sessionClaims?.["email"] as string | undefined)?.split("@")[0]
        ?? "Shield User";
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
        logger.info({ clerkUserId, userId: newUser.id }, "requireApiKeyOrAuth: JIT user created");
        return next();
      }
    }

    // ── Path 2: API key bearer token ──────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer sid_live_")) {
      const rawKey = authHeader.slice(7).trim();
      const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

      const [key] = await db
        .select({ id: apiKeysTable.id, userId: apiKeysTable.userId, revokedAt: apiKeysTable.revokedAt })
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

      req.userId = key.userId;
      req.apiKeyId = key.id;
      req.apiKeyUserId = key.userId;

      // Throttled lastUsedAt update (fire-and-forget)
      db.update(apiKeysTable)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeysTable.id, key.id))
        .catch((err) => logger.warn({ err }, "requireApiKeyOrAuth: lastUsedAt update failed"));

      return next();
    }

    // ── Neither auth method succeeded ─────────────────────────────────────
    res.status(401).json({
      error: "Unauthorized",
      message: "Provide a Clerk session cookie or Authorization: Bearer sid_live_<key>",
    });
  } catch (err) {
    logger.error({ err }, "requireApiKeyOrAuth error");
    res.status(500).json({ error: "Auth error" });
  }
}
