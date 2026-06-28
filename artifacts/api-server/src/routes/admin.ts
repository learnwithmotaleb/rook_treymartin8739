/**
 * Admin Monitoring Dashboard + Reviewer Seeding
 *
 * Protected by X-Admin-Key header matching the ADMIN_API_KEY env var.
 *
 * GET    /api/admin/stats                  — system-wide usage + cost summary
 * GET    /api/admin/consumers              — top API consumers this month
 * POST   /api/admin/unflag/:userId         — clear abuse flag for a user
 * GET    /api/admin/user/:userId/costs     — per-user API cost breakdown
 * POST   /api/admin/seed-reviewer          — seed an account with full demo data for review
 * DELETE /api/admin/seed-reviewer/:clerkId — remove all seeded reviewer data for an account
 */

import { Router, type Request, type Response, type NextFunction, type IRouter } from "express";
import { eq, gte, and, sql } from "drizzle-orm";
import {
  db,
  apiCostLogTable,
  usageQuotasTable,
  scanCacheTable,
  scanJobsTable,
  usersTable,
  connectedAccountsTable,
  threatsTable,
  visualFingerprintsTable,
  userIdentityProfilesTable,
} from "@workspace/db";
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

// ─── Reviewer Seeding ─────────────────────────────────────────────────────────
//
// Image URLs use stable randomuser.me portrait CDN.
// "Reviewer's own" photo appears as yourPhotoUrl in evidence comparisons.
// "Impersonator" photo appears as stolenPhotoUrl.
// No images are stored in the DB — only URL strings.
//
// All seeded rows are tagged so the DELETE endpoint can clean them precisely:
//   - threats:              detectedSignalsJson contains "isReviewerSeed": true
//   - connected_accounts:  platformUserId starts with "review_seed_"
//   - visual_fingerprints: styleEmbeddingJson = '"reviewer_seed"'
//   - user_identity_profiles: canonicalHashClusterJson = '"reviewer_seed"'

const REVIEWER_PHOTO = "https://randomuser.me/api/portraits/women/44.jpg";
const IMPERSONATOR_PHOTO_ALIKE = "https://randomuser.me/api/portraits/women/46.jpg";
const STRANGER_PHOTO = "https://randomuser.me/api/portraits/women/50.jpg";
const SEED_MARKER_JSON = JSON.stringify({ flags: ["firstScanHighConfidence"], isReviewerSeed: true });

