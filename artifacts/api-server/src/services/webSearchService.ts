/**
 * Web Search Service — Impersonator Discovery
 *
 * Three complementary discovery strategies:
 *
 * 1. USERNAME VARIANT SEARCH  — Google CSE text search for known suffix patterns
 *    (catches: @user.official, @user_real, @user0fficial, etc.)
 *    Requires: GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX
 *
 * 2. REVERSE IMAGE SEARCH     — Google Cloud Vision WEB_DETECTION
 *    Sends actual photo pixels to Google Vision; returns every public page
 *    where that image (or a visually similar one) appears.
 *    (catches: completely different usernames that stole your photos)
 *    Requires: GOOGLE_SEARCH_API_KEY with Cloud Vision API enabled on the project
 *    Pricing: $1.50 per 1,000 images (first 1,000/mo free)
 *
 * 3. CAPTION TEXT SEARCH      — Google CSE verbatim text search
 *    (catches: accounts that copy your post text with no username overlap)
 *    Requires: GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX
 *
 * Setup:
 *   1. console.cloud.google.com → enable "Custom Search API" + "Cloud Vision API"
 *   2. programmablesearchengine.google.com → create engine → "Search the entire web"
 *   3. Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX
 */

import { logger } from "../lib/logger";
import { trackApiCall } from "./costTracker";

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

/** Username variant + caption search requires CSE (key + cx). */
export function isConfigured(): boolean {
  return !!(
    process.env["GOOGLE_SEARCH_API_KEY"] && process.env["GOOGLE_SEARCH_CX"]
  );
}

/** Reverse image search uses Cloud Vision API — same key, Vision API must be enabled on the project. */
export function isVisionConfigured(): boolean {
  return !!(process.env["GOOGLE_SEARCH_API_KEY"]);
}

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

/**
 * Detect whether an X/Twitter page result represents an original post,
 * a retweet, or a share — based on the page title Google returns.
 *
 * Standard retweet format Google indexes: "RT @username: tweet text"
 * Quote tweets sometimes appear as "username on X: "RT @…""
 */
