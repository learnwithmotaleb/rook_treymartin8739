/**
 * Identity Verification API  —  /api/identity/*
 *
 * Turns accumulated pHash data into a cross-platform identity proof.
 * Designed for both end-user apps (Clerk session) and B2B server-to-server
 * integrations (API key bearer token).
 *
 * All endpoints accept either Clerk JWT or Authorization: Bearer sid_live_xxx.
 *
 * Endpoints:
 *   GET  /identity/profile          — full identity profile for the authenticated user
 *   GET  /identity/badge            — lightweight trust-tier summary (embed in any UI)
 *   POST /identity/verify-account   — cross-match a claimed account's hashes against anchor
 */

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  userIdentityProfilesTable,
  platformVerificationsTable,
  connectedAccountsTable,
} from "@workspace/db";
import { requireApiKeyOrAuth } from "../middleware/requireApiKeyOrAuth";
import {
  computeIdentityAnchor,
  recomputeForUser,
  verifyAccountAgainstAnchor,
  type ConfidenceTier,
} from "../services/identityAnchorService";
import { computeDHash } from "../services/photoHashService";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── GET /identity/profile ─────────────────────────────────────────────────────

/**
 * Returns the full identity verification profile for the authenticated user.
 *
 * Response shape:
 * {
 *   userId, overallConfidence, confidenceTier, verifiedPlatformCount,
 *   anchorHashCount, lastComputedAt,
 *   platforms: [{ platform, username, visualMatchScore, metadataMatchScore,
 *                 hashCount, verificationMethod, verifiedAt }]
 * }
 */
router.get("/identity/profile", requireApiKeyOrAuth, async (req, res): Promise<void> => {
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
    // No profile yet — compute on-demand and return
    const result = await computeIdentityAnchor(userId);
    // Persist fire-and-forget for future calls
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
});

// ─── GET /identity/badge ───────────────────────────────────────────────────────

/**
 * Lightweight trust badge summary. Suitable for embedding in any UI as a
 * "ShieldID Verified" indicator.
 *
 * Response shape:
 * {
 *   userId, confidenceTier, overallConfidence, verifiedPlatformCount,
 *   anchorHashCount, verifiedPlatforms: string[],
 *   badge: { tier, label, description, color }
 * }
 */
router.get("/identity/badge", requireApiKeyOrAuth, async (req, res): Promise<void> => {
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

  const verifiedPlatforms = platformRows.map((p) => p.platform);

  res.json({
    userId,
    confidenceTier: tier,
    overallConfidence: profile?.overallConfidence ?? 0,
    verifiedPlatformCount: profile?.verifiedPlatformCount ?? 0,
    anchorHashCount: profile?.anchorHashCount ?? 0,
    verifiedPlatforms,
    badge: tierToBadge(tier),
  });
});

// ─── POST /identity/verify-account ────────────────────────────────────────────

/**
 * B2B endpoint: verify that a claimed social account belongs to this user.
 *
 * Accepts photo URLs from the claimed account; downloads and hashes them,
 * then cross-matches against the user's stored identity anchor.
 *
 * Request body:
 * {
 *   platform: string,        // e.g. "instagram"
 *   username: string,        // e.g. "@johndoe"
 *   photoUrls: string[]      // 1–10 public photo URLs from the claimed account
 * }
 *
 * Response:
 * {
 *   platform, username, confidence (0–1), tier, matchedHashCount,
 *   totalCandidateHashes, verificationMethod, anchorHashCount
 * }
 */
router.post("/identity/verify-account", requireApiKeyOrAuth, async (req, res): Promise<void> => {
  const userId = req.userId;
  const { platform, username, photoUrls } = req.body as {
    platform?: string;
    username?: string;
    photoUrls?: unknown;
  };

  if (!platform || typeof platform !== "string") {
    res.status(400).json({ error: "platform is required" });
    return;
  }
  if (!username || typeof username !== "string") {
    res.status(400).json({ error: "username is required" });
    return;
  }
  if (!Array.isArray(photoUrls) || photoUrls.length === 0) {
    res.status(400).json({ error: "photoUrls must be a non-empty array" });
    return;
  }

  const urls = (photoUrls as unknown[])
    .filter((u): u is string => typeof u === "string" && u.startsWith("http"))
    .slice(0, 10);

  if (urls.length === 0) {
    res.status(400).json({ error: "No valid http/https URLs provided in photoUrls" });
    return;
  }

  // Compute dHashes for the provided URLs
  const dHashes: string[] = [];
  for (const url of urls) {
    try {
      const hash = await computeDHash(url);
      if (hash) dHashes.push(hash);
    } catch (err) {
      logger.warn({ err, url }, "verify-account: dHash computation failed for URL (skipped)");
    }
  }

  if (dHashes.length === 0) {
    res.status(422).json({
      error: "Could not compute hashes from provided photoUrls — ensure URLs are publicly accessible images",
    });
    return;
  }

  const result = await verifyAccountAgainstAnchor(userId, dHashes);

  // Check if this account is already a connected account for the user
  const [connectedAccount] = await db
    .select({ id: connectedAccountsTable.id, username: connectedAccountsTable.username })
    .from(connectedAccountsTable)
    .where(eq(connectedAccountsTable.userId, userId));

  const isConnectedAccount = connectedAccount != null;

  logger.info(
    {
      userId,
      platform,
      username,
      confidence: result.confidence,
      tier: result.tier,
      matchedHashes: result.matchedHashCount,
    },
    "Identity verify-account check"
  );

  res.json({
    platform,
    username,
    confidence: result.confidence / 100, // normalise 0–1 for API consumers
    confidencePercent: result.confidence,
    tier: result.tier,
    matchedHashCount: result.matchedHashCount,
    totalCandidateHashes: result.totalCandidateHashes,
    verificationMethod: result.verificationMethod,
    anchorHashCount: result.anchorHashCount,
    isConnectedAccount,
    recommendation: confidenceToRecommendation(result.confidence),
  });
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
        label: "ShieldID Verified",
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
