/**
 * Admin Monitoring Dashboard
 *
 * Protected by X-Admin-Key header matching the ADMIN_API_KEY env var.
 * Returns aggregate API usage, cost, and cache statistics for the current month.
 *
 * GET  /api/admin/stats          — system-wide usage + cost summary
 * GET  /api/admin/consumers      — top API consumers this month
 * POST /api/admin/unflag/:userId — clear abuse flag for a user
 */

import { Router, type Request, type Response, type NextFunction, type IRouter } from "express";
import { eq, gte, sql } from "drizzle-orm";
import { db, apiCostLogTable, usageQuotasTable, scanCacheTable, scanJobsTable } from "@workspace/db";
import {
  getSystemMonthlyStats,
  getTopConsumers,
  getTodaySpend,
  getCacheHitRate,
} from "../services/costTracker";
import { clearAbuseFlag } from "../services/rateLimitService";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── Auth middleware ───────────────────────────────────────────────────────────

function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env["ADMIN_API_KEY"];
  if (!adminKey) {
    res.status(503).json({ error: "Admin dashboard not configured (ADMIN_API_KEY not set)" });
    return;
  }
  const provided = req.headers["x-admin-key"];
  if (provided !== adminKey) {
    logger.warn({ ip: req.ip }, "Admin dashboard: unauthorized access attempt");
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

router.use("/admin", requireAdminKey);

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────

router.get("/admin/stats", async (_req, res): Promise<void> => {
  const [providerStats, todaySpend, cacheHitRate, scanJobCounts, cacheStats, flaggedUsers] =
    await Promise.all([
      getSystemMonthlyStats(),
      getTodaySpend(),
      getCacheHitRate(),

      // Scan job counts by status (all time)
      db
        .select({
          status: scanJobsTable.status,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(scanJobsTable)
        .groupBy(scanJobsTable.status),

      // Cache table stats
      db
        .select({
          totalEntries: sql<number>`COUNT(*)::int`,
          totalHits: sql<number>`COALESCE(SUM(hit_count), 0)::int`,
          activeEntries: sql<number>`SUM(CASE WHEN expires_at > NOW() THEN 1 ELSE 0 END)::int`,
        })
        .from(scanCacheTable),

      // Flagged users
      db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(usageQuotasTable)
        .where(eq(usageQuotasTable.flaggedForAbuse, true)),
    ]);

  const totalMonthlySpend = providerStats.reduce((sum, r) => sum + r.totalCostUsd, 0);
  const totalMonthlyCalls = providerStats.reduce((sum, r) => sum + r.totalCalls, 0);

  res.json({
    generatedAt: new Date().toISOString(),
    month: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
    cost: {
      totalMonthUsd: Math.round(totalMonthlySpend * 100000) / 100000,
      todayUsd: Math.round(todaySpend * 100000) / 100000,
      spikeAlert: todaySpend > 10,
    },
    apiCalls: {
      totalMonth: totalMonthlyCalls,
      cacheHitRate,
      byProvider: providerStats,
    },
    scans: {
      jobsByStatus: Object.fromEntries(scanJobCounts.map((r) => [r.status, r.count])),
    },
    cache: {
      totalEntries: cacheStats[0]?.totalEntries ?? 0,
      activeEntries: cacheStats[0]?.activeEntries ?? 0,
      totalHits: cacheStats[0]?.totalHits ?? 0,
    },
    abuse: {
      flaggedUsers: flaggedUsers[0]?.count ?? 0,
    },
  });
});

// ─── GET /api/admin/consumers ─────────────────────────────────────────────────

router.get("/admin/consumers", async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? "20", 10), 100);
  const [consumers, startOfMonth] = [
    await getTopConsumers(limit),
    (() => {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    })(),
  ];

  // Enrich with scan counts
  const scanCounts = await db
    .select({
      userId: scanJobsTable.userId,
      scans: sql<number>`COUNT(*)::int`,
    })
    .from(scanJobsTable)
    .where(gte(scanJobsTable.startedAt, startOfMonth))
    .groupBy(scanJobsTable.userId);

  const scanMap = Object.fromEntries(scanCounts.map((r) => [r.userId, r.scans]));

  res.json({
    generatedAt: new Date().toISOString(),
    consumers: consumers.map((c) => ({
      ...c,
      scansThisMonth: scanMap[c.userId] ?? 0,
      costPerScan:
        (scanMap[c.userId] ?? 0) > 0
          ? Math.round((c.totalCostUsd / (scanMap[c.userId] ?? 1)) * 100000) / 100000
          : 0,
    })),
  });
});

// ─── POST /api/admin/unflag/:userId ───────────────────────────────────────────

router.post("/admin/unflag/:userId", async (req, res): Promise<void> => {
  const { userId } = req.params;
  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }
  await clearAbuseFlag(userId);
  logger.info({ userId }, "Admin: abuse flag cleared");
  res.json({ ok: true, userId });
});

// ─── GET /api/admin/user/:userId/costs ────────────────────────────────────────

router.get("/admin/user/:userId/costs", async (req, res): Promise<void> => {
  const { userId } = req.params;
  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [byProvider, quota] = await Promise.all([
    db
      .select({
        provider: apiCostLogTable.provider,
        operation: apiCostLogTable.operation,
        calls: sql<number>`COUNT(*)::int`,
        costUsd: sql<number>`COALESCE(SUM(cost_usd::numeric), 0)::float`,
        cacheHits: sql<number>`SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::int`,
      })
      .from(apiCostLogTable)
      .where(
        eq(apiCostLogTable.userId, userId)
      )
      .groupBy(apiCostLogTable.provider, apiCostLogTable.operation)
      .orderBy(sql`SUM(cost_usd::numeric) DESC`),

    db
      .select()
      .from(usageQuotasTable)
      .where(eq(usageQuotasTable.userId, userId))
      .then((r) => r[0] ?? null),
  ]);

  res.json({
    userId,
    generatedAt: new Date().toISOString(),
    apiUsage: byProvider,
    quota,
  });
});

export default router;
