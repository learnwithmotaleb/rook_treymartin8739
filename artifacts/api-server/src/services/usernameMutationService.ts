/**
 * Username Mutation Engine — Phase 1 of scan engine improvements.
 *
 * Generates ranked username variants for impersonator discovery.
 * Covers the full spectrum of real-world impersonation patterns:
 *   - Suffix mutations (.official, _real, _backup, etc.)
 *   - Prefix mutations (real, official, the, its, team, support)
 *   - Character substitutions (o→0, i→1, e→3, a→4, s→5)
 *   - Separator variants (dots, underscores, no separator)
 *   - Number appends (1, 2, 01, 123)
 *   - Handle normalization (de-duplicate chars, strip separators)
 *
 * Each variant has a probability score (0–1) representing how commonly
 * that pattern appears in real-world impersonation cases.
 * Variants are returned sorted by probability so discovery functions
 * search the highest-likelihood accounts first.
 */

export interface UsernameMutation {
  /** The generated variant (lowercase, no @). */
  variant: string;
  /** Probability this is a real impersonator pattern (0–1). Higher = search first. */
  probability: number;
  /** Human-readable category of mutation. */
  patternType: "suffix" | "prefix" | "substitution" | "separator" | "number" | "normalization";
}

// ── Suffix mutations (ordered by real-world impersonation frequency) ───────────

const SUFFIX_MUTATIONS: Array<{ suffix: string; probability: number }> = [
  // Very high probability — the patterns most commonly used by scammers
  { suffix: ".official",  probability: 0.92 },
  { suffix: "_official",  probability: 0.90 },
  { suffix: "official",   probability: 0.87 },  // @userofficial (no separator)
  { suffix: "_real",      probability: 0.84 },
  { suffix: ".real",      probability: 0.82 },
  { suffix: "_backup",    probability: 0.80 },
  { suffix: ".backup",    probability: 0.78 },
  { suffix: "0fficial",   probability: 0.76 },  // char-sub variant of official
  { suffix: "_original",  probability: 0.74 },
  { suffix: ".original",  probability: 0.72 },
  { suffix: "_verified",  probability: 0.70 },
  { suffix: ".verified",  probability: 0.68 },
  // High probability
  { suffix: "_vip",       probability: 0.65 },
  { suffix: ".vip",       probability: 0.63 },
  { suffix: "_fan",       probability: 0.62 },
  { suffix: ".fan",       probability: 0.60 },
  { suffix: ".fanpage",   probability: 0.58 },
  { suffix: "_fanpage",   probability: 0.57 },
  { suffix: "_creator",   probability: 0.55 },
  { suffix: ".creator",   probability: 0.53 },
  { suffix: "_media",     probability: 0.52 },
  { suffix: ".media",     probability: 0.50 },
  { suffix: "_live",      probability: 0.49 },
  { suffix: ".live",      probability: 0.48 },
  { suffix: "_team",      probability: 0.47 },
  { suffix: ".team",      probability: 0.46 },
  { suffix: "_support",   probability: 0.45 },
  { suffix: ".support",   probability: 0.44 },
  { suffix: "_updates",   probability: 0.43 },
  { suffix: ".updates",   probability: 0.42 },
  { suffix: "_fans",      probability: 0.41 },
  { suffix: ".fans",      probability: 0.40 },
  { suffix: "_page",      probability: 0.39 },
  { suffix: ".page",      probability: 0.38 },
  { suffix: "_tv",        probability: 0.37 },
  { suffix: ".tv",        probability: 0.36 },
  { suffix: "_model",     probability: 0.35 },
  { suffix: "_content",   probability: 0.34 },
  { suffix: "_hq",        probability: 0.33 },
  { suffix: ".hq",        probability: 0.32 },
  { suffix: "_official2", probability: 0.31 },
  // Medium probability
  { suffix: "._real",     probability: 0.30 },
  { suffix: "_news",      probability: 0.29 },
  { suffix: "_world",     probability: 0.28 },
  { suffix: ".world",     probability: 0.27 },
  { suffix: "_global",    probability: 0.26 },
  { suffix: "_studio",    probability: 0.25 },
  { suffix: ".studio",    probability: 0.24 },
  { suffix: "_corp",      probability: 0.23 },
  { suffix: "_agency",    probability: 0.22 },
  { suffix: "_group",     probability: 0.21 },
  { suffix: "_network",   probability: 0.20 },
];