function detectXPostContext(title: string, snippet: string): {
  context: "original_post" | "retweet" | "share" | "unknown";
  originalPoster?: string;
} {
  const combined = `${title} ${snippet}`;
  const rtMatch = combined.match(/\bRT @(\w+)/i);
  if (rtMatch && rtMatch[1]) {
    return { context: "retweet", originalPoster: rtMatch[1].toLowerCase() };
  }
  if (/\bQT @(\w+)/i.test(combined)) {
    return { context: "share" };
  }
  return { context: "original_post" };
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
  const apiKey = process.env["GOOGLE_SEARCH_API_KEY"];
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
      const extracted = extractUsernameFromUrl(page.url);
      if (!extracted) continue;

      const { username: found, platform } = extracted;
      if (found.toLowerCase() === clean) continue; // your own profile
      if (!targetPlatforms.includes(platform)) continue;

      // ── Retweet / share detection (X/Twitter only) ────────────────────────
      // Google indexes retweet pages under the retweeter's profile URL, but
      // the page title starts with "RT @originaluser:" — they are NOT the thief.
      // Skip retweeters entirely; pivot to the original poster if detectable.
      if (platform === "x") {
        const { context, originalPoster } = detectXPostContext(
          page.pageTitle ?? "",
          ""
        );
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

const TIER_IMAGE_LIMIT: Record<string, number> = { free: 1, pro: 3, premium: 5 };
const TIER_CAPTION_LIMIT: Record<string, number> = { free: 1, pro: 2, premium: 3 };

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

  if (!cseEnabled && !visionEnabled) {
    logger.info(
      {},
      "No Google API key configured — skipping web search. Set GOOGLE_SEARCH_API_KEY to enable."
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
  }

  // Apply tier-based limits — cap images and captions before any API call
  const imageLimit = TIER_IMAGE_LIMIT[planTier] ?? 1;
  const captionLimit = TIER_CAPTION_LIMIT[planTier] ?? 1;
  const cappedPhotoUrls = deduplicateUrls(photoUrls).slice(0, imageLimit);
  const cappedCaptions = captions.slice(0, captionLimit);

  const clean = username.replace(/^@/, "").toLowerCase();
  const seen = new Set<string>();
  const allCandidates: WebSearchCandidate[] = [];

  // Username variant search: only check platforms the user is NOT already on.
  const targetPlatforms = Object.keys(PLATFORM_PATTERNS).filter(
    (p) => !connectedPlatforms.includes(p)
  );

  // Image search: always targets ALL platforms — photo theft can happen on the same platform.
  const allPlatforms = Object.keys(PLATFORM_PATTERNS);

  const hasVariantTargets = targetPlatforms.length > 0 && cseEnabled;
  const hasImageTargets = cappedPhotoUrls.length > 0 && visionEnabled;
  const hasCaptionTargets = cappedCaptions.length > 0 && cseEnabled;

  if (!hasVariantTargets && !hasImageTargets && !hasCaptionTargets) {
    logger.info(
      { username: clean, planTier, imageLimit, captionLimit, visionEnabled, cseEnabled },
      "No web search strategies available — skipping"
    );
    return [];
  }

  logger.info(
    { username: clean, planTier, imageLimit, captionLimit, photoUrlCount: cappedPhotoUrls.length },
    "Starting web impersonator search"
  );

  // ── Strategy 1: Username variants (CSE) ───────────────────────────────────
  if (cseEnabled && targetPlatforms.length > 0) {
    const variantCandidates = await searchByUsernameVariants(clean, targetPlatforms, seen);
    allCandidates.push(...variantCandidates);
    // Track CSE cost: 5 suffix queries × 1 call each
    if (userId) {
      const cseCallCount = Math.min(5, IMPERSONATION_SUFFIXES.length);
      for (let i = 0; i < cseCallCount; i++) {
        trackApiCall({ userId, provider: "google_cse", operation: "username_variant_search" });
      }
    }
  } else if (!cseEnabled) {
    logger.info({}, "GOOGLE_SEARCH_CX not set — username variant search skipped");
  } else {
    logger.info({ username: clean }, "All platforms connected — username variant search skipped (Vision still runs)");
  }

  // ── Strategy 2: Cloud Vision reverse image search (tier-limited) ──────────
  if (cappedPhotoUrls.length > 0 && visionEnabled) {
    logger.info(
      { imageCount: cappedPhotoUrls.length, planTier },
      "Running reverse image search (tier-limited)"
    );
    const imageCandidates = await searchByImageUrls(cappedPhotoUrls, clean, allPlatforms, seen);
    allCandidates.push(...imageCandidates);
    // Track Vision cost: one call per image
    if (userId) {
      for (let i = 0; i < cappedPhotoUrls.length; i++) {
        trackApiCall({ userId, provider: "google_vision", operation: "image_reverse_search" });
      }
    }
  } else if (cappedPhotoUrls.length === 0) {
    logger.info({ username: clean }, "No photo URLs — reverse image search skipped");
  } else {
    logger.info({ username: clean }, "Cloud Vision not configured — reverse image search skipped");
  }

  // ── Strategy 3: Caption text search (tier-limited) ────────────────────────
  if (cappedCaptions.length > 0 && cseEnabled) {
    const captionCandidates = await searchByCaptions(cappedCaptions, clean, targetPlatforms, seen);
    allCandidates.push(...captionCandidates);
    // Track CSE cost: one call per caption query
    if (userId) {
      for (let i = 0; i < cappedCaptions.length; i++) {
        trackApiCall({ userId, provider: "google_cse", operation: "caption_search" });
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
  const apiKey = process.env["GOOGLE_SEARCH_API_KEY"];
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
