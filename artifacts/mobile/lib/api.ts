/**
 * ShieldID API Client
 *
 * Calls the backend intelligence system at /api/*
 * The base URL is inferred from EXPO_PUBLIC_DOMAIN (set by the Expo workflow).
 */

const BASE_URL = (() => {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  return "/api";
})();

let _authTokenGetter: (() => Promise<string | null>) | null = null;

export function setApiAuthToken(getter: () => Promise<string | null>) {
  _authTokenGetter = getter;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const authHeaders: Record<string, string> = {};
  if (_authTokenGetter) {
    const token = await _authTokenGetter();
    if (token) authHeaders["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: "Request failed" })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarInitials: string;
  isPremium: boolean;
  tier: Tier;
  securityScore: number;
  scoreTrend: number;
  monitored: number;
  lastScan: string;
  totalPhotosIndexed: number;
  totalCaptionsIndexed: number;
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
  photosIndexed: number;
  captionsIndexed: number;
  reelsIndexed: number;
  lastSynced: string | null;
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
  type: string;
  severity: "high" | "medium" | "low";
  platform: string | null;
  title: string;
  description: string;
  threatScore: number;
  matchedMediaCount: number;
  suspiciousUsername: string | null;
  resolved: boolean;
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
  detectedSignals: string[];
  resolvedAt: string | null;
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

export async function getAccounts(): Promise<AccountProfile[]> {
  return apiFetch<AccountProfile[]>("/accounts");
}

export async function startScan(): Promise<ScanJob> {
  return apiFetch<ScanJob>("/scan", { method: "POST" });
}

export async function getScanStatus(jobId: string): Promise<ScanJob> {
  return apiFetch<ScanJob>(`/scan/${jobId}`);
}

export async function getLatestScan(): Promise<ScanJob> {
  return apiFetch<ScanJob>("/scan/latest");
}

export async function listThreats(params?: {
  severity?: string;
  resolved?: boolean;
}): Promise<ThreatSummary[]> {
  const qs = new URLSearchParams();
  if (params?.severity) qs.set("severity", params.severity);
  if (params?.resolved !== undefined)
    qs.set("resolved", String(params.resolved));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<ThreatSummary[]>(`/threats${query}`);
}

export async function getThreat(id: string): Promise<ThreatDetail> {
  return apiFetch<ThreatDetail>(`/threats/${id}`);
}

export async function resolveThreat(id: string): Promise<void> {
  await apiFetch(`/threats/${id}/resolve`, { method: "PATCH" });
}

export async function addAccount(
  platform: string,
  username: string,
  accessToken?: string
): Promise<AccountProfile> {
  return apiFetch<AccountProfile>("/accounts", {
    method: "POST",
    body: JSON.stringify({ platform, username, accessToken }),
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

export async function createCheckoutSession(
  tier: "pro" | "premium",
  billingCycle: "monthly" | "yearly"
): Promise<{ url: string | null; sessionId: string }> {
  return apiFetch("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ tier, billingCycle }),
  });
}

export async function createPortalSession(): Promise<{ url: string }> {
  return apiFetch("/billing/portal", { method: "POST" });
}

export async function cancelSubscription(): Promise<{ cancelAtPeriodEnd: boolean }> {
  return apiFetch("/billing/cancel", { method: "POST" });
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
  platform: "ios" | "android"
): Promise<void> {
  await apiFetch(`/notifications/token?platform=${platform}`, {
    method: "DELETE",
  });
}
