/**
 * Web Search Service — Impersonator Discovery
 *
 * Three complementary discovery strategies:
 *
 * 1. USERNAME VARIANT SEARCH  — Google CSE text search for known suffix patterns
 *    (catches: @user.official, @user_real, @user0fficial, etc.)
 *    Requires: GOOGLE_CSE_API_KEY + GOOGLE_SEARCH_CX
 *
 * 2. REVERSE IMAGE SEARCH     — Google Cloud Vision WEB_DETECTION
 *    Sends actual photo pixels to Google Vision; returns every public page
 *    where that image (or a visually similar one) appears.
 *    (catches: completely different usernames that stole your photos)
 *    Requires: GOOGLE_VISION_API_KEY (Cloud Vision API enabled on that key's project)
 *    Pricing: $1.50 per 1,000 images (first 1,000/mo free)
 *
 * 3. CAPTION TEXT SEARCH      — Google CSE verbatim text search
 *    (catches: accounts that copy your post text with no username overlap)
 *    Requires: GOOGLE_CSE_API_KEY + GOOGLE_SEARCH_CX
 *
 * Setup:
 *   1. console.cloud.google.com → enable "Custom Search JSON API" on the CSE key's project
 *   2. console.cloud.google.com → enable "Cloud Vision API" on the Vision key's project
 *   3. programmablesearchengine.google.com → create engine → "Search the entire web"
 *   4. Set GOOGLE_CSE_API_KEY, GOOGLE_VISION_API_KEY, and GOOGLE_SEARCH_CX
 */

import { logger } from "../lib/logger";
import { trackApiCall } from "./costTracker";
import { generateUsernameMutations } from "./usernameMutationService";

export interface WebSearchCandidate {
  username: string;
  platform: string;
  profileUrl: string;
  imageUrl?: string;
  title: string;
  snippet: string;
  similarity: number;
  discoveryMethod: "username_variant" | "image_search" | "caption_search";
  postContext?: "original_post" | "retweet" | "share" | "unknown";
  originalPoster?: string;
  /**
   * ISO-8601 date string for when the suspicious account posted this content.
   * Extracted from Google result pagemap metatags (article:published_time, date, etc.).
   * Used for temporal signal: real impersonators always post AFTER the victim.
   */
  datePublished?: string;
}

interface GoogleSearchItem {
  link: string;
  title: string;
  snippet: string;
  /** Structured page data — present when Google indexes schema.org or OG meta tags. */
  pagemap?: {
    metatags?: Array<Record<string, string>>;
    newsarticle?: Array<{ datepublished?: string }>;
    article?: Array<{ datepublished?: string }>;
  };
}

interface GoogleSearchResponse {
  items?: GoogleSearchItem[];
  error?: { code: number; message: string };
}

/**
 * Extract a publish date from a Google CSE result item.
 * Tries standard metatag keys in priority order.
 * Returns undefined when no date is found (graceful degradation).
 */
function extractDatePublished(item: GoogleSearchItem): string | undefined {
  const metatags = item.pagemap?.metatags?.[0];
  if (metatags) {
    const keys = [
      "article:published_time",
      "og:article:published_time",
      "datePublished",
      "date",
      "dc.date",
      "dc:date",
      "pubdate",
    ];
    for (const key of keys) {
      const val = metatags[key];
      if (val && val.length > 0) return val;
    }
  }
  // newsarticle / article schema.org pagemap
  const schemaDate =
    item.pagemap?.newsarticle?.[0]?.datepublished ??
    item.pagemap?.article?.[0]?.datepublished;
  return schemaDate ?? undefined;
}

const GOOGLE_CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";
const SERPER_ENDPOINT = "https://google.serper.dev/search";

// ─── Serper.dev search (preferred text-search backend) ───────────────────────
// Serper.dev proxies Google Search results with a simple API key — no GCP
// project setup required. Returns results in a slightly different shape from
// CSE; this function normalises them to GoogleSearchItem[] for downstream reuse.

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet?: string;
}

interface SerperSearchResponse {
  organic?: SerperOrganicResult[];
  error?: string;
}

async function runSerperSearch(query: string): Promise<GoogleSearchItem[]> {
  const apiKey = process.env["SERPER_API_KEY"];
  if (!apiKey) return [];

  try {
    const res = await fetch(SERPER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({ q: query, num: 10 }),
    });

    if (!res.ok) {
      logger.warn({ status: res.status, query }, "Serper.dev returned non-OK status");
      return [];
    }

    const data = (await res.json()) as SerperSearchResponse;
    if (!data.organic) return [];

    // Normalise to GoogleSearchItem shape — snippet and pagemap are optional
    return data.organic.map((r) => ({
      link: r.link,
      title: r.title,
      snippet: r.snippet ?? "",
    }));
  } catch (err) {
    logger.warn({ err, query }, "Serper.dev request failed");
    return [];
  }
}

// Platform URL patterns used to extract usernames from Google result URLs
const PLATFORM_PATTERNS: Record<
  string,
  { host: string; extract: (url: URL) => string | null }
> = {
  instagram: {
    host: "instagram.com",
    extract: (url) => {
      // Reject CDN/lookaside subdomains — only trust instagram.com and www.instagram.com
      if (url.hostname !== "instagram.com" && url.hostname !== "www.instagram.com") return null;
      const parts = url.pathname.split("/").filter(Boolean);
      const user = parts[0];
      if (!user || ["p", "reel", "explore", "stories", "tv"].includes(user))
        return null;
      // Reject content sub-pages: /user/tagged/, /user/reels/, etc.
      if (parts[1] && ["tagged", "reels", "channel"].includes(parts[1])) return null;
      return user;
    },
  },
  tiktok: {
    host: "tiktok.com",
    extract: (url) => {
      if (url.hostname !== "tiktok.com" && url.hostname !== "www.tiktok.com") return null;
      const parts = url.pathname.split("/").filter(Boolean);
      const userPart = parts.find((p) => p.startsWith("@"));
      return userPart ? userPart.replace("@", "") : null;
    },
  },
  x: {
    host: "x.com",
    extract: (url) => {
      // Exact match only — prevents lookaside.fbsbx.com matching via substring "x.com"
      if (url.hostname !== "x.com" && url.hostname !== "www.x.com" &&
          url.hostname !== "twitter.com" && url.hostname !== "www.twitter.com") return null;
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
      if (url.hostname !== "facebook.com" && url.hostname !== "www.facebook.com") return null;
      if (url.searchParams.has("id")) return null;
      const parts = url.pathname.split("/").filter(Boolean);
      const user = parts[0];
      if (
        !user ||
        ["pages", "groups", "events", "watch", "marketplace", "gaming"].includes(user)
      )
        return null;
      // Reject content sub-pages — these are posts/media, not the account profile
      if (parts[1] && ["videos", "photos", "posts", "reels", "about", "reviews"].includes(parts[1]))
        return null;
      return user;
    },
  },
};

// Username variant discovery now uses the mutation engine (usernameMutationService).
// The IMPERSONATION_SUFFIXES list has been replaced — see generateUsernameMutations()
// which generates 100-300 ranked variants covering suffix, prefix, char-sub, separator,
// and number patterns. The engine is called per-search with a tier-based limit.

// ─── Search provider helpers ──────────────────────────────────────────────────
// Priority: Serper.dev → Google CSE → direct platform probes (no text search)
// Serper.dev requires only SERPER_API_KEY (no GCP project setup).
// Google CSE requires GOOGLE_CSE_API_KEY + GOOGLE_SEARCH_CX.

