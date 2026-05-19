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

const DEMO_USER_ID = "demo";

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-user-id": DEMO_USER_ID,
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

export interface ScamAnalysisResult {
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  detectedPatterns: string[];
  explanation: string;
  recommendation: string;
  analyzedAt: string;
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

export async function getAccounts(): Promise<AccountProfile[]> {
  return apiFetch<AccountProfile[]>("/accounts");
}

export async function analyzeScam(text: string): Promise<ScamAnalysisResult> {
  return apiFetch<ScamAnalysisResult>("/ai/analyze-scam", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function startScan(): Promise<ScanJob> {
  return apiFetch<ScanJob>("/scan", { method: "POST" });
}

export async function getScanStatus(jobId: string): Promise<ScanJob> {
  return apiFetch<ScanJob>(`/scan/${jobId}`);
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

export interface DarkWebMonitorEntry {
  type: string;
  value: string;
  status: "clean" | "exposed" | "mentioned";
}

export interface DarkWebItem {
  id: string;
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  threatScore: number;
  resolved: boolean;
  detectedAt: string;
}

export interface DarkWebReport {
  monitoredEmail: string;
  monitoredUsername: string;
  mentions: DarkWebItem[];
  breaches: DarkWebItem[];
  totalExposures: number;
  lastChecked: string;
  monitored: DarkWebMonitorEntry[];
}

export async function getDarkWebReport(): Promise<DarkWebReport> {
  return apiFetch<DarkWebReport>("/dark-web");
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
