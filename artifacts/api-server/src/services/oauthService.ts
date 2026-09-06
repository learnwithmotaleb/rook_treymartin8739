/**
 * OAuthService
 *
 * Centralises all OAuth state-token logic, rate limiting, PKCE helpers,
 * and the cross-environment dev-notify mechanism.  Route handlers call
 * these static methods instead of duplicating the logic per platform.
 */
import crypto from "node:crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── Domain & secret configuration ─────────────────────────────────────────────

const _rawDomain =
  process.env["OAUTH_REDIRECT_BASE_URL"]
    ?.replace(/\/$/, "")
    .replace(/^https?:\/\//, "") ??
  process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim() ??
  process.env["REPLIT_DEV_DOMAIN"] ??
  "localhost";

/** Canonical domain used for all OAuth callback URLs (e.g. "tryrook.app"). */
export const DOMAIN = _rawDomain;

const _rawSecret = process.env["SESSION_SECRET"];
if (!_rawSecret) {
  throw new Error(
    "SESSION_SECRET environment variable is required. " +
      "Set it as an environment secret before starting the server."
  );
}
const STATE_SECRET = _rawSecret;

/** Base URL for cross-environment dev-notify (set in .env.local for dev only). */
export const DEV_NOTIFY_BASE = process.env["DEV_NOTIFY_URL"]?.replace(/\/$/, "");

// ── One-time state token guard ─────────────────────────────────────────────────
// Prevents state token replay attacks within the 15-minute validity window.
const _usedStateTokens = new Map<string, number>(); // token → consumed-at (ms)

function consumeStateToken(token: string): boolean {
  if (_usedStateTokens.has(token)) return false;
  _usedStateTokens.set(token, Date.now());
  // Lazy prune: remove tokens older than 15 minutes
  const cutoff = Date.now() - 900_000;
  for (const [k, ts] of _usedStateTokens) {
    if (ts < cutoff) _usedStateTokens.delete(k);
  }
  return true;
}

// ── Per-IP rate limiter ───────────────────────────────────────────────────────
const _oauthRateLimits = new Map<string, { count: number; windowStart: number }>();
const OAUTH_RL_MAX = 20;
const OAUTH_RL_WINDOW_MS = 60_000; // 1-minute sliding window

// ── Account notify payload type ───────────────────────────────────────────────
export interface NotifyPayload {
  clerkId: string;
  platform: string;
  username: string;
  platformUserId?: string;
  displayName?: string;
  accessToken?: string;
}

export class OAuthService {
  /**
   * Returns false when the IP has exceeded the per-minute rate limit.
   * Prunes stale entries lazily to keep the map bounded.
   */
  static checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = _oauthRateLimits.get(ip);
    if (!entry || now - entry.windowStart > OAUTH_RL_WINDOW_MS) {
      _oauthRateLimits.set(ip, { count: 1, windowStart: now });
      if (_oauthRateLimits.size > 5000) {
        for (const [k, v] of _oauthRateLimits) {
          if (now - v.windowStart > OAUTH_RL_WINDOW_MS) _oauthRateLimits.delete(k);
        }
      }
      return true;
    }
    if (entry.count >= OAUTH_RL_MAX) return false;
    entry.count += 1;
    return true;
  }

  /**
   * Creates an HMAC-signed state token embedding the Clerk user ID and an
   * optional dev-notify URL.  Valid for 15 minutes, one-time use.
   */
  static createState(clerkId: string, notifyUrl?: string): string {
    const data: { clerkId: string; iat: number; nu?: string } = {
      clerkId,
      iat: Math.floor(Date.now() / 1000),
    };
    if (notifyUrl) data.nu = notifyUrl;
    const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
    const sig = crypto
      .createHmac("sha256", STATE_SECRET)
      .update(payload)
      .digest("base64url");
    return `${payload}.${sig}`;
  }

  /**
   * Parses and validates an HMAC-signed state token.
   * Returns null if the signature is invalid, the token is expired (>15 min),
   * or the token has already been consumed (replay attack).
   */
  static parseState(
    state: string
  ): { id: string; notifyUrl?: string } | null {
    try {
      const dot = state.lastIndexOf(".");
      if (dot === -1) return null;
      const payload = state.slice(0, dot);
      const sig = state.slice(dot + 1);
      const expected = crypto
        .createHmac("sha256", STATE_SECRET)
        .update(payload)
        .digest("base64url");
      if (sig !== expected) return null;
      const parsed = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8")
      ) as { clerkId?: string; userId?: string; iat?: number; nu?: string };
      const id = parsed.clerkId ?? parsed.userId;
      if (!id || typeof parsed.iat !== "number") return null;
      if (Date.now() / 1000 - parsed.iat > 900) return null;
      if (!consumeStateToken(state)) return null;
      return { id, notifyUrl: parsed.nu };
    } catch {
      return null;
    }
  }

  /**
   * Creates an HMAC-signed PKCE state token for X/Twitter OAuth 2.0.
   * The code_verifier is embedded in the signed payload so the callback
   * can retrieve it without any extra round-trips.
   */
  static createPkceState(
    clerkId: string,
    notifyUrl?: string
  ): { state: string; codeChallenge: string } {
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    const data: { clerkId: string; iat: number; cv: string; nu?: string } = {
      clerkId,
      iat: Math.floor(Date.now() / 1000),
      cv: codeVerifier,
    };
    if (notifyUrl) data.nu = notifyUrl;
    const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
    const sig = crypto
      .createHmac("sha256", STATE_SECRET)
      .update(payload)
      .digest("base64url");
    return { state: `${payload}.${sig}`, codeChallenge };
  }

  /**
   * Parses and validates an X PKCE state token.
   * Returns null if invalid, expired, or replayed.
   */
  static parsePkceState(
    state: string
  ): { clerkId: string; codeVerifier: string; notifyUrl?: string } | null {
    try {
      const dot = state.lastIndexOf(".");
      if (dot === -1) return null;
      const payload = state.slice(0, dot);
      const sig = state.slice(dot + 1);
      const expected = crypto
        .createHmac("sha256", STATE_SECRET)
        .update(payload)
        .digest("base64url");
      if (sig !== expected) return null;
      const parsed = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8")
      ) as { clerkId?: string; userId?: string; iat?: number; cv?: string; nu?: string };
      const id = parsed.clerkId ?? parsed.userId;
      if (!id || typeof parsed.iat !== "number" || !parsed.cv) return null;
      if (Date.now() / 1000 - parsed.iat > 900) return null;
      return { clerkId: id, codeVerifier: parsed.cv, notifyUrl: parsed.nu };
    } catch {
      return null;
    }
  }

  /**
   * Resolves (or JIT-provisions) the DB user from an HMAC state token.
   * Falls back to Clerk JWT verification for backward compat with old clients.
   * Falls back to the demo user in development (never in production).
   *
   * @throws StateResolutionError in production when the state is invalid.
   */
  static async resolveUser(
    state: string | undefined
  ): Promise<{ userId: string; clerkId?: string; notifyUrl?: string }> {
    const { getOrCreateUserByClerkId } = await import(
      "../middleware/requireAuth"
    );

    if (state) {
      const parsed = OAuthService.parseState(state);
      if (parsed) {
        const { id: clerkOrDbId, notifyUrl } = parsed;
        if (clerkOrDbId.startsWith("user_")) {
          const dbUser = await getOrCreateUserByClerkId(clerkOrDbId, null);
          return { userId: dbUser.id, clerkId: clerkOrDbId, notifyUrl };
        }
        // Legacy path: it's a DB UUID — look it up directly.
        const [existing] = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.id, clerkOrDbId));
        if (existing) return { userId: existing.id, notifyUrl };
      }
      // Fallback: Clerk JWT (backward compat)
      try {
        const { verifyToken } = await import("@clerk/express");
        const payload = await verifyToken(state, {
          secretKey: process.env["CLERK_SECRET_KEY"] ?? "",
        });
        const dbUser = await getOrCreateUserByClerkId(payload.sub, null);
        return { userId: dbUser.id, clerkId: payload.sub };
      } catch {
        // Expired/invalid — fall through
      }
    }

    if (process.env["NODE_ENV"] !== "development") {
      throw new StateResolutionError();
    }
    const { getOrCreateDemoUser } = await import("../lib/demoUser");
    const demo = await getOrCreateDemoUser();
    return { userId: demo.id };
  }

  /**
   * Fire-and-forget: posts an HMAC-signed account-notify to the dev server.
   * Called after a prod OAuth callback saves a new account, so the dev
   * Expo app can poll its local DB and find the newly connected account
   * without needing a second registered redirect URI.
   *
   * Never throws — failures are silently swallowed so the main OAuth flow
   * is never blocked by dev tooling issues.
   */
  static async sendAccountNotify(
    notifyUrl: string,
    payload: NotifyPayload
  ): Promise<void> {
    try {
      const sig = crypto
        .createHmac("sha256", STATE_SECRET)
        .update(JSON.stringify(payload))
        .digest("base64url");
      await fetch(`${notifyUrl}/api/oauth/account-notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, sig }),
      });
    } catch {
      // Fire-and-forget — never fail the main OAuth flow
    }
  }
}

/**
 * Thrown when a state token cannot be resolved in production.
 * Route handlers catch this and return a 401 with a user-friendly HTML page.
 */
export class StateResolutionError extends Error {
  constructor() {
    super(
      "OAuth state missing or expired — please try connecting your account again from the app."
    );
    this.name = "StateResolutionError";
  }
}
