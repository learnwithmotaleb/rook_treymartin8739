/**
 * Identity Anchor Service
 *
 * Turns the user's accumulated photo hashes into a cross-platform identity proof.
 * Every scan enriches the anchor — more platforms and more hashes mean higher
 * confidence. Companies integrating the B2B API call this data to verify that
 * a user's claimed social accounts all belong to the same real person.
 *
 * Algorithm:
 *   1. Load all user_photo_hashes grouped by platform (via connected_accounts)
 *   2. For each platform pair, compute cross-platform Hamming similarity
 *   3. Build "anchor cluster" = hashes confirmed across ≥2 platforms
 *   4. Score: crossPlatformConsistency × 70 + platformBonus + hashBonus
 *   5. Map score → confidence tier (UNVERIFIED / LOW / MEDIUM / HIGH / STRONG)
 *   6. Per-platform: visualMatchScore = % of platform hashes in anchor
 *   7. Upsert user_identity_profiles and platform_verifications
 *
 * Privacy properties:
 *   - No pixel data, no photos stored — only 16-char hex hashes
 *   - Entire table deletable on user request with zero photo-data loss
 *   - Hashes are not reversible to images
 */

import { eq } from "drizzle-orm";
import {
  db,
  userPhotoHashesTable,
  connectedAccountsTable,
  userIdentityProfilesTable,
  platformVerificationsTable,
} from "@workspace/db";
import { hammingDistance } from "./photoHashService";
import { logger } from "../lib/logger";

// Hamming distance threshold for cross-platform match
const CROSS_PLATFORM_THRESHOLD = 12;

// ─── Username cross-reference scoring ─────────────────────────────────────────

/**
 * Normalise a social handle to its "core" — strip @ prefix, separators,
 * and common decorators (official, real, backup, the, its, im, 1, 2).
 */
function normHandle(u: string): string {
  return u
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[._\-]/g, "")
    .replace(/\b(official|real|backup|original|the|its|im|1|2|3)\b/g, "")
    .trim();
}

/**
 * Compute a 0-100 metadata match score for one platform's username against
 * the other connected platforms' usernames.
 *
 * Heuristics:
 *   100 — normalised cores are identical
 *    80 — one core is a substring of the other (min length 3)
 *    60 — cores share a common prefix of ≥ 3 chars
 *    20 — no meaningful overlap
 */
