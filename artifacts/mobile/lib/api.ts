/**
 * Rook API Client
 *
 * Calls the backend intelligence system at /api/*
 * Native production builds require EXPO_PUBLIC_API_URL to be a verified,
 * absolute HTTPS URL. Development may use the Expo workflow domain.
 */

import { Platform } from "react-native";
import { resolveApiBaseUrl, resolveAppOrigin, validateAppPath } from "./urls";
import {
  buildPinnedPushTokenCleanupRequest,
  createPinnedPushTokenCleanup,
  type CapturedDevicePushToken,
  type PinnedPushTokenCleanup,
} from "./logoutCleanup";
import { normalizeNullProfileEmail } from "./profileBootstrap";
import {
  addReviewerDemoAccount,
  bulkResolveReviewerDemoThreats,
  clearReviewerDemoMedia,
  getReviewerDemoMedia,
  getReviewerDemoProfilePatch,
  getReviewerDemoQuota,
  getReviewerDemoScanResults,
  getReviewerDemoScanStatus,
  getReviewerDemoSnapshot,
  getReviewerDemoThreat,
  invalidateReviewerAuthorizationForOwnerChange,
  isReviewerDemoActive,
  getReviewerDemoAuthorizationState,
  isReviewerDemoAuthorizationRevisionCurrent,
  isReviewerDemoNetworkRequestAllowed,
  setReviewerDemoAuthorizationStatus,
  removeReviewerDemoAccount,
  resolveReviewerDemoThreat,
  classifyReviewerDemoAuthorizationResult,
  saveReviewerDemoOnboardingAnswers,
  type ReviewerDemoAuthorizationDecision,
  startReviewerDemoScan,
  updateReviewerDemoAccount,
  updateReviewerDemoConsent,
  updateReviewerDemoProfile,
  resetReviewerDemoSession,
} from "./reviewerDemo";

function getUrlOptions() {
  return {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    domain: process.env.EXPO_PUBLIC_DOMAIN,
    platform: Platform.OS === "web" ? "web" as const : "native" as const,
    browserOrigin:
      Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : undefined,
    nativeProduction:
      Platform.OS !== "web" && process.env.EXPO_PUBLIC_APP_ENV === "production",
  };
}

export function getAppOrigin(): string {
  const origin = resolveAppOrigin(getUrlOptions());
  if (origin) return origin;
  if (Platform.OS !== "web" && process.env.EXPO_PUBLIC_APP_ENV === "production") {
    throw new Error(
      "Production API is not configured. Set EXPO_PUBLIC_API_URL to an absolute HTTPS URL."
    );
  }
  if (Platform.OS !== "web") {
    throw new Error(
      "Native app origin is not configured. Set EXPO_PUBLIC_API_URL or EXPO_PUBLIC_DOMAIN to an absolute HTTPS URL."
    );
  }
  throw new Error("App origin is unavailable in this browser environment.");
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl(getUrlOptions());
}

export function getApiUrl(path: string): string {
  const route = validateAppPath(path);
  return `${getApiBaseUrl()}${route}`;
}

export function getAppUrl(path: string): string {
  const route = validateAppPath(path);
  return `${getAppOrigin()}${route}`;
}

const API_TIMEOUT_MS = 15_000;
const AUTH_TOKEN_TIMEOUT_MS = 8_000;

let _authTokenGetter: (() => Promise<string | null>) | null = null;
let _authTokenGetterRevision = 0;
let _authTokenOwnerId: string | null = null;
const issuedLogoutCleanupPlans = new WeakSet<object>();

export function setApiAuthToken(
  getter: () => Promise<string | null>,
  ownerId: string | null,
) {
  if (invalidateReviewerAuthorizationForOwnerChange(_authTokenOwnerId, ownerId)) {
    _authTokenGetterRevision += 1;
  }
  // A Clerk token getter is frequently recreated while the same account stays
  // signed in. Refresh the callable without invalidating that account's
  // reviewer authorization or any in-flight account-scoped work.
  _authTokenGetter = getter;
  _authTokenOwnerId = ownerId;
}

export function getApiAuthTokenRevision(): number {
  return _authTokenGetterRevision;
}

