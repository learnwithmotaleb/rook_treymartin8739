/**
 * Impersonator Detection Service
 *
 * Implements a two-dimensional threat scoring model:
 *
 *   Identity Match Score (0-100) — how closely the account resembles the target
 *     = profilePhoto(20) + bioSimilarity(5) + usernameSimilarity(10) → scaled to 0-100
 *
 *   Impersonation Confidence Score (0-100) — how clearly the act is intentional
 *     = mediaOverlap(35) + contentReuse(15) + accountTrust(10) + temporalReuse(5) → scaled to 0-100
 *
 *   Combined Threat Score (0-100)
 *     = profilePhoto(20) + mediaOverlap(35) + contentReuse(15)
 *       + bioSimilarity(5) + usernameSimilarity(10) + accountTrust(10) + temporalReuse(5)
 *
 * Phase 9 — High severity requires meeting at least one of:
 *   Option A: profileImageSimilarity ≥ 80% AND matchedMedia ≥ 2
 *   Option B: matchedMedia ≥ 3 AND combined score ≥ 70
 *   If neither is met, maximum severity is Medium (prevents username-only High threats).
 *
 * All thresholds and weights are in scanConfig.ts — do not hardcode here.
 */

import { SCAN_CONFIG } from "./scanConfig";

export interface SignalData {
  mediaOverlapRatio: number;       // actual overlap ratio (Phase 3: real dHash comparison)
  captionOverlapRatio: number;
  profileImageSimilarity: number;
  bioSimilarity: number;
  usernameSimilarity: number;
  /** Account trust score (0=very suspicious, 1=trustworthy). Inverted for scoring. */
  accountTrustScore: number;
  /**
   * Phase 4 — Temporal reuse ratio (0–1).
   * Fraction of matched images where the suspicious account posted AFTER the victim.
   * 0 = no post-dating evidence; 1 = all matched images post-date the victim's originals.
   * Defaults to 0 when temporal data is unavailable (graceful degradation).
   */
  temporalReuseRatio: number;
}

export interface ThreatScoreBreakdown {
  mediaSimilarity: number;
  contentReuse: number;
  profileSimilarity: number;
  bioSimilarity: number;
  usernameSimilarity: number;
  /** Contribution from low-trust account signals (0–10 points). */
  accountTrust: number;
  /** Contribution from temporal post-dating evidence (0–5 points). */
  temporalReuse: number;
  total: number;
  /**
   * Identity Match Score (0-100): how closely the account resembles the target.
   * Computed from profileSimilarity + bioSimilarity + usernameSimilarity,
   * scaled to 0-100.
   */
  identityMatchScore: number;
  /**
   * Impersonation Confidence Score (0-100): how clearly the act is intentional.
   * Computed from mediaOverlap + contentReuse + accountTrust + temporalReuse,
   * scaled to 0-100.
   */
  impersonationConfidenceScore: number;
}

export interface DetectedEvidence {
  id: string;
  type: "profile_photo" | "post_photo" | "reel_thumbnail" | "caption";
  similarity: number;
  label: string;
  yourCaption?: string;
  stolenCaption?: string;
  yourPhotoUrl?: string;
  stolenPhotoUrl?: string;
  stolenPageUrl?: string;
  postContext?: "original_post" | "retweet" | "share" | "unknown";
  originalPoster?: string;
  /** Date the victim originally posted this photo (for temporal evidence display). */
  victimPublishedAt?: string;
  /** Date the suspicious account posted this photo (for temporal evidence display). */
  suspiciousPublishedAt?: string;
  /** Positive delta days when suspicious posted after victim (post-dating confirmation). */
  postDatingDays?: number;
}

