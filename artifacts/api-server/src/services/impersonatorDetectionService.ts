/**
 * Impersonator Detection Service
 *
 * Implements the threat scoring formula from the ShieldID product spec:
 *   threatScore = mediaSimilarity(40) + contentReuse(20) + profileSimilarity(15)
 *               + bioSimilarity(10) + usernameSimilarity(10) + behavioral(5)
 *
 * In production, this service receives real signal data from:
 * - Image embedding cosine similarity (via CLIP or similar)
 * - Caption/text overlap analysis
 * - Platform API search results
 * - Behavioral anomaly detection
 *
 * In demo/simulation mode (no OAuth tokens), it generates realistic
 * synthetic threats seeded by username and platform combinations.
 */

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
  signals: SignalData
): ThreatScoreBreakdown {
  const mediaSimilarity = Math.round(
    Math.min(signals.mediaOverlapRatio, 1.0) * 40
  );
  const contentReuse = Math.round(
    Math.min(signals.captionOverlapRatio, 1.0) * 20
  );
  const profileSimilarity = Math.round(
    Math.min(signals.profileImageSimilarity, 1.0) * 15
  );
  const bioSimilarity = Math.round(
    Math.min(signals.bioSimilarity, 1.0) * 10
  );
  const usernameSimilarity = Math.round(
    Math.min(signals.usernameSimilarity, 1.0) * 10
  );
  const behavioral = Math.round(Math.min(signals.behaviorScore, 1.0) * 5);
  const total =
    mediaSimilarity +
    contentReuse +
    profileSimilarity +
    bioSimilarity +
    usernameSimilarity +
    behavioral;

  return {
    mediaSimilarity,
    contentReuse,
    profileSimilarity,
    bioSimilarity,
    usernameSimilarity,
    behavioral,
    total,
  };
}

export function scoreThreatSeverity(
  total: number
): "high" | "medium" | "low" {
  if (total >= 70) return "high";
  if (total >= 45) return "medium";
  return "low";
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
export function generateSimulatedCandidates(
  username: string,
  platforms: string[]
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

  return candidates;
}

export function buildThreatFromCandidate(
  candidate: ImpersonatorCandidate
): Omit<ScoredThreat, "candidate"> & { candidate: ImpersonatorCandidate } {
  const breakdown = calculateThreatScore(candidate.signals);
  const severity = scoreThreatSeverity(breakdown.total);

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