/** Drop the live getter only if it still belongs to the account being logged out. */
export function invalidateApiAuthToken(ownerId: string | null): boolean {
  if (_authTokenOwnerId !== ownerId) return false;
  _authTokenGetterRevision += 1;
  _authTokenGetter = null;
  _authTokenOwnerId = null;
  return true;
}

/** Capture a bearer only while its Clerk owner and live authorization still match. */
export async function capturePinnedPushTokenCleanup(
  ownerId: string,
  device: CapturedDevicePushToken,
): Promise<PinnedPushTokenCleanup | null> {
  const scope = getReviewerDemoAuthorizationState();
  const tokenGetterRevision = _authTokenGetterRevision;
  if (
    !ownerId ||
    device.ownerId !== ownerId ||
    _authTokenOwnerId !== ownerId ||
    scope.accountKey !== ownerId ||
    scope.status !== "live" ||
    !_authTokenGetter
  ) return null;

  let token: string | null;
  try {
    token = await getAuthToken();
  } catch {
    return null;
  }

  const currentScope = getReviewerDemoAuthorizationState();
  if (
    !token ||
    _authTokenOwnerId !== ownerId ||
    _authTokenGetterRevision !== tokenGetterRevision ||
    currentScope.accountKey !== ownerId ||
    currentScope.status !== "live" ||
    currentScope.revision !== scope.revision
  ) return null;

  const plan = createPinnedPushTokenCleanup(
    { ownerId, bearerToken: token },
    device,
    ownerId,
  );
  if (plan) issuedLogoutCleanupPlans.add(plan);
  return plan;
}

/**
 * Executes logout cleanup with the captured old credential, never the global
 * token getter. The exact device token and owner are part of the pinned plan.
 */