export interface ImpersonatorCandidate {
  suspiciousUsername: string;
  platform: string;
  source:
    | "username_search"
    | "media_similarity"
    | "api_discovery"
    | "graph_match"
    | "image_search"
    | "caption_search";
  /** True only for demo-mode placeholders — never for real discovered accounts */
  simulated?: boolean;
  signals: SignalData;
  evidence: DetectedEvidence[];
  detectedSignals: string[];
  matchedMediaCount: number;
  suspiciousProfileImageUrl?: string;
  /**
   * ISO-8601 date string extracted from the Google result when the suspicious
   * account posted this content. Used by computeTemporalScore() to check
   * whether the suspicious post postdates the victim's original upload.
   * Undefined when Google doesn't expose a publish date (graceful skip).
   */
  suspiciousPostDate?: string;
  /** Phase 6: account quality signals collected during candidate media fetch. */
  accountQuality?: {
    followers: number;
    following?: number;
    totalPosts?: number;
    accountAgeDays?: number;
    engagementRate?: number;
  };
  /**
   * Relationship context from web search — indicates whether this page is a
   * genuine impersonation attempt or a benign mention/credit/collab.
   * Set by webSearchService.ts; used by the orchestrator to apply severity caps.
   *
   *   "impersonator"  — trying to BE the victim (default)
   *   "mention"       — victim tagged/mentioned in someone else's post
   *   "collaboration" — collab/duet/feat post with the victim
   *   "credit"        — photo/video credit; victim is the creator (filtered before scoring)
   *   "fan"           — self-declared fan/parody account
   *   "unknown"       — context could not be determined
   */
  relationshipContext?: "impersonator" | "mention" | "collaboration" | "credit" | "fan" | "unknown";
}

export interface ScoredThreat {
  candidate: ImpersonatorCandidate;
  breakdown: ThreatScoreBreakdown;
  severity: "high" | "medium" | "low";
  type:
    | "impersonator"
    | "fake_account"
    | "stolen_photo"
    | "scam";
  title: string;
  description: string;
  details: string;
}

export function calculateThreatScore(
  signals: SignalData,
  isFirstScan = false
): ThreatScoreBreakdown {
  const { weights, firstScan } = SCAN_CONFIG;

  const mediaSimilarity = Math.round(
    Math.min(signals.mediaOverlapRatio, 1.0) * weights.mediaOverlap
  );
  const contentReuse = Math.round(
    Math.min(signals.captionOverlapRatio, 1.0) * weights.contentReuse
  );
  const profileSimilarity = Math.round(
    Math.min(signals.profileImageSimilarity, 1.0) * weights.profilePhoto
  );
  const bioSimilarity = Math.round(
    Math.min(signals.bioSimilarity, 1.0) * weights.bioSimilarity
  );
  const usernameSimilarity = Math.round(
    Math.min(signals.usernameSimilarity, 1.0) * weights.usernameSimilarity
  );
  // accountTrust: inverted — low trust = more suspicious = higher contribution
  const accountTrust = Math.round(
    (1 - Math.min(Math.max(signals.accountTrustScore, 0), 1.0)) * weights.accountTrust
  );
  // temporalReuse: direct — higher ratio of post-dated matches = stronger signal
  const temporalReuse = Math.round(
    Math.min(signals.temporalReuseRatio, 1.0) * weights.temporalReuse
  );

  const total =
    mediaSimilarity +
    contentReuse +
    profileSimilarity +
    bioSimilarity +
    usernameSimilarity +
    accountTrust +
    temporalReuse;

  // ── Dual sub-scores ────────────────────────────────────────────────────────
  // Identity Match: how closely the account resembles the target identity.
  // Components: profileSimilarity + bioSimilarity + usernameSimilarity → /35 → 0-100
  const rawIdentity = profileSimilarity + bioSimilarity + usernameSimilarity;
  const identityMatchScore = Math.round(
    (rawIdentity / SCAN_CONFIG.identityMatchMaxRaw) * 100
  );

  // Impersonation Confidence: how clearly the act is intentional.
  // Components: mediaOverlap + contentReuse + accountTrust + temporalReuse → /65 → 0-100
  const rawImpersonation = mediaSimilarity + contentReuse + accountTrust + temporalReuse;
  const impersonationConfidenceScore = Math.round(
    (rawImpersonation / SCAN_CONFIG.impersonationMaxRaw) * 100
  );

  // ── First-scan precision gate ──────────────────────────────────────────────
  // On the first scan, exclude username-only / bio-only / weak-photo candidates
  // so the feed only surfaces high-confidence results.
  // Gate: profileImageSimilarity < threshold AND mediaSimilarity below floor.
  if (
    isFirstScan &&
    signals.profileImageSimilarity < firstScan.minProfileImageSimilarity &&
    mediaSimilarity < firstScan.minMediaSimilarityPoints
  ) {
    return {
      mediaSimilarity,
      contentReuse,
      profileSimilarity,
      bioSimilarity,
      usernameSimilarity,
      accountTrust,
      temporalReuse,
      identityMatchScore,
      impersonationConfidenceScore,
      total: 0,
    };
  }

  return {
    mediaSimilarity,
    contentReuse,
    profileSimilarity,
    bioSimilarity,
    usernameSimilarity,
    accountTrust,
    temporalReuse,
    identityMatchScore,
    impersonationConfidenceScore,
    total,
  };
}

