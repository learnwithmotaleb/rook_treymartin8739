/**
 * Scan Orchestrator
 *
 * Coordinates the full identity protection scan pipeline:
 *
 * 1. Fetch all connected accounts for the user
 * 2. Ingest media from each platform via official API adapters (when token present)
 * 3. Update the identity fingerprint with indexed media counts
 * 4. Run impersonator discovery:
 *    - Verified accounts: fetch real media, score username variants via API
 *    - Unverified accounts: simulation mode
 * 5. Check email against breach databases (HIBP)
 * 6. Score all candidates and create threat records
 * 7. Generate AI explanations for high-severity threats
 * 8. Mark scan complete with threat count
 */

import { eq, and, ne, isNull } from "drizzle-orm";
import { recalculateScore } from "./scoreService";
import {
  db,
  scanJobsTable,
  connectedAccountsTable,
  threatsTable,
  suppressedAccountsTable,
  usersTable,
  photoProcessingConsentsTable,
  type ScanJob,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { buildScanCacheKey, getCached, setCache } from "./cacheService";
import type { Tier } from "../lib/planConfig";
import {
  generateSimulatedCandidates,
  buildThreatFromCandidate,
  computeTemporalScore,
  computeAccountTrustScore,
  classifyThreatSeverity,
  type ImpersonatorCandidate,
  type SignalData,
  type DetectedEvidence,
} from "./impersonatorDetectionService";
import { getTopVariants } from "./usernameMutationService";
import { getPlatformPriority, getPlatformWeightMultiplier, SCAN_CONFIG } from "./scanConfig";
import {
  updateFingerprint,
  buildUserPhotoEmbeddings,
  loadUserEmbeddings,
  comparePhotoWithEmbeddings,
} from "./fingerprintService";
import { generateThreatExplanation } from "./aiAnalysisService";
import { getAdapter, type MediaItem } from "../adapters/platformAdapter";
import {
  searchForImpersonators,
  isConfigured as isWebSearchConfigured,
  isVisionConfigured as isVisionSearchConfigured,
  type WebSearchCandidate,
} from "./webSearchService";
import { computeDHash, compareHashToHashes } from "./photoHashService";
import { storeUserPhotoHashes, loadUserDHashes, loadUserPhotoHashesWithDates, loadUserPhotoUrls, type DatedPhotoHash } from "./userPhotoHashService";
import {
  findActorByHash,
  computeUserThreshold,
} from "./phashIntelligenceService";
import { recomputeForUser as recomputeIdentityAnchor } from "./identityAnchorService";
import { sendScanCompleteNotification } from "./notificationService";
import { linkThreatToActor, findActorByUsername } from "./threatActorService";
import { deliverEvent } from "./webhookService";

/** Strip leading @, lowercase, trim — used for suppression key normalization. */
export function normalizeSuppressUsername(raw: string | null | undefined): string {
  return (raw ?? "").replace(/^@/, "").toLowerCase().trim();
}

/** Canonicalize platform name so historical aliases map to current Rook platform keys.
 *  "twitter" → "x": threats resolved under either name stay suppressed regardless of
 *  which alias the web search or platform adapter returns on the next scan. */
function normalizePlatformKey(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s === "twitter") return "x";
  return s;
}

/** Build the canonical lookup key: "platform:username" (both normalized). */
export function buildSuppressKey(
  platform: string,
  username: string | null | undefined
): string {
  return `${normalizePlatformKey(platform)}:${normalizeSuppressUsername(username)}`;
}

const SCAN_STEPS = [
  { step: "Verifying connected accounts", progress: 8 },
  { step: "Reviewing your content", progress: 20 },
  { step: "Updating your protection profile", progress: 35 },
  { step: "Checking for suspicious accounts", progress: 50 },
  { step: "Searching for unauthorized copies", progress: 62 },
  { step: "Reviewing potential matches", progress: 74 },
  { step: "Analyzing results", progress: 88 },
  { step: "Finalizing results", progress: 98 },
] as const;

// Platform API discovery limit is configured in scanConfig.ts → SCAN_CONFIG.platformApiVariantLimit

export async function startScan(
  userId: string,
  planTier: Tier = "free",
  options: { bypassCache?: boolean } = {}
): Promise<ScanJob> {
  const [job] = await db
    .insert(scanJobsTable)
    .values({
      userId,
      status: "queued",
      progress: 0,
      currentStep: "Queued for scanning",
      threatsFound: 0,
      startedAt: new Date(),
    })
    .returning();

  if (!job) throw new Error("Failed to create scan job");

  logger.info({ jobId: job.id, userId, bypassCache: options.bypassCache }, "Scan job created, starting pipeline");

  runScanPipeline(job.id, userId, planTier, options.bypassCache ?? false).catch((err) => {
    logger.error({ err, jobId: job.id }, "Scan pipeline failed");
    db.update(scanJobsTable)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(scanJobsTable.id, job.id))
      .catch(() => {});
  });

  return job;
}