export async function executePinnedPushTokenCleanup(
  cleanup: PinnedPushTokenCleanup,
): Promise<void> {
  if (!issuedLogoutCleanupPlans.has(cleanup)) {
    throw new Error("Push-token cleanup authorization was not captured for this session.");
  }
  const request = buildPinnedPushTokenCleanupRequest(cleanup);
  const route = validateAppPath(request.path);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(`${getApiBaseUrl()}${route}`, {
      method: request.method,
      headers: request.headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Push-token cleanup failed (HTTP ${response.status}).`);
    }
  } catch {
    if (controller.signal.aborted) {
      throw new Error("Push-token cleanup timed out.");
    }
    throw new Error("Push-token cleanup could not be completed.");
  } finally {
    clearTimeout(timeout);
  }
}

async function getAuthToken(): Promise<string | null> {
  if (!_authTokenGetter) return null;

  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    const token = await Promise.race([
      _authTokenGetter(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Authentication timed out. Please sign in again.")),
          AUTH_TOKEN_TIMEOUT_MS
        );
      }),
    ]);
    if (!token && isReviewerDemoActive()) {
      const scope = getReviewerDemoAuthorizationState();
      resetReviewerDemoSession();
      setReviewerDemoAuthorizationStatus(scope.accountKey, "pending");
    }
    return token;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/**
 * Returns true if no Clerk token is available — mirrors the server-side
 * `isDemoUser = !user.clerkId` guard in scanOrchestrator.ts.
 * Demo users see simulated threats; real users should never see fabricated ones.
 */
export async function checkIsDemoUser(): Promise<boolean> {
  if (!_authTokenGetter) return true;
  const token = await getAuthToken();
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

class ApiResponseError extends Error {
  constructor(
    readonly statusCode: number,
    readonly errorCode: string | null,
  ) {
    super(errorCode ?? `HTTP ${statusCode}`);
    this.name = "ApiResponseError";
  }
}

class ApiAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiAuthorizationError";
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const route = validateAppPath(path);
  const scope = getReviewerDemoAuthorizationState();
  const method = (options.method ?? "GET").toUpperCase();
  if (!isReviewerDemoNetworkRequestAllowed(scope.status, route, method)) {
    throw new ApiAuthorizationError(
      scope.status === "unavailable"
        ? "Account mode could not be verified. Retry authorization before continuing."
        : scope.status === "pending"
          ? "Account authorization is still pending."
          : "This operation is unavailable in reviewer preview."
    );
  }
  const url = `${getApiBaseUrl()}${route}`;
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
    const isPublicTicket = route.split("?", 1)[0] === "/auth/app-review-ticket";
    const token = await getAuthToken();
    if (!isReviewerDemoAuthorizationRevisionCurrent(scope.revision)) {
      throw new ApiAuthorizationError("Account changed while authorizing this request.");
    }
    if (!token && !isPublicTicket) {
      throw new ApiAuthorizationError("Authentication is required for this request.");
    }
    if (token) authHeaders["Authorization"] = `Bearer ${token}`;
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...(options.headers ?? {}),
      },
    });
    if (!isReviewerDemoAuthorizationRevisionCurrent(scope.revision)) {
      throw new ApiAuthorizationError("Account changed while this request was in progress.");
    }

    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => ({ error: "Request failed" })) as Record<string, unknown>;
      if (!isReviewerDemoAuthorizationRevisionCurrent(scope.revision)) {
        throw new ApiAuthorizationError("Account changed while this request was in progress.");
      }

      // Surface structured quota errors so the UI can show the upgrade prompt
      if (response.status === 429 && body["error"] === "scan_limit_reached") {
        throw new ScanQuotaError({
          reason: String(body["reason"] ?? "monthly_limit"),
          tier: String(body["tier"] ?? "free"),
          upgradeTo: String(body["upgradeTo"] ?? "pro"),
          message: String(body["message"] ?? "Scan limit reached. Upgrade to continue."),
        });
      }

      throw new ApiResponseError(
        response.status,
        typeof body["error"] === "string"
          ? body["error"]
          : typeof body["code"] === "string"
            ? body["code"]
            : null,
      );
    }

    if (response.status === 204) return undefined as T;
    const payload = await response.json() as T;
    if (!isReviewerDemoAuthorizationRevisionCurrent(scope.revision)) {
      throw new ApiAuthorizationError("Account changed while this request was in progress.");
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiAuthorizationError || error instanceof ApiResponseError) throw error;
    if (controller.signal.aborted) {
      throw new Error("Request timed out. Check your connection and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortForCaller);
  }
}

/** Classifies the authenticated reviewer endpoint without treating failures as live mode. */
export async function authorizeReviewerDemo(): Promise<ReviewerDemoAuthorizationDecision> {
  try {
    const payload = await apiFetch<unknown>("/reviewer/demo");
    return classifyReviewerDemoAuthorizationResult({ kind: "payload", payload });
  } catch (error) {
    if (error instanceof ApiResponseError) {
      return classifyReviewerDemoAuthorizationResult({
        kind: "http",
        statusCode: error.statusCode,
        errorCode: error.errorCode,
      });
    }
    return classifyReviewerDemoAuthorizationResult({ kind: "network" });
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
  termsAcceptedAt?: string | null;
  ageConfirmedAt?: string | null;
  minimumAgeVersion?: string | null;
  reelsIndexed: number;
  fingerprintUpdated: string;
  avatarUrl?: string | null;
}

export async function requestAppReviewTicket(
  identifier: string,
  accessCode: string,
): Promise<{ ticket: string }> {
  return apiFetch<{ ticket: string }>("/auth/app-review-ticket", {
    method: "POST",
    body: JSON.stringify({ identifier, accessCode }),
  });
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
  connectionType?: "demo";
  isSample?: boolean;
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
  /** True when this threat is a seeded reviewer/example fixture, not a live finding. */
  isSample: boolean;
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
  const profile = normalizeNullProfileEmail(
    await apiFetch<unknown>("/me"),
  ) as UserProfile;
  if (!isReviewerDemoActive()) return profile;
  const demo = getReviewerDemoSnapshot();
  if (!demo) return profile;
  return {
    ...profile,
    ...getReviewerDemoProfilePatch(),
    id: profile.id,
    tier: profile.tier,
    onboardingCompleted: profile.onboardingCompleted,
    securityScore: demo.profileSummary.securityScore,
    scoreTrend: demo.profileSummary.scoreTrend,
    monitored: demo.profileSummary.monitored,
    lastScan: demo.profileSummary.lastScan,
    totalPhotosIndexed: demo.profileSummary.totalPhotosIndexed,
    totalCaptionsIndexed: demo.profileSummary.totalCaptionsIndexed,
    reelsIndexed: demo.profileSummary.reelsIndexed,
    fingerprintUpdated: demo.profileSummary.fingerprintUpdated,
  };
}

export async function deleteMyAccount(): Promise<void> {
  if (isReviewerDemoActive()) return;
  await apiFetch<void>("/me", { method: "DELETE" });
}

export async function updateMe(updates: {
  name?: string;
  username?: string;
  email?: string;
}): Promise<UserProfile> {
  if (isReviewerDemoActive()) {
    updateReviewerDemoProfile(updates);
    return getMe();
  }
  return apiFetch<UserProfile>("/me", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

// Current terms version — bump whenever Terms / Privacy Policy is materially updated.
// Users with a stored version older than this see TermsUpdateModal on next launch.
export const CURRENT_TERMS_VERSION = "2026-09-15-v4";
export const CURRENT_PHOTO_CONSENT_VERSION = "2026-09-15-v4";

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
  if (isReviewerDemoActive()) {
    const demo = getReviewerDemoSnapshot();
    if (demo) return { ...demo.consent };
  }
  return apiFetch("/me/photo-consent");
}

export async function recordPhotoConsent(consentVersion = CURRENT_PHOTO_CONSENT_VERSION): Promise<void> {
  if (isReviewerDemoActive()) {
    updateReviewerDemoConsent(true);
    return;
  }
  await apiFetch<{ ok: boolean }>("/me/photo-consent", {
    method: "POST",
    body: JSON.stringify({ consentVersion }),
  });
}

export async function withdrawPhotoConsent(): Promise<void> {
  if (isReviewerDemoActive()) {
    updateReviewerDemoConsent(false);
    return;
  }
  await apiFetch<{ ok: boolean }>("/me/photo-consent", { method: "DELETE" });
}

export async function deletePhotoData(): Promise<void> {
  if (isReviewerDemoActive()) {
    clearReviewerDemoMedia();
    return;
  }
  await apiFetch<{ ok: boolean }>("/me/photo-data", { method: "DELETE" });
}

export async function downloadMyData(): Promise<object> {
  if (isReviewerDemoActive()) {
    return {
      isSample: true,
      mode: "reviewer_demo",
      message: "This preview contains fictional sample data only.",
      data: getReviewerDemoSnapshot(),
    };
  }
  return apiFetch<object>("/me/export");
}

export async function saveOnboardingAnswers(answers: Record<string, unknown>): Promise<void> {
  const authorization = getReviewerDemoAuthorizationState();
  if (authorization.status === "demo") {
    saveReviewerDemoOnboardingAnswers(answers);
    return;
  }
  await apiFetch<{ ok: boolean }>("/me/onboarding", {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export async function uploadAvatar(imageBase64: string): Promise<{ avatarUrl: string }> {
  if (isReviewerDemoActive()) {
    const avatarUrl = `data:image/jpeg;base64,${imageBase64}`;
    updateReviewerDemoProfile({ avatarUrl });
    return { avatarUrl };
  }
  return apiFetch<{ avatarUrl: string }>("/me/avatar", {
    method: "PATCH",
    body: JSON.stringify({ imageBase64 }),
  });
}

export function previewReviewerDemoAvatar(avatarUrl: string): { avatarUrl: string } {
  if (!isReviewerDemoActive()) {
    throw new Error("Reviewer preview is not active.");
  }
  if (!/^https?:\/\//i.test(avatarUrl) && !avatarUrl.startsWith("data:image/")) {
    throw new Error("Choose an image from the reviewer-demo fixture.");
  }
  updateReviewerDemoProfile({ avatarUrl });
  return { avatarUrl };
}

export async function getAccounts(opts?: { bustCache?: boolean }): Promise<AccountProfile[]> {
  if (isReviewerDemoActive()) {
    return (getReviewerDemoSnapshot()?.accounts ?? []) as AccountProfile[];
  }
  const path = opts?.bustCache ? `/accounts?_t=${Date.now()}` : "/accounts";
  return apiFetch<AccountProfile[]>(path);
}

export async function getOAuthState(): Promise<string> {
  if (isReviewerDemoActive()) {
    throw new Error("Social account connections are disabled in reviewer preview.");
  }
  const result = await apiFetch<{ state: string }>("/oauth/state", { method: "POST" });
  return result.state;
}

export async function getXOAuthInit(): Promise<{ state: string; codeChallenge: string; redirectUri?: string }> {
  if (isReviewerDemoActive()) {
    throw new Error("Social account connections are disabled in reviewer preview.");
  }
  return apiFetch<{ state: string; codeChallenge: string; redirectUri?: string }>("/oauth/x/init", { method: "POST" });
}

export async function startScan(options: { bypassCache?: boolean } = {}): Promise<ScanJob> {
  if (isReviewerDemoActive()) return startReviewerDemoScan() as ScanJob;
  return apiFetch<ScanJob>("/scan", {
    method: "POST",
    body: JSON.stringify({ bypassCache: options.bypassCache ?? false }),
  });
}

export async function getScanStatus(jobId: string): Promise<ScanJob> {
  if (isReviewerDemoActive()) {
    const status = getReviewerDemoScanStatus(jobId);
    if (status) return status as ScanJob;
    throw new Error("Sample scan is no longer available.");
  }
  return apiFetch<ScanJob>(`/scan/${jobId}`);
}

export async function getScanResults(jobId: string): Promise<ThreatSummary[]> {
  if (isReviewerDemoActive()) {
    return getReviewerDemoScanResults().map((threat) => ({
      id: threat.id,
      isSample: true,
      scanJobId: jobId,
      type: threat.type,
      severity: threat.severity,
      platform: threat.platform,
      title: threat.title,
      description: threat.description,
      threatScore: threat.threatScore,
      matchedMediaCount: threat.matchedMediaCount,
      evidenceCount: threat.evidence.length,
      suspiciousUsername: threat.suspiciousUsername,
      resolved: threat.resolved,
      resolveAction: threat.resolveAction,
      resolvedAt: threat.resolvedAt,
      createdAt: threat.createdAt,
    }));
  }
  return apiFetch<ThreatSummary[]>(`/scan/${jobId}/results`);
}

export async function getLatestScan(): Promise<ScanJob> {
  if (isReviewerDemoActive()) {
    const demo = getReviewerDemoSnapshot();
    if (demo?.latestScan) return demo.latestScan as unknown as ScanJob;
    throw new Error("No sample scan is available.");
  }
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
  if (isReviewerDemoActive()) {
    const quota = getReviewerDemoQuota();
    if (quota) {
      return {
        ...quota,
        canScan: true,
        message: "Preview scans run locally on fictional sample data.",
      } as ScanQuotaState;
    }
  }
  return apiFetch<ScanQuotaState>("/scan/quota-state");
}

export async function listThreats(params?: {
  severity?: string;
  resolved?: boolean;
  limit?: number;
}): Promise<ThreatSummary[]> {
  if (isReviewerDemoActive()) {
    const demo = getReviewerDemoSnapshot();
    const filtered = (demo?.threats ?? []).filter((threat) =>
      (!params?.severity || threat.severity === params.severity) &&
      (params?.resolved === undefined || threat.resolved === params.resolved)
    );
    return filtered.slice(0, params?.limit ?? 200) as ThreatSummary[];
  }
  const qs = new URLSearchParams();
  if (params?.severity) qs.set("severity", params.severity);
  if (params?.resolved !== undefined)
    qs.set("resolved", String(params.resolved));
  qs.set("limit", String(params?.limit ?? 200));
  const query = `?${qs.toString()}`;
  return apiFetch<ThreatSummary[]>(`/threats${query}`);
}

export async function getThreat(id: string): Promise<ThreatDetail> {
  if (isReviewerDemoActive()) {
    const threat = getReviewerDemoThreat(id);
    if (!threat) throw new Error("Sample threat was not found.");
    return threat as unknown as ThreatDetail;
  }
  return apiFetch<ThreatDetail>(`/threats/${id}`);
}

export async function resolveThreat(id: string, resolveAction?: string): Promise<void> {
  if (isReviewerDemoActive()) {
    resolveReviewerDemoThreat(id, resolveAction);
    return;
  }
  await apiFetch(`/threats/${id}/resolve`, {
    method: "PATCH",
    body: JSON.stringify(resolveAction ? { resolveAction } : {}),
  });
}

export async function bulkResolveThreats(ids: string[]): Promise<void> {
  if (isReviewerDemoActive()) {
    bulkResolveReviewerDemoThreats(ids);
    return;
  }
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
  if (isReviewerDemoActive()) {
    return addReviewerDemoAccount(platform, username, displayName) as AccountProfile;
  }
  return apiFetch<AccountProfile>("/accounts", {
    method: "POST",
    body: JSON.stringify({ platform, username, accessToken, displayName }),
  });
}

export async function removeAccount(id: string): Promise<void> {
  if (isReviewerDemoActive()) {
    removeReviewerDemoAccount(id);
    return;
  }
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
  if (isReviewerDemoActive()) {
    return updateReviewerDemoAccount(id, updates) as AccountProfile;
  }
  return apiFetch<AccountProfile>(`/accounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function getAccountStatus(accountId: string): Promise<AccountStatus> {
  if (isReviewerDemoActive()) {
    const account = getReviewerDemoSnapshot()?.accounts.find((item) => item.id === accountId);
    if (!account) throw new Error("Sample account was not found.");
    return { verified: false, tokenExpiresAt: null, needsReconnect: account.needsReconnect, scopesGranted: [] };
  }
  return apiFetch<AccountStatus>(`/accounts/${accountId}/status`);
}

/**
 * Proactively refresh tokens for all connected accounts within their platform's
 * refresh window (X: 24h, Facebook: 7d, Instagram: 50d).
 * Called on app foreground / tab mount so a scan never starts with stale tokens.
 * Returns the updated list of accounts.
 */
export async function refreshAccountTokens(): Promise<AccountProfile[]> {
  if (isReviewerDemoActive()) {
    return (getReviewerDemoSnapshot()?.accounts ?? []) as AccountProfile[];
  }
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
  if (isReviewerDemoActive()) return;
  await apiFetch("/notifications/token", {
    method: "PATCH",
    body: JSON.stringify({ token, platform }),
  });
}

export async function deregisterPushToken(
  _platform: "ios" | "android",
  token: string
): Promise<void> {
  if (isReviewerDemoActive()) return;
  // The API must require token when removing a device registration. A
  // platform-only delete would sign out every device for this account.
  if (!token.trim()) {
    throw new Error("A device token is required to deregister push notifications.");
  }
  const params = new URLSearchParams({ token });
  const query = `?${params.toString()}`;
  await apiFetch(`/notifications/token${query}`, {
    method: "DELETE",
  });
}

export async function postCancellationSurvey(reason: string): Promise<void> {
  if (isReviewerDemoActive()) return;
  await apiFetch("/billing/cancellation-survey", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function getOAuthRedirectUris(): Promise<Record<string, string>> {
  if (isReviewerDemoActive()) return {};
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
  isSample?: boolean;
}

export async function getAccountMedia(
  accountId: string,
  limit = 30
): Promise<AccountMediaResponse> {
  if (isReviewerDemoActive()) {
    const media = getReviewerDemoMedia(accountId);
    if (media) return media as AccountMediaResponse;
    throw new Error("Sample account media was not found.");
  }
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
  if (isReviewerDemoActive()) {
    return { matches: [], threatsCreated: 0, configured: false };
  }
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
  isSample?: boolean;
}

export async function getIdentityBadge(): Promise<IdentityBadge | null> {
  if (isReviewerDemoActive()) {
    const demo = getReviewerDemoSnapshot();
    return demo ? demo.identityBadge as unknown as IdentityBadge : null;
  }
  try {
    return await apiFetch<IdentityBadge>("/identity/badge");
  } catch {
    return null;
  }
}
