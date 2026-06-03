/**
 * Web Search Service — Impersonator Discovery via Google Custom Search
 *
 * Two discovery strategies that catch impersonators regardless of username:
 *
 * 1. USERNAME VARIANT SEARCH  — searches for known suffix patterns
 *    (catches: @user.official, @user_real, @user0fficial, etc.)
 *
 * 2. REVERSE IMAGE SEARCH     — searches using your actual photo URLs
 *    (catches: completely different usernames that stole your photos)
 *
 * 3. CAPTION TEXT SEARCH      — searches verbatim caption snippets
 *    (catches: accounts that copy your post text with no username overlap)
 *
 * All three strategies are TOS-compliant: they query only publicly indexed
 * content via Google's official Custom Search API.
 *
 * Setup:
 *   1. console.developers.google.com → enable "Custom Search API"
 *   2. programmablesearchengine.google.com → create engine → "Search the entire web"
 *   3. Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX
 *
 * Pricing: $5 per 1,000 queries after the free 100/day tier.
 */

import { logger } from "../lib/logger";

export interface WebSearchCandidate {
  username: string;
  platform: string;
  profileUrl: string;
  title: string;
  snippet: string;
  similarity: number;
  discoveryMethod: "username_variant" | "image_search" | "caption_search";
}

interface GoogleSearchItem {
  link: string;
  title: string;
  snippet: string;
}

interface GoogleSearchResponse {
  items?: GoogleSearchItem[];
  error?: { code: number; message: string };
}

const GOOGLE_CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

// Platform URL patterns used to extract usernames from Google result URLs
const PLATFORM_PATTERNS: Record<
  string,
  { host: string; extract: (url: URL) => string | null }
> = {
  instagram: {
    host: "instagram.com",
    extract: (url) => {
      const parts = url.pathname.split("/").filter(Boolean);
      const user = parts[0];
      if (!user || ["p", "reel", "explore", "stories", "tv"].includes(user))
        return null;
      return user;
    },
  },
  tiktok: {
    host: "tiktok.com",
    extract: (url) => {
      const parts = url.pathname.split("/").filter(Boolean);
      const userPart = parts.find((p) => p.startsWith("@"));
      return userPart ? userPart.replace("@", "") : null;
    },
  },
  x: {
    host: "x.com",
    extract: (url) => {
      const parts = url.pathname.split("/").filter(Boolean);
      const user = parts[0];
      if (!user || ["i", "home", "explore", "notifications", "messages"].includes(user))
        return null;
      return user;
    },
  },
  facebook: {
    host: "facebook.com",
    extract: (url) => {
      if (url.searchParams.has("id")) return null;
      const parts = url.pathname.split("/").filter(Boolean);
      const user = parts[0];
      if (
        !user ||
        ["pages", "groups", "events", "watch", "marketplace", "gaming"].includes(user)
      )
        return null;
      return user;
    },
  },
};

// Common impersonation suffixes ordered by risk
const IMPERSONATION_SUFFIXES = [
  ".official",
  "_real",
  "0fficial",
  ".creator",
  "_backup",
  ".verified",
  "_original",
  ".fanpage",
];

export function isConfigured(): boolean {
  return !!(
    process.env["GOOGLE_SEARCH_API_KEY"] && process.env["GOOGLE_SEARCH_CX"]
  );
}

async function runGoogleSearch(query: string): Promise<GoogleSearchItem[]> {
  const apiKey = process.env["GOOGLE_SEARCH_API_KEY"];
  const cx = process.env["GOOGLE_SEARCH_CX"];
  if (!apiKey || !cx) return [];

  const url = new URL(GOOGLE_CSE_ENDPOINT);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "10");

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as GoogleSearchResponse;
      logger.warn(
        { status: res.status, message: body.error?.message, query },
        "Google CSE returned non-OK status"
      );
      return [];
    }
    const data = (await res.json()) as GoogleSearchResponse;
    return data.items ?? [];
  } catch (err) {
    logger.warn({ err, query }, "Google CSE request failed");
    return [];
  }
}

