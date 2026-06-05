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

    // Collect all page URLs that have this image (exact + partial matches)
    const matchingPages: VisionWebPage[] = [
      ...(webDetection.pagesWithMatchingImages ?? []),
    ];

    // Also check visuallySimilarImages URLs directly (some point to profile pages)
    const similarImageUrls: string[] = [
      ...(webDetection.fullMatchingImages ?? []).map((i) => i.url),
      ...(webDetection.partialMatchingImages ?? []).map((i) => i.url),
      ...(webDetection.visuallySimilarImages ?? []).map((i) => i.url),
    ];

    // Try to extract platform usernames from image URLs themselves
    // (some platforms embed username in image CDN path)
    for (const imgUrl of similarImageUrls) {
      const extracted = extractUsernameFromUrl(imgUrl);
      if (!extracted) continue;
      const { username: found, platform } = extracted;
      if (found === clean || !targetPlatforms.includes(platform)) continue;
      const key = `${platform}:${found}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        username: found,
        platform,
        profileUrl: `https://www.${PLATFORM_PATTERNS[platform]?.host ?? platform}/${found}`,
        title: `${found} on ${platform}`,
        snippet: "Profile photo visually matched via Cloud Vision",
        similarity: 0.0,
        discoveryMethod: "image_search",
      });
    }

    // Extract usernames from matching page URLs (most reliable — actual profile pages)
    for (const page of matchingPages) {
      const extracted = extractUsernameFromUrl(page.url);
      if (!extracted) continue;

      const { username: found, platform } = extracted;
      if (found === clean) continue;
      if (!targetPlatforms.includes(platform)) continue;

      const key = `${platform}:${found}`;
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push({
        username: found,
        platform,
        profileUrl: page.url,
        title: page.pageTitle ?? `${found} on ${platform}`,
        snippet: "Profile photo found via Cloud Vision reverse image search",
        similarity: 0.0,
        discoveryMethod: "image_search",
      });
    }

    logger.info(
      {
        photoUrl: photoUrl.slice(0, 60),
        pagesWithMatchingImages: webDetection.pagesWithMatchingImages?.length ?? 0,
        visuallySimilarImages: webDetection.visuallySimilarImages?.length ?? 0,
        candidatesFound: candidates.length,
      },
      "Cloud Vision web detection complete"
    );

    // Vision API: 1,800ms between requests to stay within 1 req/s rate limit
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

  // Username variant search: only check platforms the user is NOT already on.
  // (There's no point searching instagram.com for "@user.official" if user is verified on IG.)
  const targetPlatforms = Object.keys(PLATFORM_PATTERNS).filter(
    (p) => !connectedPlatforms.includes(p)
  );

  // Image search: always targets ALL platforms, including connected ones.
  // An impersonator can steal your photos and post them on the SAME platform
  // under a completely different username — Vision catches this regardless.
  const allPlatforms = Object.keys(PLATFORM_PATTERNS);

  // Short-circuit only if there are no targets for any strategy
  const hasVariantTargets = targetPlatforms.length > 0 && cseEnabled;
  const hasImageTargets = photoUrls.length > 0 && visionEnabled;
  const hasCaptionTargets = captions.length > 0 && cseEnabled;

  if (!hasVariantTargets && !hasImageTargets && !hasCaptionTargets) {
    logger.info(
      { username: clean, allPlatformsConnected: targetPlatforms.length === 0, hasPhotos: photoUrls.length > 0, visionEnabled, cseEnabled },
      "No web search strategies available — skipping"
    );
    return [];
  }

  // Strategy 1: Username variants (requires CSE key + CX, unconnected platforms only)
  if (cseEnabled && targetPlatforms.length > 0) {
    const variantCandidates = await searchByUsernameVariants(clean, targetPlatforms, seen);
    allCandidates.push(...variantCandidates);
  } else if (!cseEnabled) {
    logger.info({}, "GOOGLE_SEARCH_CX not set — username variant search skipped");
  } else {
    logger.info({ username: clean }, "All platforms connected — username variant search skipped (Vision still runs)");
  }

  // Strategy 2: Cloud Vision reverse image search (requires only API key)
  // Finds stolen photos posted under completely different usernames on ANY platform.
  // Runs even when all platforms are connected — photo theft can happen on the same platform.
  if (photoUrls.length > 0 && visionEnabled) {
    const imageCandidates = await searchByImageUrls(photoUrls, clean, allPlatforms, seen);
    allCandidates.push(...imageCandidates);
  } else if (photoUrls.length === 0) {
    logger.info({ username: clean }, "No photo URLs provided — reverse image search skipped");
  } else {
    logger.info({ username: clean }, "Cloud Vision not configured — reverse image search skipped");
  }

  // Strategy 3: Caption text fingerprint search (requires CSE key + CX)
  if (captions.length > 0 && cseEnabled) {
    const captionCandidates = await searchByCaptions(captions, clean, targetPlatforms, seen);
    allCandidates.push(...captionCandidates);
  }

  logger.info(
    {
      username: clean,
      total: allCandidates.length,
      cseEnabled,
      visionEnabled,
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