/** Returns true when Serper.dev is available (preferred text-search backend). */
function isSerperConfigured(): boolean {
  return !!(process.env["SERPER_API_KEY"]);
}

/** CSE uses GOOGLE_CSE_API_KEY. */
function getCseApiKey(): string | undefined {
  return process.env["GOOGLE_CSE_API_KEY"];
}

/** Vision uses GOOGLE_VISION_API_KEY. */
function getVisionApiKey(): string | undefined {
  return process.env["GOOGLE_VISION_API_KEY"];
}

/** Text search (username/name queries) is available when Serper OR CSE is configured. */
export function isConfigured(): boolean {
  return isSerperConfigured() || !!(getCseApiKey() && process.env["GOOGLE_SEARCH_CX"]);
}

/** Reverse image search uses Cloud Vision API. */
export function isVisionConfigured(): boolean {
  return !!(getVisionApiKey());
}

// ─── CSE health flag ──────────────────────────────────────────────────────────
// Tracks whether CSE is returning 403 (API not enabled on the GCP project).
// When true, directVariantProbe is activated as a CSE-independent fallback.
let cseFailing = false;

// ─── Cloud Vision WEB_DETECTION types ────────────────────────────────────────

interface VisionWebPage {
  url: string;
  pageTitle?: string;
  score?: number;
  fullMatchingImages?: VisionWebImage[];
  partialMatchingImages?: VisionWebImage[];
}

interface VisionWebImage {
  url: string;
  score?: number;
}

interface VisionWebDetection {
  pagesWithMatchingImages?: VisionWebPage[];
  fullMatchingImages?: VisionWebImage[];
  partialMatchingImages?: VisionWebImage[];
  visuallySimilarImages?: VisionWebImage[];
}

interface VisionAnnotateResponse {
  webDetection?: VisionWebDetection;
  error?: { code: number; message: string };
}

async function runGoogleSearch(query: string): Promise<GoogleSearchItem[]> {
  // Prefer Serper.dev — no GCP setup required, same Google results
  if (isSerperConfigured()) {
    return runSerperSearch(query);
  }

  const apiKey = getCseApiKey();
  const cx = process.env["GOOGLE_SEARCH_CX"];
  if (!apiKey || !cx) return [];

  const url = new URL(GOOGLE_CSE_ENDPOINT);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "10");

  const fullUrl = url.toString();
  const logUrl = fullUrl.replace(apiKey, apiKey.slice(0, 8) + "[REDACTED]");
  logger.info({ url: logUrl, cx, query }, "CSE request →");

  try {
    const res = await fetch(fullUrl);
    const rawBody = await res.text();
    logger.info(
      { httpStatus: res.status, httpStatusText: res.statusText, url: logUrl, rawBody },
      "CSE response ←"
    );

    if (!res.ok) {
      let body: GoogleSearchResponse = {};
      try { body = JSON.parse(rawBody) as GoogleSearchResponse; } catch { /* ignore */ }
      if (res.status === 403) {
        cseFailing = true;
      } else {
        logger.warn(
          { status: res.status, message: body.error?.message, query },
          "Google CSE returned non-OK status"
        );
      }
      return [];
    }
    cseFailing = false;
    const data = JSON.parse(rawBody) as GoogleSearchResponse;
    return data.items ?? [];
  } catch (err) {
    logger.warn({ err, query }, "Google CSE request failed");
    return [];
  }
}

/**
 * Detect whether an X/Twitter page result represents an original post,
 * a retweet, or a share — based on the page title Google returns.
 *
 * Patterns handled:
 *   "RT @username: tweet text"          → standard retweet
 *   "QT @username:"                     → quote tweet (old format)
 *   "user on X: "@other_user: text""    → quote tweet (title embeds quoted handle)
 *   "Retweeted" in title/snippet        → explicit retweet marker
 *   "@user Retweeted" in combined       → retweet marker with subject
 */
