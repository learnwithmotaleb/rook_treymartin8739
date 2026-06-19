/**
 * Impersonator Detection Service
 *
 * Implements a two-dimensional threat scoring model:
 *
 *   Identity Match Score (0-100) — how closely the account resembles the target
 *     = profilePhoto(25) + bioSimilarity(10) + usernameSimilarity(10) → scaled to 0-100
 *
 *   Impersonation Confidence Score (0-100) — how clearly the act is intentional
 *     = mediaOverlap(35) + contentReuse(15) + behavioral(5) → scaled to 0-100
 *
 *   Combined Threat Score (0-100)
 *     = profilePhoto(25) + mediaOverlap(35) + contentReuse(15)
 *       + bioSimilarity(10) + usernameSimilarity(10) + behavioral(5)
 *
 * High severity requires: combined ≥70 AND profile photo ≥50% AND
 *   matched media ≥2 AND both sub-scores ≥50/100.
 *
 * In production, this service receives real signal data from:
 * - Image embedding cosine similarity (via CLIP or similar)
 * - Caption/text overlap analysis
 * - Platform API search results
 * - Behavioral anomaly detection
 *
 * All thresholds and weights are in scanConfig.ts — do not hardcode here.
 */

import { SCAN_CONFIG } from "./scanConfig";

export interface SignalData {
  mediaOverlapRatio: number;
  captionOverlapRatio: number;
  profileImageSimilarity: number;
  bioSimilarity: number;
  usernameSimilarity: number;
  behaviorScore: number;
}

