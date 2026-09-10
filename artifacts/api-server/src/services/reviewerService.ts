import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

/**
 * App Review access is an entitlement of one authenticated Clerk user, not a
 * credential supplied by the client.  Resolve the internal user first so all
 * reviewer data remains scoped to the normal user id.
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

  return user?.clerkId === configuredClerkId;
}