function detectXPostContext(title: string, snippet: string): {
  context: "original_post" | "retweet" | "share" | "unknown";
  originalPoster?: string;
} {
  const combined = `${title} ${snippet}`;

  // Standard retweet: "RT @username: ..."
  const rtMatch = combined.match(/\bRT @(\w+)/i);
  if (rtMatch?.[1]) {
    return { context: "retweet", originalPoster: rtMatch[1].toLowerCase() };
  }

  // Explicit QT marker: "QT @username:"
  const qtMatch = combined.match(/\bQT @(\w+)/i);
  if (qtMatch?.[1]) {
    return { context: "share", originalPoster: qtMatch[1].toLowerCase() };
  }

  // Quote tweet title format: `user on X: "@other_user: their tweet text"`
  // Google page title wraps the outer tweet, so the quoted handle appears
  // after an opening curly/straight quote followed by @handle:
  const quoteInTitle = title.match(/["""'']@(\w+):/);
  if (quoteInTitle?.[1]) {
    return { context: "share", originalPoster: quoteInTitle[1].toLowerCase() };
  }

  // "Retweeted" keyword anywhere — rare but unambiguous
  if (/\bretweeted\b/i.test(combined)) {
    return { context: "retweet" };
  }

  return { context: "original_post" };
}

/**
 * Returns true when a URL points to a video post/page rather than a user profile.
 * These pages often surface a creator's photo in a video thumbnail, making them
 * look like stolen-photo candidates when they are just reaction/commentary videos.
 *
 * Applied to Vision API pagesWithMatchingImages results before username extraction.
 */
function isContentPageUrl(url: string): boolean {
  // TikTok video posts: tiktok.com/@user/video/12345
  if (/tiktok\.com\/@[^/]+\/video\//i.test(url)) return true;
  // YouTube watch pages, Shorts, live streams, embeds
  if (/youtube\.com\/(watch|shorts|live|embed)\b/i.test(url)) return true;
  if (/youtu\.be\//i.test(url)) return true;
  // Instagram Reels and individual posts — not profile pages
  if (/instagram\.com\/reel\//i.test(url)) return true;
  if (/instagram\.com\/p\//i.test(url)) return true;
  // Facebook top-level video/watch hubs
  if (/facebook\.com\/(watch|video)\b/i.test(url)) return true;
  // Facebook per-account content pages (videos, photos, posts, reels sub-paths)
  // e.g. facebook.com/beberexha/videos/12345 or facebook.com/IFLScience/photos/abc
  if (/facebook\.com\/[^/?#]+\/(videos|photos|posts|reels)\//i.test(url)) return true;
  // Twitch clips and VODs
  if (/twitch\.tv\/[^/]+\/(clip|videos)\b/i.test(url)) return true;
  return false;
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

// ─── Strategy 1a: Username variant search ────────────────────────────────────

/**
 * Build normalized handle variants for bare-handle searches.
 * Uses the mutation engine's normalization category: de-dup consecutive chars,
 * strip separators. These are searched first as they find the victim's own profile
 * mentions — and indirectly surface who is tagging/copying their handle.
 */
function generateHandleVariants(username: string): string[] {
  const mutations = generateUsernameMutations(username, 20);
  return mutations
    .filter((m) => m.patternType === "normalization")
    .map((m) => m.variant);
}

async function searchByUsernameVariants(
  username: string,
  targetPlatforms: string[],
  seen: Set<string>,
  suffixLimit = 5
): Promise<WebSearchCandidate[]> {
  const candidates: WebSearchCandidate[] = [];
  const clean = username.toLowerCase();

  const siteFilter = targetPlatforms
    .map((p) => `site:${PLATFORM_PATTERNS[p]!.host}`)
    .join(" OR ");

  // Build all queries upfront: bare handle + all mutation variants
  const mutations = generateUsernameMutations(clean, suffixLimit + 10);
  const variantsToSearch = mutations.slice(0, suffixLimit).map((m) => m.variant);

  const bareQuery = `"${clean}" (${siteFilter})`;
  const variantQueries = variantsToSearch.map((v) => ({
    variant: v,
    query: `"${v}" (${siteFilter})`,
  }));

  logger.info(
    { username: clean, queries: 1 + variantQueries.length },
    "Username variant searches starting (parallel)"
  );

  // ── Run bare-handle + all variant queries in parallel ─────────────────────
  // JS is single-threaded so the seen Set is safe to update from concurrent
  // .then() callbacks — they are serialised through the microtask queue.
  type QueryResult =
    | { kind: "bare"; items: GoogleSearchItem[] }
    | { kind: "variant"; variant: string; items: GoogleSearchItem[] };

  const tasks: Promise<QueryResult>[] = [
    runGoogleSearch(bareQuery).then((items) => ({ kind: "bare" as const, items })),
    ...variantQueries.map(({ variant, query }) =>
      runGoogleSearch(query).then((items) => ({ kind: "variant" as const, variant, items }))
    ),
  ];

  const results = await Promise.allSettled(tasks);

  for (const r of results) {
    if (r.status === "rejected") continue;
    const { value } = r;

    for (const item of value.items) {
      const extracted = extractUsernameFromUrl(item.link);
      if (!extracted) continue;
      const { username: found, platform } = extracted;
      if (found === clean) continue;
      const key = `${platform}:${found}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const isBare = value.kind === "bare";
      const similarity = found.startsWith(clean) || found.includes(clean)
        ? (isBare ? 0.75 : 0.85)
        : (isBare ? 0.4 : 0.55);

      candidates.push({
        username: found,
        platform,
        profileUrl: item.link,
        title: item.title,
        snippet: item.snippet,
        similarity,
        discoveryMethod: "username_variant",
        datePublished: extractDatePublished(item),
      });
    }
  }

  return candidates;
}

// ─── Strategy 1a-fallback: Direct platform URL probe ─────────────────────────
//
// When CSE is unavailable (403 / not enabled), this strategy constructs profile
// URLs for username variants and probes them directly via HTTP — no API key
// needed. Returns a candidate for every variant whose profile page exists.

const DIRECT_PROBE_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Platform-specific notes on direct probing:
//   X (Twitter) — SSR renders "<DisplayName> (@handle) / X" in <title> for real profiles.
//                  Non-existent profiles return an empty/generic title with no username.
//                  Reliable existence detection: check if variant appears in first 4KB of HTML.
//   Instagram    — Handled by instagramVariantProbe() via internal web profile JSON API.
//                  (HTML page returns 429 from DC IPs; the JSON API endpoint works)
//   TikTok       — Handled by tiktokVariantProbe() via public oEmbed API.
//                  (The SPA page is unreadable; oEmbed returns JSON: 200=exists, 400=not found)
const DIRECT_PROBE_URL_BUILDERS: Record<string, (u: string) => string> = {
  x: (u) => `https://x.com/${u}`,
};

async function directVariantProbe(
  username: string,
  targetPlatforms: string[],
  seen: Set<string>
): Promise<WebSearchCandidate[]> {
  const clean = username.toLowerCase().replace(/^@/, "");

  // Build the full variant list from the mutation engine — top 100 variants covers
  // all normalization forms + most common suffix/prefix patterns for the direct probe.
  const mutationVariants = generateUsernameMutations(clean, 100).map((m) => m.variant);
  const allVariants = [...new Set(mutationVariants)].filter(
    (v) => v !== clean && v.length >= 3 && !/\s/.test(v)
  );

  const probeTargets = targetPlatforms.filter((p) => DIRECT_PROBE_URL_BUILDERS[p]);
  const candidates: WebSearchCandidate[] = [];

  logger.info(
    { username: clean, variants: allVariants.length, platforms: probeTargets },
    "Direct platform URL probe starting (CSE fallback)"
  );

  // Flatten all (platform × variant) pairs then run with concurrency = 8
  type ProbePair = { platform: string; variant: string };
  const pairs: ProbePair[] = [];
  for (const platform of probeTargets) {
    for (const variant of allVariants) {
      const key = `${platform}:${variant}`;
      if (!seen.has(key)) pairs.push({ platform, variant });
    }
  }

  const CONCURRENCY = 8;
  for (let i = 0; i < pairs.length; i += CONCURRENCY) {
    const batch = pairs.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async ({ platform, variant }) => {
        const buildUrl = DIRECT_PROBE_URL_BUILDERS[platform]!;
        const profileUrl = buildUrl(variant);

        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 5000);

          const resp = await fetch(profileUrl, {
            method: "GET",
            redirect: "follow",
            signal: ctrl.signal,
            headers: {
              "User-Agent": DIRECT_PROBE_UA,
              Accept: "text/html,application/xhtml+xml",
            },
          }).finally(() => clearTimeout(timer));

          if (resp.status !== 200) return;

          // Read first 4KB of SSR'd HTML — enough to capture the <title> tag.
          // X (Twitter) SSR-renders "<DisplayName> (@handle) / X" in <title> for real profiles.
          // Non-existent accounts serve a generic page with no username in the title.
          const reader = resp.body?.getReader();
          let html = "";
          if (reader) {
            let bytes = 0;
            while (bytes < 4096) {
              const { value, done } = await reader.read();
              if (done || !value) break;
              html += new TextDecoder().decode(value);
              bytes += value.length;
            }
            await reader.cancel().catch(() => {});
          }

          // Profile must explicitly reference the variant username in the SSR'd HTML.
          // This passes for real X accounts (@handle in title) and fails for non-existent ones.
          if (!html.toLowerCase().includes(variant.toLowerCase())) return;

          const key = `${platform}:${variant}`;
          seen.add(key);
          candidates.push({
            username: variant,
            platform,
            profileUrl,
            title: `${variant} on ${platform}`,
            snippet: `Discovered via direct profile URL probe`,
            similarity: variant.startsWith(clean) || variant.includes(clean) ? 0.82 : 0.58,
            discoveryMethod: "username_variant",
          });
          logger.info({ variant, platform }, "Direct probe: active profile found");
        } catch {
          // Timeout / network error — skip silently
        }
      })
    );

    // Small pause between batches to avoid hammering platforms
    if (i + CONCURRENCY < pairs.length) {
      await new Promise<void>((r) => setTimeout(r, 350));
    }
  }

  logger.info(
    { found: candidates.length, probed: pairs.length, username: clean },
    "Direct platform URL probe complete"
  );
  return candidates;
}

// ─── Strategy 1c: X API direct variant lookup ────────────────────────────────
//
// Uses the Twitter OAuth 2.0 client credentials flow to get an app-only bearer
// token, then batch-looks up up to 100 username variants per request via the
// X API v2 /users/by endpoint. Much faster and more accurate than HTTP probing:
// returns real profile data (followers, display name, bio, created_at) for
// confirmed real accounts only.
//
// Requires: TWITTER_CLIENT_ID + TWITTER_CLIENT_SECRET (client_credentials grant)

let _xBearerToken: string | null = null;
let _xBearerTokenFailing = false;

async function getXBearerToken(): Promise<string | null> {
  if (_xBearerTokenFailing) return null;
  if (_xBearerToken) return _xBearerToken;

  const clientId = process.env["TWITTER_CLIENT_ID"];
  const clientSecret = process.env["TWITTER_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return null;

  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const resp = await fetch("https://api.twitter.com/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${encoded}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      logger.warn({ status: resp.status, body: body.slice(0, 200) }, "X API bearer token fetch failed — disabling X API strategy");
      _xBearerTokenFailing = true;
      return null;
    }

    const data = (await resp.json()) as { access_token?: string; token_type?: string };
    if (!data.access_token) {
      logger.warn({ data }, "X API token response missing access_token");
      _xBearerTokenFailing = true;
      return null;
    }

    _xBearerToken = data.access_token;
    logger.info("X API bearer token acquired successfully");
    return _xBearerToken;
  } catch (err) {
    logger.warn({ err }, "X API bearer token request error — disabling X API strategy");
    _xBearerTokenFailing = true;
    return null;
  }
}

interface XApiUser {
  id: string;
  username: string;
  name: string;
  description?: string;
  created_at?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

async function searchXApiVariants(
  username: string,
  seen: Set<string>
): Promise<WebSearchCandidate[]> {
  const bearerToken = await getXBearerToken();
  if (!bearerToken) return [];

  const clean = username.toLowerCase().replace(/^@/, "");

  // Generate up to 100 mutations, filter to valid X username format (1-15 chars, no spaces)
  const variants = generateUsernameMutations(clean, 100)
    .map((m) => m.variant)
    .filter((v) => v !== clean && /^[A-Za-z0-9_]{1,15}$/.test(v) && v.length >= 3);

  const unique = [...new Set(variants)].filter((v) => !seen.has(`x:${v}`));
  if (unique.length === 0) return [];

  const candidates: WebSearchCandidate[] = [];

  logger.info(
    { username: clean, variants: unique.length },
    "X API variant search starting"
  );

  // Batch in groups of 100 (X API hard limit)
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);

    try {
      const url = new URL("https://api.twitter.com/2/users/by");
      url.searchParams.set("usernames", batch.join(","));
      url.searchParams.set("user.fields", "username,name,description,public_metrics,created_at");

      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${bearerToken}` },
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) {
        logger.warn({ status: resp.status, batch: batch.length }, "X API users/by request failed");
        if (resp.status === 401) {
          _xBearerToken = null;
          _xBearerTokenFailing = true;
        }
        break;
      }

      const data = (await resp.json()) as { data?: XApiUser[]; errors?: unknown[] };

      for (const user of data.data ?? []) {
        const uname = user.username.toLowerCase();
        const key = `x:${uname}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const followers = user.public_metrics?.followers_count ?? 0;
        const similarity =
          uname.includes(clean) || clean.includes(uname) ? 0.85 : 0.60;

        candidates.push({
          username: uname,
          platform: "x",
          profileUrl: `https://x.com/${user.username}`,
          title: `${user.name} (@${user.username}) / X`,
          snippet: user.description?.slice(0, 200) ?? `X account with ${followers} followers`,
          similarity,
          discoveryMethod: "username_variant",
          datePublished: user.created_at,
        });

        logger.info(
          { variant: uname, name: user.name, followers },
          "X API: active profile confirmed"
        );
      }
    } catch (err) {
      logger.warn({ err, batch: batch.length }, "X API variant batch error");
    }
  }

  logger.info(
    { found: candidates.length, checked: unique.length, username: clean },
    "X API variant search complete"
  );

  return candidates;
}

// ─── Strategy 1d: Instagram web profile JSON probe ───────────────────────────
//
// Instagram's internal web profile endpoint returns JSON user data for existing
// accounts without requiring authentication. HTML page probes return 429 from
// data-center IPs, but this JSON API works reliably.
//
// Endpoint: GET /api/v1/users/web_profile_info/?username=<u>
// Success:  200 + { data: { user: { username, full_name, biography, ... } } }
// Not found: 200 with data.user === null, or 404

const INSTAGRAM_PROBE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  "X-IG-App-ID": "936619743392459",
  Accept: "application/json",
};

interface InstagramWebUser {
  username?: string;
  full_name?: string;
  biography?: string;
  edge_followed_by?: { count: number };
}

async function instagramVariantProbe(
  username: string,
  seen: Set<string>
): Promise<WebSearchCandidate[]> {
  const clean = username.toLowerCase().replace(/^@/, "");

  const variants = generateUsernameMutations(clean, 100)
    .map((m) => m.variant)
    .filter((v) => v !== clean && v.length >= 3 && !/[\s.]/.test(v));

  const unique = [...new Set(variants)].filter((v) => !seen.has(`instagram:${v}`));
  if (unique.length === 0) return [];

  const candidates: WebSearchCandidate[] = [];

  logger.info(
    { username: clean, variants: unique.length },
    "Instagram variant probe starting"
  );

  const CONCURRENCY = 4;
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (variant) => {
        const key = `instagram:${variant}`;
        if (seen.has(key)) return;
        try {
          const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(variant)}`;
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 6000);
          const resp = await fetch(url, {
            headers: INSTAGRAM_PROBE_HEADERS,
            signal: ctrl.signal,
          }).finally(() => clearTimeout(timer));

          if (!resp.ok) return;
          const data = await resp
            .json()
            .catch(() => null) as { data?: { user?: InstagramWebUser } } | null;
          const user = data?.data?.user;
          if (!user?.username) return;

          seen.add(key);
          const similarity =
            variant.includes(clean) || clean.includes(variant) ? 0.85 : 0.6;
          candidates.push({
            username: variant,
            platform: "instagram",
            profileUrl: `https://www.instagram.com/${user.username}/`,
            title: user.full_name
              ? `${user.full_name} (@${user.username}) on Instagram`
              : `@${user.username} on Instagram`,
            snippet:
              user.biography?.slice(0, 200) ??
              `Instagram account with ${user.edge_followed_by?.count ?? 0} followers`,
            similarity,
            discoveryMethod: "username_variant",
          });
          logger.info(
            { variant, name: user.full_name, followers: user.edge_followed_by?.count },
            "Instagram probe: active profile confirmed"
          );
        } catch {
          // timeout / network — skip
        }
      })
    );

    if (i + CONCURRENCY < unique.length) {
      await new Promise<void>((r) => setTimeout(r, 500));
    }
  }

  logger.info(
    { found: candidates.length, checked: unique.length, username: clean },
    "Instagram variant probe complete"
  );
  return candidates;
}

// ─── Strategy 1e: TikTok oEmbed direct probe ─────────────────────────────────
//
// TikTok's public oEmbed API returns profile metadata for real accounts and
// a 400 JSON error for non-existent usernames. No authentication required.
//
// Endpoint: GET https://www.tiktok.com/oembed?url=https://www.tiktok.com/@<u>
// Success:  200 + { author_name, author_url, title, thumbnail_url }
// Not found: 400 + { code: 400, message: "Something went wrong" }

interface TikTokOEmbedData {
  author_name?: string;
  author_url?: string;
  title?: string;
  code?: number;
}

async function tiktokVariantProbe(
  username: string,
  seen: Set<string>
): Promise<WebSearchCandidate[]> {
  const clean = username.toLowerCase().replace(/^@/, "");

  const variants = generateUsernameMutations(clean, 100)
    .map((m) => m.variant)
    .filter((v) => v !== clean && v.length >= 3 && !/\s/.test(v));

  const unique = [...new Set(variants)].filter((v) => !seen.has(`tiktok:${v}`));
  if (unique.length === 0) return [];

  const candidates: WebSearchCandidate[] = [];

  logger.info(
    { username: clean, variants: unique.length },
    "TikTok oEmbed probe starting"
  );

  const CONCURRENCY = 5;
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (variant) => {
        const key = `tiktok:${variant}`;
        if (seen.has(key)) return;
        try {
          const profileUrl = `https://www.tiktok.com/@${variant}`;
          const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(profileUrl)}`;
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 6000);
          const resp = await fetch(oembedUrl, {
            headers: { "User-Agent": DIRECT_PROBE_UA },
            signal: ctrl.signal,
          }).finally(() => clearTimeout(timer));

          if (!resp.ok) return; // 400 = doesn't exist
          const data = await resp
            .json()
            .catch(() => null) as TikTokOEmbedData | null;
          if (!data?.author_name) return;

          seen.add(key);
          const similarity =
            variant.includes(clean) || clean.includes(variant) ? 0.85 : 0.6;
          candidates.push({
            username: variant,
            platform: "tiktok",
            profileUrl,
            title: `${data.author_name} (@${variant}) on TikTok`,
            snippet: data.title ?? `TikTok account @${variant} by ${data.author_name}`,
            similarity,
            discoveryMethod: "username_variant",
          });
          logger.info(
            { variant, name: data.author_name },
            "TikTok oEmbed: active profile confirmed"
          );
        } catch {
          // timeout / network — skip
        }
      })
    );

    if (i + CONCURRENCY < unique.length) {
      await new Promise<void>((r) => setTimeout(r, 400));
    }
  }

  logger.info(
    { found: candidates.length, checked: unique.length, username: clean },
    "TikTok oEmbed probe complete"
  );
  return candidates;
}

// ─── Strategy 1b: Display name + normalized handle search ────────────────────
//
// Impersonators of celebrities/influencers almost always claim the person's
// REAL NAME (e.g. "Sophie Rain") rather than copying their exact handle.
// This strategy searches for the display name and/or normalized handle forms
// per platform, finding accounts that a manual human search would find first.

const NAME_SEARCH_PLATFORMS = ["instagram", "facebook", "x", "tiktok"] as const;

async function searchByDisplayNameAndHandle(
  displayName: string | null,
  username: string,
  seen: Set<string>
): Promise<WebSearchCandidate[]> {
  const candidates: WebSearchCandidate[] = [];
  const clean = username.toLowerCase().replace(/^@/, "");
  const normalizedVariants = generateHandleVariants(clean);

  // Queries to run per platform:
  const searchTerms: string[] = [];
  if (displayName && displayName.trim().length >= 3) {
    searchTerms.push(`"${displayName.trim()}"`);
  }
  for (const variant of normalizedVariants) {
    searchTerms.push(`"${variant}"`);
  }
  if (searchTerms.length === 0) return [];

  // Build all (platform × term) query pairs upfront, then run in parallel
  type NameQuery = { query: string; platform: string };
  const nameQueries: NameQuery[] = [];
  for (const platformKey of NAME_SEARCH_PLATFORMS) {
    const config = PLATFORM_PATTERNS[platformKey];
    if (!config) continue;
    const siteStr = `site:${config.host}`;
    for (const term of searchTerms) {
      nameQueries.push({ query: `${term} ${siteStr}`, platform: platformKey });
    }
  }

  logger.info(
    { username: clean, queries: nameQueries.length },
    "Display name / handle searches starting (parallel)"
  );

  const nameResults = await Promise.allSettled(
    nameQueries.map(({ query }) =>
      runGoogleSearch(query).then((items) => ({ items }))
    )
  );

  for (const r of nameResults) {
    if (r.status === "rejected") continue;
    for (const item of r.value.items) {
      const extracted = extractUsernameFromUrl(item.link);
      if (!extracted) continue;

      const { username: found, platform } = extracted;
      if (found === clean) continue;
      if (found === "") continue;

      const key = `${platform}:${found}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const similarity = found.includes(clean) || clean.includes(found)
        ? 0.70
        : normalizedVariants.some((v) => found.includes(v) || v.includes(found))
        ? 0.60
        : 0.40;

      candidates.push({
        username: found,
        platform,
        profileUrl: item.link,
        title: item.title,
        snippet: item.snippet,
        similarity,
        discoveryMethod: "username_variant",
        datePublished: extractDatePublished(item),
      });
    }
  }

  logger.info(
    { count: candidates.length, displayName, normalizedVariants },
    "Display name / handle normalization search complete"
  );

  return candidates;
}

// ─── Strategy 2: Reverse image search via Google Cloud Vision WEB_DETECTION ──
// Sends actual photo content to Google Vision API which returns every public
// page on the web where that image (or a visually similar copy) appears.
// This is true visual reverse image search — completely different from text search.

const VISION_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";
const VISION_DOWNLOAD_TIMEOUT_MS = 8_000;
const VISION_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Try to build a Vision API image object.
 * - First tries imageUri (Vision fetches the URL directly — fastest, no bandwidth used).
 * - Falls back to base64 content if the URI fetch fails (needed for short-lived CDN URLs).
 */
async function buildVisionImagePayload(
  photoUrl: string
): Promise<{ imageUri: string } | { content: string } | null> {
  // Try URI first — Vision can fetch most public CDN URLs directly
  // (Instagram scontent CDNs are publicly accessible without auth)
  return { imageUri: photoUrl };
}

/** Call Vision API for one image. Returns the webDetection block or null on error. */
async function runVisionWebDetection(
  photoUrl: string
): Promise<VisionWebDetection | null> {
  const apiKey = getVisionApiKey();
  if (!apiKey) return null;

  const imagePayload = await buildVisionImagePayload(photoUrl);
  if (!imagePayload) return null;

  const body = {
    requests: [
      {
        image: "imageUri" in imagePayload
          ? { source: { imageUri: imagePayload.imageUri } }
          : { content: imagePayload.content },
        features: [{ type: "WEB_DETECTION", maxResults: 20 }],
      },
    ],
  };

  try {
    const res = await fetch(`${VISION_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as { error?: { message?: string; code?: number } };
      const errCode = errBody.error?.code;
      const errMsg = errBody.error?.message ?? "";

      // 403: Vision API not enabled on this project → fall back silently
      // 400: Invalid image URL → try base64 fallback
      if (errCode === 403) {
        logger.warn(
          { status: res.status, message: errMsg },
          "Cloud Vision API not enabled on this Google project. " +
          "Enable it at console.cloud.google.com to activate reverse image search."
        );
        return null;
      }

      if (errCode === 400 && "imageUri" in imagePayload) {
        // CDN URL not reachable by Vision — download and retry as base64
        logger.info({ photoUrl: photoUrl.slice(0, 60) }, "Vision URI fetch failed, retrying with base64");
        return runVisionWebDetectionBase64(photoUrl, apiKey);
      }

      logger.warn({ status: res.status, message: errMsg, photoUrl: photoUrl.slice(0, 60) },
        "Cloud Vision request failed");
      return null;
    }

    const data = await res.json() as { responses?: Array<VisionAnnotateResponse> };
    const response = data.responses?.[0];
    if (response?.error) {
      logger.warn({ error: response.error, photoUrl: photoUrl.slice(0, 60) }, "Vision response error");
      // Error code 7 = permission denied; error code 3 = invalid image URI → try base64
      if (response.error.code === 3 || response.error.code === 7) {
        return runVisionWebDetectionBase64(photoUrl, apiKey);
      }
      return null;
    }

    return response?.webDetection ?? null;
  } catch (err) {
    logger.warn({ err, photoUrl: photoUrl.slice(0, 60) }, "Cloud Vision request threw");
    return null;
  }
}

/** Base64 fallback: download image locally and send content bytes. */
async function runVisionWebDetectionBase64(
  photoUrl: string,
  apiKey: string
): Promise<VisionWebDetection | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VISION_DOWNLOAD_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(photoUrl, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) return null;

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > VISION_MAX_BYTES) {
      logger.info({ photoUrl: photoUrl.slice(0, 60) }, "Image too large for Vision base64 — skipping");
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > VISION_MAX_BYTES) return null;
    const content = buffer.toString("base64");

    const body = {
      requests: [
        {
          image: { content },
          features: [{ type: "WEB_DETECTION", maxResults: 20 }],
        },
      ],
    };

    const res = await fetch(`${VISION_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;
    const data = await res.json() as { responses?: Array<VisionAnnotateResponse> };
    return data.responses?.[0]?.webDetection ?? null;
  } catch (err) {
    logger.warn({ err, photoUrl: photoUrl.slice(0, 60) }, "Vision base64 fallback failed");
    return null;
  }
}

async function searchByImageUrls(
  photoUrls: string[],
  originalUsername: string,
  targetPlatforms: string[],
  seen: Set<string>
): Promise<WebSearchCandidate[]> {
  if (photoUrls.length === 0 || !isVisionConfigured()) return [];

  const candidates: WebSearchCandidate[] = [];
  const clean = originalUsername.toLowerCase();

  // Sample up to 3 photos to stay within Vision API quota
  const sampleUrls = photoUrls.slice(0, 3);

  for (const photoUrl of sampleUrls) {
    logger.info({ photoUrl: photoUrl.slice(0, 60), username: clean }, "Cloud Vision reverse image search");

    const webDetection = await runVisionWebDetection(photoUrl);
    if (!webDetection) {
      await new Promise<void>((r) => setTimeout(r, 300));
      continue;
    }

    const pagesWithMatch = webDetection.pagesWithMatchingImages ?? [];
    const fullMatches = webDetection.fullMatchingImages ?? [];
    const partialMatches = webDetection.partialMatchingImages ?? [];
    const similarImages = webDetection.visuallySimilarImages ?? [];

    logger.info(
      {
        photoUrl: photoUrl.slice(0, 60),
        pagesWithMatchingImages: pagesWithMatch.length,
        fullMatchingImages: fullMatches.length,
        partialMatchingImages: partialMatches.length,
        visuallySimilarImages: similarImages.length,
      },
      "Cloud Vision web detection complete"
    );

    // ── Strategy A: Pages where your exact image appears ─────────────────────
    // pagesWithMatchingImages = Google confirmed your photo appears on this page.
    // These are the only reliable impersonation signals — the image IS there.
    for (const page of pagesWithMatch) {
      // Skip video content pages — a creator mentioning you in a video (reaction,
      // commentary, news) is NOT an impersonator. The photo appears in a thumbnail
      // or embed, not as a stolen profile picture.
      if (isContentPageUrl(page.url)) {
        logger.info(
          { url: page.url.slice(0, 80) },
          "Skipping content page from image search (video/photo post, not a profile)"
        );
        continue;
      }

      const extracted = extractUsernameFromUrl(page.url);
      if (!extracted) continue;

      const { username: found, platform } = extracted;
      if (found.toLowerCase() === clean) continue; // your own profile
      if (!targetPlatforms.includes(platform)) continue;

      // ── Retweet / share detection (X/Twitter only) ────────────────────────
      // Google Vision returns tweet-level URLs (x.com/user/status/ID) for both
      // original posts and retweets. We rely on the page title to distinguish:
      //   • "RT @username:" prefix → retweet → skip retweeter, pivot to original poster
      //   • No title at all        → ambiguous → skip to avoid false-positives
      //   • Title present, no RT   → treat as original post by that user
      // Profile-level URLs (x.com/username only) are always reliable signals.
      if (platform === "x") {
        const isTweetUrl = /\/status\/\d+/i.test(page.url);
        const pageTitle = page.pageTitle?.trim() ?? "";
        const { context, originalPoster } = detectXPostContext(pageTitle, "");

        if (context === "retweet" || context === "share") {
          logger.info(
            { retweeter: found, originalPoster, pageUrl: page.url.slice(0, 80) },
            "X photo match is a retweet — skipping retweeter"
          );
          // Pivot: flag the original poster, not the retweeter
          if (originalPoster && originalPoster !== clean) {
            const pivotKey = `x:${originalPoster}`;
            if (!seen.has(pivotKey)) {
              seen.add(pivotKey);
              candidates.push({
                username: originalPoster,
                platform: "x",
                profileUrl: `https://x.com/${originalPoster}`,
                title: `@${originalPoster} on X (original poster)`,
                snippet: `Your photo was found in a retweet. @${originalPoster} posted it originally.`,
                similarity: 0.90,
                discoveryMethod: "image_search",
                postContext: "original_post",
              });
              logger.info(
                { originalPoster, platform: "x" },
                "Pivoted retweet match → flagging original poster instead"
              );
            }
          }
          continue; // Skip the retweeter as a threat
        }

        // Tweet-level URL with no page title: we can't verify it's not a retweet.
        // Skip it rather than risk flagging an innocent retweeter.
        if (isTweetUrl && !pageTitle) {
          logger.info(
            { url: page.url.slice(0, 80), user: found },
            "X tweet URL has no page title — skipping to avoid retweet false-positive"
          );
          continue;
        }
      }

      const key = `${platform}:${found}`;
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push({
        username: found,
        platform,
        profileUrl: page.url,
        title: page.pageTitle ?? `${found} on ${platform}`,
        snippet: "Your photo was found on this profile via Google reverse image search",
        similarity: 0.95,
        discoveryMethod: "image_search",
        postContext: "original_post",
      });

      logger.info(
        { username: found, platform, pageUrl: page.url.slice(0, 80) },
        "Confirmed image match: your photo found on this profile page"
      );
    }

    // ── Strategy B: Exact image copies at CDN/image URLs ─────────────────────
    // fullMatchingImages = exact same pixel-level image at a different URL.
    // Some platforms embed the username in their CDN image path.
    for (const img of fullMatches) {
      const extracted = extractUsernameFromUrl(img.url);
      if (!extracted) continue;

      const { username: found, platform } = extracted;
      if (found.toLowerCase() === clean) continue;
      if (!targetPlatforms.includes(platform)) continue;

      const key = `${platform}:${found}`;
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push({
        username: found,
        platform,
        profileUrl: `https://www.${PLATFORM_PATTERNS[platform]?.host ?? platform}/${found}`,
        title: `${found} on ${platform}`,
        snippet: "Exact copy of your photo found at a different URL",
        similarity: 0.98,
        discoveryMethod: "image_search",
        postContext: "original_post",
      });

      logger.info(
        { username: found, platform, imgUrl: img.url.slice(0, 80) },
        "Confirmed full image match: exact pixel-level copy found"
      );
    }

    // NOTE: partialMatchingImages and visuallySimilarImages are intentionally
    // excluded — they produce false positives (photos that merely look similar,
    // not photos that are actually stolen). Only confirmed matches become threats.
    if (pagesWithMatch.length === 0 && fullMatches.length === 0) {
      logger.info(
        {
          partialMatches: partialMatches.length,
          similarImages: similarImages.length,
        },
        "No confirmed matches — similar images found but not treated as stolen (too many false positives)"
      );
    }

    // Vision API: stay within rate limits
    await new Promise<void>((r) => setTimeout(r, 1200));
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

      // Skip X/Twitter results where the snippet shows "RT @" —
      // the caption appeared in a retweet, not an original post by this account.
      if (platform === "x") {
        const { context } = detectXPostContext(item.title, item.snippet);
        if (context === "retweet" || context === "share") {
          logger.info(
            { username: found, platform, snippet: item.snippet.slice(0, 60) },
            "Skipping X retweet/share in caption search"
          );
          continue;
        }
      }

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
        postContext: "original_post",
        datePublished: extractDatePublished(item),
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
  /**
   * Subscription tier — controls how deep the search goes.
   * free: conservative (low cost); pro: standard; premium: maximum depth.
   */
  planTier?: "free" | "pro" | "premium";
  /** User ID — used for per-call cost logging. */
  userId?: string;
  /**
   * Display name (real name) of the user, e.g. "Sophie Rain".
   * Used by Strategy 1b (name search) to find accounts claiming to be this
   * person regardless of their handle. Most impersonators use the real name,
   * not the handle, so this is the highest-signal CSE strategy.
   */
  displayName?: string;
}

/**
 * Search the public web for potential impersonator accounts using three
 * complementary strategies: username variants, reverse image search, and
 * caption text search.
 *
 * Returns deduplicated candidates tagged with the discovery method so the
 * scoring engine can weight each appropriately.
 */
// ─── Tier-based API depth limits ─────────────────────────────────────────────
// Controls how many photos and captions are sent to external APIs per scan.
// Lower tiers use fewer API calls to minimize cost while still providing value.

const TIER_IMAGE_LIMIT: Record<string, number> = { free: 2, pro: 5, premium: 8 };
const TIER_CAPTION_LIMIT: Record<string, number> = { free: 1, pro: 3, premium: 5 };

/** Remove duplicate URLs before sending to Vision API. */
function deduplicateUrls(urls: string[]): string[] {
  return [...new Set(urls)];
}

export async function searchForImpersonators(
  usernameOrOptions: string | SearchImpersonatorsOptions,
  connectedPlatformsArg?: string[]
): Promise<WebSearchCandidate[]> {
  const cseEnabled = isConfigured();
  const visionEnabled = isVisionConfigured();

  // Direct platform probes (Instagram, TikTok, X) work without Google credentials —
  // they use public APIs that require no API key. We only skip entirely if there is
  // genuinely nothing to run (no Google AND no direct probe targets configured).
  const hasDirectProbeCapability = true; // Instagram + TikTok oEmbed always available
  if (!cseEnabled && !visionEnabled && !hasDirectProbeCapability) {
    logger.info(
      {},
      "No search capabilities configured — skipping web search."
    );
    return [];
  }

  // Support both old call signature (string, string[]) and new options object
  let username: string;
  let connectedPlatforms: string[];
  let photoUrls: string[] = [];
  let captions: string[] = [];
  let planTier: "free" | "pro" | "premium" = "free";
  let userId: string | undefined;
  let displayName: string | undefined;

  if (typeof usernameOrOptions === "string") {
    username = usernameOrOptions;
    connectedPlatforms = connectedPlatformsArg ?? [];
  } else {
    username = usernameOrOptions.username;
    connectedPlatforms = usernameOrOptions.connectedPlatforms;
    photoUrls = usernameOrOptions.photoUrls ?? [];
    captions = usernameOrOptions.captions ?? [];
    planTier = usernameOrOptions.planTier ?? "free";
    userId = usernameOrOptions.userId;
    displayName = usernameOrOptions.displayName;
  }

  // Apply tier-based limits — cap images and captions before any API call
  const imageLimit = TIER_IMAGE_LIMIT[planTier] ?? 1;
  const captionLimit = TIER_CAPTION_LIMIT[planTier] ?? 1;
  // Tier-based suffix limit: free=5 (current baseline), pro=15, premium=all
  const TIER_SUFFIX_LIMIT: Record<string, number> = { free: 5, pro: 15, premium: 24 };
  const suffixLimit = TIER_SUFFIX_LIMIT[planTier] ?? 5;

  const cappedPhotoUrls = deduplicateUrls(photoUrls).slice(0, imageLimit);
  const cappedCaptions = captions.slice(0, captionLimit);

  const clean = username.replace(/^@/, "").toLowerCase();
  const seen = new Set<string>();
  const allCandidates: WebSearchCandidate[] = [];

  // Username variant and caption search: target ALL platforms, including connected ones.
  // Impersonators frequently create accounts on the same platform as their victim
  // (e.g., @user_real on Instagram when @user is the real account).
  // The own-username filter inside each strategy already skips exact matches.
  const targetPlatforms = Object.keys(PLATFORM_PATTERNS);

  // Image search: always targets ALL platforms — photo theft can happen on the same platform.
  const allPlatforms = Object.keys(PLATFORM_PATTERNS);

  const hasVariantTargets = targetPlatforms.length > 0; // probe always available
  const hasImageTargets = cappedPhotoUrls.length > 0 && visionEnabled;
  const hasCaptionTargets = cappedCaptions.length > 0 && cseEnabled;
  const hasNameTargets = cseEnabled && (!!displayName || generateHandleVariants(clean).length > 0);

  if (!hasVariantTargets && !hasImageTargets && !hasCaptionTargets && !hasNameTargets) {
    logger.info(
      { username: clean, planTier, imageLimit, captionLimit, visionEnabled, cseEnabled },
      "No web search strategies available — skipping"
    );
    return [];
  }

  logger.info(
    { username: clean, planTier, imageLimit, captionLimit, suffixLimit, photoUrlCount: cappedPhotoUrls.length, displayName },
    "Starting web impersonator search"
  );

  // ── Run all four strategies concurrently ─────────────────────────────────
  // Strategy 1a (username variants), 1b (display name), 2 (vision), and 3
  // (captions) are fully independent — none of their inputs depend on another's
  // output. Running them in parallel cuts wall-clock time to max(each strategy)
  // instead of sum(all strategies). The shared `seen` Set is safe because JS
  // callbacks are serialised through the microtask queue (no true concurrency).

  // Separate seen sets per strategy to avoid cross-contamination during parallel
  // execution; merge all into the shared `seen` at the end.
  const seen1a = new Set<string>(seen);
  const seen1b = new Set<string>(seen);
  const seen1c = new Set<string>(seen);
  const seen1d = new Set<string>(seen);
  const seen1e = new Set<string>(seen);
  const seen2  = new Set<string>(seen);
  const seen3  = new Set<string>(seen);

  type StrategyResult = { tag: string; candidates: WebSearchCandidate[] };

  const strategyTasks: Promise<StrategyResult>[] = [];

  // Strategy 1a: username variant CSE (or direct probe fallback)
  if (cseEnabled && targetPlatforms.length > 0) {
    strategyTasks.push(
      searchByUsernameVariants(clean, targetPlatforms, seen1a, suffixLimit)
        .then((c) => ({ tag: "1a", candidates: c }))
    );
  } else if (!cseEnabled) {
    logger.info({}, "GOOGLE_SEARCH_CX not set — using direct platform URL probe");
    const probeTargets = targetPlatforms.filter((p) => p !== "facebook");
    strategyTasks.push(
      directVariantProbe(clean, probeTargets, seen1a)
        .then((c) => ({ tag: "1a_probe", candidates: c }))
    );
  }

  // Strategy 1c: X API direct variant lookup (always runs when Twitter credentials are set)
  // Batch-checks up to 100 username variants via the official X API v2 — faster and
  // more accurate than HTTP probing, and independent of CSE/Google.
  if (targetPlatforms.includes("x") && (process.env["TWITTER_CLIENT_ID"] || process.env["TWITTER_CLIENT_SECRET"])) {
    strategyTasks.push(
      searchXApiVariants(clean, seen1c)
        .then((c) => ({ tag: "1c_xapi", candidates: c }))
    );
  }

  // Strategy 1d: Instagram web profile JSON probe (always runs for instagram targets)
  // Uses Instagram's internal web profile API endpoint — no auth required, works from
  // server IPs (unlike the HTML page which 429s from data-center addresses).
  if (targetPlatforms.includes("instagram")) {
    strategyTasks.push(
      instagramVariantProbe(clean, seen1d)
        .then((c) => ({ tag: "1d_instagram", candidates: c }))
    );
  }

  // Strategy 1e: TikTok oEmbed direct probe (always runs for tiktok targets)
  // Uses TikTok's public oEmbed API — no auth required, returns JSON indicating
  // whether a profile exists (200) or not (400). Covers all username variants.
  if (targetPlatforms.includes("tiktok")) {
    strategyTasks.push(
      tiktokVariantProbe(clean, seen1e)
        .then((c) => ({ tag: "1e_tiktok", candidates: c }))
    );
  }

  // Strategy 1b: display name + normalized handle
  if (hasNameTargets) {
    strategyTasks.push(
      searchByDisplayNameAndHandle(displayName ?? null, clean, seen1b)
        .then((c) => ({ tag: "1b", candidates: c }))
    );
  }

  // Strategy 2: Cloud Vision reverse image search
  if (cappedPhotoUrls.length > 0 && visionEnabled) {
    logger.info({ imageCount: cappedPhotoUrls.length, planTier }, "Running reverse image search (tier-limited)");
    strategyTasks.push(
      searchByImageUrls(cappedPhotoUrls, clean, allPlatforms, seen2)
        .then((c) => ({ tag: "2", candidates: c }))
    );
  } else if (cappedPhotoUrls.length === 0) {
    logger.info({ username: clean }, "No photo URLs — reverse image search skipped");
  } else {
    logger.info({ username: clean }, "Cloud Vision not configured — reverse image search skipped");
  }

  // Strategy 3: caption text search
  if (cappedCaptions.length > 0 && cseEnabled) {
    strategyTasks.push(
      searchByCaptions(cappedCaptions, clean, targetPlatforms, seen3)
        .then((c) => ({ tag: "3", candidates: c }))
    );
  }

  const strategyResults = await Promise.allSettled(strategyTasks);

  // Merge results, deduplicating across strategies using the shared `seen` set
  for (const r of strategyResults) {
    if (r.status === "rejected") {
      logger.warn({ err: r.reason }, "Search strategy failed (non-fatal)");
      continue;
    }
    const { tag, candidates } = r.value;

    // CSE fallback: if strategy 1a via CSE returned 0 and CSE is failing, run direct probe
    if (tag === "1a" && candidates.length === 0 && cseFailing) {
      const probeTargets = targetPlatforms.filter((p) => p !== "facebook");
      const probeCandidates = await directVariantProbe(clean, probeTargets, seen);
      allCandidates.push(...probeCandidates);
      probeCandidates.forEach((c) => seen.add(`${c.platform}:${c.username}`));
      continue;
    }

    for (const c of candidates) {
      const key = `${c.platform}:${c.username}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allCandidates.push(c);
    }

    // Track API costs
    if (userId) {
      if (tag === "1a") {
        const n = 1 + suffixLimit;
        for (let i = 0; i < n; i++) trackApiCall({ userId, provider: "google_cse", operation: "username_variant_search" });
      } else if (tag === "1b") {
        for (let i = 0; i < candidates.length; i++) trackApiCall({ userId, provider: "google_cse", operation: "name_handle_search" });
      } else if (tag === "2") {
        for (let i = 0; i < cappedPhotoUrls.length; i++) trackApiCall({ userId, provider: "google_vision", operation: "image_reverse_search" });
      } else if (tag === "3") {
        for (let i = 0; i < cappedCaptions.length; i++) trackApiCall({ userId, provider: "google_cse", operation: "caption_search" });
      }
    }
  }

  logger.info(
    {
      username: clean,
      planTier,
      imageLimit,
      total: allCandidates.length,
      byMethod: {
        username_variant: allCandidates.filter((c) => c.discoveryMethod === "username_variant").length,
        image_search: allCandidates.filter((c) => c.discoveryMethod === "image_search").length,
        caption_search: allCandidates.filter((c) => c.discoveryMethod === "caption_search").length,
      },
    },
    "Web impersonator search complete"
  );

  return allCandidates;
}

// ─── On-demand photo reverse search (used by POST /photos/search) ─────────────

/**
 * Perform a standalone reverse image search for a single photo.
 * Accepts either a public HTTPS URL (from a connected account CDN) or a
 * base64-encoded image string (from the device camera roll via the mobile app).
 *
 * Returns all discovered social-platform candidates where the image was found.
 * The caller is responsible for filtering out the user's own accounts.
 */
export async function reverseImageSearchForPhoto(input: {
  imageUrl?: string;
  imageBase64?: string;
}): Promise<{ matches: WebSearchCandidate[] }> {
  const apiKey = getVisionApiKey();
  if (!apiKey) return { matches: [] };

  let webDetection: VisionWebDetection | null = null;

  if (input.imageUrl) {
    webDetection = await runVisionWebDetection(input.imageUrl);
  } else if (input.imageBase64) {
    // Direct base64 path — mobile camera roll photo sent as content bytes
    const body = {
      requests: [
        {
          image: { content: input.imageBase64 },
          features: [{ type: "WEB_DETECTION", maxResults: 20 }],
        },
      ],
    };
    try {
      const res = await fetch(`${VISION_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = (await res.json()) as { responses?: Array<VisionAnnotateResponse> };
        const response = data.responses?.[0];
        if (response?.error) {
          logger.warn({ error: response.error }, "Vision base64 direct search: response-level error");
        } else {
          webDetection = response?.webDetection ?? null;
        }
      } else {
        const errBody = await res.json().catch(() => ({})) as { error?: { message?: string; code?: number } };
        logger.warn(
          { status: res.status, message: errBody.error?.message, code: errBody.error?.code },
          "Vision base64 direct search: non-OK HTTP response"
        );
      }
    } catch (err) {
      logger.warn({ err }, "Vision base64 direct search threw");
    }
  }

  if (!webDetection) return { matches: [] };

  const candidates: WebSearchCandidate[] = [];
  const seen = new Set<string>();

  for (const page of webDetection.pagesWithMatchingImages ?? []) {
    const extracted = extractUsernameFromUrl(page.url);
    if (!extracted) continue;
    const key = `${extracted.platform}:${extracted.username}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Use the nested image URL (actual photo) for display; page.url for opening in browser
    const nestedImageUrl =
      page.fullMatchingImages?.[0]?.url ??
      page.partialMatchingImages?.[0]?.url;
    candidates.push({
      username: extracted.username,
      platform: extracted.platform,
      profileUrl: page.url,
      imageUrl: nestedImageUrl,
      title: page.pageTitle ?? `${extracted.username} on ${extracted.platform}`,
      snippet: "Your photo was found on this profile via Google reverse image search",
      similarity: page.score ?? 0.92,
      discoveryMethod: "image_search",
    });
  }

  for (const img of webDetection.fullMatchingImages ?? []) {
    const extracted = extractUsernameFromUrl(img.url);
    if (!extracted) continue;
    const key = `${extracted.platform}:${extracted.username}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      username: extracted.username,
      platform: extracted.platform,
      profileUrl: img.url,
      imageUrl: img.url,
      title: `${extracted.username} on ${extracted.platform}`,
      snippet: "Exact copy of your photo found at this URL",
      similarity: img.score ?? 0.98,
      discoveryMethod: "image_search",
    });
  }

  logger.info({ found: candidates.length }, "reverseImageSearchForPhoto complete");
  return { matches: candidates };
}
