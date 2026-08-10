/**
 * SSRF Protection — URL validation for any server-side URL fetch.
 *
 * Blocks requests to:
 *  - localhost / loopback (127.x, ::1)
 *  - Private RFC-1918 ranges (10.x, 172.16-31.x, 192.168.x)
 *  - Link-local (169.254.x — AWS/GCP metadata endpoint)
 *  - IPv6 unique-local (fc00::/7) and link-local (fe80::/10)
 *  - Cloud metadata endpoints
 *  - file:// and non-HTTP(S) schemes
 *
 * Use this before any fetch() call that processes a URL originating from
 * external search results, user input, or stored CDN URLs.
 */

// Matches private/loopback IPv4 addresses and special hostnames
const PRIVATE_IPV4_RE =
  /^(127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|0\.0\.0\.0)$/i;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
  "169.254.169.254",
  "instance-data",
  "computemetadata",
]);

export class SsrfBlockedError extends Error {
  constructor(url: string, reason: string) {
    super(`SSRF blocked: ${reason} (url=${url})`);
    this.name = "SsrfBlockedError";
  }
}

/**
 * Validate a URL before fetching it server-side.
 * Throws SsrfBlockedError if the URL targets a private/internal network.
 * Returns the parsed URL object for convenience.
 */
export function validateFetchUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError(rawUrl, "Invalid URL");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new SsrfBlockedError(rawUrl, `Disallowed scheme: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new SsrfBlockedError(rawUrl, `Blocked hostname: ${hostname}`);
  }

  if (PRIVATE_IPV4_RE.test(hostname)) {
    throw new SsrfBlockedError(rawUrl, `Private/loopback IP: ${hostname}`);
  }

  // Block IPv6 loopback and private ranges
  if (
    hostname === "::1" ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd") ||
    hostname.startsWith("fe80")
  ) {
    throw new SsrfBlockedError(rawUrl, `Private IPv6: ${hostname}`);
  }

  return parsed;
}

/**
 * Validate a URL for SSRF risks without throwing — returns a boolean.
 * Use this when you want to filter rather than abort on bad URLs.
 */
export function isSafeUrl(rawUrl: string): boolean {
  try {
    validateFetchUrl(rawUrl);
    return true;
  } catch {
    return false;
  }
}
