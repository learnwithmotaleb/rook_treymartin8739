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
}

export interface ImpersonatorCandidate {
  suspiciousUsername: string;
  platform: string;
  source:
    | "username_search"
    | "media_similarity"
    | "api_discovery"
    | "graph_match";
  signals: SignalData;
  evidence: DetectedEvidence[];
  detectedSignals: string[];
  matchedMediaCount: number;
}

export interface ScoredThreat {
  candidate: ImpersonatorCandidate;
  breakdown: ThreatScoreBreakdown;
  severity: "high" | "medium" | "low";
  type:
    | "impersonator"
    | "fake_account"
    | "stolen_photo"
    | "scam"
    | "dark_web";
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
 * real platform API credentials are available. Returns realistic scenarios
 * based on common impersonation patterns.
 *
 * Replace this with real platform adapter calls when credentials are ready.
 */
export function generateSimulatedCandidates(
  username: string,
  platforms: string[]
): ImpersonatorCandidate[] {
  const candidates: ImpersonatorCandidate[] = [];
  const cleanUsername = username.replace("@", "");

  const impersonationPatterns = [
    { suffix: ".official", mediaRatio: 0.95, captionRatio: 0.82 },
    { suffix: "_real", mediaRatio: 0.87, captionRatio: 0.45 },
    { suffix: ".creator", mediaRatio: 0.92, captionRatio: 0.65 },
    { suffix: "0fficial", mediaRatio: 0.78, captionRatio: 0.38 },
    { suffix: "_backup", mediaRatio: 0.71, captionRatio: 0.29 },
  ];

  const platformPool = ["instagram", "tiktok", "x", "facebook"].filter(
    (p) => !platforms.includes(p)
  );

  impersonationPatterns.slice(0, 2).forEach((pattern, i) => {
    const targetPlatform =
      platformPool[i % platformPool.length] ?? "instagram";
    const suspiciousUsername = `@${cleanUsername}${pattern.suffix}`;

    const signals: SignalData = {
      mediaOverlapRatio: pattern.mediaRatio,
      captionOverlapRatio: pattern.captionRatio,
      profileImageSimilarity: 0.88 - i * 0.08,
      bioSimilarity: 0.72 - i * 0.12,
      usernameSimilarity: 0.85 - i * 0.1,
      behaviorScore: 0.75 - i * 0.05,
    };

    const mediaCount = Math.round(8 + i * 4);

    const evidence: DetectedEvidence[] = [
      {
        id: `ev_${i}_1`,
        type: "profile_photo",
        similarity: Math.round(signals.profileImageSimilarity * 100),
        label: "Profile Photo Match",
      },
      {
        id: `ev_${i}_2`,
        type: "post_photo",
        similarity: Math.round(signals.mediaOverlapRatio * 100 - 5),
        label: "Post Photo Reuse",
        yourCaption: "Content from my verified account",
        stolenCaption: "Reposted without permission",
      },
      ...(i === 0
        ? [
            {
              id: `ev_${i}_3`,
              type: "reel_thumbnail" as const,
              similarity: Math.round(signals.mediaOverlapRatio * 100 - 12),
              label: "Reel Thumbnail Stolen",
            },
          ]
        : []),
    ];

    candidates.push({
      suspiciousUsername,
      platform: targetPlatform,
      source: i === 0 ? "media_similarity" : "username_search",
      signals,
      evidence,
      matchedMediaCount: mediaCount,
      detectedSignals: [
        `${mediaCount} public photos reused`,
        `Username pattern: added '${pattern.suffix.replace(".", "")}'`,
        `Bio similarity: ${Math.round(signals.bioSimilarity * 100)}%`,
        "Fake giveaway language detected",
        "Recently created account",
        pattern.captionRatio > 0.5
          ? `${Math.round(pattern.captionRatio * 10)} captions duplicated`
          : "Partial caption reuse detected",
      ],
    });
  });

  return candidates;
}

export function buildThreatFromCandidate(
  candidate: ImpersonatorCandidate
): Omit<ScoredThreat, "candidate"> & { candidate: ImpersonatorCandidate } {
  const breakdown = calculateThreatScore(candidate.signals);
  const severity = scoreThreatSeverity(breakdown.total);

  const isStolen = candidate.source === "media_similarity";
  const type = isStolen ? "stolen_photo" : "impersonator";

  const title = isStolen
    ? `Stolen Photos Detected on ${capitalize(candidate.platform)}`
    : `Impersonator on ${capitalize(candidate.platform)}`;

  const description = isStolen
    ? `${candidate.suspiciousUsername} is using ${candidate.matchedMediaCount} of your photos on ${capitalize(candidate.platform)}`
    : `${candidate.suspiciousUsername} is impersonating you on ${capitalize(candidate.platform)}`;

  const details = isStolen
    ? `A ${capitalize(candidate.platform)} account was found using ${candidate.matchedMediaCount} of your publicly posted photos. This account appears to be operating a fake creator page using your content.`
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