/**
 * Raw combined score → base severity tier (no caps or gates).
 * Use `classifyThreatSeverity` for full classification with all guards applied.
 */
export function scoreThreatSeverity(
  total: number
): "high" | "medium" | "low" {
  if (total >= SCAN_CONFIG.severity.highMin) return "high";
  if (total >= SCAN_CONFIG.severity.mediumMin) return "medium";
  return "low";
}

/**
 * Full threat severity classification with strict false-positive filters.
 *
 * Phase 11 tightens all gates to require near-certain visual evidence for High:
 *
 *   Option A: profile photo ≥ 90% (near-exact pHash match) AND ≥ 2 matched media
 *   Option B: ≥ 3 matched media AND combined score ≥ 75
 *
 * If neither option is met, the maximum severity is Medium — no matter
 * how high the combined score is. This prevents username-similarity-only
 * accounts from reaching High.
 *
 * Medium now requires profile photo ≥ 30% so that pure username/bio matches
 * with no visual identity anchor can only reach Low.
 *
 * Actor corpus matches and cross-user escalation can still override this
 * result in the scan pipeline (trusted collective intelligence bypasses caps).
 *
 * Relationship context (mention/collab/credit) is applied BEFORE this function
 * in the orchestrator — candidates that are clearly non-impersonators are either
 * disqualified or capped at Low before scoring runs.
 */
export function classifyThreatSeverity(
  breakdown: ThreatScoreBreakdown,
  profileImageSimilarity: number,
  matchedMediaCount: number
): "high" | "medium" | "low" {
  const { profilePhoto, highSeverityGate } = SCAN_CONFIG;

  // Gate 0: absolute profile photo floor — very weak match → Low regardless
  if (profileImageSimilarity < profilePhoto.lowCapThreshold) {
    return "low";
  }

  // Start from the combined score tier
  let severity = scoreThreatSeverity(breakdown.total);

  // Gate 1: profile photo medium cap — below threshold, max is Medium.
  // Phase 11: raised from 0.25 to 0.30 — pure username/bio matches cap at Low
  // when there is essentially no visual evidence of stolen identity.
  if (profileImageSimilarity < profilePhoto.mediumCapThreshold) {
    if (severity === "high") severity = "medium";
    // If the score is only Medium but profile photo is very weak, cap at Low
    // so username-only signals can never reach Medium on their own.
    if (severity === "medium" && profileImageSimilarity < profilePhoto.lowCapThreshold + 0.05) {
      return "low";
    }
    return severity;
  }

  // Phase 11: High severity requires meeting at least ONE of two evidence gates.
  // A candidate should NEVER be High based only on username/bio similarity.
  // These gates ensure actual visual theft evidence is present.
  if (severity === "high") {
    const optionA =
      profileImageSimilarity >= highSeverityGate.optionA.minProfileSimilarity &&
      matchedMediaCount >= highSeverityGate.optionA.minMatchedMedia;

    const optionB =
      matchedMediaCount >= highSeverityGate.optionB.minMatchedMedia &&
      breakdown.total >= highSeverityGate.optionB.minCombinedScore;

    if (!optionA && !optionB) {
      // Not enough visual evidence — downgrade to Medium
      return "medium";
    }

    // Additional dual-score gate: both identity and impersonation must be strong
    if (
      breakdown.identityMatchScore < SCAN_CONFIG.dualScoreGate.minIdentityMatchForHigh ||
      breakdown.impersonationConfidenceScore < SCAN_CONFIG.dualScoreGate.minImpersonationConfForHigh
    ) {
      return "medium";
    }
  }

  return severity;
}

