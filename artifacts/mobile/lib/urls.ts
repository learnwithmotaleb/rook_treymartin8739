export type UrlPlatform = "web" | "native";

export interface AppUrlOptions {
  apiUrl?: string;
  domain?: string;
  platform: UrlPlatform;
  browserOrigin?: string;
  nativeProduction?: boolean;
}

function parseOrigin(value: string | undefined, allowHttp: boolean): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const validProtocol = url.protocol === "https:" || (allowHttp && url.protocol === "http:");
    if (
      !validProtocol ||
      !url.hostname ||
      url.username ||
      url.password ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function parseDomain(domain: string | undefined): string | null {
  if (!domain) return null;
  const value = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  return parseOrigin(value, false);
}

export function resolveAppOrigin(options: AppUrlOptions): string | null {
  const configuredApiOrigin = parseOrigin(options.apiUrl, false);
  if (configuredApiOrigin) return configuredApiOrigin;

  // Production native builds must use their explicitly configured, verified API
  // origin. Preview builds may instead use the workflow domain.
  if (options.platform === "native" && options.nativeProduction) return null;

  const domainOrigin = parseDomain(options.domain);
  if (domainOrigin) return domainOrigin;

  if (options.platform === "web") {
    return parseOrigin(options.browserOrigin, true);
  }
  return null;
}

export function resolveApiBaseUrl(options: AppUrlOptions): string {
  const origin = resolveAppOrigin(options);
  if (origin) return `${origin}/api`;

  if (options.platform === "web") return "/api";
  if (options.nativeProduction) {
    throw new Error(
      "Production API is not configured. Set EXPO_PUBLIC_API_URL to an absolute HTTPS URL."
    );
  }
  throw new Error(
    "Native API is not configured. Set EXPO_PUBLIC_API_URL or EXPO_PUBLIC_DOMAIN to an absolute HTTPS URL."
  );
}

export function validateAppPath(path: string): string {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    path.includes("\n") ||
    path.includes("\r")
  ) {
    throw new Error("App URL path must be a local absolute path.");
  }
  return path;
}