function buildReviewerThreats(userId: string) {
  return [
    // ── Threat 1: HIGH — exact profile photo theft on Instagram ───────────────
    {
      userId,
      type: "impersonator",
      severity: "high",
      platform: "instagram",
      title: "Impersonator Detected on Instagram",
      description:
        "Account @alexrivera.official is using your exact profile photo and impersonating your identity to deceive your followers.",
      details:
        "This account was created after your verified profile and has reposted 28 of your images with identical captions.",
      aiExplanation:
        "This account is using your exact profile photo and has reposted 28 of your images. The username @alexrivera.official follows a common impersonation pattern designed to deceive your followers into thinking it is your official account.",
      threatScore: 91,
      suspiciousUsername: "alexrivera.official",
      matchedMediaCount: 28,
      identityMatchScore: 89,
      impersonationConfidenceScore: 91,
      evidenceJson: JSON.stringify([
        {
          id: "ev_high_profile_photo",
          type: "profile_photo",
          similarity: 91,
          label: "Profile Photo Match",
          yourPhotoUrl: REVIEWER_PHOTO,
          stolenPhotoUrl: REVIEWER_PHOTO,
        },
        {
          id: "ev_high_media_overlap",
          type: "post_photo",
          similarity: 85,
          label: "28 Posts Reposted",
          yourPhotoUrl: REVIEWER_PHOTO,
          stolenPhotoUrl: REVIEWER_PHOTO,
          yourCaption: "Golden hour vibes ✨ #photography",
          stolenCaption: "Golden hour vibes ✨ #photography",
        },
      ]),
      scoreBreakdownJson: JSON.stringify({
        mediaSimilarity: 35,
        contentReuse: 28,
        profileSimilarity: 18,
        bioSimilarity: 5,
        usernameSimilarity: 3,
        behavioral: 2,
      }),
      detectedSignalsJson: SEED_MARKER_JSON,
      resolved: false,
    },
    // ── Threat 2: MEDIUM — lookalike photo + username variant on X ────────────
    {
      userId,
      type: "impersonator",
      severity: "medium",
      platform: "x",
      title: "Username Impersonator on X",
      description:
        "Account @alex_rivera_real is mimicking your handle with a visually similar profile photo.",
      details:
        "The username closely mirrors your handle with an added 'real' suffix — a common impersonation tactic used to claim authenticity.",
      aiExplanation:
        "This account uses a visually similar profile photo and a username variant of your handle. The 'real' suffix is a common impersonation tactic used to claim authenticity and divert your audience.",
      threatScore: 67,
      suspiciousUsername: "alex_rivera_real",
      matchedMediaCount: 0,
      identityMatchScore: 61,
      impersonationConfidenceScore: 67,
      evidenceJson: JSON.stringify([
        {
          id: "ev_med1_profile_photo",
          type: "profile_photo",
          similarity: 61,
          label: "Similar Profile Photo",
          yourPhotoUrl: REVIEWER_PHOTO,
          stolenPhotoUrl: IMPERSONATOR_PHOTO_ALIKE,
        },
        {
          id: "ev_med1_username",
          type: "caption",
          similarity: 82,
          label: "Username Variant",
          yourCaption: "@alexrivera",
          stolenCaption: "@alex_rivera_real",
        },
      ]),
      scoreBreakdownJson: JSON.stringify({
        mediaSimilarity: 12,
        contentReuse: 0,
        profileSimilarity: 14,
        bioSimilarity: 2,
        usernameSimilarity: 22,
        behavioral: 17,
      }),
      detectedSignalsJson: SEED_MARKER_JSON,
      resolved: false,
    },
    // ── Threat 3: MEDIUM — stolen post photo on Facebook ─────────────────────
    {
      userId,
      type: "stolen_photo",
      severity: "medium",
      platform: "facebook",
      title: "Your Photo Reposted Without Credit",
      description:
        "A Facebook page published one of your photos without attribution or permission.",
      details:
        "Image hash analysis confirmed an 88% match with your original Instagram post. This may constitute a copyright violation.",
      aiExplanation:
        "A Facebook page reposted one of your photos without attribution. The image hash matches your original post with 88% confidence. This may constitute a copyright violation.",
      threatScore: 72,
      suspiciousUsername: "lifestyle_collective_page",
      matchedMediaCount: 1,
      identityMatchScore: 55,
      impersonationConfidenceScore: 48,
      evidenceJson: JSON.stringify([
        {
          id: "ev_med2_post_photo",
          type: "post_photo",
          similarity: 88,
          label: "Photo Reposted",
          yourPhotoUrl: REVIEWER_PHOTO,
          stolenPhotoUrl: REVIEWER_PHOTO,
          yourCaption: "Sunday morning light 🌅",
          stolenCaption: "Beautiful morning! 🌅",
        },
        {
          id: "ev_med2_page",
          type: "caption",
          similarity: 74,
          label: "Caption Reused",
          yourCaption: "Sunday morning light 🌅",
          stolenCaption: "Beautiful morning! 🌅",
        },
      ]),
      scoreBreakdownJson: JSON.stringify({
        mediaSimilarity: 22,
        contentReuse: 18,
        profileSimilarity: 4,
        bioSimilarity: 0,
        usernameSimilarity: 0,
        behavioral: 8,
      }),
      detectedSignalsJson: SEED_MARKER_JSON,
      resolved: false,
    },
    // ── Threat 4: LOW — suspicious login anomaly ──────────────────────────────
    {
      userId,
      type: "suspicious_login",
      severity: "low",
      platform: "instagram",
      title: "Suspicious Login Detected",
      description:
        "An unrecognized device or location accessed your connected Instagram account.",
      details:
        "The login origin does not match your usual device fingerprint or IP range. No content changes were detected.",
      aiExplanation:
        "An unrecognized device logged into your connected Instagram account. This could be a legitimate device change or unauthorized access. Review your active sessions and change your password if you don't recognize the activity.",
      threatScore: 32,
      suspiciousUsername: null,
      matchedMediaCount: 0,
      identityMatchScore: 0,
      impersonationConfidenceScore: 0,
      evidenceJson: JSON.stringify([
        {
          id: "ev_low_login",
          type: "caption",
          similarity: 0,
          label: "Login Anomaly",
          yourCaption: "Your usual location",
          stolenCaption: "Unrecognized device / location",
        },
      ]),
      scoreBreakdownJson: JSON.stringify({
        mediaSimilarity: 0,
        contentReuse: 0,
        profileSimilarity: 0,
        bioSimilarity: 0,
        usernameSimilarity: 0,
        behavioral: 32,
      }),
      detectedSignalsJson: SEED_MARKER_JSON,
      resolved: false,
    },
  ] as const;
}