/**
 * Temporal signal scorer: impersonators always post stolen content AFTER the victim.
 *
 * Returns a score modifier in the range [-10, +15]:
 *   +15  — suspicious post is clearly later (≥2 days after victim's upload)
 *    0   — suspicious post is exactly 1 day later (within clock/timezone jitter)
 *   -10  — suspicious post is same-day (deltaDays = 0) or pre-dates victim upload
 *    0   — either date is missing (graceful skip — no penalty for lack of data)
 */
export interface TemporalScoreResult {
  /** Score modifier to add/subtract from the threat score. */
  modifier: number;
  /**
   * Signed day delta: suspicious post date minus victim publish date.
   * Positive = post-dating (suspicious posted after victim).
   * Negative = pre-dating (suspicious posted before victim).
   * null when either date is missing or unparseable.
   */
  deltaDays: number | null;
}

export function computeTemporalScore(
  victimPublishedAt: Date | null | undefined,
  suspiciousPostDate: string | null | undefined
): TemporalScoreResult {
  if (!victimPublishedAt || !suspiciousPostDate) return { modifier: 0, deltaDays: null };

  let suspicious: Date;
  try {
    suspicious = new Date(suspiciousPostDate);
    if (isNaN(suspicious.getTime())) return { modifier: 0, deltaDays: null };
  } catch {
    return { modifier: 0, deltaDays: null };
  }

  const victimMs = victimPublishedAt.getTime();
  const suspiciousMs = suspicious.getTime();
  const deltaDays = Math.floor((suspiciousMs - victimMs) / (1000 * 60 * 60 * 24));

  if (deltaDays >= 2) return { modifier: 15, deltaDays };
  if (deltaDays === 1) return { modifier: 0, deltaDays };
  return { modifier: -10, deltaDays };
}

/**
 * Compute an account trust score (0–1) from observable quality signals.
 *
 * Lower score = less trustworthy = more suspicious as an impersonator.
 * Used to populate SignalData.accountTrustScore.
 *
 * @param followers     - Follower count of the suspicious account
 * @param following     - Following count (optional; ratio signals bot behaviour)
 * @param totalPosts    - Total post count (optional; very new accounts have few posts)
 * @param accountAgeDays - Account age in days (optional; new accounts are more suspicious)
 */