function metadataMatchScoreForPlatform(
  targetUsername: string,
  otherUsernames: string[]
): number {
  if (otherUsernames.length === 0) return 50;
  const coreA = normHandle(targetUsername);
  if (coreA.length < 2) return 50;

  const perPair = otherUsernames.map((u) => {
    const coreB = normHandle(u);
    if (coreB.length < 2) return 20;
    if (coreA === coreB) return 100;
    if (
      (coreA.length >= 3 && coreB.includes(coreA)) ||
      (coreB.length >= 3 && coreA.includes(coreB))
    ) return 80;
    const prefixLen = Math.min(coreA.length, coreB.length, 4);
    if (prefixLen >= 3 && coreA.slice(0, prefixLen) === coreB.slice(0, prefixLen)) return 60;
    return 20;
  });

  return Math.round(perPair.reduce((a, b) => a + b, 0) / perPair.length);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConfidenceTier = "UNVERIFIED" | "LOW" | "MEDIUM" | "HIGH" | "STRONG";

export interface IdentityAnchorResult {
  overallConfidence: number;
  confidenceTier: ConfidenceTier;
  verifiedPlatformCount: number;
  anchorHashCount: number;
  canonicalHashCluster: string[];
  platformScores: PlatformScore[];
}

export interface PlatformScore {
  platform: string;
  username: string;
  hashCount: number;
  visualMatchScore: number;
  metadataMatchScore: number;
  verificationMethod: "visual_hash_consensus" | "single_platform" | "unverified";
}

// ─── Core computation ─────────────────────────────────────────────────────────

/**
 * Recompute and persist the identity anchor for a user.
 * Safe to call fire-and-forget — all errors are caught and logged.
 */
export async function recomputeForUser(userId: string): Promise<void> {
  try {
    const result = await computeIdentityAnchor(userId);
    await persistIdentityProfile(userId, result);
    logger.info(
      {
        userId,
        confidence: result.overallConfidence,
        tier: result.confidenceTier,
        platforms: result.verifiedPlatformCount,
        anchorHashes: result.anchorHashCount,
      },
      "Identity anchor recomputed"
    );
  } catch (err) {
    logger.warn({ err, userId }, "Identity anchor recompute failed (non-fatal)");
  }
}

/**
 * Compute the identity anchor for a user without persisting.
 * Useful for on-demand verification API calls.
 */
export async function computeIdentityAnchor(
  userId: string
): Promise<IdentityAnchorResult> {
  // Load all photo hashes with their account info
  const hashRows = await db
    .select({
      dHash: userPhotoHashesTable.dHash,
      accountId: userPhotoHashesTable.accountId,
      platformMediaId: userPhotoHashesTable.platformMediaId,
    })
    .from(userPhotoHashesTable)
    .where(eq(userPhotoHashesTable.userId, userId));

  if (hashRows.length === 0) {
    return emptyResult();
  }

  // Load connected accounts to resolve accountId → platform + username
  const accounts = await db
    .select({
      id: connectedAccountsTable.id,
      platform: connectedAccountsTable.platform,
      username: connectedAccountsTable.username,
    })
    .from(connectedAccountsTable)
    .where(eq(connectedAccountsTable.userId, userId));

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  // Group hashes by platform
  const platformHashMap = new Map<string, { username: string; hashes: string[] }>();

  for (const row of hashRows) {
    if (!row.accountId) continue;
    const account = accountMap.get(row.accountId);
    if (!account) continue;

    const existing = platformHashMap.get(account.platform);
    if (existing) {
      existing.hashes.push(row.dHash);
    } else {
      platformHashMap.set(account.platform, {
        username: account.username,
        hashes: [row.dHash],
      });
    }
  }

  // Hashes without an accountId (stored via URL fallback) grouped under a virtual platform
  const orphanHashes = hashRows
    .filter((r) => !r.accountId)
    .map((r) => r.dHash);

  if (orphanHashes.length > 0 && platformHashMap.size === 0) {
    // Only orphan hashes — no account association, treat as single-platform
    const syntheticPlatform = "_unknown";
    platformHashMap.set(syntheticPlatform, { username: "", hashes: orphanHashes });
  }

  const platforms = Array.from(platformHashMap.entries());
  const platformCount = platforms.length;

  if (platformCount === 0) {
    return emptyResult();
  }

  // ── Single platform: limited confidence ──────────────────────────────────
  if (platformCount === 1) {
    const [platformKey, { username, hashes }] = platforms[0]!;
    const hashCount = hashes.length;
    const confidence = Math.min(25, hashCount * 3);
    const tier = scoreToTier(confidence);

    return {
      overallConfidence: confidence,
      confidenceTier: tier,
      verifiedPlatformCount: 1,
      anchorHashCount: hashCount,
      canonicalHashCluster: hashes,
      platformScores: [
        {
          platform: platformKey,
          username,
          hashCount,
          visualMatchScore: 100,
          // Only one platform — no cross-reference possible; neutral score
          metadataMatchScore: 50,
          verificationMethod: "single_platform",
        },
      ],
    };
  }

  // ── Multi-platform: cross-platform consistency ────────────────────────────
  const anchorSet = new Set<string>();

  // For each platform pair, find hashes that cross-match
  for (let i = 0; i < platforms.length; i++) {
    const [, dataA] = platforms[i]!;
    for (let j = 0; j < platforms.length; j++) {
      if (i === j) continue;
      const [, dataB] = platforms[j]!;

      for (const hashA of dataA.hashes) {
        const hasCrossMatch = dataB.hashes.some(
          (hashB) => hammingDistance(hashA, hashB) <= CROSS_PLATFORM_THRESHOLD
        );
        if (hasCrossMatch) {
          anchorSet.add(hashA);
        }
      }
    }
  }

  const anchorCluster = Array.from(anchorSet);
  const anchorHashCount = anchorCluster.length;

  // Cross-platform consistency: average fraction of each platform's hashes in anchor
  let consistencySum = 0;
  const platformScores: PlatformScore[] = [];

  for (const [platformKey, { username, hashes }] of platforms) {
    const matchedCount = hashes.filter((h) => anchorSet.has(h)).length;
    const platformConsistency = hashes.length > 0 ? matchedCount / hashes.length : 0;
    consistencySum += platformConsistency;

    const visualMatchScore = Math.round(platformConsistency * 100);

    // Compute real metadata match score from cross-platform username similarity
    const otherUsernames = platforms
      .filter(([pk]) => pk !== platformKey)
      .map(([, d]) => d.username);
    const metadataScore = metadataMatchScoreForPlatform(username, otherUsernames);

    platformScores.push({
      platform: platformKey,
      username,
      hashCount: hashes.length,
      visualMatchScore,
      metadataMatchScore: metadataScore,
      verificationMethod: anchorHashCount > 0 ? "visual_hash_consensus" : "single_platform",
    });
  }

  const avgConsistency = consistencySum / platformCount;

  // Average metadata match score across all platforms
  const avgMetadata =
    platformScores.reduce((sum, p) => sum + p.metadataMatchScore, 0) /
    platformScores.length;

  // Confidence formula:
  //   base      = crossPlatformConsistency × 60  (photo hash anchor)
  //   metadata  = normalised metadataMatch × 10  (username cross-reference)
  //   platform  = (platforms - 1) × 8, capped at 20
  //   hash      = anchor cluster size, capped at 10
  const base = avgConsistency * 60;
  const metadataBonus = Math.round((avgMetadata / 100) * 10);
  const platformBonus = Math.min(20, (platformCount - 1) * 8);
  const hashBonus = Math.min(10, anchorHashCount);
  const overallConfidence = Math.min(
    100,
    Math.round(base + metadataBonus + platformBonus + hashBonus)
  );

  // Verified platform count = platforms with ≥50% visual match score
  const verifiedPlatformCount = platformScores.filter(
    (p) => p.visualMatchScore >= 50
  ).length;

  const tier = scoreToTier(overallConfidence);

  return {
    overallConfidence,
    confidenceTier: tier,
    verifiedPlatformCount,
    anchorHashCount,
    canonicalHashCluster: anchorCluster,
    platformScores,
  };
}

// ─── Persistence ──────────────────────────────────────────────────────────────

async function persistIdentityProfile(
  userId: string,
  result: IdentityAnchorResult
): Promise<void> {
  // Upsert the identity profile
  await db
    .insert(userIdentityProfilesTable)
    .values({
      userId,
      canonicalHashClusterJson: JSON.stringify(result.canonicalHashCluster),
      overallConfidence: result.overallConfidence,
      verifiedPlatformCount: result.verifiedPlatformCount,
      anchorHashCount: result.anchorHashCount,
      confidenceTier: result.confidenceTier,
      lastComputedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userIdentityProfilesTable.userId,
      set: {
        canonicalHashClusterJson: JSON.stringify(result.canonicalHashCluster),
        overallConfidence: result.overallConfidence,
        verifiedPlatformCount: result.verifiedPlatformCount,
        anchorHashCount: result.anchorHashCount,
        confidenceTier: result.confidenceTier,
        lastComputedAt: new Date(),
      },
    });

  // Upsert per-platform verifications
  for (const score of result.platformScores) {
    if (score.platform === "_unknown") continue;
    await db
      .insert(platformVerificationsTable)
      .values({
        userId,
        platform: score.platform,
        username: score.username,
        visualMatchScore: score.visualMatchScore,
        metadataMatchScore: score.metadataMatchScore,
        hashCount: score.hashCount,
        verificationMethod: score.verificationMethod,
        verifiedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          platformVerificationsTable.userId,
          platformVerificationsTable.platform,
        ],
        set: {
          username: score.username,
          visualMatchScore: score.visualMatchScore,
          metadataMatchScore: score.metadataMatchScore,
          hashCount: score.hashCount,
          verificationMethod: score.verificationMethod,
          verifiedAt: new Date(),
        },
      });
  }
}