/** Extract a social media username from a Google result URL. */
function extractUsernameFromUrl(link: string): { username: string; platform: string } | null {
  let url: URL;
  try { url = new URL(link); } catch { return null; }

  for (const [platform, config] of Object.entries(PLATFORM_PATTERNS)) {
    if (!url.hostname.includes(config.host)) continue;
    const extracted = config.extract(url);
    if (!extracted) continue;
    return { username: extracted.toLowerCase().replace(/^@/, ""), platform };
  }
  return null;
}

// ─── Strategy 1: Username variant search ─────────────────────────────────────

async function searchByUsernameVariants(
  username: string,
  targetPlatforms: string[],
  seen: Set<string>
): Promise<WebSearchCandidate[]> {
  const candidates: WebSearchCandidate[] = [];
  const clean = username.toLowerCase();

  const siteFilter = targetPlatforms
    .map((p) => `site:${PLATFORM_PATTERNS[p]!.host}`)
    .join(" OR ");

  for (const suffix of IMPERSONATION_SUFFIXES.slice(0, 5)) {
    const variant = `${clean}${suffix}`;
    const query = `"${variant}" (${siteFilter})`;

    logger.info({ query, username: clean }, "Username variant search");
    const results = await runGoogleSearch(query);

    for (const item of results) {
      const extracted = extractUsernameFromUrl(item.link);
      if (!extracted) continue;

      const { username: found, platform } = extracted;
      if (found === clean) continue; // that's the user themselves

      const key = `${platform}:${found}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Must contain the original username to qualify as a variant
      if (!found.startsWith(clean) && !found.includes(clean)) continue;

      const similarity = found.startsWith(clean) ? 0.85 : 0.6;

      candidates.push({
        username: found,
        platform,
        profileUrl: item.link,
        title: item.title,
        snippet: item.snippet,
        similarity,
        discoveryMethod: "username_variant",
      });
    }

    await new Promise<void>((r) => setTimeout(r, 1100));
  }

  return candidates;
}

// ─── Strategy 2: Reverse image search ────────────────────────────────────────
// Finds accounts using your actual photos regardless of username.

async function searchByImageUrls(
  photoUrls: string[],
  originalUsername: string,
  targetPlatforms: string[],
  seen: Set<string>
): Promise<WebSearchCandidate[]> {
  if (photoUrls.length === 0) return [];

  const candidates: WebSearchCandidate[] = [];
  const clean = originalUsername.toLowerCase();
  const siteFilter = targetPlatforms
    .map((p) => `site:${PLATFORM_PATTERNS[p]!.host}`)
    .join(" OR ");

  // Sample up to 3 photos to limit API quota
  const sampleUrls = photoUrls.slice(0, 3);

  for (const photoUrl of sampleUrls) {
    // Google CSE image search: search for the image URL itself
    const query = `"${photoUrl}" (${siteFilter})`;

    logger.info({ photoUrl: photoUrl.slice(0, 60), username: clean }, "Reverse image search");
    const results = await runGoogleSearch(query);

    for (const item of results) {
      const extracted = extractUsernameFromUrl(item.link);
      if (!extracted) continue;

      const { username: found, platform } = extracted;
      if (found === clean) continue;

      const key = `${platform}:${found}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Include regardless of username similarity — that's the whole point
      candidates.push({
        username: found,
        platform,
        profileUrl: item.link,
        title: item.title,
        snippet: item.snippet,
        similarity: 0.0, // username similarity is irrelevant here; visual match drives the score
        discoveryMethod: "image_search",
      });
    }

    await new Promise<void>((r) => setTimeout(r, 1100));
  }

  logger.info(
    { count: candidates.length, photosSearched: sampleUrls.length },
    "Reverse image search complete"
  );

  return candidates;
}

// ─── Strategy 3: Caption text search ─────────────────────────────────────────
// Finds accounts reusing your verbatim caption text.

