/**
 * API Cost Tracker
 *
 * Logs every external API call with its estimated cost.  All writes are
 * fire-and-forget so a tracking failure never blocks a scan.
 *
 * Estimated costs (conservative; update as pricing changes):
 *   OpenAI gpt-4o explanation:       $0.0025 / 1K tokens → ~$0.0005 per call
 *   OpenAI gpt-5.1 scam analysis:    $0.0150 / 1K tokens → ~$0.0060 per call
 *   Google Cloud Vision:             $1.50  / 1K images  → $0.0015 per image
 *   Google CSE:                      $5.00  / 1K queries → $0.0050 per query
 */

import { and, eq, gte, sql } from "drizzle-orm";
import { db, apiCostLogTable } from "@workspace/db";
import { logger } from "../lib/logger";

// ─── Cost table ───────────────────────────────────────────────────────────────

const COST_USD: Record<string, number> = {
  openai_explanation: 0.0005,   // gpt-4o, ~200 tokens
  openai_scam_analysis: 0.0060, // gpt-5.1, ~400 tokens
  google_vision: 0.0015,        // Cloud Vision WEB_DETECTION per image
  google_cse: 0.0050,           // Custom Search per query
};

export type ApiProvider = "openai" | "google_vision" | "google_cse";

// ─── Logging ─────────────────────────────────────────────────────────────────

/** Log a single API call.  Non-blocking — errors are swallowed. */
export function trackApiCall(opts: {
  userId: string;
  provider: ApiProvider;
  operation: string;
  tokensUsed?: number;
  cacheHit?: boolean;
}): void {
  const costKey = `${opts.provider === "openai" ? "openai" : opts.provider}_${
    opts.operation.replace(/\s+/g, "_").toLowerCase()
  }`;
  const costUsd = (COST_USD[costKey] ?? COST_USD[opts.provider] ?? 0).toFixed(6);

  db.insert(apiCostLogTable)
    .values({
      userId: opts.userId,
      provider: opts.provider,
      operation: opts.operation,
      costUsd,
      tokensUsed: opts.tokensUsed ?? 0,
      cacheHit: opts.cacheHit ?? false,
    })
    .catch((err) =>
      logger.warn({ err, provider: opts.provider }, "Cost tracking write failed (non-fatal)")
    );
}

// ─── Monitoring queries ───────────────────────────────────────────────────────

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Total estimated spend for a user this calendar month. */
export async function getUserMonthlyCost(userId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<string>`COALESCE(SUM(cost_usd::numeric), 0)` })
    .from(apiCostLogTable)
    .where(
      and(
        eq(apiCostLogTable.userId, userId),
        gte(apiCostLogTable.createdAt, startOfMonth())
      )
    );
  return parseFloat(rows[0]?.total ?? "0");
}

/** Aggregate spend + call counts by provider for the current month (system-wide). */
export async function getSystemMonthlyStats(): Promise<
  Array<{ provider: string; totalCalls: number; totalCostUsd: number; cacheHits: number }>
> {
  const rows = await db
    .select({
      provider: apiCostLogTable.provider,
      totalCalls: sql<number>`COUNT(*)::int`,
      totalCostUsd: sql<number>`COALESCE(SUM(cost_usd::numeric), 0)::float`,
      cacheHits: sql<number>`SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::int`,
    })
    .from(apiCostLogTable)
    .where(gte(apiCostLogTable.createdAt, startOfMonth()))
    .groupBy(apiCostLogTable.provider);
  return rows;
}

/** Top N users by spend this month. */
export async function getTopConsumers(limit = 10): Promise<
  Array<{ userId: string; totalCostUsd: number; totalCalls: number }>
> {
  const rows = await db
    .select({
      userId: apiCostLogTable.userId,
      totalCostUsd: sql<number>`COALESCE(SUM(cost_usd::numeric), 0)::float`,
      totalCalls: sql<number>`COUNT(*)::int`,
    })
    .from(apiCostLogTable)
    .where(gte(apiCostLogTable.createdAt, startOfMonth()))
    .groupBy(apiCostLogTable.userId)
    .orderBy(sql`SUM(cost_usd::numeric) DESC`)
    .limit(limit);
  return rows;
}

/** Total spend today (for spike detection). */
export async function getTodaySpend(): Promise<number> {
  const rows = await db
    .select({ total: sql<string>`COALESCE(SUM(cost_usd::numeric), 0)` })
    .from(apiCostLogTable)
    .where(gte(apiCostLogTable.createdAt, startOfDay()));
  return parseFloat(rows[0]?.total ?? "0");
}

/** Cache hit rate for this month (0–1). */
export async function getCacheHitRate(): Promise<number> {
  const rows = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      hits: sql<number>`SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::int`,
    })
    .from(apiCostLogTable)
    .where(gte(apiCostLogTable.createdAt, startOfMonth()));
  const total = rows[0]?.total ?? 0;
  const hits = rows[0]?.hits ?? 0;
  if (total === 0) return 0;
  return Math.round((hits / total) * 1000) / 1000;
}

/** Per-user spend for today — used by per-scan cost reporting. */
export async function getUserDailySpend(userId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<string>`COALESCE(SUM(cost_usd::numeric), 0)` })
    .from(apiCostLogTable)
    .where(
      and(
        eq(apiCostLogTable.userId, userId),
        gte(apiCostLogTable.createdAt, startOfDay())
      )
    );
  return parseFloat(rows[0]?.total ?? "0");
}
