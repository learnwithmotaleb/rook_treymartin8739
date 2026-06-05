export type Tier = "free" | "pro" | "premium";

export interface PlanLimits {
  // Accounts
  maxAccounts: number;          // -1 = unlimited

  // Scan cadence
  scanIntervalDays: number;
  autoScan: boolean;
  dailyScans: boolean;

  // Quota (enforced server-side by rateLimitService)
  scansPerMonth: number;        // -1 = unlimited
  imagesPerScan: number;        // -1 = unlimited

  // History retention
  historyDays: number;          // days; 1 = 24h

  // Feature flags
  realTimeAlerts: boolean;
  fullEvidence: boolean;
  downloadableReports: boolean;
  priorityProcessing: boolean;
  advancedRiskScoring: boolean;
  earlyAccess: boolean;

  label: string;
}

export const PLAN_CONFIG: Record<Tier, PlanLimits> = {
  free: {
    maxAccounts: 1,
    scanIntervalDays: 14,
    autoScan: false,
    dailyScans: false,
    scansPerMonth: 3,
    imagesPerScan: 1,
    historyDays: 1,             // 24h
    realTimeAlerts: false,
    fullEvidence: false,
    downloadableReports: false,
    priorityProcessing: false,
    advancedRiskScoring: false,
    earlyAccess: false,
    label: "Free",
  },
  pro: {
    maxAccounts: 3,
    scanIntervalDays: 7,
    autoScan: true,
    dailyScans: false,
    scansPerMonth: 15,
    imagesPerScan: 5,
    historyDays: 7,
    realTimeAlerts: true,
    fullEvidence: true,
    downloadableReports: false,
    priorityProcessing: false,
    advancedRiskScoring: false,
    earlyAccess: false,
    label: "Pro",
  },
  premium: {
    maxAccounts: -1,
    scanIntervalDays: 1,
    autoScan: true,
    dailyScans: true,
    scansPerMonth: -1,
    imagesPerScan: -1,
    historyDays: 30,
    realTimeAlerts: true,
    fullEvidence: true,
    downloadableReports: true,
    priorityProcessing: true,
    advancedRiskScoring: true,
    earlyAccess: true,
    label: "Premium",
  },
};

export const TIER_ORDER: Record<Tier, number> = { free: 0, pro: 1, premium: 2 };

export function tierAtLeast(userTier: string, required: Tier): boolean {
  const user = TIER_ORDER[userTier as Tier] ?? 0;
  const req = TIER_ORDER[required];
  return user >= req;
}
