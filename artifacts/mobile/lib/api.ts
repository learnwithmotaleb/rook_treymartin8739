/**
 * Rook API Client
 *
 * Calls the backend intelligence system at /api/*
 * Native production builds require EXPO_PUBLIC_API_URL to be a verified,
 * absolute HTTPS URL. Development may use the Expo workflow domain.
 */

import { Platform } from "react-native";

function absoluteHttpsUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
      return null;
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function getBaseUrl(): string {
  const configuredApiUrl = absoluteHttpsUrl(process.env.EXPO_PUBLIC_API_URL);
  if (configuredApiUrl) return `${configuredApiUrl}/api`;

  const isNativeProduction =
    Platform.OS !== "web" && process.env.EXPO_PUBLIC_APP_ENV === "production";
  if (isNativeProduction) {
    throw new Error(
      "Production API is not configured. Set EXPO_PUBLIC_API_URL to an absolute HTTPS URL."
    );
  }

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const domainUrl = domain
    ? absoluteHttpsUrl(domain.startsWith("http") ? domain : `https://${domain}`)
    : null;
  if (domainUrl) return `${domainUrl}/api`;

  if (Platform.OS !== "web") {
    throw new Error(
      "Native API is not configured. Set EXPO_PUBLIC_API_URL or EXPO_PUBLIC_DOMAIN to an absolute HTTPS URL."
    );
  }

  return "/api";
}

const API_TIMEOUT_MS = 15_000;

let _authTokenGetter: (() => Promise<string | null>) | null = null;

export function setApiAuthToken(getter: () => Promise<string | null>) {
  _authTokenGetter = getter;
}

/**
 * Returns true if no Clerk token is available — mirrors the server-side
 * `isDemoUser = !user.clerkId` guard in scanOrchestrator.ts.
 * Demo users see simulated threats; real users should never see fabricated ones.
 */
export async function checkIsDemoUser(): Promise<boolean> {
  if (!_authTokenGetter) return true;
  const token = await _authTokenGetter();
  return !token;
}

/** Thrown when the server returns 429 scan_limit_reached. */
export class ScanQuotaError extends Error {
  readonly reason: string;
  readonly tier: string;
  readonly upgradeTo: string;
  readonly userMessage: string;
  constructor(payload: { reason: string; tier: string; upgradeTo: string; message: string }) {
    super(payload.message);
    this.name = "ScanQuotaError";
    this.reason = payload.reason;
    this.tier = payload.tier;
    this.upgradeTo = payload.upgradeTo;
    this.userMessage = payload.message;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const controller = new AbortController();
  const abortForCaller = () => controller.abort();
  if (options.signal?.aborted) {
    controller.abort();
  } else {
    options.signal?.addEventListener("abort", abortForCaller, { once: true });
  }
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const authHeaders: Record<string, string> = {};
  try {
    if (_authTokenGetter) {
      const token = await _authTokenGetter();
      if (token) authHeaders["Authorization"] = `Bearer ${token}`;
    }
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...(options.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => ({ error: "Request failed" })) as Record<string, unknown>;

      // Surface structured quota errors so the UI can show the upgrade prompt
      if (response.status === 429 && body["error"] === "scan_limit_reached") {
        throw new ScanQuotaError({
          reason: String(body["reason"] ?? "monthly_limit"),
          tier: String(body["tier"] ?? "free"),
          upgradeTo: String(body["upgradeTo"] ?? "pro"),
          message: String(body["message"] ?? "Scan limit reached. Upgrade to continue."),
        });
      }

      throw new Error(String(body["error"] ?? `HTTP ${response.status}`));
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Request timed out. Check your connection and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortForCaller);
  }
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarInitials: string;
  tier: Tier;
  securityScore: number;
  scoreTrend: number;
  monitored: number;
  onboardingCompleted: boolean;
  lastScan: string;
  totalPhotosIndexed: number;
  totalCaptionsIndexed: number;
  /** The terms version the user last accepted, or null if never accepted. */
  termsVersion?: string | null;
  reelsIndexed: number;
  fingerprintUpdated: string;
}

