import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

/**
 * Reviewer privileges belong only to the exact server-configured identity.
 * APP_REVIEW_EMAIL takes precedence over legacy environment-specific Clerk IDs.
 * Removing that configuration after review removes reviewer privileges.
 */
export async function isDesignatedReviewer(userId: string): Promise<boolean> {
  const configuredEmail = process.env["APP_REVIEW_EMAIL"]?.trim().toLowerCase();
  const configuredClerkId = (
    process.env["APP_REVIEW_USER_ID"] ??
    process.env["APP_REVIEW_CLERK_USER_ID"]
  )?.trim();
  if (!configuredEmail && !configuredClerkId) return false;

  const [user] = await db
    .select({ clerkId: usersTable.clerkId, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (configuredEmail) return user?.email?.trim().toLowerCase() === configuredEmail;
  return user?.clerkId === configuredClerkId;
}