async function updateJobProgress(
  jobId: string,
  progress: number,
  step: string
): Promise<void> {
  await db
    .update(scanJobsTable)
    .set({ progress, currentStep: step, status: "running" })
    .where(eq(scanJobsTable.id, jobId));
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Real media ingestion ─────────────────────────────────────────────────────

interface IngestedMedia {
  accountId: string;
  platform: string;
  username: string;
  accessToken: string;
  photos: number;
  captions: number;
  reels: number;
  mediaItems: MediaItem[];
  profileImageUrl?: string;
}

async function ingestPlatformMedia(
  account: typeof connectedAccountsTable.$inferSelect
): Promise<IngestedMedia | null> {
  if (!account.accessToken || !account.verified) return null;

  const adapter = getAdapter(account.platform);
  if (!adapter) return null;

  try {
    // Refresh profile data (follower count, display name)
    let platformUserId = account.platformUserId;
    let profileImageUrl: string | undefined;
    try {
      const profile = await adapter.getProfile(account.accessToken);
      platformUserId = profile.platformUserId;
      profileImageUrl = profile.profileImageUrl;
      await db
        .update(connectedAccountsTable)
        .set({
          displayName: profile.displayName ?? account.displayName,
          followers: profile.followers,
          platformUserId: profile.platformUserId,
        })
        .where(eq(connectedAccountsTable.id, account.id));
      logger.info(
        { accountId: account.id, platform: account.platform, followers: profile.followers },
        "Refreshed profile data"
      );
    } catch (err) {
      logger.warn({ err, accountId: account.id }, "Profile refresh failed, using cached data");
    }

    // Fetch media items
    const mediaItems = await adapter.getMediaItems(
      account.accessToken,
      platformUserId ?? account.platformUserId ?? "",
      50
    );

    const photos = mediaItems.filter((m) => m.type === "image").length;
    const reels = mediaItems.filter((m) => m.type === "video").length;
    const captions = mediaItems.filter((m) => m.caption && m.caption.length > 0).length;

    // Update indexed counts on the account
    await db
      .update(connectedAccountsTable)
      .set({
        photosIndexed: photos,
        captionsIndexed: captions,
        reelsIndexed: reels,
        lastSynced: new Date(),
      })
      .where(eq(connectedAccountsTable.id, account.id));

    logger.info(
      { accountId: account.id, platform: account.platform, photos, captions, reels },
      "Media ingestion complete"
    );

    return {
      accountId: account.id,
      platform: account.platform,
      username: account.username,
      accessToken: account.accessToken,
      photos,
      captions,
      reels,
      mediaItems,
      profileImageUrl,
    };
  } catch (err) {
    logger.error({ err, accountId: account.id, platform: account.platform }, "Media ingestion failed");
    return null;
  }
}

// ─── Real impersonator discovery via username variants ────────────────────────

async function discoverRealImpersonators(
  ingestedData: IngestedMedia
): Promise<ImpersonatorCandidate[]> {
  const adapter = getAdapter(ingestedData.platform);
  if (!adapter) return [];

  const cleanUsername = ingestedData.username.replace(/^@/, "");
  const candidates: ImpersonatorCandidate[] = [];

  // Phase 1: use the full mutation engine instead of the old 8-suffix list.
  // Top 20 ranked variants are searched (conservative limit — each = one API call).
  const variantsToSearch = getTopVariants(cleanUsername, SCAN_CONFIG.platformApiVariantLimit);

  logger.info(
    { platform: ingestedData.platform, username: cleanUsername, variantCount: variantsToSearch.length },
    "Starting platform API variant discovery with mutation engine"
  );

  // Fire all variant lookups in parallel — eliminates the old 200ms-per-variant
  // sequential sleep (20 variants × 200ms = 4s → now effectively 0).
  // Promise.allSettled so a single failed lookup doesn't abort the rest.
  const variantResults = await Promise.allSettled(
    variantsToSearch.map((variantUsername) =>
      adapter
        .searchByUsername(variantUsername, ingestedData.accessToken)
        .then((found) => ({ variantUsername, found }))
    )
  );

  for (const result of variantResults) {
    if (result.status === "rejected") {
      logger.warn(
        { err: result.reason, platform: ingestedData.platform },
        "Username variant check failed, skipping"
      );
      continue;
    }

    const { variantUsername, found } = result.value;

    for (const candidate of found) {
      if (candidate.username.toLowerCase() === cleanUsername.toLowerCase()) continue;

      // Username similarity vs the original handle
      const usernameSimilarity = computeUsernameSimilarity(cleanUsername, candidate.username);

      // Phase 6: account trust score from observable quality signals.
      // We have followers from CandidateAccount; following/age not available from
      // platform API for candidate accounts (requires their auth token).
      // Lower trust = more suspicious = higher threat contribution.
      const accountTrustScore = computeAccountTrustScore(candidate.followers);

      // Media overlap: we cannot fetch the candidate's post feed without their
      // auth token, so we use a conservative quality-weighted heuristic.
      // Phase 3 (real dHash comparison) applies to web/Vision candidates below
      // where we do have actual image URLs from Google Vision.
      const suspectedStolenCount = Math.min(
        Math.round(ingestedData.photos * 0.3),
        candidate.followers > 1000 ? 8 : 3
      );
      const mediaOverlapRatio = ingestedData.photos > 0
        ? Math.min(suspectedStolenCount / ingestedData.photos, 0.85)
        : 0.3;

      const signals: SignalData = {
        mediaOverlapRatio,
        captionOverlapRatio: mediaOverlapRatio * 0.6,
        profileImageSimilarity: usernameSimilarity > 0.7 ? 0.75 : 0.4,
        bioSimilarity: usernameSimilarity > 0.7 ? 0.55 : 0.25,
        usernameSimilarity,
        accountTrustScore,
        temporalReuseRatio: 0, // Phase 4: temporal data not available from platform API search
      };

      const evidence: DetectedEvidence[] = [
        {
          id: `real_${candidate.platformUserId}_profile`,
          type: "profile_photo",
          similarity: Math.round(signals.profileImageSimilarity * 100),
          label: "Profile Photo Similarity",
          yourPhotoUrl: ingestedData.profileImageUrl,
          stolenPhotoUrl: candidate.profileImageUrl,
        },
      ];

      if (suspectedStolenCount > 0) {
        evidence.push({
          id: `real_${candidate.platformUserId}_media`,
          type: "post_photo",
          similarity: Math.round(signals.mediaOverlapRatio * 100),
          label: `${suspectedStolenCount} Photos Potentially Reused`,
          yourPhotoUrl: ingestedData.profileImageUrl,
          stolenPhotoUrl: candidate.profileImageUrl,
        });
      }

      const trustLabel = accountTrustScore < 0.30
        ? "Very low-trust account — high suspicion"
        : accountTrustScore < 0.50
        ? "Low-trust account — recently created or few followers"
        : "Established account — monitor for escalation";

      const detectedSignals: string[] = [
        `Username variant: "${candidate.username}" matches mutation pattern`,
        `Username similarity: ${Math.round(usernameSimilarity * 100)}%`,
        `Account has ${candidate.followers} followers`,
        ingestedData.photos > 0
          ? `Up to ${suspectedStolenCount} of your ${ingestedData.photos} photos may be reused`
          : "No media baseline for comparison yet",
        trustLabel,
        `Found via username variant scan on ${ingestedData.platform}`,
      ];

      candidates.push({
        suspiciousUsername: `@${candidate.username}`,
        platform: ingestedData.platform,
        source: "username_search",
        signals,
        evidence,
        detectedSignals,
        matchedMediaCount: suspectedStolenCount,
        suspiciousProfileImageUrl: candidate.profileImageUrl,
        accountQuality: { followers: candidate.followers },
      });

      logger.info(
        { variantUsername: candidate.username, platform: ingestedData.platform, accountTrustScore },
        "Real impersonator candidate found"
      );
    }
  }

  logger.info(
    { platform: ingestedData.platform, candidates: candidates.length, variantsSearched: variantsToSearch.length },
    "Platform API variant discovery complete"
  );

  return candidates;
}

// Simple Levenshtein-based username similarity (0–1)
function computeUsernameSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  if (s1 === s2) return 1.0;
  if (s2.startsWith(s1) || s2.includes(s1)) return 0.85;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - editDistance(longer, shorter)) / longerLength;
}

function editDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1]!;
        if (s1[i - 1] !== s2[j - 1]) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]!) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length] ?? 0;
}

// ─── Web search candidate → ImpersonatorCandidate conversion ─────────────────

/** Maps Rook platform names to unavatar.io path segments for profile photo lookup. */
const UNAVATAR_PLATFORM: Record<string, string> = {
  instagram: "instagram",
  x: "twitter",
  tiktok: "tiktok",
  facebook: "facebook",
  youtube: "youtube",
  linkedin: "linkedin",
};

/** Best-effort profile photo URL for an impersonator account.
 *  Uses unavatar.io, which proxies platform CDNs.
 *  The mobile EvidencePhotoBox has an onError handler that falls back gracefully. */
function buildStolenPhotoUrl(platform: string, username: string): string | undefined {
  const slug = UNAVATAR_PLATFORM[platform.toLowerCase()];
  if (!slug) return undefined;
  const clean = username.replace(/^@/, "");
  return `https://unavatar.io/${slug}/${encodeURIComponent(clean)}`;
}

