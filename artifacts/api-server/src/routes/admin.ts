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
 * POST   /api/admin/prepare-real-reviewer   — enable a real account and remove an obsolete demo
 */

import { Router, type Request, type Response, type NextFunction, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { eq, gte, and, or, sql, isNull } from "drizzle-orm";
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
  subscriptionsTable,
  photoProcessingConsentsTable,
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
  const providedKey = typeof provided === "string" ? provided : "";
  const providedBuffer = Buffer.from(providedKey);
  const expectedBuffer = Buffer.from(adminKey);
  const valid =
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer);
  if (!valid) {
    logger.warn({ ip: req.ip }, "Admin dashboard: unauthorized access attempt");
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

router.use("/admin", requireAdminKey);

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────

router.get("/admin/stats", async (_req, res): Promise<void> => {
  try {
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
  } catch (err) {
    logger.error({ err }, "GET /admin/stats failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/admin/consumers ─────────────────────────────────────────────────

router.get("/admin/consumers", async (req, res): Promise<void> => {
  try {
    const limitParsed = z.coerce.number().int().min(1).max(100).default(20).safeParse(req.query["limit"]);
    if (!limitParsed.success) {
      res.status(400).json({ error: "limit must be a number between 1 and 100" });
      return;
    }
    const [consumers, startOfMonth] = [
      await getTopConsumers(limitParsed.data),
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
  } catch (err) {
    logger.error({ err }, "GET /admin/consumers failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/admin/unflag/:userId ───────────────────────────────────────────

router.post("/admin/unflag/:userId", async (req, res): Promise<void> => {
  try {
    const { userId } = req.params;
    if (!userId) {
      res.status(400).json({ error: "Missing userId" });
      return;
    }
    await clearAbuseFlag(userId);
    logger.info({ userId }, "Admin: abuse flag cleared");
    res.json({ ok: true, userId });
  } catch (err) {
    logger.error({ err }, "POST /admin/unflag failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/admin/user/:userId/costs ────────────────────────────────────────

router.get("/admin/user/:userId/costs", async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    logger.error({ err }, "GET /admin/user/:userId/costs failed");
    res.status(500).json({ error: "Internal server error" });
  }
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

const REVIEWER_PHOTO = "https://tryrook.app/reviewer-sample-photo.jpg";
const IMPERSONATOR_PHOTO_ALIKE = "https://randomuser.me/api/portraits/women/46.jpg";
const STRANGER_PHOTO = "https://randomuser.me/api/portraits/women/50.jpg";

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
      detectedSignalsJson: JSON.stringify({
        flags: ["firstScanHighConfidence"],
        isReviewerSeed: true,
        yourPhotoUrl: REVIEWER_PHOTO,
        suspiciousProfileImageUrl: REVIEWER_PHOTO,
        evidence: [
          {
            type: "profile_photo_match",
            yourPhotoUrl: REVIEWER_PHOTO,
            stolenPhotoUrl: REVIEWER_PHOTO,
            similarity: 0.91,
            caption: "Profile photo appears to be copied verbatim from your Instagram account",
          },
          {
            type: "media_overlap",
            count: 28,
            caption: "28 posts share identical captions or images with your account",
          },
        ],
      }),
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
      detectedSignalsJson: JSON.stringify({
        flags: ["firstScanHighConfidence"],
        isReviewerSeed: true,
        yourPhotoUrl: REVIEWER_PHOTO,
        suspiciousProfileImageUrl: IMPERSONATOR_PHOTO_ALIKE,
        evidence: [
          {
            type: "profile_photo_match",
            yourPhotoUrl: REVIEWER_PHOTO,
            stolenPhotoUrl: IMPERSONATOR_PHOTO_ALIKE,
            similarity: 0.61,
            caption: "Profile photo is visually similar — possible edited copy of your photo",
          },
          {
            type: "username_variant",
            yourUsername: "alexrivera",
            theirUsername: "alex_rivera_real",
            similarity: 0.82,
            caption: "Username closely mimics your handle with an added 'real' suffix",
          },
        ],
      }),
      resolved: false,
    },
    // ── Threat 3: MEDIUM — stolen post photo on Facebook ─────────────────────
    // suspiciousProfileImageUrl = STRANGER_PHOTO (the page owner — a different person)
    // stolenPhotoUrl in evidence = REVIEWER_PHOTO (YOUR photo that was reposted)
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
          id: "ev_med2_caption",
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
      detectedSignalsJson: JSON.stringify({
        flags: ["firstScanHighConfidence"],
        isReviewerSeed: true,
        yourPhotoUrl: REVIEWER_PHOTO,
        suspiciousProfileImageUrl: STRANGER_PHOTO,
        evidence: [
          {
            type: "post_photo_theft",
            yourPhotoUrl: REVIEWER_PHOTO,
            stolenPhotoUrl: REVIEWER_PHOTO,
            caption: "A photo from your Instagram was posted without credit to this Facebook page",
            similarity: 0.88,
          },
          {
            type: "caption_match",
            caption: "Post caption matches your original Instagram post text",
          },
        ],
      }),
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
      detectedSignalsJson: JSON.stringify({
        flags: [],
        isReviewerSeed: true,
        evidence: [
          {
            type: "login_anomaly",
            caption: "Unusual login detected from an unrecognized device or location",
          },
        ],
      }),
      resolved: false,
    },
  ] as const;
}

// ─── POST /api/admin/seed-reviewer ────────────────────────────────────────────

router.post("/admin/seed-reviewer", async (req, res): Promise<void> => {
  try {
  const SeedBody = z.object({
    clerkId: z.string().min(1),
    tier: z.enum(["free", "pro", "premium"]).default("premium"),
  });
  const bodyParsed = SeedBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body", details: bodyParsed.error.flatten() });
    return;
  }
  const { clerkId, tier } = bodyParsed.data;

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const fourDaysFromNow = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  const expiredAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  // ── Step 1: Upsert users row (insert on first call, update on repeat) ─────────
  const [dbUser] = await db
    .insert(usersTable)
    .values({
      clerkId,
      name: "Alex Rivera",
      username: "alexrivera",
      avatarInitials: "AR",
      securityScore: 64,
      scanCount: 3,
      avatarUrl: REVIEWER_PHOTO,
      nextScanDue: tier === "pro" || tier === "premium" ? fourDaysFromNow : null,
    })
    .onConflictDoUpdate({
      target: usersTable.clerkId,
      set: {
        name: "Alex Rivera",
        username: "alexrivera",
        avatarInitials: "AR",
        securityScore: 64,
        scanCount: 3,
        avatarUrl: REVIEWER_PHOTO,
        nextScanDue: tier === "pro" || tier === "premium" ? fourDaysFromNow : null,
        updatedAt: now,
      },
    })
    .returning({ id: usersTable.id });

  const userId = dbUser.id;

  // Remove the previous deterministic completed review job before rebuilding
  // it. Threats are removed first because scan_job_id is intentionally nullable.
  await db.delete(threatsTable).where(
    and(
      eq(threatsTable.userId, userId),
      or(
        sql`${threatsTable.detectedSignalsJson}::jsonb @> '{"isReviewerSeed":true}'::jsonb`,
        sql`${threatsTable.detectedSignalsJson}::jsonb @> '{"isReviewerFixtureClone":true}'::jsonb`,
      ),
    ),
  );
  await db.delete(scanJobsTable).where(
    and(
      eq(scanJobsTable.userId, userId),
      sql`${scanJobsTable.metadataJson}::jsonb @> '{"isReviewerSeed":true}'::jsonb`,
    ),
  );

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
        platformUserId: "review_seed_yt_pending",
        username: "",
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
        or(
          sql`${threatsTable.detectedSignalsJson}::jsonb @> '{"isReviewerSeed":true}'::jsonb`,
          sql`${threatsTable.detectedSignalsJson}::jsonb @> '{"isReviewerFixtureClone":true}'::jsonb`,
        )
      )
    );

  // ── Step 5: Insert fresh threats ──────────────────────────────────────────────
  const [reviewScanJob] = await db.insert(scanJobsTable).values({
    userId,
    status: "completed",
    progress: 100,
    currentStep: "complete",
    threatsFound: 4,
    metadataJson: JSON.stringify({ isReviewerSeed: true }),
    startedAt: threeDaysAgo,
    completedAt: threeDaysAgo,
  }).returning();
  if (!reviewScanJob) throw new Error("Failed to create reviewer scan job");
  const threats = buildReviewerThreats(userId).map((threat) => ({
    ...threat,
    scanJobId: reviewScanJob.id,
  }));
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

  // ── Step 8: Grant subscription tier (so paywalled screens actually unlock) ───
  await db
    .insert(subscriptionsTable)
    .values({
      userId,
      tier: "free",
      status: "canceled",
      billingCycle: "yearly",
      currentPeriodEnd: expiredAt,
      cancelAtPeriodEnd: true,
      trialEndsAt: null,
    })
    .onConflictDoUpdate({
      target: subscriptionsTable.userId,
      set: {
        tier: "free",
        status: "canceled",
        billingCycle: "yearly",
        currentPeriodEnd: expiredAt,
        cancelAtPeriodEnd: true,
        trialEndsAt: null,
        updatedAt: now,
      },
    });

  logger.info({ userId }, "Admin: reviewer account seeded");

  res.json({
    ok: true,
    clerkId,
    userId,
    tier: "free",
    scanJobId: reviewScanJob.id,
    threatsSeeded: threatsInserted.length,
    accountsSeeded: accountsSeeded.length,
    note: "All seeded rows tagged isReviewerSeed:true — use DELETE /api/admin/seed-reviewer/:clerkId to clean up.",
  });
  } catch (err) {
    logger.error({ err }, "POST /admin/seed-reviewer failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DELETE /api/admin/seed-reviewer/:clerkId ─────────────────────────────────

router.delete("/admin/seed-reviewer/:clerkId", async (req, res): Promise<void> => {
  try {
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

  const [deletedThreats, deletedAccounts, deletedFingerprints, deletedProfiles, deletedScanJobs] =
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
      db
        .delete(scanJobsTable)
        .where(
          and(
            eq(scanJobsTable.userId, userId),
            sql`${scanJobsTable.metadataJson}::jsonb @> '{"isReviewerSeed":true}'::jsonb`,
          ),
        )
        .returning({ id: scanJobsTable.id }),
    ]);

  // Reset the granted subscription back to free so the account doesn't keep
  // paid entitlements after its seeded review data is removed.
  await db
    .update(subscriptionsTable)
    .set({ tier: "free", status: "active", cancelAtPeriodEnd: false, updatedAt: new Date() })
    .where(eq(subscriptionsTable.userId, userId));

  const rowsDeleted =
    deletedThreats.length +
    deletedAccounts.length +
    deletedFingerprints.length +
    deletedProfiles.length +
    deletedScanJobs.length;

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
      scanJobs: deletedScanJobs.length,
    },
  });
  } catch (err) {
    logger.error({ err }, "DELETE /admin/seed-reviewer failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/admin/prepare-real-reviewer ────────────────────────────────────

router.post("/admin/prepare-real-reviewer", async (req, res): Promise<void> => {
  try {
    const PrepareBody = z.object({
      clerkId: z.string().startsWith("user_"),
      email: z.string().email(),
      obsoleteClerkId: z.string().startsWith("user_"),
    }).refine((value) => value.clerkId !== value.obsoleteClerkId, {
      message: "The real and obsolete Clerk IDs must be different",
    });
    const parsed = PrepareBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
      return;
    }

    const { clerkId, email, obsoleteClerkId } = parsed.data;
    const now = new Date();
    const expiredAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const result = await db.transaction(async (tx) => {
      const [realUser] = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.clerkId, clerkId))
        .limit(1);
      if (!realUser) throw new Error("REAL_REVIEWER_NOT_FOUND");

      const realAccounts = await tx
        .select({
          platform: connectedAccountsTable.platform,
          username: connectedAccountsTable.username,
        })
        .from(connectedAccountsTable)
        .where(eq(connectedAccountsTable.userId, realUser.id));

      const activePlatforms = [...new Set(realAccounts.map((account) => account.platform))];
      const platformHandles = Object.fromEntries(
        realAccounts
          .filter((account) => account.username)
          .map((account) => [account.platform, account.username]),
      );

      await tx
        .update(usersTable)
        .set({
          email: email.trim().toLowerCase(),
          onboardingAnswers: {
            primaryConcern: "impersonation",
            goalFollowUp: null,
            userType: "individual",
            typeFollowUp: null,
            followerRange: null,
            activePlatforms,
            attribution: "app-review",
            perceivedRisk: 5,
            identityInput: null,
            platformHandles,
          },
          termsAcceptedAt: now,
          termsVersion: "2026-09-15-v4",
          ageConfirmedAt: now,
          minimumAgeVersion: "1.0",
          updatedAt: now,
        })
        .where(eq(usersTable.id, realUser.id));

      await tx
        .update(photoProcessingConsentsTable)
        .set({ withdrawnAt: now })
        .where(
          and(
            eq(photoProcessingConsentsTable.userId, realUser.id),
            isNull(photoProcessingConsentsTable.withdrawnAt),
          ),
        );
      await tx.insert(photoProcessingConsentsTable).values({
        userId: realUser.id,
        consentVersion: "2026-09-15-v4",
        consentedAt: now,
      });

      await tx
        .insert(subscriptionsTable)
        .values({
          userId: realUser.id,
          tier: "free",
          status: "canceled",
          billingCycle: "yearly",
          currentPeriodEnd: expiredAt,
          cancelAtPeriodEnd: true,
          trialEndsAt: null,
        })
        .onConflictDoUpdate({
          target: subscriptionsTable.userId,
          set: {
            tier: "free",
            status: "canceled",
            billingCycle: "yearly",
            currentPeriodEnd: expiredAt,
            cancelAtPeriodEnd: true,
            trialEndsAt: null,
            updatedAt: now,
          },
        });

      const deletedDemoUsers = await tx
        .delete(usersTable)
        .where(eq(usersTable.clerkId, obsoleteClerkId))
        .returning({ id: usersTable.id });

      return {
        userId: realUser.id,
        connectedAccountsPreserved: realAccounts.length,
        deletedDemoUsers: deletedDemoUsers.length,
      };
    });

    if (process.env.CLERK_SECRET_KEY) {
      const clerkResponse = await fetch(
        `https://api.clerk.com/v1/users/${encodeURIComponent(obsoleteClerkId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
        },
      );
      if (!clerkResponse.ok && clerkResponse.status !== 404) {
        logger.warn(
          { obsoleteClerkId, status: clerkResponse.status },
          "Obsolete reviewer Clerk deletion failed",
        );
      }
    }

    logger.info(
      { clerkId, obsoleteClerkId, userId: result.userId },
      "Admin: real reviewer prepared and obsolete demo removed",
    );
    res.json({
      ok: true,
      clerkId,
      userId: result.userId,
      tier: "free",
      onboardingCompleted: true,
      connectedAccountsPreserved: result.connectedAccountsPreserved,
      deletedDemoUsers: result.deletedDemoUsers,
      subscriptionStatus: "canceled",
    });
  } catch (err) {
    if (err instanceof Error && err.message === "REAL_REVIEWER_NOT_FOUND") {
      res.status(404).json({ error: "Real reviewer account not found" });
      return;
    }
    logger.error({ err }, "POST /admin/prepare-real-reviewer failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