// ─── On-demand cross-match for B2B verify-account ─────────────────────────────

export interface VerifyAccountResult {
  confidence: number;
  tier: ConfidenceTier;
  matchedHashCount: number;
  totalCandidateHashes: number;
  verificationMethod: string;
  anchorHashCount: number;
}

/**
 * Check whether a given set of dHashes (from a claimed account) is consistent
 * with the user's existing identity anchor. Used by POST /identity/verify-account.
 *
 * @param userId     The ShieldID user whose anchor to compare against
 * @param dHashes    dHash strings computed from the claimed account's photos
 */
export async function verifyAccountAgainstAnchor(
  userId: string,
  dHashes: string[]
): Promise<VerifyAccountResult> {
  if (dHashes.length === 0) {
    return {
      confidence: 0,
      tier: "UNVERIFIED",
      matchedHashCount: 0,
      totalCandidateHashes: 0,
      verificationMethod: "no_hashes_provided",
      anchorHashCount: 0,
    };
  }

  // Load the stored identity profile
  const [profile] = await db
    .select()
    .from(userIdentityProfilesTable)
    .where(eq(userIdentityProfilesTable.userId, userId));

  if (!profile || profile.anchorHashCount === 0) {
    return {
      confidence: 0,
      tier: "UNVERIFIED",
      matchedHashCount: 0,
      totalCandidateHashes: dHashes.length,
      verificationMethod: "no_anchor",
      anchorHashCount: 0,
    };
  }

  const anchor: string[] = JSON.parse(profile.canonicalHashClusterJson) as string[];

  // Count candidate hashes that match the anchor
  let matchedCount = 0;
  for (const candidateHash of dHashes) {
    const hasMatch = anchor.some(
      (anchorHash) => hammingDistance(candidateHash, anchorHash) <= CROSS_PLATFORM_THRESHOLD
    );
    if (hasMatch) matchedCount++;
  }

  const matchRatio = matchedCount / dHashes.length;
  // Scale: full match on a rich anchor = 95; partial match = proportionally less
  const rawConfidence = matchRatio * Math.min(95, profile.overallConfidence + 20);
  const confidence = Math.min(100, Math.round(rawConfidence));
  const tier = scoreToTier(confidence);

  return {
    confidence,
    tier,
    matchedHashCount: matchedCount,
    totalCandidateHashes: dHashes.length,
    verificationMethod: "visual_hash_anchor_match",
    anchorHashCount: anchor.length,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyResult(): IdentityAnchorResult {
  return {
    overallConfidence: 0,
    confidenceTier: "UNVERIFIED",
    verifiedPlatformCount: 0,
    anchorHashCount: 0,
    canonicalHashCluster: [],
    platformScores: [],
  };
}

function scoreToTier(score: number): ConfidenceTier {
  if (score >= 80) return "STRONG";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  if (score >= 5) return "LOW";
  return "UNVERIFIED";
}
