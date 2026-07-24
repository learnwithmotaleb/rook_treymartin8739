/**
 * Identity Verification API  —  /api/identity/*
 *
 * Turns accumulated pHash data into a cross-platform identity proof.
 * Designed for both end-user apps (Clerk session) and B2B server-to-server
 * integrations (API key via Authorization: Bearer sid_live_xxx or
 * X-Rook-API-Key: sid_live_xxx header).
 *
 * Endpoints:
 *   GET  /identity/profile          — full identity profile for the authenticated user
 *   GET  /identity/badge            — lightweight trust-tier summary (embed in any UI)
 *   POST /identity/verify-account   — verify a claimed connected account against the anchor
 *   POST /identity/api-keys         — mint a new API key (Clerk session only)
 *   GET  /identity/api-keys         — list all API keys for the authenticated user
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import crypto from "crypto";
import {
  db,
  userIdentityProfilesTable,
  platformVerificationsTable,
  connectedAccountsTable,
  userPhotoHashesTable,
  apiKeysTable,
} from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { requireApiKeyOrAuth } from "../middleware/requireApiKeyOrAuth";
import {
  computeIdentityAnchor,
  recomputeForUser,
  verifyAccountAgainstAnchor,
  type ConfidenceTier,
} from "../services/identityAnchorService";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── GET /identity/profile ─────────────────────────────────────────────────────

router.get("/identity/profile", requireApiKeyOrAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId;

    const [profile] = await db
      .select()
      .from(userIdentityProfilesTable)
      .where(eq(userIdentityProfilesTable.userId, userId));

    const platformRows = await db
      .select()
      .from(platformVerificationsTable)
      .where(eq(platformVerificationsTable.userId, userId));

    if (!profile) {
      const result = await computeIdentityAnchor(userId);
      recomputeForUser(userId).catch(() => {});

      res.json({
        userId,
        overallConfidence: result.overallConfidence,
        confidenceTier: result.confidenceTier,
        verifiedPlatformCount: result.verifiedPlatformCount,
        anchorHashCount: result.anchorHashCount,
        lastComputedAt: null,
        platforms: result.platformScores.map((p) => ({
          platform: p.platform,
          username: p.username,
          visualMatchScore: p.visualMatchScore,
          metadataMatchScore: p.metadataMatchScore,
          hashCount: p.hashCount,
          verificationMethod: p.verificationMethod,
          verifiedAt: null,
        })),
      });
      return;
    }

    res.json({
      userId,
      overallConfidence: profile.overallConfidence,
      confidenceTier: profile.confidenceTier,
      verifiedPlatformCount: profile.verifiedPlatformCount,
      anchorHashCount: profile.anchorHashCount,
      lastComputedAt: profile.lastComputedAt.toISOString(),
      platforms: platformRows.map((p) => ({
        platform: p.platform,
        username: p.username,
        visualMatchScore: p.visualMatchScore,
        metadataMatchScore: p.metadataMatchScore,
        hashCount: p.hashCount,
        verificationMethod: p.verificationMethod,
        verifiedAt: p.verifiedAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error({ err }, "GET /identity/profile failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /identity/badge ───────────────────────────────────────────────────────

router.get("/identity/badge", requireApiKeyOrAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId;

    const [profile] = await db
      .select()
      .from(userIdentityProfilesTable)
      .where(eq(userIdentityProfilesTable.userId, userId));

    const tier: ConfidenceTier = (profile?.confidenceTier as ConfidenceTier) ?? "UNVERIFIED";

    const platformRows = await db
      .select({ platform: platformVerificationsTable.platform })
      .from(platformVerificationsTable)
      .where(eq(platformVerificationsTable.userId, userId));

    res.json({
      userId,
      confidenceTier: tier,
      overallConfidence: profile?.overallConfidence ?? 0,
      verifiedPlatformCount: profile?.verifiedPlatformCount ?? 0,
      anchorHashCount: profile?.anchorHashCount ?? 0,
      verifiedPlatforms: platformRows.map((p) => p.platform),
      badge: tierToBadge(tier),
    });
  } catch (err) {
    logger.error({ err }, "GET /identity/badge failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

const VerifyAccountBody = z.object({
  platform: z.string().min(1).toLowerCase().trim(),
  username: z.string().min(1),
});

const ApiKeyBody = z.object({
  name: z.string().min(1).max(100).optional(),
});

// ─── POST /identity/verify-account ────────────────────────────────────────────

router.post("/identity/verify-account", requireApiKeyOrAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const bodyParsed = VerifyAccountBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: "platform and username are required", details: bodyParsed.error.flatten() });
      return;
    }
    const normalizedPlatform = bodyParsed.data.platform;
    const normalizedUsername = bodyParsed.data.username.replace(/^@/, "").toLowerCase().trim();

    const accounts = await db
      .select({
        id: connectedAccountsTable.id,
        username: connectedAccountsTable.username,
        platform: connectedAccountsTable.platform,
      })
      .from(connectedAccountsTable)
      .where(
        and(
          eq(connectedAccountsTable.userId, userId),
          eq(connectedAccountsTable.platform, normalizedPlatform)
        )
      );

    const matchedAccount = accounts.find(
      (a) => a.username.replace(/^@/, "").toLowerCase() === normalizedUsername
    );

    if (!matchedAccount) {
      logger.info(
        { userId, platform: normalizedPlatform, username: normalizedUsername },
        "verify-account: platform/username not a connected account"
      );
      res.json({
        platform: normalizedPlatform,
        username: normalizedUsername,
        connected: false,
        indexed: false,
        confidence: 0,
        confidencePercent: 0,
        tier: "UNVERIFIED",
        matchedHashCount: 0,
        totalHashCount: 0,
        verificationMethod: "account_not_connected",
        anchorHashCount: 0,
        recommendation: "reject",
        note: "This account is not connected to the Rook user. Connect the account and run a scan first.",
      });
      return;
    }

    const hashRows = await db
      .select({ dHash: userPhotoHashesTable.dHash })
      .from(userPhotoHashesTable)
      .where(
        and(
          eq(userPhotoHashesTable.userId, userId),
          eq(userPhotoHashesTable.accountId, matchedAccount.id)
        )
      );

    if (hashRows.length === 0) {
      logger.info(
        { userId, accountId: matchedAccount.id, platform: normalizedPlatform },
        "verify-account: account connected but not yet indexed (no hashes)"
      );
      res.json({
        platform: normalizedPlatform,
        username: normalizedUsername,
        connected: true,
        indexed: false,
        confidence: 0,
        confidencePercent: 0,
        tier: "UNVERIFIED",
        matchedHashCount: 0,
        totalHashCount: 0,
        verificationMethod: "not_indexed",
        anchorHashCount: 0,
        recommendation: "manual_review",
        note: "Account is connected but not yet indexed — trigger a scan to build the hash index.",
      });
      return;
    }

    const dHashes = hashRows.map((r) => r.dHash);
    const result = await verifyAccountAgainstAnchor(userId, dHashes);

    logger.info(
      {
        userId,
        platform: normalizedPlatform,
        username: normalizedUsername,
        confidence: result.confidence,
        tier: result.tier,
        matchedHashes: result.matchedHashCount,
        totalHashes: dHashes.length,
      },
      "Identity verify-account check complete"
    );

    res.json({
      platform: normalizedPlatform,
      username: normalizedUsername,
      connected: true,
      indexed: true,
      confidence: result.confidence / 100,
      confidencePercent: result.confidence,
      tier: result.tier,
      matchedHashCount: result.matchedHashCount,
      totalHashCount: dHashes.length,
      verificationMethod: result.verificationMethod,
      anchorHashCount: result.anchorHashCount,
      recommendation: confidenceToRecommendation(result.confidence),
    });
  } catch (err) {
    logger.error({ err }, "POST /identity/verify-account failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /identity/api-keys ───────────────────────────────────────────────────

router.post("/identity/api-keys", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const bodyParsed = ApiKeyBody.safeParse(req.body ?? {});
    if (!bodyParsed.success) {
      res.status(400).json({ error: "Invalid request body", details: bodyParsed.error.flatten() });
      return;
    }
    const name = bodyParsed.data.name ?? "Identity API Key";

    const secret = crypto.randomBytes(32).toString("hex");
    const raw = `sid_live_${secret}`;
    const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
    const keyPrefix = secret.slice(0, 8);

    const [key] = await db
      .insert(apiKeysTable)
      .values({ userId, keyHash, keyPrefix, name })
      .returning({
        id: apiKeysTable.id,
        name: apiKeysTable.name,
        keyPrefix: apiKeysTable.keyPrefix,
        createdAt: apiKeysTable.createdAt,
      });

    res.status(201).json({
      id: key!.id,
      name: key!.name,
      keyPrefix: key!.keyPrefix,
      key: raw,
      createdAt: key!.createdAt,
      message: "Store this key securely — it will not be shown again.",
      usage: {
        authorizationHeader: `Authorization: Bearer ${raw}`,
        customHeader: `X-Rook-API-Key: ${raw}`,
      },
    });
  } catch (err) {
    logger.error({ err }, "POST /identity/api-keys failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /identity/api-keys ────────────────────────────────────────────────────

router.get("/identity/api-keys", requireAuth, async (req, res): Promise<void> => {
  try {
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

    res.json(
      keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        displayKey: `sid_live_${k.keyPrefix}...`,
        rateLimitRpm: k.rateLimitRpm,
        active: !k.revokedAt,
        createdAt: k.createdAt.toISOString(),
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        revokedAt: k.revokedAt?.toISOString() ?? null,
      }))
    );
  } catch (err) {
    logger.error({ err }, "GET /identity/api-keys failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tierToBadge(tier: ConfidenceTier): {
  tier: string;
  label: string;
  description: string;
  color: string;
} {
  switch (tier) {
    case "STRONG":
      return {
        tier: "STRONG",
        label: "Rook Verified",
        description: "Identity strongly confirmed across 3+ platforms",
        color: "#00C896",
      };
    case "HIGH":
      return {
        tier: "HIGH",
        label: "Verified",
        description: "Identity confirmed across multiple platforms",
        color: "#4CAF50",
      };
    case "MEDIUM":
      return {
        tier: "MEDIUM",
        label: "Partially Verified",
        description: "Identity partially confirmed — add more platforms to strengthen",
        color: "#FF9800",
      };
    case "LOW":
      return {
        tier: "LOW",
        label: "Weakly Verified",
        description: "Only single-platform data available",
        color: "#FF5722",
      };
    case "UNVERIFIED":
    default:
      return {
        tier: "UNVERIFIED",
        label: "Unverified",
        description: "No identity data available — run a scan to build your profile",
        color: "#9E9E9E",
      };
  }
}

function confidenceToRecommendation(confidence: number): string {
  if (confidence >= 80) return "approve";
  if (confidence >= 60) return "approve_with_review";
  if (confidence >= 40) return "manual_review";
  if (confidence >= 20) return "high_risk_review";
  return "reject";
}

export default router;
