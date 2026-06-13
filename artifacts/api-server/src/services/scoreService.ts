import { eq, and } from "drizzle-orm";
import { db, usersTable, threatsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const BASELINE = 95;
const DEDUCTION: Record<string, number> = {
  high: 15,
  medium: 8,
  low: 3,
};

/**
 * Recompute and persist the security score for a user based on their current
 * active (unresolved) threats.  Also updates scoreTrend (delta from previous).
 *
 * Formula:
 *   score = max(0, 95 − 15×high − 8×medium − 3×low)
 *
 * Returns the new score so callers can log or return it to the client.
 */
export async function recalculateScore(userId: string): Promise<number> {
  const [user] = await db
    .select({ securityScore: usersTable.securityScore })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) return BASELINE;

  const activeThreats = await db
    .select({ severity: threatsTable.severity })
    .from(threatsTable)
    .where(
      and(eq(threatsTable.userId, userId), eq(threatsTable.resolved, false))
    );

  const deduction = activeThreats.reduce(
    (sum, t) => sum + (DEDUCTION[t.severity] ?? 3),
    0
  );

  const newScore = Math.max(0, BASELINE - deduction);
  const trend = newScore - user.securityScore;

  await db
    .update(usersTable)
    .set({ securityScore: newScore, scoreTrend: trend, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  logger.info(
    { userId, newScore, trend, activeThreats: activeThreats.length },
    "Security score recalculated"
  );

  return newScore;
}
