/**
 * Developer API — /api/v1/*
 *
 * External REST API for brand protection teams, security vendors, and platform integrations.
 * Auth: Bearer API key (sid_live_xxxx) via apiKeyAuth middleware.
 * Management endpoints (key/webhook CRUD) use Clerk session auth.
 *
 * All data-plane routes reuse existing business logic services —
 * no new AI calls, no new external API dependencies.
 */

import { Router, type IRouter } from "express";
import crypto from "crypto";
import { eq, and, isNull } from "drizzle-orm";
import {
  db,
  apiKeysTable,
  webhooksTable,
  webhookDeliveryLogTable,
  threatsTable,
  scanJobsTable,
  usersTable,
  subscriptionsTable,
  threatActorsTable,
} from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { apiKeyAuth } from "../middleware/apiKeyAuth";
import { rateLimitMiddleware } from "../services/apiKeyRateLimiter";
import { startScan } from "../services/scanOrchestrator";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const secret = crypto.randomBytes(32).toString("hex");
  const raw = `sid_live_${secret}`;
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const prefix = secret.slice(0, 8);
  return { raw, hash, prefix };
}

function generateSigningSecret(): string {
  return crypto.randomBytes(24).toString("hex");
}

// ─── Management routes (Clerk session auth) ───────────────────────────────────

/** Create a new API key. Returns the raw key once — store it now. */
router.post("/v1/keys", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId;
  const name = (req.body as { name?: string }).name ?? "Default";

  const { raw, hash, prefix } = generateApiKey();

  const [key] = await db
    .insert(apiKeysTable)
    .values({ userId, keyHash: hash, keyPrefix: prefix, name })
    .returning({ id: apiKeysTable.id, name: apiKeysTable.name, keyPrefix: apiKeysTable.keyPrefix, createdAt: apiKeysTable.createdAt });

  res.status(201).json({
    id: key!.id,
    name: key!.name,
    keyPrefix: key!.keyPrefix,
    key: raw, // shown once — never stored in plaintext
    createdAt: key!.createdAt,
    message: "Store this key securely — it will not be shown again.",
  });
});

/** List all API keys for the authenticated user (without the raw key). */
router.get("/v1/keys", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId;

  const keys = await db
    .select({
      id: apiKeysTable.id,
      name: apiKeysTable.name,
      keyPrefix: apiKeysTable.keyPrefix,
      rateLimitRpm: apiKeysTable.rateLimitRpm,
      createdAt: apiKeysTable.createdAt,
      lastUsedAt: apiKeysTable.lastUsedAt,
      revokedAt: apiKeysTable.revokedAt,
    })
    .from(apiKeysTable)
    .where(eq(apiKeysTable.userId, userId))
    .orderBy(apiKeysTable.createdAt);

  res.json(keys.map((k) => ({
    ...k,
    createdAt: k.createdAt.toISOString(),
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
    active: !k.revokedAt,
  })));
});

/** Revoke an API key. */
router.delete("/v1/keys/:keyId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId;
  const keyId = Array.isArray(req.params.keyId) ? req.params.keyId[0]! : req.params.keyId!;

  const [updated] = await db
    .update(apiKeysTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeysTable.id, keyId), eq(apiKeysTable.userId, userId)))
    .returning({ id: apiKeysTable.id });

  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  res.json({ revoked: true, id: updated.id });
});

/** Register a webhook endpoint. */
router.post("/v1/webhooks", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId;
  const { apiKeyId, url, events } = req.body as { apiKeyId: string; url: string; events?: string[] };

  if (!apiKeyId || !url) {
    res.status(400).json({ error: "apiKeyId and url are required" });
    return;
  }

  // Verify the API key belongs to this user
  const [key] = await db
    .select({ id: apiKeysTable.id })
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.id, apiKeyId), eq(apiKeysTable.userId, userId)));

  if (!key) {
    res.status(403).json({ error: "API key not found or not owned by you" });
    return;
  }

  const signingSecret = generateSigningSecret();
  const eventsJson = JSON.stringify(events ?? ["threat.detected", "scan.completed"]);

  const [hook] = await db
    .insert(webhooksTable)
    .values({ apiKeyId, url, eventsJson, signingSecret })
    .returning();

  res.status(201).json({
    id: hook!.id,
    url: hook!.url,
    events: JSON.parse(eventsJson) as string[],
    signingSecret, // shown once
    active: true,
    createdAt: hook!.createdAt,
    message: "Store the signing secret — it will not be shown again.",
  });
});

/** List webhooks for a specific API key. */
router.get("/v1/webhooks", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId;

  const keys = await db
    .select({ id: apiKeysTable.id })
    .from(apiKeysTable)
    .where(eq(apiKeysTable.userId, userId));

  const keyIds = keys.map((k) => k.id);
  if (keyIds.length === 0) { res.json([]); return; }

  const hooks = await db.select().from(webhooksTable);
  const userHooks = hooks.filter((h) => keyIds.includes(h.apiKeyId));

  res.json(userHooks.map((h) => ({
    id: h.id,
    apiKeyId: h.apiKeyId,
    url: h.url,
    events: JSON.parse(h.eventsJson) as string[],
    active: h.active,
    createdAt: h.createdAt.toISOString(),
  })));
});