// ── Prefix mutations (ordered by real-world impersonation frequency) ───────────

const PREFIX_MUTATIONS: Array<{ prefix: string; probability: number }> = [
  { prefix: "real",      probability: 0.88 },  // realjohnsmith
  { prefix: "official",  probability: 0.85 },  // officialjohnsmith
  { prefix: "the",       probability: 0.78 },  // thejohnsmith
  { prefix: "its",       probability: 0.72 },  // itsjohnsmith
  { prefix: "team",      probability: 0.62 },  // teamjohnsmith
  { prefix: "support",   probability: 0.57 },  // supportjohnsmith
  { prefix: "iam",       probability: 0.50 },  // iamjohnsmith
  { prefix: "imthe",     probability: 0.45 },  // imthejohnsmith
  { prefix: "meet",      probability: 0.40 },  // meetjohnsmith
];

// ── Character substitutions (leetspeak / typosquatting) ───────────────────────
// Each entry: [original char, replacement char, probability weight]

const CHAR_SUBSTITUTIONS: Array<[string, string, number]> = [
  ["o", "0", 0.72],
  ["i", "1", 0.68],
  ["e", "3", 0.60],
  ["a", "4", 0.55],
  ["s", "5", 0.50],
  ["l", "1", 0.45],
  ["t", "7", 0.35],
  ["g", "9", 0.30],
];

/** Apply a single character substitution. Returns null if char not present. */
function applySubstitution(username: string, from: string, to: string): string | null {
  if (!username.includes(from)) return null;
  return username.replaceAll(from, to);
}

/**
 * Generate all realistic username mutations for a given handle.
 *
 * Returns variants sorted by probability descending (highest probability first),
 * deduplicated, with the original handle excluded.
 *
 * @param username - The original username (with or without @)
 * @param limit    - Maximum variants to return (default 150; use ~20-30 for API search budgets)
 */
