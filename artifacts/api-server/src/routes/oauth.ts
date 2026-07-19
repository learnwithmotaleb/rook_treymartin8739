import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, connectedAccountsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { metaFetch } from "../lib/metaFetch";

const router: IRouter = Router();

/** Thrown when a state token cannot be resolved in production (no demo fallback). */
class StateResolutionError extends Error {
  constructor() {
    super("OAuth state missing or expired — please try connecting your account again from the app.");
    this.name = "StateResolutionError";
  }
}

// OAUTH_REDIRECT_BASE_URL overrides the auto-detected domain for all OAuth
// callbacks. Set this to your canonical domain (e.g. https://tryrook.app) so
// the redirect_uri sent to Meta/X always matches what's registered in their
// developer portals, regardless of which Replit environment is running.
const _rawDomain =
  process.env["OAUTH_REDIRECT_BASE_URL"]?.replace(/\/$/, "").replace(/^https?:\/\//, "")
  ?? process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim()
  ?? process.env["REPLIT_DEV_DOMAIN"]
  ?? "localhost";

const DOMAIN = _rawDomain;

// ── HMAC-signed OAuth state token ────────────────────────────────────────────
// Solves the Clerk JWT expiry problem: Clerk JWTs live ~60 s, but a user
// might take several minutes on the Facebook/Instagram consent screen.
// Instead we generate our own HMAC-signed token with a 15-minute window.

const _rawSecret = process.env["SESSION_SECRET"];
if (!_rawSecret) {
  throw new Error(
    "SESSION_SECRET environment variable is required. " +
    "Set it as an environment secret before starting the server."
  );
}
const STATE_SECRET = _rawSecret;

function createOAuthState(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ userId, iat: Math.floor(Date.now() / 1000) })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", STATE_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

function parseOAuthState(state: string): string | null {
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
    const { userId, iat } = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { userId?: string; iat?: number };
    if (!userId || typeof iat !== "number") return null;
    if (Date.now() / 1000 - iat > 900) return null; // 15-min window
    return userId;
  } catch {
    return null;
  }
}

// ── X/Twitter PKCE state helpers ─────────────────────────────────────────────
// Twitter's OAuth 2.0 always requires PKCE. The server generates the
// code_verifier + code_challenge and embeds the verifier in the signed state
// token so the callback can use it without any extra round-trips.

function createXPkceState(userId: string): { state: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  const payload = Buffer.from(
    JSON.stringify({ userId, iat: Math.floor(Date.now() / 1000), cv: codeVerifier })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", STATE_SECRET).update(payload).digest("base64url");
  return { state: `${payload}.${sig}`, codeChallenge };
}

function parseXPkceState(state: string): { userId: string; codeVerifier: string } | null {
  try {
    const dot = state.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = state.slice(0, dot);
    const sig = state.slice(dot + 1);
    const expected = crypto.createHmac("sha256", STATE_SECRET).update(payload).digest("base64url");
    if (sig !== expected) return null;
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { userId?: string; iat?: number; cv?: string };
    if (!parsed.userId || typeof parsed.iat !== "number" || !parsed.cv) return null;
    if (Date.now() / 1000 - parsed.iat > 900) return null;
    return { userId: parsed.userId, codeVerifier: parsed.cv };
  } catch {
    return null;
  }
}

async function resolveUserFromState(state: string | undefined): Promise<string> {
  if (state) {
    // Primary: HMAC-signed opaque state token (doesn't expire in 60s like JWTs)
    const userId = parseOAuthState(state);
    if (userId) return userId;

    // Fallback: Clerk JWT (backward compat — try to look up by clerkId)
    try {
      const { verifyToken } = await import("@clerk/express");
      const payload = await verifyToken(state, {
        secretKey: process.env["CLERK_SECRET_KEY"] ?? "",
      });
      const [dbUser] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.clerkId, payload.sub));
      if (dbUser) return dbUser.id;
    } catch {
      // expired / invalid — fall through
    }
  }
  if (process.env["NODE_ENV"] === "production") {
    throw new StateResolutionError();
  }
  const { getOrCreateDemoUser } = await import("../lib/demoUser");
  const demo = await getOrCreateDemoUser();
  return demo.id;
}

// ── POST /api/oauth/state ─────────────────────────────────────────────────────
// Called by the mobile app (authenticated) before opening the OAuth browser.
// Returns a short-lived HMAC-signed state token that the callback can verify
// without depending on the Clerk JWT expiry window.
router.post("/oauth/state", requireAuth, (req, res): void => {
  const state = createOAuthState(req.userId);
  res.json({ state });
});

// ── POST /api/oauth/x/init ────────────────────────────────────────────────────
// Called by the mobile app before opening X's OAuth browser.
// Generates a PKCE code_verifier (embedded in signed state) + code_challenge
// (sent to Twitter). The callback extracts code_verifier from the state token.
router.post("/oauth/x/init", requireAuth, (req, res): void => {
  const { state, codeChallenge } = createXPkceState(req.userId);
  res.json({ state, codeChallenge });
});

