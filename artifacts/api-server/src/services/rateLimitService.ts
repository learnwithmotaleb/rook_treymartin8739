/**
 * Rate Limit Service
 *
 * Enforces per-user scan quotas with automatic daily / monthly resets.
 * Quotas are stored in PostgreSQL so they survive server restarts.
 *
 * Tier limits:
 *   Free    — 1 scan / month, 1 deep scan / day
 *   Pro     — 15 scans / month (sunset; treated as Premium via normalizeTier)
 *   Premium — unlimited scans and deep scans
 *
 * A "deep scan" triggers the full Vision + CSE pipeline.  A lightweight scan
 * (e.g., breach-only re-check) does not count against the deep scan quota.
 *
 * Abuse detection: any user who exceeds 10 scan attempts in a single day is
 * flagged and throttled automatically until manually cleared.
 */

import { eq } from "drizzle-orm";
import { db, usageQuotasTable } from "@workspace/db";
import { logger } from "../lib/logger";

// ─── Tier configuration ───────────────────────────────────────────────────────

interface TierLimits {
  scansPerMonth: number;        // -1 = unlimited
  deepScansPerDay: number;      // -1 = unlimited
  abuseThresholdPerDay: number; // flag user if they exceed this many attempts/day
}

const TIER_LIMITS: Record<string, TierLimits> = {
  free: {
    scansPerMonth: 1,
    deepScansPerDay: 1,
    abuseThresholdPerDay: 8,
  },
  pro: {
    scansPerMonth: 15,
    deepScansPerDay: 5,
    abuseThresholdPerDay: 20,
  },
  premium: {
    scansPerMonth: -1,
    deepScansPerDay: -1,
    abuseThresholdPerDay: 50,
  },
};

// ─── Key helpers ─────────────────────────────────────────────────────────────

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type QuotaDenialReason =
  | "monthly_limit"
  | "daily_deep_scan_limit"
  | "flagged_for_abuse";

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: QuotaDenialReason;
  /** Scans remaining this month (undefined when unlimited). */
  remainingMonth?: number;
  /** Deep scans remaining today (undefined when unlimited). */
  remainingDay?: number;
}

/**
 * Check whether a user may start a new scan, and increment their counters if so.
 *
 * @param userId       Internal UUID of the user.
 * @param planTier     "free" | "pro" | "premium"
 * @param isDeepScan   True when the full Vision + CSE pipeline will run.
 */
export async function checkAndIncrementQuota(
  userId: string,
  planTier: "free" | "pro" | "premium",
  isDeepScan: boolean
): Promise<QuotaCheckResult> {
  const limits = TIER_LIMITS[planTier] ?? TIER_LIMITS.free!;
  const now = new Date();
  const mKey = monthKey(now);
  const dKey = dayKey(now);

  try {
    // Get or create the quota row
    let [quota] = await db
      .select()
      .from(usageQuotasTable)
      .where(eq(usageQuotasTable.userId, userId));

    if (!quota) {
      const [created] = await db
        .insert(usageQuotasTable)
        .values({
          userId,
          scansThisMonth: 0,
          deepScansToday: 0,
          monthKey: mKey,
          dayKey: dKey,
        })
        .returning();
      quota = created!;
    }

    // Detect rollover: reset counters when month / day changed
    const scansThisMonth =
      quota.monthKey === mKey ? quota.scansThisMonth : 0;
    const deepScansToday =
      quota.dayKey === dKey ? quota.deepScansToday : 0;

    // Abuse check (uses raw scansThisMonth — not reset — to catch burst abuse)
    if (quota.flaggedForAbuse) {
      logger.warn({ userId }, "Scan blocked: user flagged for abuse");
      return { allowed: false, reason: "flagged_for_abuse" };
    }

    // Monthly scan limit (free + pro only)
    if (limits.scansPerMonth !== -1 && scansThisMonth >= limits.scansPerMonth) {
      logger.info({ userId, scansThisMonth, limit: limits.scansPerMonth }, "Monthly scan limit reached");
      return {
        allowed: false,
        reason: "monthly_limit",
        remainingMonth: 0,
      };
    }

    // Daily deep-scan limit
    if (isDeepScan && limits.deepScansPerDay !== -1 && deepScansToday >= limits.deepScansPerDay) {
      logger.info({ userId, deepScansToday, limit: limits.deepScansPerDay }, "Daily deep-scan limit reached");
      return {
        allowed: false,
        reason: "daily_deep_scan_limit",
        remainingDay: 0,
      };
    }

    const newScansThisMonth = scansThisMonth + 1;
    const newDeepScansToday = deepScansToday + (isDeepScan ? 1 : 0);

    // Flag for abuse if scan velocity is suspiciously high
    const shouldFlag =
      newScansThisMonth > limits.abuseThresholdPerDay * 3 ||
      newDeepScansToday > limits.abuseThresholdPerDay;

    await db
      .update(usageQuotasTable)
      .set({
        scansThisMonth: newScansThisMonth,
        deepScansToday: newDeepScansToday,
        monthKey: mKey,
        dayKey: dKey,
        flaggedForAbuse: shouldFlag || quota.flaggedForAbuse,
        updatedAt: now,
      })
      .where(eq(usageQuotasTable.userId, userId));

    if (shouldFlag && !quota.flaggedForAbuse) {
      logger.warn({ userId, newScansThisMonth, newDeepScansToday }, "User flagged for excessive scan activity");
    }

    return {
      allowed: true,
      remainingMonth:
        limits.scansPerMonth === -1
          ? undefined
          : limits.scansPerMonth - newScansThisMonth,
      remainingDay:
        limits.deepScansPerDay === -1
          ? undefined
          : limits.deepScansPerDay - newDeepScansToday,
    };
  } catch (err) {
    // If quota tracking fails, allow the scan to proceed (fail open)
    logger.error({ err, userId }, "Quota check failed — allowing scan (fail-open)");
    return { allowed: true };
  }
}

/** Get the current quota state for a user without modifying anything. */
export async function getQuotaState(
  userId: string
): Promise<{ scansThisMonth: number; deepScansToday: number; flaggedForAbuse: boolean } | null> {
  try {
    const [quota] = await db
      .select()
      .from(usageQuotasTable)
      .where(eq(usageQuotasTable.userId, userId));

    if (!quota) return null;

    const now = new Date();
    return {
      scansThisMonth: quota.monthKey === monthKey(now) ? quota.scansThisMonth : 0,
      deepScansToday: quota.dayKey === dayKey(now) ? quota.deepScansToday : 0,
      flaggedForAbuse: quota.flaggedForAbuse,
    };
  } catch {
    return null;
  }
}

/** Unflag a user (admin action). */
export async function clearAbuseFlag(userId: string): Promise<void> {
  await db
    .update(usageQuotasTable)
    .set({ flaggedForAbuse: false, updatedAt: new Date() })
    .where(eq(usageQuotasTable.userId, userId));
}
