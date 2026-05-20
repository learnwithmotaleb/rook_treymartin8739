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

export const PLAN_CONFIG: Record<Tier, PlanLimits> = {
  free: {
    maxAccounts: 1,
    scanIntervalDays: 14,
    autoScan: false,
    realTimeAlerts: false,
    fullEvidence: false,
    dailyScans: false,
    downloadableReports: false,
    label: "Free",
  },
  pro: {
    maxAccounts: 3,
    scanIntervalDays: 7,
    autoScan: true,
    realTimeAlerts: true,
    fullEvidence: true,
    dailyScans: false,
    downloadableReports: false,
    label: "Pro",
  },
  premium: {
    maxAccounts: -1,
    scanIntervalDays: 1,
    autoScan: true,
    realTimeAlerts: true,
    fullEvidence: true,
    dailyScans: true,
    downloadableReports: true,
    label: "Premium",
  },
};

export const TIER_ORDER: Record<Tier, number> = { free: 0, pro: 1, premium: 2 };

export function tierAtLeast(userTier: string, required: Tier): boolean {
  const user = TIER_ORDER[userTier as Tier] ?? 0;
  const req = TIER_ORDER[required];
  return user >= req;
}