// ─── Instagram OAuth callback ────────────────────────────────────────────────
// Meta redirects here after the user approves the app.
// URL: GET /api/oauth/instagram/callback?code=...&state=...
router.get("/oauth/instagram/callback", async (req, res): Promise<void> => {
  const { code, error, error_reason, state } = req.query as Record<string, string>;

  if (error || !code) {
    const msg = error_reason ?? error ?? "Unknown error";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(400).send(errorPage("Instagram Authorization Failed", msg));
    return;
  }

  const clientId = process.env["INSTAGRAM_CLIENT_ID"];
  const clientSecret = process.env["INSTAGRAM_CLIENT_SECRET"];

  if (!clientId || !clientSecret) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(503).send(errorPage(
      "Not Configured",
      "INSTAGRAM_CLIENT_ID and INSTAGRAM_CLIENT_SECRET must be set as environment secrets."
    ));
    return;
  }

  try {
    // Accept either the https server callback URI OR the custom-scheme URI
    // (used by the Expo app so iOS can intercept the redirect immediately).
    // The redirect_uri in the token exchange must exactly match what was sent
    // to Instagram in the authorization request.
    const serverRedirectUri = `https://${DOMAIN}/api/oauth/instagram/callback`;
    const mobileRedirectUri = "com.getrook.app://oauth";
    const redirectUri = (req.query["redirect_uri"] as string | undefined) === mobileRedirectUri
      ? mobileRedirectUri
      : serverRedirectUri;

    // Exchange code for short-lived token
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });

    req.log?.info({ clientId, redirectUri }, "Exchanging Instagram auth code for token");

    const tokenRes = await metaFetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: tokenParams,
    });

    const tokenBody = await tokenRes.text();
    if (!tokenRes.ok) {
      req.log?.error({ status: tokenRes.status, body: tokenBody, clientId, redirectUri }, "Instagram token exchange failed");
      throw new Error(`Token exchange failed (HTTP ${tokenRes.status}): ${tokenBody}`);
    }

    let tokenData: { access_token: string; user_id: number };
    try {
      tokenData = JSON.parse(tokenBody) as { access_token: string; user_id: number };
    } catch {
      throw new Error(`Token exchange returned invalid JSON: ${tokenBody}`);
    }

    if (!tokenData.access_token) {
      throw new Error(`Token exchange returned no access_token: ${tokenBody}`);
    }

    const { access_token, user_id } = tokenData;

    req.log?.info({ userId: user_id }, "Instagram short-lived token obtained");

    // Fetch profile — instagram_business_basic provides username + followers_count + profile_picture_url
    // Try /me first (works with new Instagram Login), fall back to /{user_id}
    let profile: { id: string; username: string; followers_count?: number; profile_picture_url?: string };
    const meRes = await metaFetch(
      `https://graph.instagram.com/me?fields=id,username,followers_count,profile_picture_url&access_token=${access_token}`
    );
    if (meRes.ok) {
      profile = await meRes.json() as typeof profile;
    } else {
      const userRes = await metaFetch(
        `https://graph.instagram.com/${user_id}?fields=id,username,followers_count,profile_picture_url&access_token=${access_token}`
      );
      if (!userRes.ok) {
        const errText = await userRes.text();
        req.log?.error({ status: userRes.status, body: errText }, "Instagram profile fetch failed");
        throw new Error(`Profile fetch failed (HTTP ${userRes.status}): ${errText}`);
      }
      profile = await userRes.json() as typeof profile;
    }

    req.log?.info({ igUsername: profile.username, igId: profile.id }, "Instagram profile fetched");

    // Exchange for long-lived token (60 days)
    const longLivedRes = await metaFetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${access_token}`
    );
    const longLivedBody = await longLivedRes.text();
    if (!longLivedRes.ok) {
      // Non-fatal: save the short-lived token and warn. The account is still connected.
      req.log?.warn({ status: longLivedRes.status, body: longLivedBody }, "Long-lived token exchange failed — using short-lived token");
    }
    let longToken: string = access_token; // fallback to short-lived
    try {
      const longData = JSON.parse(longLivedBody) as { access_token?: string };
      if (longData.access_token) longToken = longData.access_token;
    } catch {
      req.log?.warn({ body: longLivedBody }, "Could not parse long-lived token response — using short-lived token");
    }

    const userId = await resolveUserFromState(state);

    const existing = await db
      .select({ id: connectedAccountsTable.id })
      .from(connectedAccountsTable)
      .where(
        and(
          eq(connectedAccountsTable.userId, userId),
          eq(connectedAccountsTable.platform, "instagram")
        )
      );

    if (existing.length > 0) {
      await db
        .update(connectedAccountsTable)
        .set({
          accessToken: longToken,
          platformUserId: String(profile.id),
          username: profile.username,
          followers: profile.followers_count ?? 0,
          verified: true,
          lastSynced: new Date(),
        })
        .where(eq(connectedAccountsTable.id, existing[0]!.id));
    } else {
      await db
        .insert(connectedAccountsTable)
        .values({
          userId,
          platform: "instagram",
          username: profile.username,
          platformUserId: String(profile.id),
          accessToken: longToken,
          verified: true,
          followers: profile.followers_count ?? 0,
          photosIndexed: 0,
          captionsIndexed: 0,
          reelsIndexed: 0,
          lastSynced: new Date(),
        });
    }

    // Redirect to the app custom scheme so ASWebAuthenticationSession closes automatically.
    // Falls back to the HTML success page on non-iOS clients (Android, web).
    const ua = (req.headers["user-agent"] ?? "").toLowerCase();
    const isMobile = ua.includes("iphone") || ua.includes("ipad") || ua.includes("android");
    if (isMobile) {
      res.redirect("com.getrook.app://oauth?platform=instagram&status=connected");
    } else {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(successPage(
        "Instagram Connected!",
        `@${profile.username} is now verified and being monitored by Rook.`,
        profile.username
      ));
    }
  } catch (err: any) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (err instanceof StateResolutionError) {
      res.status(401).send(errorPage("Session Expired", "Your sign-in session expired or the link is invalid. Please try connecting your Instagram account again."));
      return;
    }
    req.log?.error({ err }, "Instagram OAuth callback error");
    res.status(500).send(errorPage("Connection Failed", "Something went wrong while connecting your Instagram account. Please try again."));
  }
});

// ─── Facebook OAuth callback ──────────────────────────────────────────────────
router.get("/oauth/facebook/callback", async (req, res): Promise<void> => {
  const { code, error, state } = req.query as Record<string, string>;

  if (error || !code) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(400).send(errorPage("Facebook Authorization Failed", error ?? "Unknown error"));
    return;
  }

  const clientId = process.env["FACEBOOK_APP_ID"];
  const clientSecret = process.env["FACEBOOK_APP_SECRET"];

  if (!clientId || !clientSecret) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(503).send(errorPage(
      "Not Configured",
      "FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be set as environment secrets."
    ));
    return;
  }

  try {
    const redirectUri = `https://${DOMAIN}/api/oauth/facebook/callback`;
    const tokenUrl = `https://graph.facebook.com/v22.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${code}`;

    const tokenRes = await metaFetch(tokenUrl);
    const tokenData = await tokenRes.json() as { access_token?: string; error?: { message: string } };

    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error?.message ?? `Token exchange failed (HTTP ${tokenRes.status})`);
    }

    const { access_token } = tokenData;

    const profileRes = await metaFetch(
      `https://graph.facebook.com/v22.0/me?fields=id,name&access_token=${access_token}`
    );
    const profile = await profileRes.json() as { id: string; name: string; error?: { message: string } };

    if (!profile.id) {
      throw new Error(profile.error?.message ?? "Failed to fetch Facebook profile");
    }

    const userId = await resolveUserFromState(state);

    const existing = await db
      .select({ id: connectedAccountsTable.id })
      .from(connectedAccountsTable)
      .where(
        and(
          eq(connectedAccountsTable.userId, userId),
          eq(connectedAccountsTable.platform, "facebook")
        )
      );

    if (existing.length > 0) {
      await db
        .update(connectedAccountsTable)
        .set({ accessToken: access_token, platformUserId: profile.id, verified: true, lastSynced: new Date() })
        .where(eq(connectedAccountsTable.id, existing[0]!.id));
    } else {
      await db
        .insert(connectedAccountsTable)
        .values({
          userId,
          platform: "facebook",
          username: profile.name.toLowerCase().replace(/\s+/g, "."),
          displayName: profile.name,
          platformUserId: profile.id,
          accessToken: access_token,
          verified: true,
          followers: 0,
          photosIndexed: 0,
          captionsIndexed: 0,
          reelsIndexed: 0,
          lastSynced: new Date(),
        });
    }

    const ua = (req.headers["user-agent"] ?? "").toLowerCase();
    const isMobile = ua.includes("iphone") || ua.includes("ipad") || ua.includes("android");
    if (isMobile) {
      res.redirect("com.getrook.app://oauth?platform=facebook&status=connected");
    } else {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(successPage("Facebook Connected!", `${profile.name} is now being monitored by Rook.`, profile.name));
    }
  } catch (err: any) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (err instanceof StateResolutionError) {
      res.status(401).send(errorPage("Session Expired", "Your sign-in session expired or the link is invalid. Please try connecting your Facebook account again."));
      return;
    }
    req.log?.error({ err }, "Facebook OAuth callback error");
    res.status(500).send(errorPage("Connection Failed", "Something went wrong while connecting your Facebook account. Please try again."));
  }
});