/** Delete/deactivate a webhook. */
router.delete("/v1/webhooks/:hookId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId;
  const hookId = Array.isArray(req.params.hookId) ? req.params.hookId[0]! : req.params.hookId!;

  // Verify ownership via API key
  const [hook] = await db
    .select()
    .from(webhooksTable)
    .where(eq(webhooksTable.id, hookId));

  if (!hook) { res.status(404).json({ error: "not_found" }); return; }

  const [key] = await db
    .select({ id: apiKeysTable.id })
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.id, hook.apiKeyId), eq(apiKeysTable.userId, userId)));

  if (!key) { res.status(403).json({ error: "forbidden" }); return; }

  await db
    .update(webhooksTable)
    .set({ active: false })
    .where(eq(webhooksTable.id, hookId));

  res.json({ deleted: true, id: hookId });
});

// ─── Data-plane routes (API key auth) ────────────────────────────────────────

const apiKeyMiddleware = [apiKeyAuth, rateLimitMiddleware()];

/**
 * Trigger an on-demand scan for the API key owner's identity.
 * Reuses the full existing scan pipeline including cache and quota checks.
 */
router.post("/v1/scans", ...apiKeyMiddleware, async (req, res): Promise<void> => {
  const userId = req.apiKeyUserId!;

  try {
    // Look up the user and their subscription tier
    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }

    const [sub] = await db
      .select({ tier: subscriptionsTable.tier })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, userId));

    const planTier = (sub?.tier ?? "free") as "free" | "pro" | "premium";
    const job = await startScan(userId, planTier);

    res.status(202).json({
      scanId: job.id,
      status: job.status,
      pollUrl: `/api/v1/scans/${job.id}`,
      message: "Scan started. Poll pollUrl for status.",
    });
  } catch (err) {
    logger.error({ err, userId }, "v1 scan start failed");
    res.status(500).json({ error: "scan_failed" });
  }
});

/** Poll scan status. */
router.get("/v1/scans/:scanId", ...apiKeyMiddleware, async (req, res): Promise<void> => {
  const userId = req.apiKeyUserId!;
  const scanId = Array.isArray(req.params.scanId) ? req.params.scanId[0]! : req.params.scanId!;

  const [job] = await db
    .select()
    .from(scanJobsTable)
    .where(and(eq(scanJobsTable.id, scanId), eq(scanJobsTable.userId, userId)));

  if (!job) { res.status(404).json({ error: "not_found" }); return; }

  res.json({
    scanId: job.id,
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep,
    threatsFound: job.threatsFound,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  });
});

/** List all threats for the API key owner. */
router.get("/v1/threats", ...apiKeyMiddleware, async (req, res): Promise<void> => {
  const userId = req.apiKeyUserId!;
  const { severity, resolved, limit = "50", offset = "0" } = req.query as Record<string, string>;

  const conditions = [eq(threatsTable.userId, userId)];
  if (severity && ["high", "medium", "low"].includes(severity)) {
    conditions.push(eq(threatsTable.severity, severity));
  }
  if (resolved !== undefined) {
    conditions.push(eq(threatsTable.resolved, resolved === "true"));
  }

  const rows = await db
    .select({
      id: threatsTable.id,
      type: threatsTable.type,
      severity: threatsTable.severity,
      platform: threatsTable.platform,
      title: threatsTable.title,
      description: threatsTable.description,
      threatScore: threatsTable.threatScore,
      suspiciousUsername: threatsTable.suspiciousUsername,
      resolved: threatsTable.resolved,
      threatActorId: threatsTable.threatActorId,
      createdAt: threatsTable.createdAt,
    })
    .from(threatsTable)
    .where(and(...conditions))
    .orderBy(threatsTable.createdAt)
    .limit(Math.min(parseInt(limit, 10), 100))
    .offset(Math.max(parseInt(offset, 10), 0));

  res.json(rows.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  })));
});