// ─── POST /api/admin/seed-reviewer ────────────────────────────────────────────

router.post("/admin/seed-reviewer", async (req, res): Promise<void> => {
  const { clerkId, tier = "pro" } = req.body as { clerkId?: string; tier?: string };

  if (!clerkId) {
    res.status(400).json({ error: "clerkId is required" });
    return;
  }

  const [dbUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);

  if (!dbUser) {
    res.status(404).json({
      error: "User not found in DB. Have the reviewer sign in to the app first, then retry.",
      clerkId,
    });
    return;
  }

  const userId = dbUser.id;
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const fourDaysFromNow = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  // ── Step 1: Update users row ─────────────────────────────────────────────────
  await db
    .update(usersTable)
    .set({
      name: "Alex Rivera",
      username: "alexrivera",
      avatarInitials: "AR",
      securityScore: 64,
      scanCount: 3,
      avatarUrl: REVIEWER_PHOTO,
      nextScanDue: tier === "pro" || tier === "premium" ? fourDaysFromNow : null,
      updatedAt: now,
    })
    .where(eq(usersTable.id, userId));

  // ── Step 2: Remove any previously seeded connected accounts ──────────────────
  await db
    .delete(connectedAccountsTable)
    .where(
      and(
        eq(connectedAccountsTable.userId, userId),
        sql`${connectedAccountsTable.platformUserId} LIKE 'review_seed_%'`
      )
    );

  // ── Step 3: Insert fresh connected accounts ───────────────────────────────────
  const accountsSeeded = await db
    .insert(connectedAccountsTable)
    .values([
      {
        userId,
        platform: "instagram",
        platformUserId: "review_seed_ig_001",
        username: "alexrivera",
        displayName: "Alex Rivera",
        followers: 4820,
        verified: false,
        photosIndexed: 47,
        captionsIndexed: 183,
        reelsIndexed: 12,
        lastSynced: twoDaysAgo,
      },
      {
        userId,
        platform: "facebook",
        platformUserId: "review_seed_fb_001",
        username: "alexrivera",
        displayName: "Alex Rivera",
        followers: 1240,
        verified: false,
        photosIndexed: 31,
        captionsIndexed: 94,
        reelsIndexed: 0,
        lastSynced: twoDaysAgo,
      },
      {
        userId,
        platform: "x",
        platformUserId: "review_seed_x_001",
        username: "alexrivera_x",
        displayName: "Alex Rivera",
        followers: 892,
        verified: false,
        photosIndexed: 18,
        captionsIndexed: 412,
        reelsIndexed: 0,
        lastSynced: twoDaysAgo,
      },
      {
        userId,
        platform: "youtube",
        platformUserId: null,
        username: "alexrivera",
        displayName: "Alex Rivera",
        followers: 0,
        verified: false,
        photosIndexed: 0,
        captionsIndexed: 0,
        reelsIndexed: 0,
        lastSynced: null,
      },
    ])
    .returning({ id: connectedAccountsTable.id });

  // ── Step 4: Remove any previously seeded threats ─────────────────────────────
  await db
    .delete(threatsTable)
    .where(
      and(
        eq(threatsTable.userId, userId),
        sql`${threatsTable.detectedSignalsJson}::jsonb @> '{"isReviewerSeed":true}'::jsonb`
      )
    );

  // ── Step 5: Insert fresh threats ──────────────────────────────────────────────
  const threats = buildReviewerThreats(userId);
  const threatsInserted = await db
    .insert(threatsTable)
    .values(
      threats.map((t) => ({
        ...t,
        createdAt: threeDaysAgo,
      }))
    )
    .returning({ id: threatsTable.id });

  // ── Step 6: Upsert visual fingerprints ───────────────────────────────────────
  await db
    .insert(visualFingerprintsTable)
    .values({
      userId,
      totalPhotosIndexed: 47,
      totalCaptionsIndexed: 183,
      reelsIndexed: 12,
      styleEmbeddingJson: '"reviewer_seed"',
      lastUpdated: twoDaysAgo,
    })
    .onConflictDoUpdate({
      target: visualFingerprintsTable.userId,
      set: {
        totalPhotosIndexed: 47,
        totalCaptionsIndexed: 183,
        reelsIndexed: 12,
        styleEmbeddingJson: '"reviewer_seed"',
        lastUpdated: twoDaysAgo,
      },
    });

  // ── Step 7: Upsert user identity profile ─────────────────────────────────────
  await db
    .insert(userIdentityProfilesTable)
    .values({
      userId,
      canonicalHashClusterJson: '"reviewer_seed"',
      overallConfidence: 88,
      verifiedPlatformCount: 3,
      anchorHashCount: 47,
      confidenceTier: "HIGH",
      lastComputedAt: twoDaysAgo,
    })
    .onConflictDoUpdate({
      target: userIdentityProfilesTable.userId,
      set: {
        canonicalHashClusterJson: '"reviewer_seed"',
        overallConfidence: 88,
        verifiedPlatformCount: 3,
        anchorHashCount: 47,
        confidenceTier: "HIGH",
        lastComputedAt: twoDaysAgo,
      },
    });

  logger.info({ clerkId, userId, tier }, "Admin: reviewer account seeded");

  res.json({
    ok: true,
    clerkId,
    userId,
    tier,
    threatsSeeded: threatsInserted.length,
    accountsSeeded: accountsSeeded.length,
    note: "All seeded rows tagged isReviewerSeed:true — use DELETE /api/admin/seed-reviewer/:clerkId to clean up.",
  });
});