// ─── X (Twitter) OAuth 2.0 + PKCE callback ────────────────────────────────────
// Twitter redirects here after the user approves the app.
// URL: GET /api/oauth/x/callback?code=...&state=...
router.get("/oauth/x/callback", async (req, res): Promise<void> => {
  const { code, error, state } = req.query as Record<string, string>;

  if (error || !code) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(400).send(errorPage("X Authorization Failed", error ?? "No authorization code received"));
    return;
  }

  const clientId = process.env["TWITTER_CLIENT_ID"];
  const clientSecret = process.env["TWITTER_CLIENT_SECRET"];

  if (!clientId || !clientSecret) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(503).send(errorPage(
      "Not Configured",
      "TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET must be set as environment secrets."
    ));
    return;
  }

  // State must be an X PKCE state (contains embedded code_verifier)
  const pkce = state ? parseXPkceState(state) : null;
  if (!pkce) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(401).send(errorPage(
      "Session Expired",
      "Your sign-in session expired or the link is invalid. Please try connecting your X account again."
    ));
    return;
  }

  const { userId, codeVerifier } = pkce;

  try {
    const redirectUri = `https://${DOMAIN}/api/oauth/x/callback`;

    // Exchange authorization code for access token (PKCE confidential client)
    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }).toString(),
    });

    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      req.log?.error({ status: tokenRes.status, body: tokenText }, "X token exchange failed");
      throw new Error(`Token exchange failed (HTTP ${tokenRes.status}): ${tokenText}`);
    }

    const tokenData = JSON.parse(tokenText) as { access_token?: string; refresh_token?: string; error?: string };
    if (!tokenData.access_token) {
      throw new Error(tokenData.error ?? `Token exchange returned no access_token: ${tokenText}`);
    }

    const { access_token } = tokenData;

    // Fetch user profile
    const profileRes = await fetch(
      "https://api.twitter.com/2/users/me?user.fields=public_metrics,profile_image_url,username,name,description",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    if (!profileRes.ok) {
      throw new Error(`X profile fetch failed (HTTP ${profileRes.status})`);
    }
    const profileJson = await profileRes.json() as {
      data?: {
        id: string;
        username: string;
        name: string;
        description?: string;
        public_metrics?: { followers_count?: number };
        profile_image_url?: string;
      };
    };
    const profile = profileJson.data;
    if (!profile?.id) {
      throw new Error("X profile response missing data");
    }

    req.log?.info({ xUsername: profile.username, xId: profile.id }, "X profile fetched");

    // Upsert connected account
    const existing = await db
      .select({ id: connectedAccountsTable.id })
      .from(connectedAccountsTable)
      .where(and(eq(connectedAccountsTable.userId, userId), eq(connectedAccountsTable.platform, "x")));

    if (existing.length > 0) {
      await db
        .update(connectedAccountsTable)
        .set({
          accessToken: access_token,
          platformUserId: profile.id,
          username: profile.username,
          displayName: profile.name,
          followers: profile.public_metrics?.followers_count ?? 0,
          verified: true,
          lastSynced: new Date(),
        })
        .where(eq(connectedAccountsTable.id, existing[0]!.id));
    } else {
      await db.insert(connectedAccountsTable).values({
        userId,
        platform: "x",
        username: profile.username,
        displayName: profile.name,
        platformUserId: profile.id,
        accessToken: access_token,
        verified: true,
        followers: profile.public_metrics?.followers_count ?? 0,
        photosIndexed: 0,
        captionsIndexed: 0,
        reelsIndexed: 0,
        lastSynced: new Date(),
      });
    }

    const ua = (req.headers["user-agent"] ?? "").toLowerCase();
    const isMobile = ua.includes("iphone") || ua.includes("ipad") || ua.includes("android");
    if (isMobile) {
      res.redirect("com.getrook.app://oauth?platform=x&status=connected");
    } else {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(successPage(
        "X Connected!",
        `@${profile.username} is now verified and being monitored by Rook.`,
        profile.username
      ));
    }
  } catch (err: any) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (err instanceof StateResolutionError) {
      res.status(401).send(errorPage("Session Expired", "Your sign-in session expired or the link is invalid. Please try connecting your X account again."));
      return;
    }
    req.log?.error({ err }, "X OAuth callback error");
    res.status(500).send(errorPage("Connection Failed", "Something went wrong while connecting your X account. Please try again."));
  }
});

