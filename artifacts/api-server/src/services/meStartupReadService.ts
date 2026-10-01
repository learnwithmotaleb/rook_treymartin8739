import { eq } from "drizzle-orm";
import { db, subscriptionsTable } from "@workspace/db";
import { getSubscription } from "./subscriptionService";
import { recalculateScore } from "./scoreService";

type MeStartupDependencies = {
  getStoredSubscriptionTier: (userId: string) => Promise<string | null>;
  getSubscription: (userId: string) => Promise<{ tier: string }>;
  recalculateScore: (userId: string) => Promise<number>;
};

async function getStoredSubscriptionTier(userId: string): Promise<string | null> {
  const [subscription] = await db
    .select({ tier: subscriptionsTable.tier })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .limit(1);
  return subscription?.tier ?? null;
}

/**
 * GET /me is the authenticated app's startup read. Reviewer reads must remain
 * authoritative but avoid getSubscription's insert-on-miss and the persistent
 * score recalculation. Normal users retain the existing enrichment behavior.
 */
export async function getMeStartupFields(
  userId: string,
  isReviewer: boolean,
  storedSecurityScore: number,
  dependencies: MeStartupDependencies = {
    getStoredSubscriptionTier,
    getSubscription,
    recalculateScore,
  },
): Promise<{ tier: string; securityScore: number }> {
  if (isReviewer) {
    return {
      tier: (await dependencies.getStoredSubscriptionTier(userId)) ?? "free",
      securityScore: storedSecurityScore,
    };
  }

  const subscription = await dependencies.getSubscription(userId);
  return {
    tier: subscription.tier,
    securityScore: await dependencies.recalculateScore(userId),
  };
}