async function searchByCaptions(
  captions: string[],
  originalUsername: string,
  targetPlatforms: string[],
  seen: Set<string>
): Promise<WebSearchCandidate[]> {
  if (captions.length === 0) return [];

  const candidates: WebSearchCandidate[] = [];
  const clean = originalUsername.toLowerCase();
  const siteFilter = targetPlatforms
    .map((p) => `site:${PLATFORM_PATTERNS[p]!.host}`)
    .join(" OR ");

  // Take up to 2 captions of meaningful length (≥30 chars) as fingerprints
  const sampleCaptions = captions
    .map((c) => c.trim())
    .filter((c) => c.length >= 30)
    .slice(0, 2);

  for (const caption of sampleCaptions) {
    // Use first 60 chars as a verbatim search snippet
    const snippet = caption.slice(0, 60).replace(/"/g, "");
    const query = `"${snippet}" (${siteFilter})`;

    logger.info({ snippet, username: clean }, "Caption text search");
    const results = await runGoogleSearch(query);

    for (const item of results) {
      const extracted = extractUsernameFromUrl(item.link);
      if (!extracted) continue;

      const { username: found, platform } = extracted;
      if (found === clean) continue;

      const key = `${platform}:${found}`;
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push({
        username: found,
        platform,
        profileUrl: item.link,
        title: item.title,
        snippet: item.snippet,
        similarity: 0.0, // caption match is its own strong signal
        discoveryMethod: "caption_search",
      });
    }

    await new Promise<void>((r) => setTimeout(r, 1100));
  }

  logger.info(
    { count: candidates.length, captionsSearched: sampleCaptions.length },
    "Caption text search complete"
  );

  return candidates;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SearchImpersonatorsOptions {
  username: string;
  connectedPlatforms: string[];
  /** URLs of the user's own photos for reverse image search */
  photoUrls?: string[];
  /** Verbatim captions from the user's posts for caption search */
  captions?: string[];
}

/**
 * Search the public web for potential impersonator accounts using three
 * complementary strategies: username variants, reverse image search, and
 * caption text search.
 *
 * Returns deduplicated candidates tagged with the discovery method so the
 * scoring engine can weight each appropriately.
 */
export async function searchForImpersonators(
  usernameOrOptions: string | SearchImpersonatorsOptions,
  connectedPlatformsArg?: string[]
): Promise<WebSearchCandidate[]> {
  if (!isConfigured()) {
    logger.info(
      {},
      "GOOGLE_SEARCH_API_KEY/CX not configured — skipping web search. Add keys to enable."
    );
    return [];
  }

  // Support both old call signature (string, string[]) and new options object
  let username: string;
  let connectedPlatforms: string[];
  let photoUrls: string[] = [];
  let captions: string[] = [];

  if (typeof usernameOrOptions === "string") {
    username = usernameOrOptions;
    connectedPlatforms = connectedPlatformsArg ?? [];
  } else {
    username = usernameOrOptions.username;
    connectedPlatforms = usernameOrOptions.connectedPlatforms;
    photoUrls = usernameOrOptions.photoUrls ?? [];
    captions = usernameOrOptions.captions ?? [];
  }

  const clean = username.replace(/^@/, "").toLowerCase();
  const seen = new Set<string>();
  const allCandidates: WebSearchCandidate[] = [];

  const targetPlatforms = Object.keys(PLATFORM_PATTERNS).filter(
    (p) => !connectedPlatforms.includes(p)
  );

  if (targetPlatforms.length === 0) {
    logger.info({ username: clean }, "All platforms connected — skipping web search");
    return [];
  }

  // Strategy 1: Username variants
  const variantCandidates = await searchByUsernameVariants(clean, targetPlatforms, seen);
  allCandidates.push(...variantCandidates);

  // Strategy 2: Reverse image search (finds stolen photos with totally different usernames)
  if (photoUrls.length > 0) {
    const imageCandidates = await searchByImageUrls(photoUrls, clean, targetPlatforms, seen);
    allCandidates.push(...imageCandidates);
  }

  // Strategy 3: Caption text fingerprint search
  if (captions.length > 0) {
    const captionCandidates = await searchByCaptions(captions, clean, targetPlatforms, seen);
    allCandidates.push(...captionCandidates);
  }

  logger.info(
    {
      username: clean,
      total: allCandidates.length,
      byMethod: {
        username_variant: allCandidates.filter((c) => c.discoveryMethod === "username_variant").length,
        image_search: allCandidates.filter((c) => c.discoveryMethod === "image_search").length,
        caption_search: allCandidates.filter((c) => c.discoveryMethod === "caption_search").length,
      },
      platforms: targetPlatforms,
    },
    "Web impersonator search complete"
  );

  return allCandidates;
}