export function generateUsernameMutations(
  username: string,
  limit = 150
): UsernameMutation[] {
  const clean = username.toLowerCase().replace(/^@/, "").trim();
  const seen = new Set<string>([clean]);
  const mutations: UsernameMutation[] = [];

  function add(
    variant: string,
    probability: number,
    patternType: UsernameMutation["patternType"]
  ): void {
    const v = variant.toLowerCase().trim();
    // Skip empty, too short, too long, or already seen
    if (v.length < 3 || v.length > 30 || seen.has(v)) return;
    seen.add(v);
    mutations.push({ variant: v, probability, patternType });
  }

  // ── Normalization variants ─────────────────────────────────────────────────
  // De-duplicate consecutive identical chars: sophieraiin → sophierain
  const deduped = clean.replace(/(.)\1+/g, "$1");
  if (deduped !== clean) {
    add(deduped, 0.82, "normalization");
    // Apply top suffixes to the deduped form too
    for (const { suffix, probability } of SUFFIX_MUTATIONS.slice(0, 12)) {
      add(`${deduped}${suffix}`, probability * 0.88, "suffix");
    }
    // Apply top prefixes to the deduped form
    for (const { prefix, probability } of PREFIX_MUTATIONS.slice(0, 4)) {
      add(`${prefix}${deduped}`, probability * 0.82, "prefix");
      add(`${prefix}_${deduped}`, probability * 0.76, "prefix");
    }
  }

  // Strip separators: sophie.rain → sophierain
  const stripped = clean.replace(/[._\-]/g, "");
  if (stripped !== clean) {
    add(stripped, 0.76, "normalization");
    // Apply top suffixes to stripped form
    for (const { suffix, probability } of SUFFIX_MUTATIONS.slice(0, 8)) {
      add(`${stripped}${suffix}`, probability * 0.82, "suffix");
    }
  }

  // Deduped + stripped combo
  const dedupedStripped = deduped.replace(/[._\-]/g, "");
  if (dedupedStripped !== clean && dedupedStripped !== stripped && dedupedStripped !== deduped) {
    add(dedupedStripped, 0.72, "normalization");
  }

  // ── Suffix mutations on base handle ───────────────────────────────────────
  for (const { suffix, probability } of SUFFIX_MUTATIONS) {
    add(`${clean}${suffix}`, probability, "suffix");
  }

  // ── Prefix mutations on base handle ───────────────────────────────────────
  for (const { prefix, probability } of PREFIX_MUTATIONS) {
    // No separator: officialjohnsmith
    add(`${prefix}${clean}`, probability, "prefix");
    // With underscore: official_johnsmith
    add(`${prefix}_${clean}`, probability * 0.92, "prefix");
    // With dot: official.johnsmith
    add(`${prefix}.${clean}`, probability * 0.88, "prefix");
  }

  // ── Character substitutions on base handle ────────────────────────────────
  for (const [from, to, prob] of CHAR_SUBSTITUTIONS) {
    const subbed = applySubstitution(clean, from, to);
    if (!subbed) continue;
    add(subbed, prob, "substitution");
    // Apply top suffixes to substituted form
    for (const { suffix, probability } of SUFFIX_MUTATIONS.slice(0, 6)) {
      add(`${subbed}${suffix}`, probability * prob, "substitution");
    }
    // Apply top prefixes to substituted form
    for (const { prefix, probability } of PREFIX_MUTATIONS.slice(0, 3)) {
      add(`${prefix}${subbed}`, probability * prob * 0.90, "substitution");
    }
  }

  // ── Separator variants ────────────────────────────────────────────────────
  // If username has no separator, try inserting one at common word breaks
  if (!clean.includes("_") && !clean.includes(".") && clean.length >= 6) {
    // Midpoint split
    const mid = Math.floor(clean.length / 2);
    add(`${clean.slice(0, mid)}_${clean.slice(mid)}`, 0.42, "separator");
    add(`${clean.slice(0, mid)}.${clean.slice(mid)}`, 0.40, "separator");
    // One char from end (very common: firstnamelast → firstname_last)
    const threeQuarter = Math.floor(clean.length * 0.7);
    add(`${clean.slice(0, threeQuarter)}_${clean.slice(threeQuarter)}`, 0.38, "separator");
  }

  // ── Number appends ────────────────────────────────────────────────────────
  for (const [num, prob] of [["_", 0], ["1", 0.38], ["2", 0.36], ["0", 0.33], ["01", 0.30], ["11", 0.28], ["21", 0.26], ["123", 0.24], ["_1", 0.32], ["_2", 0.30]] as Array<[string, number]>) {
    if (num === "_") continue;
    add(`${clean}${num}`, prob, "number");
  }

  // ── Last-char repetition ───────────────────────────────────────────────────
  // Very common real-world pattern: grab @sophieraiin by registering @sophieraiinn
  // (append the last char one more time). Also catches triple-repeat of already-
  // doubled final chars, e.g. sophieraiin → sophieraiinn.
  if (clean.length >= 4) {
    const lastChar = clean[clean.length - 1]!;
    add(`${clean}${lastChar}`, 0.62, "substitution");
    // If the last TWO chars are identical (already doubled), also try tripled
    if (clean.length >= 5 && clean[clean.length - 2] === lastChar) {
      add(`${clean}${lastChar}`, 0.55, "substitution"); // deduped — same as above, will skip
    }
  }

  // ── Any doubled-char inflation (e.g. sophieraiin → sophieraiiin) ──────────
  // Impersonators inflate already-doubled chars to stand out while staying similar.
  for (let i = 1; i < clean.length; i++) {
    if (clean[i] === clean[i - 1]) {
      // Inflate this doubled char to tripled
      const tripled = clean.slice(0, i) + clean[i] + clean.slice(i);
      add(tripled, 0.58, "substitution");
    }
  }

  // ── No-separator common suffixes ────────────────────────────────────────────
  // Many impersonators concatenate words directly: @sophieraiintv, @sophieraiinfan
  for (const [bare, prob] of [
    ["tv", 0.38], ["fan", 0.36], ["real", 0.34], ["live", 0.32],
    ["hq", 0.30], ["vip", 0.29], ["media", 0.28], ["xx", 0.26],
    ["xxx", 0.24], ["nsfw", 0.22],
  ] as Array<[string, number]>) {
    add(`${clean}${bare}`, prob, "suffix");
  }

  // Sort by probability descending
  mutations.sort((a, b) => b.probability - a.probability);
  return mutations.slice(0, limit);
}

/**
 * Get the top N mutation variants as plain strings (sorted by probability).
 * Convenience wrapper for use in discovery loops.
 *
 * @param username - Original handle (with or without @)
 * @param limit    - Maximum number of variants to return
 */
export function getTopVariants(username: string, limit = 20): string[] {
  return generateUsernameMutations(username, limit).map((m) => m.variant);
}