export interface AccountProfile {
  id: string;
  platform: string;
  username: string;
  displayName: string | null;
  followers: number;
  verified: boolean;
  needsReconnect: boolean;
  photosIndexed: number;
  captionsIndexed: number;
  reelsIndexed: number;
  lastSynced: string | null;
}

export interface AccountStatus {
  verified: boolean;
  tokenExpiresAt: string | null;
  needsReconnect: boolean;
  scopesGranted: string[];
}

export interface ScanJob {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  currentStep: string | null;
  threatsFound: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ThreatSummary {
  id: string;
  scanJobId: string | null;
  type: string;
  severity: "high" | "medium" | "low";
  platform: string | null;
  title: string;
  description: string;
  threatScore: number;
  matchedMediaCount: number;
  evidenceCount?: number;
  suspiciousUsername: string | null;
  resolved: boolean;
  resolveAction: string | null;
  resolvedAt: string | null;
  highConfidence?: boolean;
  createdAt: string;
}

export interface ThreatDetail extends ThreatSummary {
  details: string;
  aiExplanation: string;
  evidence: Array<{
    id: string;
    type: "profile_photo" | "post_photo" | "reel_thumbnail" | "caption";
    similarity: number;
    label: string;
    yourCaption?: string;
    stolenCaption?: string;
    yourPhotoUrl?: string;
    stolenPhotoUrl?: string;
  }>;
  scoreBreakdown: {
    mediaSimilarity: number;
    contentReuse: number;
    profileSimilarity: number;
    bioSimilarity: number;
    usernameSimilarity: number;
    behavioral: number;
  };
  /**
   * Impersonator account quality data captured at scan time.
   * Null for threats detected before Phase 11 (no retroactive backfill).
   */
  accountMeta?: {
    followers: number;
    following?: number;
    totalPosts?: number;
    accountAgeDays?: number;
    engagementRate?: number;
  } | null;
  detectedSignals: string[];
  confirmedVictims: number | null;
  crossUserEscalation: boolean;
  postDatingDays: number | null;
  resolvedAt: string | null;
  /** Collective intelligence data from the shared threat actor corpus. */
  threatActor?: {
    id: string;
    victimCount: number;
    platformSpread: string[];
    firstSeen: string;
    lastSeen: string;
    confidenceScore: number;
  };
}

export async function getMe(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/me");
}

export async function updateMe(updates: {
  name?: string;
  username?: string;
  email?: string;
}): Promise<UserProfile> {
  return apiFetch<UserProfile>("/me", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

// Current terms version — bump whenever Terms / Privacy Policy is materially updated.
// Users with a stored version older than this see TermsUpdateModal on next launch.
export const CURRENT_TERMS_VERSION = "2026-08-10-v2";

// Age confirmation version — bump when the age requirement wording changes.
export const CURRENT_AGE_VERSION = "1.0";

export async function recordTermsAcceptance(): Promise<void> {
  await apiFetch<{ ok: boolean }>("/me/terms", {
    method: "POST",
    body: JSON.stringify({ termsVersion: CURRENT_TERMS_VERSION }),
  });
}

export async function recordAgeConfirmation(): Promise<void> {
  await apiFetch<{ ok: boolean }>("/me/age-confirm", {
    method: "POST",
    body: JSON.stringify({ ageVersion: CURRENT_AGE_VERSION }),
  });
}

export async function getPhotoConsent(): Promise<{
  hasConsent: boolean;
  consentedAt: string | null;
  consentVersion: string | null;
}> {
  return apiFetch("/me/photo-consent");
}

export async function recordPhotoConsent(consentVersion = "1.0"): Promise<void> {
  await apiFetch<{ ok: boolean }>("/me/photo-consent", {
    method: "POST",
    body: JSON.stringify({ consentVersion }),
  });
}

export async function withdrawPhotoConsent(): Promise<void> {
  await apiFetch<{ ok: boolean }>("/me/photo-consent", { method: "DELETE" });
}

export async function deletePhotoData(): Promise<void> {
  await apiFetch<{ ok: boolean }>("/me/photo-data", { method: "DELETE" });
}

export async function downloadMyData(): Promise<object> {
  return apiFetch<object>("/me/export");
}

export async function saveOnboardingAnswers(answers: Record<string, unknown>): Promise<void> {
  await apiFetch<{ ok: boolean }>("/me/onboarding", {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export async function uploadAvatar(imageBase64: string): Promise<{ avatarUrl: string }> {
  return apiFetch<{ avatarUrl: string }>("/me/avatar", {
    method: "PATCH",
    body: JSON.stringify({ imageBase64 }),
  });
}

export async function getAccounts(opts?: { bustCache?: boolean }): Promise<AccountProfile[]> {
  const path = opts?.bustCache ? `/accounts?_t=${Date.now()}` : "/accounts";
  return apiFetch<AccountProfile[]>(path);
}

export async function getOAuthState(): Promise<string> {
  const result = await apiFetch<{ state: string }>("/oauth/state", { method: "POST" });
  return result.state;
}

export async function getXOAuthInit(): Promise<{ state: string; codeChallenge: string; redirectUri?: string }> {
  return apiFetch<{ state: string; codeChallenge: string; redirectUri?: string }>("/oauth/x/init", { method: "POST" });
}

export async function startScan(options: { bypassCache?: boolean } = {}): Promise<ScanJob> {
  return apiFetch<ScanJob>("/scan", {
    method: "POST",
    body: JSON.stringify({ bypassCache: options.bypassCache ?? false }),
  });
}

export async function getScanStatus(jobId: string): Promise<ScanJob> {
  return apiFetch<ScanJob>(`/scan/${jobId}`);
}

export async function getScanResults(jobId: string): Promise<ThreatSummary[]> {
  return apiFetch<ThreatSummary[]>(`/scan/${jobId}/results`);
}

export async function getLatestScan(): Promise<ScanJob> {
  return apiFetch<ScanJob>("/scan/latest");
}

export interface ScanQuotaState {
  canScan: boolean;
  scansUsed: number;
  scansAllowed: number;
  tier: string;
  /** Maximum images analyzed per scan; -1 means unlimited. */
  imagesPerScan?: number;
  upgradeTo?: string;
  message: string | null;
  /** ISO date for the next free monthly allowance, or null for unlimited plans. */
  resetsAt?: string | null;
}

export async function getScanQuotaState(): Promise<ScanQuotaState> {
  return apiFetch<ScanQuotaState>("/scan/quota-state");
}

export async function listThreats(params?: {
  severity?: string;
  resolved?: boolean;
  limit?: number;
}): Promise<ThreatSummary[]> {
  const qs = new URLSearchParams();
  if (params?.severity) qs.set("severity", params.severity);
  if (params?.resolved !== undefined)
    qs.set("resolved", String(params.resolved));
  qs.set("limit", String(params?.limit ?? 200));
  const query = `?${qs.toString()}`;
  return apiFetch<ThreatSummary[]>(`/threats${query}`);
}

export async function getThreat(id: string): Promise<ThreatDetail> {
  return apiFetch<ThreatDetail>(`/threats/${id}`);
}

export async function resolveThreat(id: string, resolveAction?: string): Promise<void> {
  await apiFetch(`/threats/${id}/resolve`, {
    method: "PATCH",
    body: JSON.stringify(resolveAction ? { resolveAction } : {}),
  });
}

export async function bulkResolveThreats(ids: string[]): Promise<void> {
  await apiFetch("/threats/bulk-resolve", {
    method: "PATCH",
    body: JSON.stringify({ ids }),
  });
}

export async function addAccount(
  platform: string,
  username: string,
  accessToken?: string,
  displayName?: string
): Promise<AccountProfile> {
  return apiFetch<AccountProfile>("/accounts", {
    method: "POST",
    body: JSON.stringify({ platform, username, accessToken, displayName }),
  });
}

export async function removeAccount(id: string): Promise<void> {
  await apiFetch(`/accounts/${id}`, { method: "DELETE" });
}

export async function updateAccount(
  id: string,
  updates: {
    accessToken?: string;
    displayName?: string;
    followers?: number;
    platformUserId?: string;
  }
): Promise<AccountProfile> {
  return apiFetch<AccountProfile>(`/accounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function getAccountStatus(accountId: string): Promise<AccountStatus> {
  return apiFetch<AccountStatus>(`/accounts/${accountId}/status`);
}

/**
 * Proactively refresh tokens for all connected accounts within their platform's
 * refresh window (X: 24h, Facebook: 7d, Instagram: 50d).
 * Called on app foreground / tab mount so a scan never starts with stale tokens.
 * Returns the updated list of accounts.
 */
export async function refreshAccountTokens(): Promise<AccountProfile[]> {
  return apiFetch<AccountProfile[]>("/accounts/refresh", { method: "POST" });
}

export type Tier = "free" | "pro" | "premium";

export interface PlanLimits {
  maxAccounts: number;
  scanIntervalDays: number;
  autoScan: boolean;
  realTimeAlerts: boolean;
  fullEvidence: boolean;
  dailyScans: boolean;
  downloadableReports: boolean;
  label: string;
}

export interface SubscriptionInfo {
  id: string;
  userId: string;
  tier: Tier;
  status: "active" | "trialing" | "canceled" | "past_due";
  billingCycle: "monthly" | "yearly";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  limits: PlanLimits;
}

export async function getSubscription(): Promise<SubscriptionInfo> {
  return apiFetch<SubscriptionInfo>("/billing/subscription");
}

export async function registerPushToken(
  token: string,
  platform: "ios" | "android"
): Promise<void> {
  await apiFetch("/notifications/token", {
    method: "PATCH",
    body: JSON.stringify({ token, platform }),
  });
}

export async function deregisterPushToken(
  platform?: "ios" | "android"
): Promise<void> {
  const query = platform ? `?platform=${platform}` : "";
  await apiFetch(`/notifications/token${query}`, {
    method: "DELETE",
  });
}

export async function postCancellationSurvey(reason: string): Promise<void> {
  await apiFetch("/billing/cancellation-survey", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function getOAuthRedirectUris(): Promise<Record<string, string>> {
  return apiFetch<Record<string, string>>("/oauth/redirect-uris");
}

export interface AccountMediaItem {
  id: string;
  type: "image" | "video" | "carousel";
  url: string;
  thumbnailUrl: string;
  caption: string | null;
  postedAt: string | null;
}

export interface AccountMediaResponse {
  items: AccountMediaItem[];
  hasAccess: boolean;
  reason?: string;
}

export async function getAccountMedia(
  accountId: string,
  limit = 30
): Promise<AccountMediaResponse> {
  return apiFetch<AccountMediaResponse>(
    `/accounts/${accountId}/media?limit=${limit}`
  );
}

export interface PhotoSearchMatch {
  username: string;
  platform: string;
  profileUrl: string;
  title: string;
  snippet: string;
  similarity: number;
  discoveryMethod: string;
}

export interface PhotoSearchResponse {
  matches: PhotoSearchMatch[];
  threatsCreated: number;
  configured: boolean;
}

/**
 * Reverse image search via Google Cloud Vision WEB_DETECTION.
 * Pass imageUrl for CDN photos (from connected accounts) or
 * imageBase64 for camera roll photos (from expo-image-picker with base64:true).
 */
export async function reverseImageSearch(input: {
  imageUrl?: string;
  imageBase64?: string;
  localUri?: string;
}): Promise<PhotoSearchResponse> {
  return apiFetch<PhotoSearchResponse>("/photos/search", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function syncSubscriptionTier(
  tier: "free" | "premium",
  options?: { status?: "active" | "trialing" | "canceled"; trialEndsAt?: string }
): Promise<void> {
  await apiFetch("/billing/revenuecat-sync", {
    method: "POST",
    body: JSON.stringify({ tier, ...options }),
  });
}

export interface IdentityBadge {
  confidenceTier: "UNVERIFIED" | "LOW" | "MEDIUM" | "HIGH" | "STRONG";
  overallConfidence: number;
  verifiedPlatformCount: number;
  verifiedPlatforms: string[];
  badge: { tier: string; label: string; description: string; color: string };
}

export async function getIdentityBadge(): Promise<IdentityBadge | null> {
  try {
    return await apiFetch<IdentityBadge>("/identity/badge");
  } catch {
    return null;
  }
}