// ─── OAuth config — returns the current redirect URIs for this deployment ────
// Used by the mobile app to keep its redirect_uri in sync with the server.
router.get("/oauth/redirect-uris", (_req, res) => {
  res.json({
    instagram: `https://${DOMAIN}/api/oauth/instagram/callback`,
    facebook:  `https://${DOMAIN}/api/oauth/facebook/callback`,
    x:         `https://${DOMAIN}/api/oauth/x/callback`,
    // Public client IDs (non-secret) — mobile uses these when EXPO_PUBLIC_* not bundled
    x_client_id: process.env["TWITTER_CLIENT_ID"] ?? "",
    // com.getrook.app:// scheme used by the Expo app for in-app browser OAuth
    instagram_mobile: "com.getrook.app://oauth",
    facebook_mobile:  "com.getrook.app://oauth",
  });
});

// ─── Dev diagnostic: shows truncated IDs and a testable auth URL ──────────────
// Only available in non-production environments.
router.get("/oauth/debug", (_req, res) => {
  if (process.env["NODE_ENV"] === "production") {
    res.status(404).end();
    return;
  }
  const igClientId  = process.env["INSTAGRAM_CLIENT_ID"] ?? "";
  const fbAppId     = process.env["FACEBOOK_APP_ID"] ?? "";
  const igPublicId  = process.env["EXPO_PUBLIC_INSTAGRAM_CLIENT_ID"] ?? "";
  const fbPublicId  = process.env["EXPO_PUBLIC_FACEBOOK_CLIENT_ID"] ?? "";
  const xClientId   = process.env["TWITTER_CLIENT_ID"] ?? "";

  const mask = (s: string) =>
    s.length > 8 ? `${s.slice(0, 5)}…${s.slice(-4)}` : s.length > 0 ? "****" : "(not set)";

  const igRedirect  = `https://${DOMAIN}/api/oauth/instagram/callback`;
  const fbRedirect  = `https://${DOMAIN}/api/oauth/facebook/callback`;
  const xRedirect   = `https://${DOMAIN}/api/oauth/x/callback`;
  const mobileScheme = "com.getrook.app://oauth";

  // Build the exact URL the mobile app would open
  const testAuthUrl = new URL("https://www.instagram.com/oauth/authorize");
  testAuthUrl.searchParams.set("client_id", igPublicId);
  testAuthUrl.searchParams.set("redirect_uri", igRedirect);
  testAuthUrl.searchParams.set("scope", "instagram_business_basic");
  testAuthUrl.searchParams.set("response_type", "code");
  testAuthUrl.searchParams.set("state", "debug_test");

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>OAuth Debug — Rook</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
       background: #0a0f1e; color: #e2e8f0; padding: 40px 24px; }
.container { max-width: 780px; margin: 0 auto; }
h1 { font-size: 24px; font-weight: 800; color: #f8fafc; margin-bottom: 6px; }
.sub { color: #64748b; font-size: 14px; margin-bottom: 32px; }
.card { background: #131929; border: 1px solid #1e2d4a; border-radius: 16px; padding: 24px; margin-bottom: 20px; }
h2 { font-size: 14px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 14px; }
.row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0;
       border-bottom: 1px solid #1e2d4a; font-size: 14px; gap: 16px; }
.row:last-child { border-bottom: none; }
.label { color: #64748b; font-family: monospace; font-size: 12px; flex-shrink: 0; }
.value { font-family: monospace; font-size: 12px; text-align: right; word-break: break-all; }
.ok { color: #10B981; } .warn { color: #F59E0B; } .err { color: #EF4444; } .muted { color: #475569; }
.url-block { background: #0d1525; border: 1px solid #1e2d4a; border-radius: 10px;
             padding: 12px 14px; word-break: break-all; font-family: monospace; font-size: 12px;
             color: #60a5fa; margin: 6px 0; user-select: all; cursor: text; }
.url-label { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;
             letter-spacing: .4px; margin-top: 14px; margin-bottom: 2px; }
.btn { display: inline-block; background: #E1306C; color: #fff; padding: 11px 22px;
       border-radius: 10px; font-weight: 600; text-decoration: none; margin-top: 12px; font-size: 13px; }
.note { color: #F59E0B; font-size: 13px; background: #F59E0B11; border: 1px solid #F59E0B33;
        border-radius: 8px; padding: 12px 14px; margin-top: 14px; line-height: 1.6; }
.platform-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px;
                  font-weight: 700; margin-right: 6px; }
</style></head><body><div class="container">
<h1>🔍 OAuth Debug — Rook</h1>
<p class="sub">All secrets are masked. Copy redirect URIs from here to register in each platform's developer portal.</p>

<div class="card">
<h2>Current Domain</h2>
<div class="row">
  <span class="label">DOMAIN (all callback URIs use this)</span>
  <span class="value ok">${DOMAIN}</span>
</div>
<div class="row">
  <span class="label">Mobile deep-link scheme</span>
  <span class="value ok">${mobileScheme}</span>
</div>
</div>

<div class="card">
<h2>All Redirect URIs — Register These Exactly</h2>
<p style="color:#64748b;font-size:13px;margin-bottom:12px;">
  Copy each URI below and paste it into the matching platform's developer portal. One character difference = "invalid request".
</p>
<div class="url-label">Instagram → Meta for Developers → Instagram Login → Settings → Valid OAuth Redirect URIs</div>
<div class="url-block">${igRedirect}</div>
<div class="url-label">Facebook → Meta for Developers → Facebook Login → Settings → Valid OAuth Redirect URIs</div>
<div class="url-block">${fbRedirect}</div>
<div class="url-label">X / Twitter → developer.twitter.com → App → Settings → Callback URI / Redirect URL</div>
<div class="url-block">${xRedirect}</div>
<div class="url-label">Instagram &amp; Facebook mobile (also register in Meta → Valid OAuth Redirect URIs)</div>
<div class="url-block">${mobileScheme}</div>
<div class="note">
  <strong>Meta (Instagram + Facebook):</strong> The redirect URI must be registered in <em>two</em> places —
  under <strong>Instagram Login → Settings</strong> AND under <strong>Facebook Login → Settings</strong> if you use both.
  They are separate products in the same app.<br/><br/>
  Also add <code>${DOMAIN}</code> to <strong>App Settings → Basic → App Domains</strong>.
</div>
</div>

<div class="card">
<h2>Client ID Status</h2>
<div class="row">
  <span class="label">INSTAGRAM_CLIENT_ID (server token exchange)</span>
  <span class="value ${igClientId ? "ok" : "err"}">${mask(igClientId)}</span>
</div>
<div class="row">
  <span class="label">EXPO_PUBLIC_INSTAGRAM_CLIENT_ID (mobile auth URL)</span>
  <span class="value ${igPublicId ? "ok" : "err"}">${mask(igPublicId)}</span>
</div>
<div class="row">
  <span class="label">FACEBOOK_APP_ID</span>
  <span class="value ${fbAppId ? "ok" : "warn"}">${mask(fbAppId)}</span>
</div>
<div class="row">
  <span class="label">EXPO_PUBLIC_FACEBOOK_CLIENT_ID (mobile auth URL)</span>
  <span class="value ${fbPublicId ? "ok" : "warn"}">${mask(fbPublicId)}</span>
</div>
<div class="row">
  <span class="label">TWITTER_CLIENT_ID</span>
  <span class="value ${xClientId ? "ok" : "warn"}">${mask(xClientId)}</span>
</div>
${igClientId && igPublicId
  ? igClientId === igPublicId
    ? `<div class="row"><span class="label">IG client_id match?</span><span class="value ok">✅ Match — both equal FACEBOOK_APP_ID</span></div>`
    : `<div class="row"><span class="label">IG client_id match?</span><span class="value err">❌ MISMATCH — INSTAGRAM_CLIENT_ID ≠ EXPO_PUBLIC_INSTAGRAM_CLIENT_ID</span></div>`
  : ""}
</div>

<div class="card">
<h2>Test Instagram Auth</h2>
<p style="color:#64748b;font-size:13px;margin-bottom:8px;">
  Opens Instagram's real OAuth page. ✅ login screen = credentials correct. ❌ "invalid request" = redirect_uri or client_id mismatch.
</p>
<div class="url-block">${testAuthUrl.toString()}</div>
<a href="${testAuthUrl.toString()}" class="btn" target="_blank">→ Test Instagram Auth Now</a>
<div class="note">
  <strong>Checklist for "invalid request" error:</strong><br/>
  1. The redirect URI above is registered under <strong>Instagram Login → Settings</strong> (not just Facebook Login)<br/>
  2. <code>instagram_business_basic</code> is explicitly added under <strong>Instagram Login → Permissions</strong><br/>
  3. Your test account is listed as a Developer or Tester under <strong>App Roles</strong> (Dev Mode only)<br/>
  4. Your Instagram account is a <strong>Professional account</strong> (Business or Creator) connected to a Facebook Page
</div>
</div>
</div></body></html>`);
});

// ─── Developer Setup Guide ────────────────────────────────────────────────────
// Blocked in production — only useful during local / staging development.
router.get("/oauth/setup", (_req, res) => {
  if (process.env["NODE_ENV"] === "production") {
    res.status(404).end();
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(setupPage());
});

// ─── Facebook Data Deletion Callback ─────────────────────────────────────────
// Meta calls this URL when a user removes your app from their Facebook account.
// We must verify the signed_request, delete their data, and return a status URL.
// Register this URL in Meta App → Settings → Advanced → Data Deletion Instructions
// URL: POST https://<domain>/api/oauth/facebook/data-deletion
//
// Spec: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
router.post("/oauth/facebook/data-deletion", async (req, res): Promise<void> => {
  const appSecret = process.env["FACEBOOK_APP_SECRET"];
  if (!appSecret) {
    res.status(503).json({ error: "FACEBOOK_APP_SECRET not configured" });
    return;
  }

  // signed_request arrives as form-encoded body OR JSON body (or query param for GET-based tools)
  const body = (req.body ?? {}) as Record<string, string>;
  const rawSignedRequest: string | undefined =
    body["signed_request"] ??
    (req.query["signed_request"] as string | undefined);

  if (!rawSignedRequest) {
    res.status(400).json({ error: "signed_request parameter missing" });
    return;
  }

  // Parse: <base64url_sig>.<base64url_payload>
  const dotIdx = rawSignedRequest.indexOf(".");
  if (dotIdx === -1) {
    res.status(400).json({ error: "Malformed signed_request" });
    return;
  }
  const encodedSig = rawSignedRequest.slice(0, dotIdx);
  const encodedPayload = rawSignedRequest.slice(dotIdx + 1);

  // Verify HMAC-SHA256 signature
  const expectedSig = crypto
    .createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest("base64url");

  if (expectedSig !== encodedSig) {
    res.status(400).json({ error: "Invalid signed_request signature" });
    return;
  }

  let payload: { user_id?: string; algorithm?: string; issued_at?: number };
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as typeof payload;
  } catch {
    res.status(400).json({ error: "Could not parse signed_request payload" });
    return;
  }

  const facebookUserId = payload.user_id;
  if (!facebookUserId) {
    res.status(400).json({ error: "signed_request payload missing user_id" });
    return;
  }

  // Delete all Facebook-sourced data for this user
  // (the connected account row that holds the access token + profile data)
  const deleted = await db
    .delete(connectedAccountsTable)
    .where(
      and(
        eq(connectedAccountsTable.platform, "facebook"),
        eq(connectedAccountsTable.platformUserId, facebookUserId)
      )
    )
    .returning({ id: connectedAccountsTable.id, userId: connectedAccountsTable.userId });

  const confirmationCode = crypto
    .createHmac("sha256", STATE_SECRET)
    .update(`fb-deletion:${facebookUserId}:${Date.now()}`)
    .digest("hex")
    .slice(0, 16);

  req.log?.info(
    { facebookUserId, rowsDeleted: deleted.length, confirmationCode },
    "Facebook data deletion request processed"
  );

  res.json({
    url: `https://${DOMAIN}/api/oauth/facebook/deletion-status?id=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
});

// ─── Facebook Data Deletion Status ────────────────────────────────────────────
// Meta may fetch this URL to confirm deletion was completed.
router.get("/oauth/facebook/deletion-status", (req, res) => {
  const id = req.query["id"] as string | undefined;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/>
<title>Data Deletion Status — Rook</title>
<style>body{font-family:-apple-system,sans-serif;background:#0a0f1e;color:#e2e8f0;
  display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.card{background:#131929;border:1px solid #1e2d4a;border-radius:16px;padding:40px;
  max-width:480px;text-align:center;}
h1{color:#10B981;font-size:22px;margin:0 0 12px;}
p{color:#94a3b8;font-size:14px;line-height:1.6;margin:0;}
.code{font-family:monospace;font-size:12px;color:#64748b;margin-top:16px;}</style>
</head><body><div class="card">
<h1>✓ Data Deleted</h1>
<p>Your Facebook data has been removed from Rook's systems. All connected account data, access tokens, and associated profile information have been permanently deleted.</p>
${id ? `<p class="code">Confirmation ID: ${id}</p>` : ""}
</div></body></html>`);
});

// ─── HTML helpers ─────────────────────────────────────────────────────────────
function baseHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Rook</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
           background: #0a0f1e; color: #e2e8f0; min-height: 100vh; display: flex;
           align-items: center; justify-content: center; padding: 24px; }
    .card { background: #131929; border: 1px solid #1e2d4a; border-radius: 20px;
            padding: 40px; max-width: 480px; width: 100%; text-align: center; }
    .icon { font-size: 56px; margin-bottom: 20px; }
    h1 { font-size: 24px; font-weight: 800; color: #f8fafc; margin-bottom: 10px; }
    p { color: #94a3b8; line-height: 1.6; margin-bottom: 8px; }
    .badge { display: inline-block; background: #10B98122; color: #10B981;
             border: 1px solid #10B98144; border-radius: 20px; padding: 4px 14px;
             font-size: 13px; font-weight: 600; margin-bottom: 20px; }
    .btn { display: inline-block; background: #3B82F6; color: white; text-decoration: none;
           padding: 12px 28px; border-radius: 12px; font-weight: 600; margin-top: 20px;
           font-size: 15px; }
  </style>
</head>
<body><div class="card">${body}</div></body></html>`;
}

function successPage(title: string, message: string, username: string): string {
  return baseHtml(title, `
    <div class="icon">✅</div>
    <div class="badge">Verified</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p style="margin-top:16px;color:#64748b;font-size:13px;">
      Returning to Rook…
    </p>
    <script>
      // Auto-close for Android Chrome Custom Tabs / mobile browsers.
      // On iOS, ASWebAuthenticationSession already intercepted the redirect
      // before this page loads, so window.close() is a no-op there.
      setTimeout(function() { window.close(); }, 800);
    </script>
  `);
}

function errorPage(title: string, detail: string): string {
  return baseHtml(title, `
    <div class="icon">❌</div>
    <h1>${title}</h1>
    <p>${detail}</p>
    <p style="margin-top:16px;color:#64748b;font-size:13px;">
      Close this tab and try again in the Rook app.
    </p>
  `);
}

function setupPage(): string {
  const igCallback = `https://${DOMAIN}/api/oauth/instagram/callback`;
  const fbCallback = `https://${DOMAIN}/api/oauth/facebook/callback`;
  const privacyUrl = `https://${DOMAIN}/api/legal/privacy`;
  const termsUrl = `https://${DOMAIN}/api/legal/terms`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OAuth Setup Guide — Rook</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
           background: #0a0f1e; color: #e2e8f0; padding: 40px 24px 80px; }
    .container { max-width: 820px; margin: 0 auto; }
    .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 48px; }
    .logo-mark { width: 36px; height: 36px; background: #3B82F6; border-radius: 10px;
                 display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .logo-name { font-size: 20px; font-weight: 700; color: #f8fafc; }
    h1 { font-size: 30px; font-weight: 800; color: #f8fafc; margin-bottom: 8px; }
    .subtitle { color: #64748b; margin-bottom: 48px; font-size: 15px; }
    .platform { background: #131929; border: 1px solid #1e2d4a; border-radius: 16px;
                padding: 28px; margin-bottom: 28px; }
    .platform-header { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
    .platform-icon { font-size: 28px; }
    .platform-name { font-size: 18px; font-weight: 700; color: #f8fafc; }
    .platform-sub { font-size: 13px; color: #64748b; margin-top: 2px; }
    h3 { font-size: 13px; font-weight: 600; color: #94a3b8; text-transform: uppercase;
         letter-spacing: 0.5px; margin-bottom: 8px; }
    .url-block { background: #0d1525; border: 1px solid #1e2d4a; border-radius: 10px;
                 padding: 14px 16px; margin-bottom: 16px; }
    .url-label { font-size: 12px; color: #475569; margin-bottom: 6px; }
    .url-value { font-family: "SF Mono", "Fira Code", monospace; font-size: 13px;
                 color: #60a5fa; word-break: break-all; }
    .copy-btn { float: right; background: #1e2d4a; color: #94a3b8; border: none;
                border-radius: 6px; padding: 3px 10px; font-size: 11px; cursor: pointer;
                margin-top: -2px; font-family: inherit; }
    .copy-btn:hover { background: #2d3f5a; color: #e2e8f0; }
    .step { display: flex; gap: 14px; margin-bottom: 12px; align-items: flex-start; }
    .step-num { background: #3B82F6; color: white; border-radius: 50%; width: 24px; height: 24px;
                display: flex; align-items: center; justify-content: center; font-size: 12px;
                font-weight: 700; flex-shrink: 0; margin-top: 1px; }
    .step-text { color: #94a3b8; font-size: 14px; line-height: 1.6; }
    .step-text a { color: #60a5fa; }
    .step-text code { background: #1e2d4a; padding: 2px 6px; border-radius: 4px;
                      font-family: monospace; font-size: 12px; color: #f0abfc; }
    .secrets-block { background: #0d1525; border: 1px solid #7C3AED44; border-radius: 10px;
                     padding: 16px; margin: 8px 0 16px; }
    .secret-row { display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px; font-size: 13px; }
    .secret-key { font-family: monospace; color: #f0abfc; min-width: 200px; }
    .secret-desc { color: #64748b; font-size: 12px; }
    .badge-live { display: inline-block; background: #10B98122; color: #10B981;
                  border: 1px solid #10B98144; border-radius: 20px; padding: 2px 10px;
                  font-size: 11px; font-weight: 600; margin-left: 8px; vertical-align: middle; }
    .badge-needed { display: inline-block; background: #F59E0B22; color: #F59E0B;
                    border: 1px solid #F59E0B44; border-radius: 20px; padding: 2px 10px;
                    font-size: 11px; font-weight: 600; margin-left: 8px; vertical-align: middle; }
    .divider { border: none; border-top: 1px solid #1e2d4a; margin: 32px 0; }
  </style>
  <script>
    function copy(id) {
      const el = document.getElementById(id);
      navigator.clipboard.writeText(el.textContent.trim()).then(() => {
        const btn = el.parentElement.querySelector('.copy-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 1500);
      });
    }
  </script>
</head>
<body>
<div class="container">
  <div class="logo">
    <div class="logo-mark">🛡</div>
    <span class="logo-name">Rook</span>
  </div>

  <h1>Social OAuth Setup Guide</h1>
  <p class="subtitle">All the URLs and credentials you need to configure Instagram and Facebook developer apps.</p>

  <!-- Legal URLs (needed first) -->
  <div class="platform">
    <div class="platform-header">
      <span class="platform-icon">📄</span>
      <div>
        <div class="platform-name">Legal Pages <span class="badge-live">Live</span></div>
        <div class="platform-sub">These pages are live — copy the URLs directly into Meta's developer portal.</div>
      </div>
    </div>

    <h3>Privacy Policy URL (required by Meta)</h3>
    <div class="url-block">
      <div class="url-label">Copy this exact URL into the Meta App Dashboard → Basic Settings → Privacy Policy URL</div>
      <button class="copy-btn" onclick="copy('pp-url')">Copy</button>
      <div class="url-value" id="pp-url">${privacyUrl}</div>
    </div>

    <h3>Terms of Service URL (required by Meta)</h3>
    <div class="url-block">
      <div class="url-label">Copy this into Meta App Dashboard → Basic Settings → Terms of Service URL</div>
      <button class="copy-btn" onclick="copy('tos-url')">Copy</button>
      <div class="url-value" id="tos-url">${termsUrl}</div>
    </div>
  </div>

  <!-- Instagram -->
  <div class="platform">
    <div class="platform-header">
      <span class="platform-icon">📸</span>
      <div>
        <div class="platform-name">Instagram Login <span class="badge-needed">Needs Setup</span></div>
        <div class="platform-sub">Via Meta for Developers — add the Instagram Login product to your app</div>
      </div>
    </div>

    <h3>Step 1 — Create Your Meta App</h3>
    <div class="step"><div class="step-num">1</div><div class="step-text">Go to <a href="https://developers.facebook.com/apps" target="_blank">developers.facebook.com/apps</a> and click <strong>Create App</strong>.</div></div>
    <div class="step"><div class="step-num">2</div><div class="step-text">Choose <strong>Consumer</strong> as the app type. Name it "Rook" (or any name).</div></div>
    <div class="step"><div class="step-num">3</div><div class="step-text">In <strong>Basic Settings</strong>, paste your Privacy Policy URL and Terms of Service URL from the section above.</div></div>
    <div class="step"><div class="step-num">4</div><div class="step-text">Add the <strong>Instagram Login</strong> product from the Products panel → Add Product.</div></div>

    <h3>Step 2 — Configure the OAuth Redirect URI</h3>
    <div class="url-block">
      <div class="url-label">Instagram Login → Settings → Valid OAuth Redirect URIs — Add this URL:</div>
      <button class="copy-btn" onclick="copy('ig-redirect')">Copy</button>
      <div class="url-value" id="ig-redirect">${igCallback}</div>
    </div>
    <div class="url-block">
      <div class="url-label">Also add to: Instagram Login → Settings → Deauthorize Callback URL</div>
      <button class="copy-btn" onclick="copy('ig-deauth')">Copy</button>
      <div class="url-value" id="ig-deauth">https://${DOMAIN}/api/oauth/instagram/deauthorize</div>
    </div>

    <h3>Step 3 — Add Environment Secrets</h3>
    <p style="color:#64748b;font-size:13px;margin-bottom:10px;">After creating the app, go to Instagram Login → Settings and copy these values:</p>
    <div class="secrets-block">
      <div class="secret-row"><span class="secret-key">INSTAGRAM_CLIENT_ID</span><span class="secret-desc">Instagram App ID (from Instagram Login → Settings)</span></div>
      <div class="secret-row"><span class="secret-key">INSTAGRAM_CLIENT_SECRET</span><span class="secret-desc">Instagram App Secret (from Instagram Login → Settings)</span></div>
      <div class="secret-row"><span class="secret-key">EXPO_PUBLIC_INSTAGRAM_CLIENT_ID</span><span class="secret-desc">Same value as INSTAGRAM_CLIENT_ID (used by the mobile app)</span></div>
    </div>
    <p style="color:#64748b;font-size:12px;">Add these in Replit → Secrets (the padlock icon in the left panel).</p>

    <h3>Step 4 — Add Test Users</h3>
    <div class="step"><div class="step-num">1</div><div class="step-text">In your Meta App → Roles → Instagram Testers, add your Instagram account.</div></div>
    <div class="step"><div class="step-num">2</div><div class="step-text">Accept the tester invite from your Instagram account (Settings → Apps and Websites → Tester Invites).</div></div>
    <div class="step"><div class="step-num">3</div><div class="step-text">You're ready to test OAuth! The app works in sandbox mode without App Review for your test accounts.</div></div>
  </div>

  <!-- Facebook -->
  <div class="platform">
    <div class="platform-header">
      <span class="platform-icon">📘</span>
      <div>
        <div class="platform-name">Facebook Login <span class="badge-needed">Needs Setup</span></div>
        <div class="platform-sub">Uses the same Meta app — just add Facebook Login product</div>
      </div>
    </div>

    <h3>OAuth Redirect URI</h3>
    <div class="url-block">
      <div class="url-label">Facebook Login → Settings → Valid OAuth Redirect URIs — Add this URL:</div>
      <button class="copy-btn" onclick="copy('fb-redirect')">Copy</button>
      <div class="url-value" id="fb-redirect">${fbCallback}</div>
    </div>

    <h3>Environment Secrets</h3>
    <div class="secrets-block">
      <div class="secret-row"><span class="secret-key">FACEBOOK_APP_ID</span><span class="secret-desc">App ID from Meta App Dashboard → Basic Settings</span></div>
      <div class="secret-row"><span class="secret-key">FACEBOOK_APP_SECRET</span><span class="secret-desc">App Secret from Meta App Dashboard → Basic Settings</span></div>
      <div class="secret-row"><span class="secret-key">EXPO_PUBLIC_FACEBOOK_CLIENT_ID</span><span class="secret-desc">Same value as FACEBOOK_APP_ID</span></div>
    </div>
  </div>

  <hr class="divider" />

  <!-- Mobile redirect URI -->
  <div class="platform">
    <div class="platform-header">
      <span class="platform-icon">📱</span>
      <div>
        <div class="platform-name">Mobile App Redirect URI</div>
        <div class="platform-sub">Used when OAuth is triggered from inside the Expo app via expo-auth-session</div>
      </div>
    </div>
    <h3>Also add this URI to Valid OAuth Redirect URIs for both Instagram and Facebook</h3>
    <div class="url-block">
      <div class="url-label">This is the deep-link URI expo-auth-session uses when running in Expo Go on a device:</div>
      <button class="copy-btn" onclick="copy('expo-redirect')">Copy</button>
      <div class="url-value" id="expo-redirect">https://auth.expo.io/@your-expo-username/rook</div>
    </div>
    <p style="color:#64748b;font-size:12px;margin-top:8px;">Replace <code style="background:#1e2d4a;padding:2px 5px;border-radius:4px;font-size:11px;color:#f0abfc">your-expo-username</code> with your actual Expo account username. Find it at <a href="https://expo.dev" target="_blank" style="color:#60a5fa">expo.dev</a>.</p>
  </div>

  <hr class="divider" />

  <!-- What happens after -->
  <div class="platform">
    <div class="platform-header">
      <span class="platform-icon">🔄</span>
      <div>
        <div class="platform-name">What Happens After Setup</div>
        <div class="platform-sub">The full monitoring loop once credentials are in place</div>
      </div>
    </div>
    <div class="step"><div class="step-num">1</div><div class="step-text">User taps "Sign in with Instagram" in the app → OAuth flow opens in system browser.</div></div>
    <div class="step"><div class="step-num">2</div><div class="step-text">User approves → Instagram redirects to <code style="background:#1e2d4a;padding:2px 5px;border-radius:4px;color:#f0abfc">/api/oauth/instagram/callback</code> with an auth code.</div></div>
    <div class="step"><div class="step-num">3</div><div class="step-text">The server exchanges the code for a 60-day access token and fetches the real username.</div></div>
    <div class="step"><div class="step-num">4</div><div class="step-text">The account is saved as <strong>verified</strong> in the database with the real token.</div></div>
    <div class="step"><div class="step-num">5</div><div class="step-text">Scan jobs can now call the Instagram API with the stored token to fetch posts and photos for comparison.</div></div>
  </div>

</div>
</body>
</html>`;
}

// ── Vision API smoke test ─────────────────────────────────────────────────────
// GET /api/oauth/debug/vision — dev-only, not available in production.
router.get("/oauth/debug/vision", async (_req, res) => {
  if (process.env["NODE_ENV"] === "production") {
    res.status(404).end();
    return;
  }
  const apiKey = process.env["GOOGLE_VISION_API_KEY"];
  if (!apiKey) {
    res.status(503).json({ ok: false, error: "GOOGLE_VISION_API_KEY not set" });
    return;
  }

  // Wikimedia public domain image — stable URL, always fetchable by Vision
  const testImageUri = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png";

  try {
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { source: { imageUri: testImageUri } },
            features: [{ type: "WEB_DETECTION", maxResults: 5 }],
          }],
        }),
      }
    );

    const body = await visionRes.json() as Record<string, unknown>;

    if (!visionRes.ok) {
      res.status(visionRes.status).json({ ok: false, httpStatus: visionRes.status, body });
      return;
    }

    const responses = (body as { responses?: unknown[] }).responses ?? [];
    const first = responses[0] as Record<string, unknown> | undefined;
    const webDetection = first?.["webDetection"] as Record<string, unknown> | undefined;

    res.json({
      ok: true,
      httpStatus: visionRes.status,
      visionApiEnabled: true,
      pagesWithMatchingImages: (webDetection?.["pagesWithMatchingImages"] as unknown[] | undefined)?.length ?? 0,
      webEntities: (webDetection?.["webEntities"] as unknown[] | undefined)?.slice(0, 3),
      message: "Cloud Vision WEB_DETECTION is working correctly ✓",
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