/**
 * Classification result from the reverse mutation classifier.
 * Indicates which known impersonation pattern a discovered username matches.
 */
export interface MutationClassification {
  patternType: UsernameMutation["patternType"];
  /** Probability that this pattern indicates real impersonation (0–1). */
  probability: number;
  /** Human-readable rule key for evidence detail display (e.g. "suffix:_official"). */
  matchedRule: string;
}

/**
 * Reverse-classify a discovered username against known mutation patterns.
 *
 * Given an original handle (e.g. "sophierain") and a handle discovered in
 * the wild (e.g. "sophierain_official"), returns the best-matching mutation
 * pattern or null if no known pattern matches.
 *
 * This turns the mutation engine into a CLASSIFIER rather than a query factory:
 * instead of generating handles to search for, we confirm that a handle the
 * web actually returned matches a known impersonation pattern, and report that
 * pattern in the evidence detail.
 *
 * @param original   - The real user's handle (with or without @)
 * @param discovered - A handle found on the web (with or without @)
 * @returns Best matching pattern, or null if no pattern matches.
 */
export function classifyDiscoveredUsername(
  original: string,
  discovered: string
): MutationClassification | null {
  const clean = original.toLowerCase().replace(/^@/, "").trim();
  const found = discovered.toLowerCase().replace(/^@/, "").trim();

  if (!clean || !found || found === clean) return null;

  let best: MutationClassification | null = null;

  function keep(candidate: MutationClassification): void {
    if (!best || candidate.probability > best.probability) {
      best = candidate;
    }
  }

  // ── Suffix mutations ────────────────────────────────────────────────────────
  for (const { suffix, probability } of SUFFIX_MUTATIONS) {
    if (found === `${clean}${suffix}`) {
      keep({ patternType: "suffix", probability, matchedRule: `suffix:${suffix}` });
    }
  }

  // ── Prefix mutations ────────────────────────────────────────────────────────
  for (const { prefix, probability } of PREFIX_MUTATIONS) {
    if (found === `${prefix}${clean}`) {
      keep({ patternType: "prefix", probability, matchedRule: `prefix:${prefix}` });
    }
    if (found === `${prefix}_${clean}`) {
      keep({ patternType: "prefix", probability: probability * 0.92, matchedRule: `prefix:${prefix}_` });
    }
    if (found === `${prefix}.${clean}`) {
      keep({ patternType: "prefix", probability: probability * 0.88, matchedRule: `prefix:${prefix}.` });
    }
  }

  // ── Character substitutions ─────────────────────────────────────────────────
  for (const [from, to, prob] of CHAR_SUBSTITUTIONS) {
    const subbed = applySubstitution(clean, from, to);
    if (!subbed) continue;
    if (found === subbed) {
      keep({ patternType: "substitution", probability: prob, matchedRule: `sub:${from}→${to}` });
    }
    // Substitution + top suffixes
    for (const { suffix, probability: sp } of SUFFIX_MUTATIONS.slice(0, 6)) {
      if (found === `${subbed}${suffix}`) {
        keep({ patternType: "substitution", probability: sp * prob, matchedRule: `sub:${from}→${to}+suffix:${suffix}` });
      }
    }
    // Prefix + substitution
    for (const { prefix, probability: pp } of PREFIX_MUTATIONS.slice(0, 3)) {
      if (found === `${prefix}${subbed}`) {
        keep({ patternType: "substitution", probability: pp * prob * 0.90, matchedRule: `prefix:${prefix}+sub:${from}→${to}` });
      }
    }
  }

  // ── Normalization variants ──────────────────────────────────────────────────
  const deduped = clean.replace(/(.)\1+/g, "$1");
  if (deduped !== clean) {
    if (found === deduped) {
      keep({ patternType: "normalization", probability: 0.82, matchedRule: "normalization:dedup" });
    }
    // Deduped + suffix
    for (const { suffix, probability } of SUFFIX_MUTATIONS.slice(0, 12)) {
      if (found === `${deduped}${suffix}`) {
        keep({ patternType: "suffix", probability: probability * 0.88, matchedRule: `normalization:dedup+suffix:${suffix}` });
      }
    }
    // Prefix + deduped
    for (const { prefix, probability } of PREFIX_MUTATIONS.slice(0, 4)) {
      if (found === `${prefix}${deduped}`) {
        keep({ patternType: "prefix", probability: probability * 0.82, matchedRule: `normalization:dedup+prefix:${prefix}` });
      }
      if (found === `${prefix}_${deduped}`) {
        keep({ patternType: "prefix", probability: probability * 0.76, matchedRule: `normalization:dedup+prefix:${prefix}_` });
      }
    }
  }

  const stripped = clean.replace(/[._\-]/g, "");
  if (stripped !== clean) {
    if (found === stripped) {
      keep({ patternType: "normalization", probability: 0.76, matchedRule: "normalization:strip" });
    }
    for (const { suffix, probability } of SUFFIX_MUTATIONS.slice(0, 8)) {
      if (found === `${stripped}${suffix}`) {
        keep({ patternType: "suffix", probability: probability * 0.82, matchedRule: `normalization:strip+suffix:${suffix}` });
      }
    }
  }

  const dedupedStripped = deduped.replace(/[._\-]/g, "");
  if (dedupedStripped !== clean && found === dedupedStripped) {
    keep({ patternType: "normalization", probability: 0.72, matchedRule: "normalization:dedup+strip" });
  }

  // ── Number appends ──────────────────────────────────────────────────────────
  const numberAppends: Array<[string, number]> = [
    ["1", 0.38], ["2", 0.36], ["0", 0.33], ["01", 0.30],
    ["11", 0.28], ["21", 0.26], ["123", 0.24], ["_1", 0.32], ["_2", 0.30],
  ];
  for (const [num, prob] of numberAppends) {
    if (found === `${clean}${num}`) {
      keep({ patternType: "number", probability: prob, matchedRule: `number:${num}` });
    }
  }

  // ── Last-char repetition ────────────────────────────────────────────────────
  if (clean.length >= 4) {
    const lastChar = clean[clean.length - 1]!;
    if (found === `${clean}${lastChar}`) {
      keep({ patternType: "substitution", probability: 0.62, matchedRule: "substitution:last_char_repeat" });
    }
    // Doubled-char inflation (e.g. sophieraiin → sophieraiiin)
    for (let i = 1; i < clean.length; i++) {
      if (clean[i] === clean[i - 1]) {
        const inflated = clean.slice(0, i) + clean[i] + clean.slice(i);
        if (found === inflated) {
          keep({ patternType: "substitution", probability: 0.58, matchedRule: "substitution:doubled_char_inflate" });
        }
      }
    }
  }

  // ── Separator variants ──────────────────────────────────────────────────────
  if (!clean.includes("_") && !clean.includes(".") && clean.length >= 6) {
    const mid = Math.floor(clean.length / 2);
    if (found === `${clean.slice(0, mid)}_${clean.slice(mid)}`) {
      keep({ patternType: "separator", probability: 0.42, matchedRule: "separator:mid_underscore" });
    }
    if (found === `${clean.slice(0, mid)}.${clean.slice(mid)}`) {
      keep({ patternType: "separator", probability: 0.40, matchedRule: "separator:mid_dot" });
    }
    const tq = Math.floor(clean.length * 0.7);
    if (found === `${clean.slice(0, tq)}_${clean.slice(tq)}`) {
      keep({ patternType: "separator", probability: 0.38, matchedRule: "separator:70pct_underscore" });
    }
  }

  // ── No-separator bare suffixes ──────────────────────────────────────────────
  const bareSuffixes: Array<[string, number]> = [
    ["tv", 0.38], ["fan", 0.36], ["real", 0.34], ["live", 0.32],
    ["hq", 0.30], ["vip", 0.29], ["media", 0.28],
  ];
  for (const [bare, prob] of bareSuffixes) {
    if (found === `${clean}${bare}`) {
      keep({ patternType: "suffix", probability: prob, matchedRule: `suffix_bare:${bare}` });
    }
  }

  return best;
}

/**
 * Get mutations grouped by pattern type.
 * Useful for budgeted discovery (e.g. run all suffix mutations before substitutions).
 */
export function getMutationsByType(
  username: string
): Record<UsernameMutation["patternType"], string[]> {
  const all = generateUsernameMutations(username, 300);
  const result: Record<UsernameMutation["patternType"], string[]> = {
    suffix: [],
    prefix: [],
    substitution: [],
    separator: [],
    number: [],
    normalization: [],
  };
  for (const m of all) {
    result[m.patternType].push(m.variant);
  }
  return result;
}
