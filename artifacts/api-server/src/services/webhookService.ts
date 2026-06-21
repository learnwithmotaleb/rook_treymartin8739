/**
 * Webhook Delivery Service
 *
 * Delivers signed JSON payloads to registered webhook endpoints.
 * Signature: HMAC-SHA256 of the raw JSON body using the webhook's signing secret.
 * Signature header: X-Rook-Signature: sha256=<hex>
 *
 * Retry logic: up to 3 attempts with 2x/4x exponential backoff.
 * Delivery state is tracked in webhook_delivery_log table.
 * A setInterval retry loop runs in-process — no external queue dependency.
 */

import crypto from "crypto";
import { eq, and, lt, lte } from "drizzle-orm";
import {
  db,
  webhooksTable,
  webhookDeliveryLogTable,
  apiKeysTable,
} from "@workspace/db";
import { logger } from "../lib/logger";

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [0, 120_000, 480_000]; // 0m, 2m, 8m

// ─── Payload signing ──────────────────────────────────────────────────────────

function signPayload(secret: string, body: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

// ─── HTTP delivery ────────────────────────────────────────────────────────────

async function postWebhook(
  url: string,
  body: string,
  signature: string
): Promise<{ ok: boolean; code: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Rook-Signature": signature,
        "User-Agent": "Rook-Webhooks/1.0",
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return { ok: resp.status >= 200 && resp.status < 300, code: resp.status };
  } catch {
    clearTimeout(timeout);
    return { ok: false, code: 0 };
  }
}

// ─── Main deliver function ────────────────────────────────────────────────────

/**
 * Deliver an event to all active webhooks for the given API key owner.
 * Called inline after scan completes or threat is detected.
 * On failure, creates a retry record in webhook_delivery_log.
 */
export async function deliverEvent(
  ownerUserId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Find all API keys belonging to this user
  const keys = await db
    .select({ id: apiKeysTable.id })
    .from(apiKeysTable)
    .where(eq(apiKeysTable.userId, ownerUserId));

  if (keys.length === 0) return;

  const keyIds = keys.map((k) => k.id);

  // Find all active webhooks for these keys that subscribe to this event
  const hooks = await db
    .select()
    .from(webhooksTable)
    .where(eq(webhooksTable.active, true));

  const relevantHooks = hooks.filter(
    (h) => keyIds.includes(h.apiKeyId) &&
    (JSON.parse(h.eventsJson) as string[]).includes(eventType)
  );

  if (relevantHooks.length === 0) return;

  const body = JSON.stringify({
    event: eventType,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  for (const hook of relevantHooks) {
    const signature = signPayload(hook.signingSecret, body);
    const { ok, code } = await postWebhook(hook.url, body, signature);

    if (ok) {
      // Log successful delivery
      await db.insert(webhookDeliveryLogTable).values({
        webhookId: hook.id,
        eventType,
        payloadJson: body,
        status: "delivered",
        attempts: 1,
        deliveredAt: new Date(),
        responseCode: code,
      });
    } else {
      // Schedule first retry
      const nextRetryAt = new Date(Date.now() + RETRY_DELAYS_MS[1]!);
      await db.insert(webhookDeliveryLogTable).values({
        webhookId: hook.id,
        eventType,
        payloadJson: body,
        status: "pending",
        attempts: 1,
        nextRetryAt,
        responseCode: code === 0 ? null : code,
      });

      logger.warn({ webhookId: hook.id, url: hook.url, code }, "Webhook delivery failed — scheduled retry");
    }
  }
}

// ─── Retry loop ───────────────────────────────────────────────────────────────

async function runRetries(): Promise<void> {
  const now = new Date();

  try {
    const pending = await db
      .select()
      .from(webhookDeliveryLogTable)
      .where(
        and(
          eq(webhookDeliveryLogTable.status, "pending"),
          lte(webhookDeliveryLogTable.nextRetryAt, now)
        )
      )
      .limit(20);

    for (const log of pending) {
      if (log.attempts >= MAX_ATTEMPTS) {
        await db
          .update(webhookDeliveryLogTable)
          .set({ status: "failed" })
          .where(eq(webhookDeliveryLogTable.id, log.id));
        continue;
      }

      const [hook] = await db
        .select()
        .from(webhooksTable)
        .where(eq(webhooksTable.id, log.webhookId));

      if (!hook || !hook.active) {
        await db
          .update(webhookDeliveryLogTable)
          .set({ status: "failed" })
          .where(eq(webhookDeliveryLogTable.id, log.id));
        continue;
      }

      const signature = signPayload(hook.signingSecret, log.payloadJson);
      const { ok, code } = await postWebhook(hook.url, log.payloadJson, signature);
      const newAttempts = log.attempts + 1;

      if (ok) {
        await db
          .update(webhookDeliveryLogTable)
          .set({ status: "delivered", attempts: newAttempts, deliveredAt: new Date(), responseCode: code })
          .where(eq(webhookDeliveryLogTable.id, log.id));
      } else {
        const nextDelay = RETRY_DELAYS_MS[newAttempts] ?? null;
        await db
          .update(webhookDeliveryLogTable)
          .set({
            attempts: newAttempts,
            status: newAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
            nextRetryAt: nextDelay ? new Date(Date.now() + nextDelay) : null,
            responseCode: code === 0 ? null : code,
          })
          .where(eq(webhookDeliveryLogTable.id, log.id));
      }
    }
  } catch (err) {
    logger.warn({ err }, "Webhook retry loop error");
  }
}

/** Start the background retry loop. Call once at server startup. */
export function startWebhookRetryLoop(): void {
  setInterval(() => {
    runRetries().catch(() => {});
  }, 60_000);
  logger.info({}, "Webhook retry loop started (60s interval)");
}
