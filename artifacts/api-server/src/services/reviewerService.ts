import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

const REVIEWER_CACHE_TTL_MS = 5 * 60 * 1000;
const reviewerCache = new Map<string, { isReviewer: boolean; expiresAt: number }>();

async function hasReviewerPrivateMetadata(clerkId: string): Promise<boolean> {
  const cached = reviewerCache.get(clerkId);
  if (cached && cached.expiresAt > Date.now()) return cached.isReviewer;

  const clerkSecretKey = process.env["CLERK_SECRET_KEY"]?.trim();
  if (!clerkSecretKey) return false;

  try {
    const response = await fetch(
      `https://api.clerk.com/v1/users/${encodeURIComponent(clerkId)}`,
      { headers: { Authorization: `Bearer ${clerkSecretKey}` } },
    );
    if (!response.ok) return false;
    const clerkUser = (await response.json()) as {
      private_metadata?: Record<string, unknown>;
    };
    const isReviewer = clerkUser.private_metadata?.["rookAppReviewer"] === true;
    reviewerCache.set(clerkId, {
      isReviewer,
      expiresAt: Date.now() + REVIEWER_CACHE_TTL_MS,
    });
    return isReviewer;
  } catch {
    return false;
  }
}

/**
 * App Review access is an entitlement of one authenticated Clerk user, not a
 * credential supplied by the client. Resolve the internal user first so all
 * reviewer data remains scoped to the normal user id. Replit-managed Clerk
 * keeps development and production users separate, so production uses a
 * server-only Clerk private-metadata marker created by the protected reviewer
 * ticket exchange.
 */
export async function isDesignatedReviewer(userId: string): Promise<boolean> {
  const configuredClerkId = (
    process.env["APP_REVIEW_USER_ID"] ??
    process.env["APP_REVIEW_CLERK_USER_ID"]
  )?.trim();
  if (!configuredClerkId) return false;

  const [user] = await db
    .select({ clerkId: usersTable.clerkId })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user?.clerkId) return false;
  if (user.clerkId === configuredClerkId) return true;
  return hasReviewerPrivateMetadata(user.clerkId);
}