export function computeAccountTrustScore(
  followers: number,
  following?: number,
  totalPosts?: number,
  accountAgeDays?: number
): number {
  let score = 0.60; // neutral baseline for unknown-age accounts

  // Follower count signal — impersonators typically have few followers early on
  if (followers < 50)   score -= 0.30;
  else if (followers < 200)  score -= 0.20;
  else if (followers < 500)  score -= 0.15;
  else if (followers < 1000) score -= 0.08;
  else if (followers > 10000) score += 0.10; // established account is less likely to be a new impersonator

  // Following ratio — bots and new impersonators follow many to get follows back
  if (following !== undefined && followers > 0) {
    const ratio = following / Math.max(followers, 1);
    if (ratio > 5) score -= 0.15;    // following 5x more than followers
    else if (ratio > 2) score -= 0.08;
  }

  // Total posts — fresh impersonator accounts have very few posts
  if (totalPosts !== undefined) {
    if (totalPosts < 5)  score -= 0.15;
    else if (totalPosts < 15) score -= 0.08;
    else if (totalPosts > 100) score += 0.05; // active account
  }

  // Account age — very new accounts are suspicious
  if (accountAgeDays !== undefined) {
    if (accountAgeDays < 7)  score -= 0.25;
    else if (accountAgeDays < 30) score -= 0.15;
    else if (accountAgeDays < 90) score -= 0.05;
    else if (accountAgeDays > 365) score += 0.08; // established account
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Simulation mode: generates synthetic impersonator candidates when no
 * real platform API credentials are available.
 */
function simSuppressKey(platform: string, username: string): string {
  return `${platform.toLowerCase()}:${username.replace(/^@/, "").toLowerCase().trim()}`;
}

export function generateSimulatedCandidates(
  username: string,
  platforms: string[],
  suppressionSet?: Set<string>
): ImpersonatorCandidate[] {
  const candidates: ImpersonatorCandidate[] = [];
  const cleanUsername = username.replace(/^@/, "");

  const platformPool = ["instagram", "tiktok", "x", "facebook"].filter(
    (p) => !platforms.includes(p)
  );
  const platform0 = platformPool[0] ?? "instagram";
  const platform1 = platformPool[1] ?? "tiktok";

  // ── Candidate 1: Username variant (classic impersonator pattern) ───────────
  const variantSuffix = ".official";
  const variantSignals: SignalData = {
    mediaOverlapRatio: 0.91,
    captionOverlapRatio: 0.78,
    profileImageSimilarity: 0.86,
    bioSimilarity: 0.70,
    usernameSimilarity: 0.88,
    accountTrustScore: 0.18,   // very suspicious: new, low-follower account
    temporalReuseRatio: 0.82,  // most matched images post-date the victim
  };
  candidates.push({
    suspiciousUsername: `@${cleanUsername}${variantSuffix}`,
    platform: platform0,
    source: "username_search",
    simulated: true,
    signals: variantSignals,
    evidence: [
      {
        id: "sim_v_1",
        type: "profile_photo",
        similarity: 86,
        label: "Profile Photo Match",
      },
      {
        id: "sim_v_2",
        type: "post_photo",
        similarity: 89,
        label: "Post Photo Reuse",
        yourCaption: "Content from your verified account",
        stolenCaption: "Reposted without credit",
        postDatingDays: 14,
      },
      {
        id: "sim_v_3",
        type: "reel_thumbnail",
        similarity: 82,
        label: "Reel Thumbnail Stolen",
        postDatingDays: 9,
      },
    ],
    matchedMediaCount: 11,
    accountQuality: { followers: 312, following: 2100, totalPosts: 8, accountAgeDays: 22 },
    detectedSignals: [
      "11 public photos reused across posts",
      `Username pattern: added '${variantSuffix.replace(".", "")}' suffix`,
      `Bio similarity: ${Math.round(variantSignals.bioSimilarity * 100)}%`,
      "Fake giveaway language detected in bio",
      "Account created within the last 30 days",
      "7 captions duplicated verbatim",
      "Post-dating confirmed: 9 of 11 matched images posted after your original uploads",
    ],
  });

  // ── Candidate 2: Visual-only match — completely different username ──────────
  const randomHandles = [
    "lifestyle_collective_",
    "dailyvibes_hq",
    "glowup.central",
    "trending.moments_",
    "creator.spotlight24",
  ];
  const seedIndex = cleanUsername.charCodeAt(0) % randomHandles.length;
  const randomHandle = randomHandles[seedIndex] ?? "lifestyle_collective_";

  const visualSignals: SignalData = {
    mediaOverlapRatio: 0.82,
    captionOverlapRatio: 0.18,
    profileImageSimilarity: 0.91,
    bioSimilarity: 0.12,
    usernameSimilarity: 0.0,
    accountTrustScore: 0.22,   // suspicious: low followers, following many
    temporalReuseRatio: 0.75,  // majority of matched images post-date victim
  };
  candidates.push({
    suspiciousUsername: `@${randomHandle}`,
    platform: platform1,
    source: "image_search",
    simulated: true,
    signals: visualSignals,
    evidence: [
      {
        id: "sim_i_1",
        type: "profile_photo",
        similarity: 91,
        label: "Profile Photo — 91% pHash Match",
      },
      {
        id: "sim_i_2",
        type: "post_photo",
        similarity: 85,
        label: "8 Photos Reused (Image Search)",
        postDatingDays: 21,
      },
    ],
    matchedMediaCount: 8,
    accountQuality: { followers: 148, following: 3400, totalPosts: 12, accountAgeDays: 11 },
    detectedSignals: [
      "Detected via reverse image search — username has NO similarity",
      "Profile photo pHash match: 91% identical (Hamming distance: 6/64)",
      "8 of your photos found on this account's grid",
      "Account bio is unrelated — no name overlap",
      "Monetizing your content via third-party link in bio",
      "Recently created account with rapid follower growth",
      "Post-dating confirmed: content posted 21 days after your original uploads",
    ],
  });

  if (!suppressionSet) return candidates;
  return candidates.filter(
    (c) => !suppressionSet.has(simSuppressKey(c.platform, c.suspiciousUsername))
  );
}

export function buildThreatFromCandidate(
  candidate: ImpersonatorCandidate,
  isFirstScan = false
): Omit<ScoredThreat, "candidate"> & { candidate: ImpersonatorCandidate } {
  const breakdown = calculateThreatScore(candidate.signals, isFirstScan);
  const severity = classifyThreatSeverity(
    breakdown,
    candidate.signals.profileImageSimilarity,
    candidate.matchedMediaCount
  );

  const isStolen =
    candidate.source === "image_search" || candidate.source === "media_similarity";

  const photoSim = Math.round(candidate.signals.profileImageSimilarity * 100);
  const mediaOverlap = Math.round(candidate.signals.mediaOverlapRatio * 100);

  const type = isStolen ? "stolen_photo" : "impersonator";
  const title =
    severity === "high"
      ? isStolen
        ? `Photo Theft Detected — ${photoSim}% Match`
        : `High-Risk Impersonator — ${photoSim}% Profile Match`
      : severity === "medium"
        ? `Suspicious Account Found — ${mediaOverlap}% Media Overlap`
        : `Low-Risk Username Variant Found`;

  const description =
    severity === "high"
      ? `Account ${candidate.suspiciousUsername} on ${candidate.platform} is stealing your photos and impersonating your identity. Immediate action recommended.`
      : severity === "medium"
        ? `Account ${candidate.suspiciousUsername} on ${candidate.platform} shows suspicious overlap with your content. Review recommended.`
        : `Account ${candidate.suspiciousUsername} on ${candidate.platform} uses a variant of your handle. Low risk — monitor for escalation.`;

  const matchedLabel =
    candidate.matchedMediaCount > 0
      ? `, ${candidate.matchedMediaCount} matched media items`
      : "";

  const temporalLabel =
    candidate.signals.temporalReuseRatio > 0.5
      ? ` Post-dating confirmed on majority of matches.`
      : "";

  const details = `${Math.round(candidate.signals.profileImageSimilarity * 100)}% profile photo similarity${matchedLabel}. Platform: ${candidate.platform}. Trust score: ${Math.round(candidate.signals.accountTrustScore * 100)}%.${temporalLabel}`;

  return { candidate, breakdown, severity, type, title, description, details };
}