function webCandidateToImpersonator(
  wc: WebSearchCandidate,
  ingestedAccounts: IngestedMedia[],
  userAvatarUrl?: string
): ImpersonatorCandidate {
  const bestIngested = ingestedAccounts.reduce<IngestedMedia | null>(
    (best, curr) => (!best || curr.photos > best.photos ? curr : best),
    null
  );
  const userPhotos = bestIngested?.photos ?? 0;

  const isImageMatch = wc.discoveryMethod === "image_search";
  const isCaptionMatch = wc.discoveryMethod === "caption_search";

  // For image/caption discoveries the username similarity is irrelevant;
  // we weight the visual/content signals much higher instead.
  const mediaOverlapRatio = isImageMatch
    ? 0.80
    : isCaptionMatch
    ? 0.35
    : wc.similarity * 0.6;

  const captionOverlapRatio = isCaptionMatch
    ? 0.82
    : isImageMatch
    ? 0.15
    : wc.similarity * 0.4;

  const profileImageSimilarity = isImageMatch
    ? 0.88
    : wc.similarity * 0.7;

  const suspectedStolenCount = isImageMatch
    ? Math.max(3, Math.round(userPhotos * 0.3))
    : isCaptionMatch
    ? Math.max(1, Math.round(userPhotos * 0.1))
    : userPhotos > 0
    ? Math.max(1, Math.round(userPhotos * 0.25 * wc.similarity))
    : 3;

  // Phase 6: web candidates discovered without platform API data — use a neutral
  // account trust baseline (0.40 = slightly suspicious; unknown new account).
  // Full account trust scoring requires followers/age data only available from API.
  const signals: SignalData = {
    mediaOverlapRatio,
    captionOverlapRatio,
    profileImageSimilarity,
    bioSimilarity: isImageMatch ? 0.10 : wc.similarity * 0.5,
    usernameSimilarity: isImageMatch || isCaptionMatch ? 0.0 : wc.similarity,
    accountTrustScore: 0.40,        // conservative neutral for web-discovered candidates
    temporalReuseRatio: 0,          // Phase 4: populated later when Vision returns dated images
  };

  // ── Relationship context signal penalties ─────────────────────────────────
  // Mentions, credits, and collaborations are NOT impersonators.
  // Cap signals so these candidates reach at most Low severity regardless
  // of username similarity. "credit" context is filtered upstream in
  // webSearchService.ts, but applied here as a defense-in-depth measure.
  const relCtx = wc.relationshipContext;
  if (relCtx === "mention" || relCtx === "fan") {
    signals.profileImageSimilarity = Math.min(signals.profileImageSimilarity, 0.28);
    signals.mediaOverlapRatio = Math.min(signals.mediaOverlapRatio, 0.20);
    signals.captionOverlapRatio = Math.min(signals.captionOverlapRatio, 0.20);
  } else if (relCtx === "collaboration") {
    signals.profileImageSimilarity = Math.min(signals.profileImageSimilarity, 0.32);
    signals.mediaOverlapRatio = Math.min(signals.mediaOverlapRatio, 0.25);
    signals.captionOverlapRatio = Math.min(signals.captionOverlapRatio, 0.25);
  } else if (relCtx === "credit") {
    // Should be filtered before reaching here, but zero all signals as a safety net
    signals.profileImageSimilarity = 0;
    signals.mediaOverlapRatio = 0;
    signals.captionOverlapRatio = 0;
  }

  const evidence: DetectedEvidence[] = [];

  // "Your Photo" — prefer ingested profile photo, fall back to user avatar URL from DB
  const userProfilePhotoUrl = bestIngested?.profileImageUrl ?? userAvatarUrl ?? undefined;

  // "Stolen Photo" — use image URL if Vision found one, otherwise build via unavatar.io.
  // EvidencePhotoBox has an onError handler so a 404 from unavatar falls back gracefully.
  const stolenProfilePhotoUrl =
    wc.imageUrl ?? buildStolenPhotoUrl(wc.platform, wc.username) ?? undefined;

  if (isImageMatch) {
    evidence.push({
      id: `web_${wc.platform}_${wc.username}_img`,
      type: "profile_photo",
      similarity: Math.round(profileImageSimilarity * 100),
      label: "Profile Photo Found via Image Search",
      stolenPageUrl: wc.profileUrl,
      stolenPhotoUrl: stolenProfilePhotoUrl,
      yourPhotoUrl: userProfilePhotoUrl,
      postContext: wc.postContext ?? "original_post",
    });
  } else {
    evidence.push({
      id: `web_${wc.platform}_${wc.username}_username`,
      type: "profile_photo",
      similarity: Math.round(wc.similarity * 100),
      label: "Username Pattern Match",
      stolenPageUrl: wc.profileUrl,
      stolenPhotoUrl: stolenProfilePhotoUrl,
      yourPhotoUrl: userProfilePhotoUrl,
      postContext: wc.postContext ?? "original_post",
    });
  }

  if (suspectedStolenCount > 0) {
    evidence.push({
      id: `web_${wc.platform}_${wc.username}_media`,
      type: "post_photo",
      similarity: Math.round(mediaOverlapRatio * 100),
      label: isCaptionMatch
        ? "Caption Text Stolen Verbatim"
        : `${suspectedStolenCount} Potentially Stolen Photos`,
      stolenPageUrl: wc.profileUrl,
      stolenPhotoUrl: stolenProfilePhotoUrl,
      yourPhotoUrl: userProfilePhotoUrl,
      postContext: wc.postContext ?? "original_post",
      ...(isCaptionMatch
        ? {
            yourCaption: "Your original post text",
            stolenCaption: wc.snippet.slice(0, 80),
          }
        : {}),
    });
  }

  const detectedSignals: string[] = [];
  if (isImageMatch) {
    detectedSignals.push(
      `Discovered via reverse image search — username is completely different`,
      `${suspectedStolenCount} of your photos found on this account`,
      `Profile URL: ${wc.profileUrl}`,
      "Username has zero similarity to yours — photo theft without name cloning",
      userPhotos > 0
        ? `You have ${userPhotos} indexed photos; ${suspectedStolenCount} appear reused`
        : "No media baseline yet — visual match is primary signal"
    );
  } else if (isCaptionMatch) {
    detectedSignals.push(
      `Discovered via verbatim caption search — your post text found on this account`,
      `Username "${wc.username}" — no name similarity to yours`,
      `Caption snippet match: "${wc.snippet.slice(0, 60)}"`,
      `Profile URL: ${wc.profileUrl}`,
      "Content theft without photo or name cloning"
    );
  } else {
    detectedSignals.push(
      `Found via public web search on ${wc.platform}`,
      `Username "${wc.username}" matches impersonation pattern`,
      `Username similarity: ${Math.round(wc.similarity * 100)}%`,
      `Profile URL: ${wc.profileUrl}`,
      userPhotos > 0
        ? `Up to ${suspectedStolenCount} of your ${userPhotos} photos may be reused`
        : "No media baseline yet — monitor this account"
    );
  }

  // Map discovery method to candidate source
  const source: ImpersonatorCandidate["source"] =
    isImageMatch ? "image_search"
    : isCaptionMatch ? "caption_search"
    : "username_search";

  return {
    suspiciousUsername: `@${wc.username}`,
    platform: wc.platform,
    source,
    signals,
    evidence,
    detectedSignals,
    matchedMediaCount: suspectedStolenCount,
    suspiciousPostDate: wc.datePublished,
    // Use the fully-resolved photo URL (Vision URL when available, unavatar.io fallback)
    // so pHash comparison fires in Step 6 for ALL web candidates — not just the subset
    // where Google Vision returned a direct image URL.
    suspiciousProfileImageUrl: stolenProfilePhotoUrl,
    // Carry relationship context through for severity capping in the scoring loop
    relationshipContext: wc.relationshipContext,
    // Account quality data from platform APIs — stored in scoreBreakdownJson for the mobile UI
    accountQuality: wc.accountQuality,
  };
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

async function runScanPipeline(
  jobId: string,
  userId: string,
  planTier: Tier = "free",
  bypassCache: boolean = false
): Promise<void> {
  logger.info({ jobId, userId }, "Starting scan pipeline");

  // Immediately mark the job as running so the progress bar moves off 0%
  // before the initial DB queries complete.
  await updateJobProgress(jobId, 1, "Starting scan…");

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) throw new Error(`User not found: ${userId}`);

  // ── Photo-processing consent gate + parallel DB prefetch ─────────────────
  // Run consent check, connected accounts, and suppression set in parallel —
  // all three only need userId which is already known.
  const [activeConsentResult, connectedAccountsRaw, suppressedRows] = await Promise.all([
    // BIPA / GDPR Art. 9: real users need active consent for photo fingerprinting.
    // Demo users (no clerkId) are always allowed — they have no real photos.
    !user.clerkId
      ? Promise.resolve([{ id: "demo" }] as { id: string }[])
      : db
          .select({ id: photoProcessingConsentsTable.id })
          .from(photoProcessingConsentsTable)
          .where(
            and(
              eq(photoProcessingConsentsTable.userId, userId),
              isNull(photoProcessingConsentsTable.withdrawnAt)
            )
          )
          .limit(1),
    db.select().from(connectedAccountsTable).where(eq(connectedAccountsTable.userId, userId)),
    db
      .select({ platform: suppressedAccountsTable.platform, username: suppressedAccountsTable.username })
      .from(suppressedAccountsTable)
      .where(eq(suppressedAccountsTable.userId, userId)),
  ]);

  const [activeConsent] = activeConsentResult;
  const hasPhotoConsent = Boolean(activeConsent);
  if (!hasPhotoConsent) {
    logger.info({ userId }, "No active photo-processing consent — skipping photo fingerprinting steps");
  }

  // First scan: scanCount === 0. Used to apply high-precision mode throughout
  // the pipeline — tighter Hamming threshold, profile-photo hard filter, and
  // suppression of Low-severity results until a second scan confirms them.
  const isFirstScan = (user.scanCount ?? 0) === 0;

  // Demo user has no Clerk ID — simulation mode is only allowed for demo users.
  // Real authenticated users always get genuine scan results (even if empty).
  const isDemoUser = !user.clerkId;

  // Sort by platform priority so higher-risk platforms (Instagram, Facebook)
  // are ingested and searched first — urgent threats surface faster.
  const connectedAccounts = [...connectedAccountsRaw].sort(
    (a, b) => getPlatformPriority(a.platform) - getPlatformPriority(b.platform)
  );

  // ── Step 0: Suppression set (already loaded above in parallel) ────────────
  const suppressionSet = new Set(
    suppressedRows.map((r) => buildSuppressKey(r.platform, r.username))
  );

  if (suppressionSet.size > 0) {
    logger.info({ count: suppressionSet.size, userId }, "Loaded permanent suppression set");
  }

  await updateJobProgress(jobId, SCAN_STEPS[0].progress, SCAN_STEPS[0].step);

  // ── Step 2: Ingest real media from verified accounts ──────────────────────
  const ingestedAccounts: IngestedMedia[] = [];
  const verifiedAccounts = connectedAccounts.filter((a) => a.accessToken && a.verified);
  const unverifiedAccounts = connectedAccounts.filter((a) => !a.accessToken || !a.verified);

  await updateJobProgress(
    jobId,
    SCAN_STEPS[1].progress,
    verifiedAccounts.length > 0
      ? `Indexing media from ${verifiedAccounts.length} verified account${verifiedAccounts.length > 1 ? "s" : ""}…`
      : SCAN_STEPS[1].step
  );

  for (const account of verifiedAccounts) {
    const ingested = await ingestPlatformMedia(account);
    if (ingested) ingestedAccounts.push(ingested);
  }

  // Aggregate totals (real + cached for unverified)
  const realPhotos = ingestedAccounts.reduce((sum, a) => sum + a.photos, 0);
  const realCaptions = ingestedAccounts.reduce((sum, a) => sum + a.captions, 0);
  const realReels = ingestedAccounts.reduce((sum, a) => sum + a.reels, 0);

  const cachedPhotos = unverifiedAccounts.reduce((sum, a) => sum + a.photosIndexed, 0);
  const cachedCaptions = unverifiedAccounts.reduce((sum, a) => sum + a.captionsIndexed, 0);
  const cachedReels = unverifiedAccounts.reduce((sum, a) => sum + a.reelsIndexed, 0);

  const totalPhotos = realPhotos + cachedPhotos;
  const totalCaptions = realCaptions + cachedCaptions;
  const totalReels = realReels + cachedReels;

  // ── Step 3: Update fingerprint ────────────────────────────────────────────
  await updateFingerprint(userId, {
    totalPhotosIndexed: totalPhotos,
    totalCaptionsIndexed: totalCaptions,
    reelsIndexed: totalReels,
  });

  await updateJobProgress(jobId, SCAN_STEPS[2].progress, SCAN_STEPS[2].step);

  // Compute and persist pHash fingerprints for user's own photos.
  // Requires active photo-processing consent (BIPA / GDPR Art. 9).
  // storeUserPhotoHashes checks the DB first — photos already hashed from a
  // prior scan are returned immediately (no re-download).  The persistent
  // user_photo_hashes table means hashes survive CDN URL rotation between scans.
  // Build hash inputs from structured media items to preserve each photo's
  // postedAt timestamp — this is threaded into the DB so temporal scoring can
  // compare a suspicious account's post date against the exact matched victim photo.
  let allUserHashes: Awaited<ReturnType<typeof storeUserPhotoHashes>> = [];
  if (hasPhotoConsent) {
    const photoHashInputs: Array<{ platformMediaId: string; url: string; publishedAt?: Date }> = [];
    for (const ingested of ingestedAccounts) {
      if (ingested.profileImageUrl) {
        photoHashInputs.push({
          platformMediaId: `url:${encodeURIComponent(ingested.profileImageUrl).slice(0, 200)}`,
          url: ingested.profileImageUrl,
        });
      }
      for (const item of ingested.mediaItems) {
        if (item.type === "image" && item.url) {
          photoHashInputs.push({
            platformMediaId: `url:${encodeURIComponent(item.url).slice(0, 200)}`,
            url: item.url,
            publishedAt: item.postedAt,
          });
        }
      }
    }
    allUserHashes = await storeUserPhotoHashes(userId, photoHashInputs);
    logger.info({ userId, total: photoHashInputs.length, hashed: allUserHashes.length }, "User photo hashes ready");
  }

  // Fire-and-forget: recompute cross-platform identity anchor.
  // Every scan that ingests new photos improves the anchor's confidence and
  // per-platform verification scores — no scan completion needed to wait on this.
  recomputeIdentityAnchor(userId).catch(() => {});

  // Build AI embedding vectors for user photos (up to 20, profile photos first).
  // These catch cropped/filtered/re-uploaded copies that dHash misses.
  // Requires the same photo-processing consent as hash fingerprinting.
  // Runs in background — errors are non-fatal.
  if (hasPhotoConsent) {
    const profilePhotoUrls = ingestedAccounts
      .map((a) => a.profileImageUrl)
      .filter((u): u is string => Boolean(u));
    const allIngestedImageUrls = ingestedAccounts.flatMap((a) =>
      a.mediaItems.filter((m) => m.type === "image" && m.url).map((m) => m.url as string)
    );
    const embeddingTargetUrls = [
      ...profilePhotoUrls,
      ...allIngestedImageUrls.filter((u) => !profilePhotoUrls.includes(u)),
    ].slice(0, 20);

    buildUserPhotoEmbeddings(userId, embeddingTargetUrls, 20).catch((err) =>
      logger.warn({ err }, "Background AI embedding generation failed (non-fatal)")
    );
  }

  // Compute per-user Hamming threshold early — needed for both the pre-search
  // actor corpus fast-path and the per-candidate photo comparison in Step 6.
  // This is user-level calibration from feedback history; it does not depend
  // on any ingestion data so it can run before discovery steps start.
  const userHammingThreshold = await computeUserThreshold(userId, isFirstScan);
  const userMatchThreshold = Math.max(0, 1 - userHammingThreshold / 64);

  // ── Step 4: Platform variant search for impersonators ────────────────────
  await updateJobProgress(jobId, SCAN_STEPS[3].progress, SCAN_STEPS[3].step);

  const allCandidates: ImpersonatorCandidate[] = [];
  // Populated inside the web search block; consumed by the TikTok photo-gate
  // after step 6. Declared here so it's in scope at both points.
  const tiktokUsernameVariantKeys = new Set<string>();

  // ── Pre-web-search: Threat Actor Corpus Fast-Path ─────────────────────────
  // Compare the user's own photo hashes against known threat actor clusters.
  // When a match is found it means a confirmed multi-victim actor is using
  // photos similar to this user's — we synthesise a candidate immediately
  // and skip expensive web-search discovery for that actor.
  // Only fires for real users (not demo) with at least one stored photo hash.
  if (!isDemoUser && allUserHashes.length > 0) {
    const seenActorIds = new Set<string>();
    for (const userHash of allUserHashes.slice(0, 20)) {
      const actorMatch = await findActorByHash(userHash, userHammingThreshold);
      if (!actorMatch) continue;
      if (seenActorIds.has(actorMatch.actor.id)) continue; // dedup across hashes
      if (actorMatch.actor.victimCount < 2) continue; // require multi-victim actors

      seenActorIds.add(actorMatch.actor.id);

      let platformSet: string[] = [];
      try { platformSet = JSON.parse(actorMatch.actor.platformSetJson ?? "[]"); } catch { /* empty */ }
      const targetPlatform = platformSet[0] ?? "instagram";
      const targetUsername = actorMatch.actor.canonicalUsername ?? "unknown.account";

      if (suppressionSet.has(buildSuppressKey(targetPlatform, targetUsername))) continue;

      const actorSim = actorMatch.similarity;
      allCandidates.push({
        suspiciousUsername: targetUsername,
        platform: targetPlatform,
        source: "image_search",
        signals: {
          mediaOverlapRatio: actorSim * 0.9,
          captionOverlapRatio: 0,
          profileImageSimilarity: actorSim,
          bioSimilarity: 0,
          usernameSimilarity: 0,
          accountTrustScore: 0.20,    // known bad actor = very low trust
          temporalReuseRatio: 0,
        },
        evidence: [{
          id: `actor_fp_${actorMatch.actor.id}`,
          type: "profile_photo",
          similarity: Math.round(actorSim * 100),
          label: `Known Actor — ${Math.round(actorSim * 100)}% pHash Match (${actorMatch.actor.victimCount} victim${actorMatch.actor.victimCount !== 1 ? "s" : ""})`,
        }],
        matchedMediaCount: 1,
        detectedSignals: [
          `Known threat actor: "${targetUsername}" — targeted ${actorMatch.actor.victimCount} user${actorMatch.actor.victimCount !== 1 ? "s" : ""} (pHash distance: ${actorMatch.distance}/64, confidence: ${actorMatch.actor.confidenceScore}%)`,
          // Machine-readable collective intelligence signal — parsed in threat building loop
          `confirmedVictims:${actorMatch.actor.victimCount}`,
        ],
      });

      logger.info(
        { actorId: actorMatch.actor.id, username: targetUsername, distance: actorMatch.distance, victimCount: actorMatch.actor.victimCount },
        "Pre-search actor fast-path: corpus match found from user photo hash"
      );
    }
    if (seenActorIds.size > 0) {
      logger.info({ matchCount: seenActorIds.size }, "Pre-search actor fast-path complete — candidates added before web search");
    }
  }

  // Real discovery for verified accounts via platform APIs
  for (const ingested of ingestedAccounts) {
    const realCandidates = await discoverRealImpersonators(ingested);
    const unsuppressedReal = realCandidates.filter(
      (c) => !suppressionSet.has(buildSuppressKey(c.platform, c.suspiciousUsername))
    );
    if (realCandidates.length !== unsuppressedReal.length) {
      logger.info(
        { platform: ingested.platform, suppressed: realCandidates.length - unsuppressedReal.length },
        "Skipped suppressed real candidates (pre-filter)"
      );
    }
    allCandidates.push(...unsuppressedReal);
    logger.info(
      { platform: ingested.platform, found: unsuppressedReal.length },
      "Real impersonator discovery complete"
    );
  }

  // ── Step 5: Web search for impostor profiles on unconnected platforms ─────
  const connectedPlatforms = connectedAccounts.map((a) => a.platform);

  // Collect ALL unique usernames and display names across connected accounts.
  // Users often use different handles on different platforms (e.g. @johndoe on IG,
  // @john_official on X). Each unique username gets its own web/CSE search so
  // impersonators of any handle are discovered — not just the primary account's.
  // Image search (Vision) and caption search run only on the first pass to avoid
  // duplicating expensive API calls.
  const allConnectedUsernames = [
    ...new Set(
      connectedAccounts
        .map((a) => a.username?.replace(/^@/, "").toLowerCase().trim())
        .filter((u): u is string => Boolean(u))
    ),
  ];
  // Fall back to user.username if no connected accounts have usernames stored.
  const primaryUsername = allConnectedUsernames[0] ?? (user.username ?? "");

  // Unique display names — used by Strategy 1b (real-name CSE search).
  const allDisplayNames = [
    ...new Set(
      connectedAccounts
        .map((a) => a.displayName)
        .filter((d): d is string => Boolean(d))
    ),
  ];

  // Web search runs if either CSE (text search) OR Vision (image search) is available
  const webSearchEnabled = isWebSearchConfigured() || isVisionSearchConfigured();

  await updateJobProgress(
    jobId,
    SCAN_STEPS[4].progress,
    webSearchEnabled
      ? `Scanning the web for ${primaryUsername} impostor profiles…`
      : SCAN_STEPS[4].step
  );

  if (webSearchEnabled) {
    // Gather photo URLs — include profile photos first (always available even
    // when post-photo permissions haven't been granted via App Review).
    // Profile photos appear as the user's main identity image and are the
    // most likely to be stolen by impersonators.
    const profilePhotoUrls = ingestedAccounts
      .map((a) => a.profileImageUrl)
      .filter((u): u is string => Boolean(u));

    const { webSearch: webSearchLimits } = SCAN_CONFIG;

    const postPhotoUrls = ingestedAccounts.flatMap((a) =>
      a.mediaItems
        .filter((m) => m.type === "image" && m.url)
        .map((m) => m.url)
        .slice(0, webSearchLimits.maxPostPhotoUrls)
    );

    // For unverified / manually-connected accounts that produced no ingested
    // photos, fall back to Photo Monitor uploads stored in user_photo_hashes.
    // This ensures Vision reverse-image search fires even when there is no OAuth.
    const indexedPhotoUrls: string[] =
      profilePhotoUrls.length === 0 && postPhotoUrls.length === 0
        ? await loadUserPhotoUrls(userId).catch(() => [])
        : [];

    // Profile photos first so Strategy 2 (reverse image search) always has
    // at least one URL to work with, even when post photos aren't accessible.
    const allPhotoUrls = [
      ...profilePhotoUrls,
      ...postPhotoUrls,
      ...indexedPhotoUrls,
    ].slice(0, webSearchLimits.maxTotalPhotoUrls);

    const allCaptions = ingestedAccounts.flatMap((a) =>
      a.mediaItems
        .map((m) => m.caption)
        .filter((c): c is string => typeof c === "string" && c.length >= 30)
        .slice(0, webSearchLimits.maxCaptions)
    );

    // All display names across accounts — Strategy 1b (real-name CSE) uses these.
    // Most impersonators copy the real name, not just the handle, so searching
    // every display name the user goes by maximises coverage.
    const primaryDisplayName = allDisplayNames[0] ?? null;

    logger.info(
      {
        profilePhotos: profilePhotoUrls.length,
        postPhotos: postPhotoUrls.length,
        indexedPhotos: indexedPhotoUrls.length,
        captions: allCaptions.length,
        displayName: primaryDisplayName ?? "(none)",
      },
      "Web search inputs prepared"
    );

    // ── Cache check: skip expensive APIs if same accounts were scanned within 72h ─
    const scanCacheKey = buildScanCacheKey(
      connectedAccounts.map((a) => ({ username: a.username, platform: a.platform }))
    );

    let webCandidates: WebSearchCandidate[];
    const cachedResult = isDemoUser || bypassCache
      ? null
      : await getCached<WebSearchCandidate[]>(scanCacheKey);

    if (cachedResult) {
      webCandidates = cachedResult.data;
      logger.info(
        {
          cacheKey: scanCacheKey.slice(0, 16),
          hitCount: cachedResult.hitCount,
          candidateCount: webCandidates.length,
          expiresAt: cachedResult.expiresAt,
        },
        "Web search cache HIT — skipping external API calls"
      );
    } else {
      // Run web search for EVERY unique username across all connected accounts.
      // Image search (Vision) and caption search run only on the first pass to
      // avoid duplicating expensive API calls — they're photo/text-based, not
      // username-based, so one call covers all accounts.
      // Text search (CSE + direct probes) runs per unique username so impersonators
      // of any handle the user goes by are discovered.
      const seenWebKeys = new Set<string>();
      const mergedWebCandidates: typeof webCandidates = [];

      const searchTargets = allConnectedUsernames.length > 0
        ? allConnectedUsernames
        : [primaryUsername];

      // Run all username searches in parallel — each is independent.
      // Photos/captions only pass on index 0 to avoid duplicate Vision API calls
      // (image/caption search is not username-dependent; one pass covers all).
      const allSearchResults = await Promise.allSettled(
        searchTargets.map((searchUsername, i) => {
          const searchDisplayName = allDisplayNames[i] ?? allDisplayNames[0] ?? undefined;
          return searchForImpersonators({
            username: searchUsername,
            connectedPlatforms,
            photoUrls: i === 0 ? allPhotoUrls : [],
            captions: i === 0 ? allCaptions : [],
            planTier,
            userId,
            displayName: searchDisplayName,
          });
        })
      );

      for (let i = 0; i < allSearchResults.length; i++) {
        const result = allSearchResults[i]!;
        if (result.status === "rejected") {
          logger.warn({ err: result.reason, pass: i + 1 }, "Web search pass failed (non-fatal)");
          continue;
        }
        const results = result.value;
        for (const c of results) {
          const key = `${c.platform}:${c.username.toLowerCase().replace(/^@/, "")}`;
          if (!seenWebKeys.has(key)) {
            seenWebKeys.add(key);
            mergedWebCandidates.push(c);
          }
        }
        logger.info(
          { pass: i + 1, total: searchTargets.length, found: results.length, merged: mergedWebCandidates.length },
          "Web search pass complete"
        );
      }

      webCandidates = mergedWebCandidates;

      // Cache results only when candidates were found — never cache empty results
      // so the next scan can retry the APIs instead of serving a stale zero.
      if (!isDemoUser && webCandidates.length > 0) {
        setCache(scanCacheKey, webCandidates).catch(() => {});
      }
    }

    for (const wc of webCandidates) {
      const candidate = webCandidateToImpersonator(wc, ingestedAccounts, user.avatarUrl ?? undefined);
      if (suppressionSet.has(buildSuppressKey(candidate.platform, candidate.suspiciousUsername))) {
        logger.info(
          { username: candidate.suspiciousUsername, platform: candidate.platform },
          "Skipped suppressed web candidate (pre-filter)"
        );
        continue;
      }
      allCandidates.push(candidate);
      // Track TikTok username-variant keys for the photo-gate that runs after step 6.
      if (wc.platform === "tiktok" && wc.discoveryMethod === "username_variant") {
        tiktokUsernameVariantKeys.add(`tiktok:${wc.username.toLowerCase().replace(/^@/, "")}`);
      }
    }

    logger.info(
      {
        count: webCandidates.length,
        usernamesSearched: allConnectedUsernames.length || 1,
        byMethod: {
          username_variant: webCandidates.filter((c) => c.discoveryMethod === "username_variant").length,
          image_search: webCandidates.filter((c) => c.discoveryMethod === "image_search").length,
          caption_search: webCandidates.filter((c) => c.discoveryMethod === "caption_search").length,
        },
      },
      "Web-based impersonator search complete"
    );
  }

  // Simulation for accounts with no real candidates from any source.
  // ONLY for the demo user (no Clerk ID). Real authenticated users receive
  // genuine results — even if empty — so they never see fabricated threats.
  const simulatedPlatforms = connectedAccounts.map((a) => a.platform);

  if (allCandidates.length === 0 && isDemoUser && connectedAccounts.length > 0) {
    const simulated = generateSimulatedCandidates(primaryUsername, simulatedPlatforms, suppressionSet);
    allCandidates.push(...simulated);
    logger.info(
      { count: simulated.length },
      "Using simulated candidates (demo user, no real candidates found)"
    );
  } else if (allCandidates.length === 0 && !isDemoUser) {
    logger.info(
      { userId, connectedAccounts: connectedAccounts.length },
      "Real user scan complete — no impersonator candidates found (clean result)"
    );
  }

  // Sort candidate pool by platform priority — higher-priority platforms
  // scored first so the most critical results are computed and stored early.
  allCandidates.sort(
    (a, b) => getPlatformPriority(a.platform) - getPlatformPriority(b.platform)
  );

  // ── Step 6: Visual media analysis — pHash profile picture comparison ─────
  await updateJobProgress(jobId, SCAN_STEPS[5].progress, SCAN_STEPS[5].step);

  // Load dHash+publishedAt pairs for all of the user's indexed photos.
  // These drive both hash comparison (dHash string) and temporal post-dating
  // detection (publishedAt of the specific photo that matched the candidate).
  let userHashDates: DatedPhotoHash[] = [];
  try {
    userHashDates = await loadUserPhotoHashesWithDates(userId);
  } catch {
    // Non-fatal: temporal scoring will be skipped for this scan
  }

  // For Hamming comparison, prefer freshly-computed hashes from this scan.
  // Fall back to DB-loaded dHashes if no new photos were hashed this scan.
  let userHashes: string[] = allUserHashes.length > 0
    ? [...allUserHashes]
    : userHashDates.map((h) => h.dHash);
  if (userHashes.length === 0) {
    userHashes = await loadUserDHashes(userId);
    logger.info({ userId, loaded: userHashes.length }, "Loaded user dHashes from persistent store");
  }

  // (userHammingThreshold and userMatchThreshold are computed before Step 4 above
  // so they are available for the pre-search actor corpus fast-path.)

  // Load AI embedding vectors (built in background above, or from a prior scan)
  const userEmbeddings = await loadUserEmbeddings(userId);

  const candidatesWithImages = allCandidates.filter((c) => c.suspiciousProfileImageUrl);
  // candidateDHashMap: tracks each candidate's computed dHash so we can
  // (a) skip re-downloading when comparing to user hashes, and
  // (b) pass the hash to linkThreatToActor for cross-user cluster enrichment.
  const candidateDHashMap = new Map<string, string>(); // key = `${platform}:${username}`
  // Per-candidate: tracks the publishedAt of the specific victim photo that matched
  // so temporal scoring compares against the exact original, not the earliest-ever photo.
  const candidateMatchedDateMap = new Map<string, Date | null>(); // key = `${platform}:${username}`

  if (candidatesWithImages.length > 0) {
    logger.info(
      {
        userHashes: userHashes.length,
        userEmbeddings: userEmbeddings.length,
        candidatesWithImages: candidatesWithImages.length,
        userHammingThreshold,
      },
      "Running photo comparison (pHash fast-path + AI embeddings) for candidate profile pictures"
    );

    // Process all candidates in parallel — each writes to its own Map key
    // and its own candidate object, so there is no shared mutable state.
    await Promise.allSettled(candidatesWithImages.map(async (candidate) => {
      if (!candidate.suspiciousProfileImageUrl) return;
      const candidateKey = `${candidate.platform}:${candidate.suspiciousUsername}`;

      // Download the candidate image ONCE and compute its dHash.
      // All subsequent comparisons reuse this hash — no second download.
      const candidateDHash = await computeDHash(candidate.suspiciousProfileImageUrl);
      if (candidateDHash) {
        candidateDHashMap.set(candidateKey, candidateDHash);
      }

      // ── Fast path: check known threat actor clusters ────────────────────────
      // Zero AI cost.  If this impersonator's hash matches a cluster built from
      // a previous user's scan, we get instant high-confidence detection without
      // calling GPT-4o.  The cluster grows with every confirmed threat — the
      // more users, the faster and cheaper detection becomes for everyone.
      if (candidateDHash) {
        const actorMatch = await findActorByHash(candidateDHash, userHammingThreshold);
        if (actorMatch) {
          const actorSim = actorMatch.similarity;
          if (actorSim > candidate.signals.profileImageSimilarity) {
            candidate.signals.profileImageSimilarity = actorSim;
          }
          candidate.signals.mediaOverlapRatio = Math.max(
            candidate.signals.mediaOverlapRatio,
            actorSim * 0.9
          );
          candidate.detectedSignals.push(
            `Known threat actor: "${actorMatch.actor.canonicalUsername}" — targeted ${actorMatch.actor.victimCount} user${actorMatch.actor.victimCount !== 1 ? "s" : ""} (pHash distance: ${actorMatch.distance}/64, confidence: ${actorMatch.actor.confidenceScore}%)`,
            // Machine-readable collective intelligence signal — parsed in threat building loop
            `confirmedVictims:${actorMatch.actor.victimCount}`
          );
          const profileEvidence = candidate.evidence.find((e) => e.type === "profile_photo");
          if (profileEvidence && actorSim > profileEvidence.similarity / 100) {
            profileEvidence.similarity = Math.round(actorSim * 100);
            profileEvidence.label = `Known Actor — ${Math.round(actorSim * 100)}% pHash Match (${actorMatch.actor.victimCount} victim${actorMatch.actor.victimCount !== 1 ? "s" : ""})`;
          }
          logger.info(
            {
              username: candidate.suspiciousUsername,
              actorId: actorMatch.actor.id,
              distance: actorMatch.distance,
              victimCount: actorMatch.actor.victimCount,
              confidence: actorMatch.actor.confidenceScore,
            },
            "Fast-path actor match via pHash cluster"
          );
        }
      }

      // ── Layer 1: dHash vs user's own photo hashes ───────────────────────────
      // Uses the pre-computed candidateDHash — no second image download.
      // Threshold is per-user (adjusted from false_positive feedback history).
      if (candidateDHash && userHashes.length > 0) {
        const hashResult = compareHashToHashes(candidateDHash, userHashes, userMatchThreshold);

        if (hashResult.similarity > candidate.signals.profileImageSimilarity) {
          candidate.signals.profileImageSimilarity = hashResult.similarity;
        }

        if (hashResult.matched) {
          candidate.signals.mediaOverlapRatio = Math.max(
            candidate.signals.mediaOverlapRatio,
            hashResult.similarity * 0.9
          );
          candidate.detectedSignals.push(
            `Profile photo pHash match: ${Math.round(hashResult.similarity * 100)}% identical (Hamming distance: ${hashResult.hammingDistance}/64)`
          );
          const profileEvidence = candidate.evidence.find((e) => e.type === "profile_photo");
          if (profileEvidence) {
            profileEvidence.similarity = Math.round(hashResult.similarity * 100);
            profileEvidence.label = `Profile Photo — ${Math.round(hashResult.similarity * 100)}% Match (pHash verified)`;
          }
          // Record the matched victim photo's publish date so the temporal scoring
          // block can compare against the specific original, not the library-earliest.
          if (hashResult.matchedHash) {
            const matchedEntry = userHashDates.find((h) => h.dHash === hashResult.matchedHash);
            if (matchedEntry?.publishedAt) {
              candidateMatchedDateMap.set(candidateKey, matchedEntry.publishedAt);
            }
          }
          logger.info(
            { username: candidate.suspiciousUsername, similarity: Math.round(hashResult.similarity * 100), distance: hashResult.hammingDistance },
            "pHash profile picture match confirmed"
          );
        }
      }

      // ── Layer 2: AI embedding similarity ───────────────────────────────────
      // Only run when: we have embeddings AND dHash + actor-fast-path didn't
      // already yield a strong signal (≥85%).  This catches cropped/filtered
      // re-uploads that fool dHash but not semantic similarity.
      const currentSim = candidate.signals.profileImageSimilarity;
      if (userEmbeddings.length > 0 && currentSim < 0.85) {
        try {
          const embResult = await comparePhotoWithEmbeddings(
            candidate.suspiciousProfileImageUrl,
            userEmbeddings
          );
          if (embResult) {
            logger.info(
              { username: candidate.suspiciousUsername, embeddingSimilarity: Math.round(embResult.similarity * 100) },
              "AI embedding photo comparison complete"
            );
            if (embResult.similarity > candidate.signals.profileImageSimilarity) {
              candidate.signals.profileImageSimilarity = embResult.similarity;
            }
            if (embResult.matched) {
              candidate.signals.mediaOverlapRatio = Math.max(
                candidate.signals.mediaOverlapRatio,
                embResult.similarity * 0.85
              );
              candidate.detectedSignals.push(
                `AI visual match: ${Math.round(embResult.similarity * 100)}% similarity (style/composition embedding)`
              );
              const profileEvidence = candidate.evidence.find((e) => e.type === "profile_photo");
              if (profileEvidence && embResult.similarity > profileEvidence.similarity / 100) {
                profileEvidence.similarity = Math.round(embResult.similarity * 100);
                profileEvidence.label = `Profile Photo — ${Math.round(embResult.similarity * 100)}% AI Match (visual embedding)`;
              }
            }
          }
        } catch (err) {
          logger.warn({ err, username: candidate.suspiciousUsername }, "AI embedding comparison failed (non-fatal)");
        }
      }
    }));  // end Promise.allSettled — all candidates processed in parallel
  } else {
    if (candidatesWithImages.length === 0) {
      logger.info(
        { userHashes: userHashes.length, userEmbeddings: userEmbeddings.length },
        "No candidate profile images to compare — pHash step skipped (Vision may find some next scan)"
      );
    } else {
      logger.info({ userId }, "No user photo fingerprints available — comparison skipped");
    }
  }

  // ── TikTok photo-gate ─────────────────────────────────────────────────────
  // TikTok username-variant candidates are extremely prone to false positives:
  // creators who post videos *about* or *crediting* a person often appear as
  // username variants even though they share no photo DNA with the victim.
  // Gate: only keep TikTok username_variant candidates if their profile photo
  // (oEmbed thumbnail_url, captured as imageUrl → suspiciousProfileImageUrl)
  // matched one of the user's monitored photo hashes in step 6 above.
  // Falls back to username-only if the user has no photo hashes stored yet
  // (e.g. photo consent not granted), so no TikTok results are lost in that case.
  if (userHashes.length > 0 && tiktokUsernameVariantKeys.size > 0) {
    const beforeTikTokGate = allCandidates.length;

    // Filter: remove TikTok username-variant candidates that didn't get a photo
    // match. profileImageSimilarity < userMatchThreshold means no confirmed match.
    const tiktokGated = allCandidates.filter((c) => {
      if (c.platform !== "tiktok") return true;
      const key = `tiktok:${c.suspiciousUsername.toLowerCase().replace(/^@/, "")}`;
      if (!tiktokUsernameVariantKeys.has(key)) return true; // not username_variant path
      const photoMatched = c.signals.profileImageSimilarity >= userMatchThreshold;
      if (!photoMatched) {
        logger.info(
          { username: c.suspiciousUsername, profileImageSimilarity: Math.round(c.signals.profileImageSimilarity * 100) },
          "TikTok candidate suppressed by photo-gate: no profile photo match"
        );
      }
      return photoMatched;
    });

    allCandidates.length = 0;
    allCandidates.push(...tiktokGated);

    const suppressed = beforeTikTokGate - allCandidates.length;
    if (suppressed > 0) {
      logger.info({ suppressed, checked: tiktokUsernameVariantKeys.size }, "TikTok photo-gate removed false-positive candidates");
    }
  }

  // NOTE: Bulk retirement removed.
  // Old behaviour wiped ALL previous threats at scan start, so interrupted scans
  // or scans that returned fewer results (API limits, CSE coverage gaps) silently
  // deleted legitimate finds from prior runs.
  //
  // New behaviour: threats accumulate and are only retired when the same
  // account is *re-found* in the current scan (see post-insert step below).
  // Threats not found in this scan persist until the user resolves them manually
  // or a future scan positively confirms the account is gone.

  // All candidates in allCandidates are already pre-filtered against the
  // permanent suppressionSet (loaded at step 0). This safety check is a
  // last-resort guard in case any candidate slipped through a future code path.
  const newThreats: (typeof threatsTable.$inferInsert)[] = [];

  for (const candidate of allCandidates) {
    if (suppressionSet.has(buildSuppressKey(candidate.platform, candidate.suspiciousUsername))) {
      logger.warn(
        { username: candidate.suspiciousUsername, platform: candidate.platform },
        "Late-stage suppression catch — candidate was not pre-filtered (check discovery path)"
      );
      continue;
    }

    // Phase 4 — Multi-image temporal ratio pre-pass.
    // Populate temporalReuseRatio BEFORE buildThreatFromCandidate so the 5-pt
    // temporalReuse weight in the scoring function reflects confirmed post-dating.
    // (The +15/-10 modifier in the block below is an additional bonus on top.)
    const candidateKey = `${candidate.platform}:${candidate.suspiciousUsername}`;
    const victimMatchedDatePrepass = candidateMatchedDateMap.get(candidateKey) ?? null;
    if (victimMatchedDatePrepass || candidate.suspiciousPostDate) {
      const { modifier: prepassModifier } = computeTemporalScore(
        victimMatchedDatePrepass,
        candidate.suspiciousPostDate
      );
      if (prepassModifier > 0) {
        // Confirmed post-dating: set ratio to 1.0 → full 5 pts from temporalReuse weight
        candidate.signals.temporalReuseRatio = 1.0;
      } else if (prepassModifier < 0) {
        // Pre-dating contra-indicator: 0.0 → no temporal contribution
        candidate.signals.temporalReuseRatio = 0.0;
      }
      // prepassModifier === 0 (within jitter): leave at default 0 (neutral)
    }

    const scored = buildThreatFromCandidate(candidate, isFirstScan);

    // Threat zeroed out by first-scan precision gate — skip it entirely
    if (scored.breakdown.total === 0 && !candidate.simulated) {
      logger.info(
        { username: candidate.suspiciousUsername, platform: candidate.platform },
        "First-scan precision gate: candidate excluded (no strong visual signal)"
      );
      continue;
    }

    // Tag known-actor matches so the mobile app can show a collective badge.
    // The actor signal is already in detectedSignals as a "Known threat actor: …"
    // string — add a machine-readable marker alongside it.
    const hasActorMatch = candidate.detectedSignals.some((s) =>
      s.startsWith("Known threat actor:")
    );
    if (hasActorMatch) {
      candidate.detectedSignals.push("sharedThreatActor");
    }

    // ── Cross-user escalation ─────────────────────────────────────────────
    // Query threatActorsTable directly for this candidate — authoritative source
    // for victimCount regardless of which fast-path branch ran. Falls back to
    // string-tag parsing only when the DB lookup itself throws.
    let confirmedVictims = 0;
    try {
      const actorRecord = await findActorByUsername(
        candidate.suspiciousUsername,
        candidate.platform
      );
      confirmedVictims = actorRecord?.victimCount ?? 0;
    } catch {
      // Non-fatal: fall back to fast-path string tag
      const confirmedVictimsSignal = candidate.detectedSignals.find((s) =>
        s.startsWith("confirmedVictims:")
      );
      confirmedVictims = confirmedVictimsSignal
        ? parseInt(confirmedVictimsSignal.split(":")[1] ?? "0", 10)
        : 0;
    }
    const scoredSeverity = scored.severity;

    // ── Relationship context severity cap ─────────────────────────────────────
    // Mentions, collaborations, and fan accounts are NOT impersonators.
    // Cap severity at Low for these contexts regardless of combined score.
    // Cross-user escalation does NOT override this cap — if a bunch of users
    // mark a fan-account page as "approved" it still can't be High.
    const candidateRelCtx = candidate.relationshipContext;
    const isNonImpersonatorContext =
      candidateRelCtx === "mention" ||
      candidateRelCtx === "collaboration" ||
      candidateRelCtx === "credit" ||
      candidateRelCtx === "fan";
    const contextCappedSeverity: "high" | "medium" | "low" =
      isNonImpersonatorContext ? "low" : scoredSeverity;
    if (isNonImpersonatorContext && scoredSeverity !== "low") {
      candidate.detectedSignals.push(
        `relationshipContextCap: capped at Low — relationship context "${candidateRelCtx}" is not impersonation`
      );
    }

    const escalatedSeverity: "high" | "medium" | "low" =
      !isNonImpersonatorContext && confirmedVictims >= 3 && contextCappedSeverity === "low" ? "medium"
      : !isNonImpersonatorContext && confirmedVictims >= 3 && contextCappedSeverity === "medium" ? "high"
      : contextCappedSeverity;
    if (confirmedVictims >= 3 && escalatedSeverity !== contextCappedSeverity) {
      candidate.detectedSignals.push(
        "crossUserEscalation",
        `confirmedVictimsEscalation: severity escalated ${contextCappedSeverity}→${escalatedSeverity} (${confirmedVictims} Rook users confirmed this actor)`
      );
    }

    // ── Temporal signal ───────────────────────────────────────────────────
    // Use the matched victim photo's own publishedAt (the specific photo the
    // candidate copied), not the library-earliest heuristic.  Falls back to
    // null gracefully when no hash match was found for this candidate.
    const victimMatchedDate = candidateMatchedDateMap.get(candidateKey) ?? null;
    const { modifier: temporalModifier, deltaDays: temporalDeltaDays } = computeTemporalScore(
      victimMatchedDate,
      candidate.suspiciousPostDate
    );
    if (temporalModifier > 0) {
      candidate.detectedSignals.push(
        `postDatingConfirmed: suspicious content posted after your original upload (+${temporalModifier} to threat score)`,
        `postDatingDays:${temporalDeltaDays}`
      );
    } else if (temporalModifier < 0) {
      candidate.detectedSignals.push(
        `preDating: suspicious content predates your upload (contra-indicator, ${temporalModifier} to threat score)`,
        `postDatingDays:${temporalDeltaDays}`
      );
    }

    // ── Platform weight multiplier ────────────────────────────────────────────
    // Instagram/Facebook impersonators cause greater real-world harm; apply a
    // small score boost so they rank above equivalent threats on lower-priority
    // platforms. Multiplier is defined in scanConfig.ts.
    const platformMultiplier = getPlatformWeightMultiplier(candidate.platform);

    // Actor corpus fast-path: guarantee High severity + minimum score floor.
    // Known bad-actors verified by collective intelligence skip normal scoring
    // and are always surfaced as High-priority threats. Normal scoring may
    // produce Medium on a first scan (tight Hamming ≤6 but moderate signal
    // values), so we enforce the floor here unconditionally.
    // Actor corpus matches bypass classifyThreatSeverity caps (trusted corpus).
    const effectiveSeverity: "high" | "medium" | "low" = hasActorMatch
      ? "high"
      : escalatedSeverity;
    const baseScore = Math.round(
      Math.min(100, Math.max(0, scored.breakdown.total + temporalModifier) * platformMultiplier)
    );
    const effectiveScore = hasActorMatch
      ? Math.max(baseScore, 75)
      : baseScore;

    // Tag high-confidence threats:
    // – any actor corpus match (cross-user verified), regardless of scan number
    // – first-scan candidates that score ≥ 75 on their own signals
    if (hasActorMatch || (isFirstScan && effectiveScore >= 75)) {
      candidate.detectedSignals.push("firstScanHighConfidence");
    }

    // Low-severity threats on the first scan are stored but hidden from the
    // feed. They surface if the same account still appears on scan #2+.
    // Actor corpus matches are never hidden — they are already high-confidence.
    const hiddenUntilScan = isFirstScan && effectiveSeverity === "low";

    let aiExplanation: string | null = null;
    if (effectiveSeverity === "high") {
      try {
        aiExplanation = await generateThreatExplanation(
          {
            threatType: scored.type,
            signals: candidate.detectedSignals,
            matchedMediaCount: candidate.matchedMediaCount,
            platform: candidate.platform,
            suspiciousUsername: candidate.suspiciousUsername,
          },
          userId   // pass userId for cost tracking
        );
      } catch (err) {
        logger.warn({ err }, "AI explanation generation failed, skipping");
      }
    }

    const effectiveBreakdown = hasActorMatch
      ? { ...scored.breakdown, total: effectiveScore }
      : scored.breakdown;
    newThreats.push({
      userId,
      scanJobId: jobId,
      type: scored.type,
      severity: effectiveSeverity,
      platform: candidate.platform,
      title: scored.title,
      description: scored.description,
      details: scored.details,
      aiExplanation,
      threatScore: effectiveScore,
      suspiciousUsername: candidate.suspiciousUsername,
      matchedMediaCount: candidate.matchedMediaCount,
      evidenceJson: JSON.stringify(candidate.evidence),
      scoreBreakdownJson: JSON.stringify({
        ...effectiveBreakdown,
        // Store account quality data so the mobile app can display follower counts,
        // post count, and account age without a separate API call.
        ...(candidate.accountQuality ? { accountMeta: candidate.accountQuality } : {}),
      }),
      detectedSignalsJson: JSON.stringify({
        flags: candidate.detectedSignals.filter(
          (s) =>
            !s.startsWith("confirmedVictims:") &&
            s !== "crossUserEscalation" &&
            !s.startsWith("postDatingDays:")
        ),
        ...(confirmedVictims > 0 && { confirmedVictims }),
        ...(confirmedVictims >= 3 &&
          escalatedSeverity !== scoredSeverity && { crossUserEscalation: true }),
        ...(temporalDeltaDays !== null && { postDatingDays: temporalDeltaDays }),
      }),
      // Store the impersonator's dHash so linkThreatToActor can enrich the
      // actor's pHash cluster — enabling fast-path detection for future users.
      impersonatorDHash: candidateDHashMap.get(candidateKey) ?? null,
      // Dual sub-scores for precision classification and UI display
      identityMatchScore: scored.breakdown.identityMatchScore,
      impersonationConfidenceScore: scored.breakdown.impersonationConfidenceScore,
      hiddenUntilScan,
      resolved: false,
    });
  }

  // ── Step 7: AI threat explanation ─────────────────────────────────────────
  await updateJobProgress(jobId, SCAN_STEPS[6].progress, SCAN_STEPS[6].step);

  const insertedThreatIds: string[] = [];

  if (newThreats.length > 0) {
    for (const threat of newThreats) {
      const [inserted] = await db
        .insert(threatsTable)
        .values(threat)
        .returning({
          id: threatsTable.id,
          suspiciousUsername: threatsTable.suspiciousUsername,
          platform: threatsTable.platform,
          severity: threatsTable.severity,
          threatScore: threatsTable.threatScore,
          impersonatorDHash: threatsTable.impersonatorDHash,
        });

      if (inserted) {
        insertedThreatIds.push(inserted.id);

        // Link to shared threat actor and enrich its pHash cluster.
        // The cluster grows with each confirmed threat, enabling instant
        // fast-path matches for future users who encounter the same actor.
        linkThreatToActor(
          inserted.id,
          inserted.suspiciousUsername ?? "",
          inserted.platform,
          inserted.impersonatorDHash  // seeds / grows the actor's hash cluster
        ).catch((err) =>
          logger.warn({ err, threatId: inserted.id }, "Threat actor linking failed (non-fatal)")
        );

        // Deliver threat.detected webhook event to any registered API key holders
        if (inserted.severity === "high" || inserted.severity === "medium") {
          deliverEvent(userId, "threat.detected", {
            threatId: inserted.id,
            severity: inserted.severity,
            platform: inserted.platform,
            suspiciousUsername: inserted.suspiciousUsername,
            threatScore: inserted.threatScore,
          }).catch(() => {});
        }
      }
    }
  }

  // ── Targeted retirement: retire OLD records only for accounts re-found this scan ──
  // For each account the current scan discovered, mark the previous unresolved record
  // as resolved (different scanJobId) so the feed shows only the freshest data.
  // Accounts NOT found in this scan keep their old record — they persist until the
  // user resolves them manually.
  if (allCandidates.length > 0) {
    for (const candidate of allCandidates) {
      await db
        .update(threatsTable)
        .set({ resolved: true })
        .where(
          and(
            eq(threatsTable.userId, userId),
            eq(threatsTable.platform, candidate.platform),
            eq(threatsTable.suspiciousUsername, candidate.suspiciousUsername),
            eq(threatsTable.resolved, false),
            ne(threatsTable.scanJobId, jobId)
          )
        );
    }
    logger.info(
      { accountsRescanned: allCandidates.length },
      "Targeted retirement: old records for re-found accounts marked resolved"
    );
  }

  // ── Step 8: Complete ──────────────────────────────────────────────────────
  await updateJobProgress(jobId, SCAN_STEPS[7].progress, SCAN_STEPS[7].step);

  await db
    .update(scanJobsTable)
    .set({
      status: "completed",
      progress: 100,
      currentStep: "Scan complete",
      threatsFound: newThreats.length,
      completedAt: new Date(),
    })
    .where(eq(scanJobsTable.id, jobId));

  // Increment scan counter — tracks how many completed scans this user has had.
  // This is the gate for first-scan precision mode on the next pipeline run.
  db.update(usersTable)
    .set({ scanCount: (user.scanCount ?? 0) + 1 })
    .where(eq(usersTable.id, userId))
    .catch((err) => logger.warn({ err }, "Failed to increment scanCount"));

  // Schedule next automated scan based on tier
  const daysUntilNext = planTier === "premium" ? 1 : planTier === "pro" ? 7 : null;
  if (daysUntilNext !== null) {
    const nextScanDue = new Date();
    nextScanDue.setDate(nextScanDue.getDate() + daysUntilNext);
    db.update(usersTable)
      .set({ nextScanDue })
      .where(eq(usersTable.id, userId))
      .catch((err) => logger.warn({ err }, "Failed to set nextScanDue"));
  }

  // Recalculate security score based on all active threats after scan
  recalculateScore(userId).catch((err) =>
    logger.warn({ err }, "Score recalculation failed after scan")
  );

  // Deliver scan.completed webhook event
  deliverEvent(userId, "scan.completed", {
    scanId: jobId,
    threatsFound: newThreats.length,
    threatIds: insertedThreatIds,
  }).catch(() => {});

  // Send push notification to user's registered devices
  sendScanCompleteNotification(userId, newThreats.length).catch(() => {});

  logger.info(
    {
      jobId,
      threatsFound: newThreats.length,
      verifiedAccounts: verifiedAccounts.length,
      realCandidates: allCandidates.filter((c) => !c.simulated).length,
      simulatedCandidates: allCandidates.filter((c) => c.simulated).length,
      mediaIndexed: { photos: totalPhotos, captions: totalCaptions, reels: totalReels },
    },
    "Scan pipeline completed"
  );
}
