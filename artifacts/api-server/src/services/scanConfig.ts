/**
 * Centralized scan configuration for Rook detection engine.
 *
 * All scoring thresholds, weights, and classification rules live here.
 * Adjust these values to tune detection sensitivity — do not hardcode them
 * in service logic.
 *
 * Weight invariant: weights.profilePhoto + weights.mediaOverlap +
 *   weights.contentReuse + weights.bioSimilarity +
 *   weights.usernameSimilarity + weights.accountTrust + weights.temporalReuse === 100
 *
 * Phase 11 precision hardening:
 *   Impersonator detection now requires NEAR-CERTAIN visual evidence for High severity.
 *   - Profile photo gate raised: 80% → 90% (pHash near-exact match)
 *   - Option B combined score raised: 70 → 75
 *   - Dual-score gates raised: 50 → 58 each
 *   - First-scan profile floor raised: 40% → 50%
 *   - New: relationship context system prevents mentions/collabs/credits from
 *     being scored as impersonators. Medium also now requires profile photo ≥ 30%.
 *
 * Phase 10 rebalance: photo evidence is the primary signal; username alone cannot
 *   drive a High-severity finding — only actual visual matches can.
 * Phase 9 High severity gate: clean OR-condition requiring actual stolen media evidence.
 */

export const SCAN_CONFIG = {
  // ── Score weight allocation (must sum to 100) ──────────────────────────────
  weights: {
    profilePhoto: 20,        // unchanged — strong single-photo identity anchor
    mediaOverlap: 40,        // primary signal — stolen photos under ANY username
    contentReuse: 15,        // unchanged — verbatim caption reuse
    bioSimilarity: 5,        // unchanged — bio is easily spoofed; low weight
    usernameSimilarity: 5,   // username alone cannot gate High findings
    accountTrust: 10,        // unchanged — low-trust account = more suspicious
    temporalReuse: 5,        // unchanged — fraction of matched images where suspect posted after victim
  },

  // ── Identity Match sub-score (how closely does the account resemble the target?)
  // Components: profilePhoto + bioSimilarity + usernameSimilarity
  // Max raw points: 20 + 5 + 5 = 30 → scaled to 0-100
  identityMatchComponents: ["profilePhoto", "bioSimilarity", "usernameSimilarity"] as const,
  identityMatchMaxRaw: 30,

  // ── Impersonation Confidence sub-score (how clearly is it intentional?)
  // Components: mediaOverlap + contentReuse + accountTrust + temporalReuse
  // Max raw points: 40 + 15 + 10 + 5 = 70 → scaled to 0-100
  impersonationComponents: ["mediaOverlap", "contentReuse", "accountTrust", "temporalReuse"] as const,
  impersonationMaxRaw: 70,

  // ── Profile photo classification caps ─────────────────────────────────────
  // A weak profile photo match overrides the combined score ceiling.
  // Rationale: username/bio cloning without stolen photos is not High Risk.
  profilePhoto: {
    minForHighRisk: 0.38,          // ≥38% → eligible for High (was 0.50 — stacked too tightly with option gates)
    mediumCapThreshold: 0.22,      // [22%, 38%) → max Medium (was 0.30)
    lowCapThreshold: 0.12,         // <12% → cap at Low (was 0.20)
  },

  // ── High severity evidence gates ──────────────────────────────────────────
  // High severity requires meeting at LEAST ONE of two evidence gates.
  // Neither gate can be satisfied by username similarity alone.
  //
  //   Option A: strong visual ID (profile photo ≥ 72% pHash) + ≥1 stolen post
  //   Option B: multiple stolen posts (≥ 3) + combined score confirms clear intent
  //
  // If neither gate is met, maximum severity is Medium regardless of combined score.
  // This prevents username-variant-only or weak-photo candidates from reaching High.
  highSeverityGate: {
    optionA: {
      minProfileSimilarity: 0.72, // strong pHash match required (was 0.82 — too tight; 72% is still a clear visual match)
      minMatchedMedia: 2,         // profile + ≥1 additional stolen post photo
    },
    optionB: {
      minMatchedMedia: 3,         // at least 3 confirmed stolen media items
      minCombinedScore: 65,       // strong combined evidence required (was 72)
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
  // The option gates above are checked first; this is an additional safeguard.
  dualScoreGate: {
    minIdentityMatchForHigh: 42,          // relaxed gate (was 52 — stacking 3 gates simultaneously was too tight)
    minImpersonationConfForHigh: 42,      // relaxed gate (was 52)
  },

  // ── Combined score severity thresholds ────────────────────────────────────
  severity: {
    highMin: 70,
    mediumMin: 38,  // was 45 — lower floor so more confirmed impersonators reach Medium
  },

  // ── Relationship context severity caps ─────────────────────────────────────
  // Accounts that appear in a MENTION, COLLABORATION, or CREDIT context are NOT
  // impersonators. These caps prevent false-positive High/Medium ratings when
  // someone is simply tagging, crediting, or collaborating with the victim.
  //
  //   credit        → disqualify entirely (photo credit = not stolen)
  //   mention       → cap at Low severity (tagged in a post ≠ impersonation)
  //   collaboration → cap at Low severity (collab/duet/feat ≠ identity theft)
  //   fan           → filtered pre-candidate; cap at Low if it reaches scoring
  relationshipContext: {
    credit: "disqualify" as const,        // remove from candidate pool entirely
    mention: "low" as const,              // cap severity at Low
    collaboration: "low" as const,        // cap severity at Low
    fan: "low" as const,                  // cap severity at Low
  },

  // ── Platform scan priority (lower = scan first) ───────────────────────────
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
  // Instagram and Facebook impersonators cause disproportionate real-world harm.
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
  // On the first scan, apply a stricter gate to avoid false positives.
  // Score is zeroed when both conditions apply.
  firstScan: {
    minProfileImageSimilarity: 0.28,   // floor on first scan (was 0.42 — was zeroing real impersonators)
    minMediaSimilarityPoints: 14,      // raw media pts floor (was 22 — too aggressive)
  },

  // ── Temporal score modifiers ───────────────────────────────────────────────
  // Added to the threat score based on whether the suspicious account posted
  // AFTER the victim's original upload date.
  //   postDating  (≥2 days after victim) → strong confirmation signal
  //   jitter      (exactly 1 day after)  → within clock/timezone tolerance; neutral
  //   preDating   (same day or before)   → contra-indicator
  temporalScore: {
    postDatingModifier: 15,    // suspicious posted ≥2 days after victim
    jitterModifier: 0,         // within 1-day clock jitter — neutral
    preDatingModifier: -10,    // suspicious predates victim — reduces score
    jitterDays: 1,             // days within which we treat as "same day" jitter
  },

  // ── Platform API variant discovery limit ───────────────────────────────────
  // Number of top-ranked username mutations to search via platform API per account.
  // Each variant = one API call; all fire in parallel so this has low latency impact.
  platformApiVariantLimit: 10,

  // ── Web search input limits ────────────────────────────────────────────────
  // Controls how many photos/captions are prepared for web/Vision search.
  // These are pre-tier caps; tier-based limits in webSearchService further reduce them.
  webSearch: {
    maxPostPhotoUrls: 8,        // post photos fed into Vision reverse image search
    maxTotalPhotoUrls: 10,      // total photo URLs (profile + post + indexed) per search call
    maxCaptions: 5,             // verbatim captions fed into CSE caption search
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