/** Get a single threat with actor intelligence. */
router.get("/v1/threats/:threatId", ...apiKeyMiddleware, async (req, res): Promise<void> => {
  const userId = req.apiKeyUserId!;
  const threatId = Array.isArray(req.params.threatId) ? req.params.threatId[0]! : req.params.threatId!;

  const [threat] = await db
    .select()
    .from(threatsTable)
    .where(and(eq(threatsTable.id, threatId), eq(threatsTable.userId, userId)));

  if (!threat) { res.status(404).json({ error: "not_found" }); return; }

  let threatActor = null;
  if (threat.threatActorId) {
    const [actor] = await db
      .select()
      .from(threatActorsTable)
      .where(eq(threatActorsTable.id, threat.threatActorId));

    if (actor) {
      threatActor = {
        id: actor.id,
        canonicalUsername: actor.canonicalUsername,
        victimCount: actor.victimCount,
        platformSpread: JSON.parse(actor.platformSetJson ?? "[]") as string[],
        firstSeen: actor.firstSeen.toISOString(),
        lastSeen: actor.lastSeen.toISOString(),
        confidenceScore: actor.confidenceScore,
      };
    }
  }

  res.json({
    id: threat.id,
    type: threat.type,
    severity: threat.severity,
    platform: threat.platform,
    title: threat.title,
    description: threat.description,
    details: threat.details,
    aiExplanation: threat.aiExplanation,
    threatScore: threat.threatScore,
    suspiciousUsername: threat.suspiciousUsername,
    matchedMediaCount: threat.matchedMediaCount,
    resolved: threat.resolved,
    resolvedAt: threat.resolvedAt?.toISOString() ?? null,
    createdAt: threat.createdAt.toISOString(),
    threatActor,
  });
});

// ─── Developer documentation ──────────────────────────────────────────────────

router.get("/v1/docs", (_req, res): void => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Rook Developer API</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 860px; margin: 48px auto; padding: 0 24px; color: #1a1a2e; line-height: 1.6; }
  h1 { color: #6c63ff; } h2 { border-bottom: 1px solid #e0e0ff; padding-bottom: 8px; margin-top: 40px; }
  code, pre { background: #f4f4ff; border-radius: 6px; }
  code { padding: 2px 6px; font-size: 0.9em; }
  pre { padding: 16px; overflow-x: auto; font-size: 0.85em; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 700; margin-right: 8px; }
  .post { background: #d4edda; color: #155724; } .get { background: #cce5ff; color: #004085; }
  .del { background: #f8d7da; color: #721c24; } .endpoint { margin: 20px 0; }
</style>
</head>
<body>
<h1>Rook Developer API</h1>
<p>Base URL: <code>/api/v1</code> &nbsp;·&nbsp; All requests must include <code>Authorization: Bearer sid_live_xxxx</code></p>

<h2>Authentication</h2>
<p>Generate an API key via <code>POST /api/v1/keys</code> (requires a Rook account). Keys are shown once at creation — store them securely.</p>

<h2>Rate Limits</h2>
<p>Default: 60 requests/minute per key. Returns <code>429</code> with <code>retry_after_ms</code> on breach.</p>

<h2>Key Management (session auth)</h2>
<div class="endpoint"><span class="badge post">POST</span><code>/api/v1/keys</code> — Create API key. Body: <code>{ "name": "My App" }</code></div>
<div class="endpoint"><span class="badge get">GET</span><code>/api/v1/keys</code> — List your API keys.</div>
<div class="endpoint"><span class="badge del">DELETE</span><code>/api/v1/keys/:id</code> — Revoke a key.</div>

<h2>Webhook Management (session auth)</h2>
<div class="endpoint"><span class="badge post">POST</span><code>/api/v1/webhooks</code> — Register endpoint. Body: <code>{ "apiKeyId": "...", "url": "https://...", "events": ["threat.detected"] }</code></div>
<div class="endpoint"><span class="badge get">GET</span><code>/api/v1/webhooks</code> — List webhooks.</div>
<div class="endpoint"><span class="badge del">DELETE</span><code>/api/v1/webhooks/:id</code> — Remove webhook.</div>

<h2>Scans (API key auth)</h2>
<div class="endpoint"><span class="badge post">POST</span><code>/api/v1/scans</code> — Trigger scan. Returns <code>{ scanId, pollUrl }</code>.</div>
<div class="endpoint"><span class="badge get">GET</span><code>/api/v1/scans/:scanId</code> — Poll status: <code>queued → running → completed</code>.</div>

<h2>Threats (API key auth)</h2>
<div class="endpoint"><span class="badge get">GET</span><code>/api/v1/threats</code> — List threats. Params: <code>severity</code>, <code>resolved</code>, <code>limit</code>, <code>offset</code>.</div>
<div class="endpoint"><span class="badge get">GET</span><code>/api/v1/threats/:id</code> — Full threat detail including <code>threatActor</code> intelligence.</div>

<h2>Webhook Payload</h2>
<pre>POST https://your-endpoint.com/webhook
X-Rook-Signature: sha256=&lt;hmac-hex&gt;
Content-Type: application/json

{
  "event": "threat.detected",
  "timestamp": "2026-06-11T12:00:00.000Z",
  "data": { "threatId": "...", "severity": "high", "platform": "instagram", ... }
}</pre>

<h2>Signature Verification (Node.js)</h2>
<pre>import crypto from 'crypto';
const sig = req.headers['x-rook-signature'];
const expected = 'sha256=' + crypto.createHmac('sha256', SIGNING_SECRET)
  .update(req.rawBody).digest('hex');
const valid = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));</pre>

<p style="margin-top:48px;color:#888;">Rook API v1 · Questions? <a href="/api/legal/support">Support</a></p>
</body>
</html>`);
});

export default router;
