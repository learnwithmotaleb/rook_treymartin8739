/**
 * Web Search Service — Impersonator Discovery via Google Custom Search
 *
 * Searches the public web for accounts using username impersonation patterns
 * on major social platforms. This approach is fully compliant with all
 * social platform terms of service because:
 *
 *  1. It only queries publicly indexed profile pages (no platform API required)
 *  2. It uses Google's official Custom Search API, not web scraping
 *  3. It does not access any private or authenticated content
 *  4. No user OAuth tokens from connected platforms are used in queries
 *
 * Setup:
 *   1. Go to console.developers.google.com → enable "Custom Search API"
 *   2. Go to programmablesearchengine.google.com → create new engine
 *      → set "Search the entire web" → copy the CX (engine ID)
 *   3. Add to environment: GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX
 *
 * Pricing: $5 per 1,000 queries after the free 100/day tier.
 *
 * Without keys: service returns empty results gracefully, and the orchestrator
 * falls back to username-variant simulation mode.
 */

import { logger } from "../lib/logger";

export interface WebSearchCandidate {
  username: string;
  platform: string;
  profileUrl: string;
  title: string;
  snippet: string;
  similarity: number;
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
      // Exclude known non-profile paths
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
      // Skip non-profile Facebook URLs
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

// Common impersonation suffixes ordered by risk (most suspicious first)
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

function extractCandidateFromUrl(
  link: string,
  title: string,
  snippet: string,
  originalUsername: string
): WebSearchCandidate | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }

  for (const [platform, config] of Object.entries(PLATFORM_PATTERNS)) {
    if (!url.hostname.includes(config.host)) continue;

    const extracted = config.extract(url);
    if (!extracted) continue;

    const clean = extracted.toLowerCase().replace(/^@/, "");
    const original = originalUsername.toLowerCase();

    // Skip exact match (that's the user themselves)
    if (clean === original) continue;

    // Must be a meaningful variant — must start with the original username
    if (!clean.startsWith(original) && !clean.includes(original)) continue;

    // Score similarity: closer username → higher similarity
    const similarity = clean.startsWith(original) ? 0.85 : 0.6;

    return { username: clean, platform, profileUrl: link, title, snippet, similarity };
  }

  return null;
}

/**
 * Search the public web for potential impersonator accounts.
 *
 * Searches Google for common impersonation username patterns on social
 * platforms the user has NOT connected (connected platforms are scanned
 * via official APIs in the main scan pipeline instead).
 *
 * Returns deduplicated candidate accounts with similarity scores.
 */
export async function searchForImpersonators(
  username: string,
  connectedPlatforms: string[]
): Promise<WebSearchCandidate[]> {
  if (!isConfigured()) {
    logger.info(
      { username },
      "GOOGLE_SEARCH_API_KEY/CX not configured — skipping web-based impersonator search. Add keys to enable."
    );
    return [];
  }

  const clean = username.replace(/^@/, "").toLowerCase();
  const candidates: WebSearchCandidate[] = [];
  const seen = new Set<string>();

  // Target platforms where official username-search API is unavailable
  const targetPlatforms = Object.keys(PLATFORM_PATTERNS).filter(
    (p) => !connectedPlatforms.includes(p)
  );

  if (targetPlatforms.length === 0) return [];

  const siteFilter = targetPlatforms
    .map((p) => `site:${PLATFORM_PATTERNS[p]!.host}`)
    .join(" OR ");

  for (const suffix of IMPERSONATION_SUFFIXES.slice(0, 5)) {
    const variant = `${clean}${suffix}`;
    const query = `"${variant}" (${siteFilter})`;

    logger.info({ query, username: clean }, "Running web search for impersonator variant");

    const results = await runGoogleSearch(query);

    for (const item of results) {
      const candidate = extractCandidateFromUrl(item.link, item.title, item.snippet, clean);
      if (!candidate) continue;

      const key = `${candidate.platform}:${candidate.username}`;
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push(candidate);
    }

    // Respect Google CSE rate limits — 1 QPS recommended
    await new Promise<void>((resolve) => setTimeout(resolve, 1100));
  }

  logger.info(
    { username: clean, candidates: candidates.length, platforms: targetPlatforms },
    "Web impersonator search complete"
  );

  return candidates;
}
