/**
 * Centralized scan configuration for ShieldID detection engine.
 *
 * All scoring thresholds, weights, and classification rules live here.
 * Adjust these values to tune detection sensitivity — do not hardcode them
 * in service logic.
 *
 * Weight invariant: weights.profilePhoto + weights.mediaOverlap +
 *   weights.contentReuse + weights.bioSimilarity +
 *   weights.usernameSimilarity + weights.accountTrust + weights.temporalReuse === 100
 *
 * Phase 8 rebalance: media evidence is now the primary signal.
 *   profilePhoto: 25 → 20  (reduced; a single photo match is not sufficient alone)
 *   bioSimilarity: 10 → 5  (reduced; bio text is easily spoofed)
 *   accountTrust: 5 → 10   (increased; low-trust accounts are a key impersonation signal)
 *   temporalReuse: 0 → 5   (new; rewards post-dating evidence across matched images)
 *
 * Phase 9 High severity gate: replaces scattered individual gates with a clean
 *   OR-condition that requires actual stolen media evidence for High.
 */

export const SCAN_CONFIG = {
  // ── Score weight allocation (must sum to 100) ──────────────────────────────
  weights: {
    profilePhoto: 20,        // ↓ was 25 — one photo match alone is insufficient
    mediaOverlap: 35,        // unchanged — stolen media is the strongest evidence
    contentReuse: 15,        // unchanged — verbatim caption reuse
    bioSimilarity: 5,        // ↓ was 10 — bio is easily spoofed; less weight
    usernameSimilarity: 10,  // unchanged
    accountTrust: 10,        // ↑ was behavioral:5 — renamed; low-trust = more suspicious
    temporalReuse: 5,        // NEW — fraction of matched images where suspect posted after victim
  },

  // ── Identity Match sub-score (how closely does the account resemble the target?)
  // Components: profilePhoto + bioSimilarity + usernameSimilarity
  // Max raw points: 20 + 5 + 10 = 35 → scaled to 0-100
  identityMatchComponents: ["profilePhoto", "bioSimilarity", "usernameSimilarity"] as const,
  identityMatchMaxRaw: 35,

  // ── Impersonation Confidence sub-score (how clearly is it intentional?)
  // Components: mediaOverlap + contentReuse + accountTrust + temporalReuse
  // Max raw points: 35 + 15 + 10 + 5 = 65 → scaled to 0-100
  impersonationComponents: ["mediaOverlap", "contentReuse", "accountTrust", "temporalReuse"] as const,
  impersonationMaxRaw: 65,

  // ── Profile photo classification caps ─────────────────────────────────────
  // A weak profile photo match overrides the combined score ceiling.
  // Rationale: username/bio cloning without stolen photos is not High Risk.
  profilePhoto: {
    minForHighRisk: 0.50,          // ≥50% → eligible for High (Phase 9 gates override this)
    mediumCapThreshold: 0.35,      // [35%, 50%) → max Medium regardless of other signals
    lowCapThreshold: 0.20,         // <20% → cap at Low
  },

  // ── Phase 9: Strict false positive protection ──────────────────────────────
  // High severity requires meeting at LEAST ONE of two evidence gates.
  // Neither gate can be satisfied by username similarity alone.
  //
  //   Option A: strong visual ID (profile photo ≥ 80%) + at least 1 stolen post
  //   Option B: multiple stolen posts (≥ 3) + combined score confirms intent
  //
  // If neither gate is met, maximum severity is Medium regardless of combined score.
  highSeverityGate: {
    optionA: {
      minProfileSimilarity: 0.80, // profile photo must be ≥ 80% similar
      minMatchedMedia: 2,         // plus at least 2 matched media items (profile + ≥1 post)
    },
    optionB: {
      minMatchedMedia: 3,         // at least 3 matched media items (strong media evidence)
      minCombinedScore: 70,       // AND combined score ≥ 70
    },
  },

  // ── Multi-image validation gate (required for High severity) ───────────────
  // Kept for compatibility with existing code paths; Phase 9 option gates
  // supersede this for High but it still prevents profile-only Medium inflation.
  multiImageGate: {
    minMatchedMediaForHigh: 2,     // profile + ≥1 additional
  },

  // ── Dual score gate for High severity ─────────────────────────────────────
  // Both Identity Match AND Impersonation Confidence must clear thresholds.
  // Phase 9 gates are checked first; this is an additional safeguard.
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
  // Phase 7: Instagram first, then X, Facebook, TikTok, then others.
  platformPriority: {
    instagram: 1,
    x: 2,
    facebook: 3,
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
