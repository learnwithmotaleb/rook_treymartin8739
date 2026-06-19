/**
 * Centralized scan configuration for ShieldID detection engine.
 *
 * All scoring thresholds, weights, and classification rules live here.
 * Adjust these values to tune detection sensitivity — do not hardcode them
 * in service logic.
 *
 * Weight invariant: weights.profilePhoto + weights.mediaOverlap +
 *   weights.contentReuse + weights.bioSimilarity +
 *   weights.usernameSimilarity + weights.behavioral === 100
 */

export const SCAN_CONFIG = {
  // ── Score weight allocation (must sum to 100) ──────────────────────────────
  // Profile photo is the strongest signal — substantially increased from prior
  // 15-point allocation. Media overlap reduced proportionally.
  weights: {
    profilePhoto: 25,        // ↑ was 15 — strongest single signal
    mediaOverlap: 35,        // ↓ was 40
    contentReuse: 15,        // ↓ was 20
    bioSimilarity: 10,
    usernameSimilarity: 10,
    behavioral: 5,
  },

  // ── Identity Match sub-score (how closely does the account resemble the target?)
  // Components: profilePhoto + bioSimilarity + usernameSimilarity
  // Max raw points: 25 + 10 + 10 = 45 → scaled to 0-100
  identityMatchComponents: ["profilePhoto", "bioSimilarity", "usernameSimilarity"] as const,
  identityMatchMaxRaw: 45,

  // ── Impersonation Confidence sub-score (how clearly is it intentional?)
  // Components: mediaOverlap + contentReuse + behavioral
  // Max raw points: 35 + 15 + 5 = 55 → scaled to 0-100
  impersonationComponents: ["mediaOverlap", "contentReuse", "behavioral"] as const,
  impersonationMaxRaw: 55,

  // ── Profile photo classification caps ─────────────────────────────────────
  // A weak profile photo match overrides the combined score ceiling.
  // Rationale: username/bio cloning without stolen photos is not High Risk.
  profilePhoto: {
    minForHighRisk: 0.50,          // ≥50% → eligible for High
    mediumCapThreshold: 0.35,      // [35%, 50%) → max Medium regardless of other signals
    lowCapThreshold: 0.20,         // <20% → cap at Low
  },

  // ── Multi-image validation gate (required for High severity) ───────────────
  // High severity requires the profile photo match PLUS at least one additional
  // matching image. A single photo match alone can be coincidental.
  multiImageGate: {
    minMatchedMediaForHigh: 2,     // profile + ≥1 additional
  },

  // ── Dual score gate for High severity ─────────────────────────────────────
  // Both the identity match AND impersonation confidence must clear their
  // thresholds before a candidate can reach High. This prevents username-only
  // or media-only accounts from falsely triggering High severity.
  dualScoreGate: {
    minIdentityMatchForHigh: 50,          // out of 100
    minImpersonationConfForHigh: 50,      // out of 100
  },

  // ── Combined score severity thresholds ────────────────────────────────────
  severity: {
    highMin: 70,
    mediumMin: 45,
  },

  // ── Platform scan priority (lower = scan first) ───────────────────────────
  // High-risk platforms scanned first so urgent threats surface faster.
  platformPriority: {
    instagram: 1,
    facebook: 2,
    x: 3,
    tiktok: 4,
    youtube: 5,
    linkedin: 6,
    snapchat: 7,
  } as Record<string, number>,

  // ── Platform score weight multipliers ─────────────────────────────────────
  // Instagram and Facebook impersonators cause disproportionate real-world
  // harm (larger user bases, financial scams). Small boost to threat score.
  platformWeightMultiplier: {
    instagram: 1.05,
    facebook: 1.04,
    x: 1.02,
    tiktok: 1.00,
    youtube: 1.00,
    linkedin: 1.01,
    snapchat: 1.00,
  } as Record<string, number>,

  // ── First-scan precision gate ──────────────────────────────────────────────
  // On the first scan, apply a stricter gate to avoid false positives from
  // incomplete profile data. Score is zeroed when both conditions apply.
  firstScan: {
    minProfileImageSimilarity: 0.40,   // profile photo similarity floor
    minMediaSimilarityPoints: 22,      // raw media pts floor (out of 35 max)
  },
} as const;

/** Return the platform scan priority (lower = higher priority). Unknowns get 99. */
export function getPlatformPriority(platform: string): number {
  return (SCAN_CONFIG.platformPriority as Record<string, number>)[platform.toLowerCase()] ?? 99;
}

/** Return the platform weight multiplier for score boosting. Defaults to 1.0. */
export function getPlatformWeightMultiplier(platform: string): number {
  return (SCAN_CONFIG.platformWeightMultiplier as Record<string, number>)[platform.toLowerCase()] ?? 1.0;
}
