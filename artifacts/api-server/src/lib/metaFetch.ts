import { logger } from "./logger";

const META_TIMEOUT_MS = 10_000;
const META_MAX_RETRIES = 2;

/**
 * Redact sensitive query parameters from a URL string before logging.
 * Covers client_secret, access_token, fb_exchange_token.
 */
function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    const sensitive = ["client_secret", "access_token", "fb_exchange_token", "client_id"];
    for (const key of sensitive) {
      if (u.searchParams.has(key)) u.searchParams.set(key, "[REDACTED]");
    }
    return u.toString();
  } catch {
    return "[unparseable url]";
  }
}

/**
 * Fetch wrapper for all Meta (Facebook / Instagram) API calls.
 *
 * - 10-second AbortController timeout per attempt.
 * - Automatic exponential-backoff retry on HTTP 429 (rate-limited):
 *   attempt 0 → 100 ms wait, attempt 1 → 200 ms wait.
 * - Up to META_MAX_RETRIES retries (3 total attempts).
 * - All other HTTP statuses are returned directly to the caller.
 * - Sensitive query params (client_secret, access_token) are redacted before logging.
 */
export async function metaFetch(url: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  const safeUrl = redactUrl(url);

  for (let attempt = 0; attempt <= META_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), META_TIMEOUT_MS);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      if (response.status === 429 && attempt < META_MAX_RETRIES) {
        const backoffMs = 100 * 2 ** attempt;
        logger.warn({ url: safeUrl, attempt, backoffMs }, "Meta API rate-limited (429) — retrying");
        await new Promise<void>((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      return response;
    } catch (err: unknown) {
      clearTimeout(timer);
      lastError = err;

      if (attempt < META_MAX_RETRIES) {
        const backoffMs = 100 * 2 ** attempt;
        logger.warn({ url: safeUrl, attempt, backoffMs, err }, "Meta API fetch error — retrying");
        await new Promise<void>((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError;
}