// ─── DELETE /api/admin/seed-reviewer/:clerkId ─────────────────────────────────

router.delete("/admin/seed-reviewer/:clerkId", async (req, res): Promise<void> => {
  const { clerkId } = req.params;

  if (!clerkId) {
    res.status(400).json({ error: "clerkId is required" });
    return;
  }

  const [dbUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);

  if (!dbUser) {
    res.status(404).json({ error: "User not found", clerkId });
    return;
  }

  const userId = dbUser.id;

  const [deletedThreats, deletedAccounts, deletedFingerprints, deletedProfiles] =
    await Promise.all([
      db
        .delete(threatsTable)
        .where(
          and(
            eq(threatsTable.userId, userId),
            sql`${threatsTable.detectedSignalsJson}::jsonb @> '{"isReviewerSeed":true}'::jsonb`
          )
        )
        .returning({ id: threatsTable.id }),

      db
        .delete(connectedAccountsTable)
        .where(
          and(
            eq(connectedAccountsTable.userId, userId),
            sql`${connectedAccountsTable.platformUserId} LIKE 'review_seed_%'`
          )
        )
        .returning({ id: connectedAccountsTable.id }),

      db
        .delete(visualFingerprintsTable)
        .where(
          and(
            eq(visualFingerprintsTable.userId, userId),
            eq(visualFingerprintsTable.styleEmbeddingJson, '"reviewer_seed"')
          )
        )
        .returning({ id: visualFingerprintsTable.id }),

      db
        .delete(userIdentityProfilesTable)
        .where(
          and(
            eq(userIdentityProfilesTable.userId, userId),
            eq(userIdentityProfilesTable.canonicalHashClusterJson, '"reviewer_seed"')
          )
        )
        .returning({ id: userIdentityProfilesTable.id }),
    ]);

  const rowsDeleted =
    deletedThreats.length +
    deletedAccounts.length +
    deletedFingerprints.length +
    deletedProfiles.length;

  logger.info({ clerkId, userId, rowsDeleted }, "Admin: reviewer seed data cleaned up");

  res.json({
    ok: true,
    clerkId,
    userId,
    rowsDeleted,
    breakdown: {
      threats: deletedThreats.length,
      connectedAccounts: deletedAccounts.length,
      visualFingerprints: deletedFingerprints.length,
      identityProfiles: deletedProfiles.length,
    },
  });
});

export default router;
