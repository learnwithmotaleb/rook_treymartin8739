import { and, eq, sql } from "drizzle-orm";
import {
  db,
  subscriptionsTable,
  usageTrackingTable,
} from "@workspace/db";
import type { Tier } from "../lib/planConfig";

export type SubStatus = "active" | "trialing" | "canceled" | "past_due";

export interface SubscriptionInfo {
  id: string;
  userId: string;
  tier: Tier;
  status: SubStatus;
  billingCycle: "monthly" | "yearly";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
}

export async function getSubscription(userId: string): Promise<SubscriptionInfo> {
  const [existing] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));

  if (existing) return mapSub(existing);

  const [created] = await db
    .insert(subscriptionsTable)
    .values({ userId, tier: "free", status: "active", billingCycle: "monthly" })
    .returning();

  return mapSub(created!);
}

export async function trackScanUsage(userId: string): Promise<void> {
  const period = getPeriod();
  await db
    .insert(usageTrackingTable)
    .values({ userId, period, scansUsed: 1 })
    .onConflictDoUpdate({
      target: [usageTrackingTable.userId, usageTrackingTable.period],
      set: {
        scansUsed: sql`${usageTrackingTable.scansUsed} + 1`,
        updatedAt: new Date(),
      },
    });
}

export async function getUsageForPeriod(
  userId: string,
  period?: string
): Promise<{ scansUsed: number; accountsConnected: number; alertsSent: number; aiCallsMade: number }> {
  const p = period ?? getPeriod();
  const [row] = await db
    .select()
    .from(usageTrackingTable)
    .where(and(eq(usageTrackingTable.userId, userId), eq(usageTrackingTable.period, p)));

  if (!row) return { scansUsed: 0, accountsConnected: 0, alertsSent: 0, aiCallsMade: 0 };
  return {
    scansUsed: row.scansUsed,
    accountsConnected: row.accountsConnected,
    alertsSent: row.alertsSent,
    aiCallsMade: row.aiCallsMade,
  };
}

function getPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function mapSub(s: typeof subscriptionsTable.$inferSelect): SubscriptionInfo {
  return {
    id: s.id,
    userId: s.userId,
    tier: s.tier as Tier,
    status: s.status as SubStatus,
    billingCycle: s.billingCycle as "monthly" | "yearly",
    currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
  };
}
