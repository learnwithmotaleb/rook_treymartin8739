import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, connectedAccountsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

const DOMAIN = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim()
  ?? process.env["REPLIT_DEV_DOMAIN"]
  ?? "localhost";

// ── HMAC-signed OAuth state token ────────────────────────────────────────────
// Solves the Clerk JWT expiry problem: Clerk JWTs live ~60 s, but a user
// might take several minutes on the Facebook/Instagram consent screen.
// Instead we generate our own HMAC-signed token with a 15-minute window.

const STATE_SECRET = process.env["SESSION_SECRET"] ?? "dev-fallback-change-in-prod";

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
      // expired / invalid — fall through to demo
    }
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
    // Exchange code for short-lived token
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      redirect_uri: `https://${DOMAIN}/api/oauth/instagram/callback`,
      code,
    });

    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: tokenParams,
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Token exchange failed: ${text}`);
    }

    const { access_token, user_id } = await tokenRes.json() as {
      access_token: string;
      user_id: number;
    };

    // Fetch profile — instagram_business_basic scope provides followers_count + profile_picture_url
    const profileRes = await fetch(
      `https://graph.instagram.com/${user_id}?fields=id,username,followers_count,profile_picture_url&access_token=${access_token}`
    );
    const profile = await profileRes.json() as {
      id: string;
      username: string;
      followers_count?: number;
      profile_picture_url?: string;
    };

    // Exchange for long-lived token (60 days)
    const longLivedRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${access_token}`
    );
    const { access_token: longToken } = await longLivedRes.json() as { access_token: string };

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

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(successPage(
      "Instagram Connected!",
      `@${profile.username} is now verified and being monitored by ShieldID.`,
      profile.username
    ));
  } catch (err: any) {
    req.log?.error({ err }, "Instagram OAuth callback error");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(500).send(errorPage("Connection Failed", err.message ?? "Unexpected error"));
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
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${code}`;

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json() as { access_token?: string; error?: { message: string } };

    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error?.message ?? `Token exchange failed (HTTP ${tokenRes.status})`);
    }

    const { access_token } = tokenData;

    const profileRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name&access_token=${access_token}`
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

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(successPage("Facebook Connected!", `${profile.name} is now being monitored by ShieldID.`, profile.name));
  } catch (err: any) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(500).send(errorPage("Connection Failed", err.message));
  }
});

// ─── OAuth config — returns the current redirect URIs for this deployment ────
// Used by the mobile app to keep its redirect_uri in sync with the server.
router.get("/oauth/redirect-uris", (_req, res) => {
  res.json({
    instagram: `https://${DOMAIN}/api/oauth/instagram/callback`,
    facebook:  `https://${DOMAIN}/api/oauth/facebook/callback`,
  });
});

// ─── Developer Setup Guide ────────────────────────────────────────────────────
router.get("/oauth/setup", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(setupPage());
});

// ─── HTML helpers ─────────────────────────────────────────────────────────────
function baseHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — ShieldID</title>
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
      Returning to ShieldID…
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
      Close this tab and try again in the ShieldID app.
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
  <title>OAuth Setup Guide — ShieldID</title>
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
    <span class="logo-name">ShieldID</span>
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
    <div class="step"><div class="step-num">2</div><div class="step-text">Choose <strong>Consumer</strong> as the app type. Name it "ShieldID" (or any name).</div></div>
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
      <div class="url-value" id="expo-redirect">https://auth.expo.io/@your-expo-username/shieldid</div>
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

export default router;