export interface ThreatScoreBreakdown {
  mediaSimilarity: number;
  contentReuse: number;
  profileSimilarity: number;
  bioSimilarity: number;
  usernameSimilarity: number;
  behavioral: number;
  total: number;
  /**
   * Identity Match Score (0-100): how closely the account resembles the target.
   * Computed from profileSimilarity + bioSimilarity + usernameSimilarity,
   * scaled to 0-100. Low = different identity; High = near-identical identity.
   */
  identityMatchScore: number;
  /**
   * Impersonation Confidence Score (0-100): how clearly the act is intentional.
   * Computed from mediaOverlap + contentReuse + behavioral, scaled to 0-100.
   * Low = coincidental; High = deliberate content theft.
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
  const behavioral = Math.round(
    Math.min(signals.behaviorScore, 1.0) * weights.behavioral
  );
  const total =
    mediaSimilarity +
    contentReuse +
    profileSimilarity +
    bioSimilarity +
    usernameSimilarity +
    behavioral;

  // ── Dual sub-scores ────────────────────────────────────────────────────────
  // Identity Match: how closely the account resembles the target identity.
  // Components: profileSimilarity + bioSimilarity + usernameSimilarity → /45 → 0-100
  const rawIdentity = profileSimilarity + bioSimilarity + usernameSimilarity;
  const identityMatchScore = Math.round(
    (rawIdentity / SCAN_CONFIG.identityMatchMaxRaw) * 100
  );

  // Impersonation Confidence: how clearly the act is intentional.
  // Components: mediaOverlap + contentReuse + behavioral → /55 → 0-100
  const rawImpersonation = mediaSimilarity + contentReuse + behavioral;
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
      behavioral,
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
    behavioral,
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
 * Applies three gates on top of the raw combined score:
 *   1. Profile photo cap — weak photo similarity bounds the max severity
 *   2. Multi-image validation — High requires profile + ≥1 additional image
 *   3. Dual score gate — both Identity Match AND Impersonation Confidence
 *      must clear their thresholds for High
 *
 * These gates only constrain downward (they never promote a lower tier).
 * Actor corpus matches and escalations can still override this result in the
 * scan pipeline (trusted collective intelligence bypasses photo caps).
 */
export function classifyThreatSeverity(
  breakdown: ThreatScoreBreakdown,
  profileImageSimilarity: number,
  matchedMediaCount: number
): "high" | "medium" | "low" {
  const { profilePhoto, multiImageGate, dualScoreGate } = SCAN_CONFIG;

  // Gate 0: absolute profile photo floor — very weak match → Low regardless
  if (profileImageSimilarity < profilePhoto.lowCapThreshold) {
    return "low";
  }

  // Start from the combined score tier
  let severity = scoreThreatSeverity(breakdown.total);

  // Gate 1: profile photo medium cap — below threshold, max is Medium
  if (profileImageSimilarity < profilePhoto.mediumCapThreshold) {
    if (severity === "high") severity = "medium";
    return severity;
  }

  // Gates 2 & 3 only constrain High — Medium and Low pass through
  if (severity === "high") {
    // Gate 2: multi-image validation — profile-only match is not High
    if (matchedMediaCount < multiImageGate.minMatchedMediaForHigh) {
      return "medium";
    }
    // Gate 3: dual score gate — both dimensions must be strong enough
    if (
      breakdown.identityMatchScore < dualScoreGate.minIdentityMatchForHigh ||
      breakdown.impersonationConfidenceScore < dualScoreGate.minImpersonationConfForHigh
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
 *    0   — same-day or within 1 day (neutral; could be live-streaming both accounts)
 *   -10  — suspicious post predates the victim's upload (strong contra-indicator)
 *    0   — either date is missing (graceful skip — no penalty for lack of data)
 *
 * Uses "days" precision to avoid false precision from timezone differences.
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
  const deltaDays = Math.round((suspiciousMs - victimMs) / (1000 * 60 * 60 * 24));

  if (deltaDays >= 2) {
    // Suspicious account posted this after the victim — classic impersonation signal
    return { modifier: 15, deltaDays };
  }
  if (deltaDays <= -1) {
    // Suspicious account posted BEFORE the victim — strong contra-indicator
    return { modifier: -10, deltaDays };
  }
  // Same-day (deltaDays 0 or 1) — neutral, within margin of timezone/clock error
  return { modifier: 0, deltaDays };
}

/**
 * Simulation mode: generates synthetic impersonator candidates when no
 * real platform API credentials are available.
 *
 * Produces TWO distinct candidate types to accurately reflect real-world
 * detection patterns:
 *
 * 1. USERNAME VARIANT — an account with a slight username modification
 *    (e.g. @user.official). Discovered via username_search.
 *
 * 2. VISUAL MATCH — an account with a COMPLETELY DIFFERENT username that
 *    was found via image search or pHash comparison. This is the most
 *    important case the user highlighted: real impersonators often pick
 *    random handles and rely entirely on stolen photos, not name similarity.
 *
 * Replace with real platform adapter + web search calls when credentials
 * are available.
 */
/** Normalize a suspicious username for suppression key lookup: strip @, lowercase, trim. */
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
    behaviorScore: 0.74,
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
      },
      {
        id: "sim_v_3",
        type: "reel_thumbnail",
        similarity: 82,
        label: "Reel Thumbnail Stolen",
      },
    ],
    matchedMediaCount: 11,
    detectedSignals: [
      "11 public photos reused across posts",
      `Username pattern: added '${variantSuffix.replace(".", "")}' suffix`,
      `Bio similarity: ${Math.round(variantSignals.bioSimilarity * 100)}%`,
      "Fake giveaway language detected in bio",
      "Account created within the last 30 days",
      "7 captions duplicated verbatim",
    ],
  });

  // ── Candidate 2: Visual-only match — completely different username ──────────
  // This simulates what the image_search / pHash strategy catches:
  // an account that stole photos but chose a totally unrelated handle.
  const randomHandles = [
    "lifestyle_collective_",
    "dailyvibes_hq",
    "glowup.central",
    "trending.moments_",
    "creator.spotlight24",
  ];
  // Seed deterministically from username so it's stable across rescans
  const seedIndex = cleanUsername.charCodeAt(0) % randomHandles.length;
  const randomHandle = randomHandles[seedIndex] ?? "lifestyle_collective_";

  const visualSignals: SignalData = {
    mediaOverlapRatio: 0.82,
    captionOverlapRatio: 0.18,
    profileImageSimilarity: 0.91,
    bioSimilarity: 0.12,
    usernameSimilarity: 0.0,  // completely different — that's the point
    behaviorScore: 0.68,
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
      },
    ],
    matchedMediaCount: 8,
    detectedSignals: [
      "Detected via reverse image search — username has NO similarity",
      "Profile photo pHash match: 91% identical (Hamming distance: 6/64)",
      "8 of your photos found on this account's grid",
      "Account bio is unrelated — no name overlap",
      "Monetizing your content via third-party link in bio",
      "Recently created account with rapid follower growth",
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
  // Use full classifyThreatSeverity (not raw scoreThreatSeverity) to apply
  // profile photo caps, multi-image gate, and dual score gate.
  const severity = classifyThreatSeverity(
    breakdown,
    candidate.signals.profileImageSimilarity,
    candidate.matchedMediaCount
  );

  const isStolen = candidate.source === "media_similarity" || candidate.source === "image_search";
  const type = isStolen ? "stolen_photo" : "impersonator";

  const title = isStolen
    ? `Stolen Photos Detected on ${capitalize(candidate.platform)}`
    : `Impersonator on ${capitalize(candidate.platform)}`;

  const description = isStolen
    ? `${candidate.suspiciousUsername} is using ${candidate.matchedMediaCount} of your photos on ${capitalize(candidate.platform)}`
    : `${candidate.suspiciousUsername} is impersonating you on ${capitalize(candidate.platform)}`;

  const details = isStolen
    ? candidate.source === "image_search"
      ? `A ${capitalize(candidate.platform)} account (${candidate.suspiciousUsername}) was discovered via reverse image search — their username has NO similarity to yours, but ${candidate.matchedMediaCount} of your photos were found on their profile. This is the hardest class of impersonator to detect without visual scanning.`
      : `A ${capitalize(candidate.platform)} account was found using ${candidate.matchedMediaCount} of your publicly posted photos. This account appears to be operating a fake creator page using your content.`
    : candidate.source === "caption_search"
      ? `A ${capitalize(candidate.platform)} account (${candidate.suspiciousUsername}) was found reusing your caption text verbatim. Their username may not resemble yours, but the duplicated text content is a strong signal of content theft.`
      : `An account was found on ${capitalize(candidate.platform)} using a similar username and your profile media. They have been flagged by ShieldID's visual fingerprint system.`;

  return {
    candidate,
    breakdown,
    severity,
    type,
    title,
    description,
    details,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
