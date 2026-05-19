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
    const err = await response.json().catch(() => ({ error: "Request failed" })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
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
  if (params?.resolved !== undefined) qs.set("resolved", String(params.resolved));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<ThreatSummary[]>(`/threats${query}`);
}

export async function resolveThreat(id: string): Promise<void> {
  await apiFetch(`/threats/${id}/resolve`, { method: "PATCH" });
}
