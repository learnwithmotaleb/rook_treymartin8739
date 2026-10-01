import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

const CLERK_USER_CACHE_TTL_MS = 60_000;
const CLERK_USER_MISS_CACHE_TTL_MS = 5_000;

type ClerkEmailAddress = {
  id?: string;
  email_address?: string;
  verification?: { status?: string | null } | null;
};

export type ClerkReviewerIdentity = {
  id?: string;
  primary_email_address_id?: string | null;
  email_addresses?: ClerkEmailAddress[];
};

type ReviewerLookupDependencies = {
  getStoredClerkId: (userId: string) => Promise<string | null>;
  getClerkUsersByEmail: (email: string) => Promise<ClerkReviewerIdentity[]>;
};

type CachedClerkUsers = {
  expiresAt: number;
  users: ClerkReviewerIdentity[];
};

type ClerkFetch = (input: string, init: RequestInit) => Promise<Response>;
type ClerkReviewerEmailLookup = ((email: string) => Promise<ClerkReviewerIdentity[]>) & {
  invalidate: (email: string) => void;
};

/**
 * Look up the Clerk user in the same active tenant used by reviewerAuth.
 * Successful and not-found lookups are cached briefly to avoid a Clerk API
 * request on every guarded endpoint. The API credential is never logged.
 */
export function createClerkReviewerEmailLookup(
  fetcher: ClerkFetch = fetch,
  getSecretKey: () => string | undefined = () => process.env["CLERK_SECRET_KEY"],
  now: () => number = Date.now,
  cacheTtlMs = CLERK_USER_CACHE_TTL_MS,
): ClerkReviewerEmailLookup {
  const cache = new Map<string, CachedClerkUsers>();
  const pending = new Map<string, Promise<ClerkReviewerIdentity[]>>();
  const generations = new Map<string, number>();

  const lookup: ClerkReviewerEmailLookup = async (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    const cached = cache.get(normalizedEmail);
    if (cached && cached.expiresAt > now()) return cached.users;
    if (cached) cache.delete(normalizedEmail);

    const existingRequest = pending.get(normalizedEmail);
    if (existingRequest) return existingRequest;

    const generation = generations.get(normalizedEmail) ?? 0;
    const request = (async () => {
      const secretKey = getSecretKey()?.trim();
      if (!secretKey) {
        throw new Error("Clerk reviewer identity lookup is not configured");
      }

      let response: Response;
      try {
        const query = new URLSearchParams({
          email_address: normalizedEmail,
          limit: "2",
        });
        response = await fetcher(`https://api.clerk.com/v1/users?${query.toString()}`, {
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(5_000),
        });
      } catch {
        throw new Error("Trusted Clerk reviewer identity lookup failed");
      }

      if (response.status === 404) {
        const users: ClerkReviewerIdentity[] = [];
        if ((generations.get(normalizedEmail) ?? 0) === generation) {
          cache.set(normalizedEmail, {
            expiresAt: now() + CLERK_USER_MISS_CACHE_TTL_MS,
            users,
          });
        }
        return users;
      }
      if (!response.ok) {
        throw new Error(`Trusted Clerk reviewer identity lookup failed (${response.status})`);
      }

      let users: ClerkReviewerIdentity[];
      try {
        const result = await response.json() as unknown;
        if (!Array.isArray(result)) throw new Error("Expected a user list");
        users = result as ClerkReviewerIdentity[];
      } catch {
        throw new Error("Trusted Clerk reviewer identity response was invalid");
      }
      const isVerifiedReviewer = (
        users.length === 1 &&
        hasVerifiedPrimaryReviewerEmail(users[0]!, normalizedEmail)
      );
      if ((generations.get(normalizedEmail) ?? 0) === generation) {
        // Cache positive identities longer than misses and unverified results.
        // reviewerAuth invalidates this entry after provisioning/retrieval.
        cache.set(normalizedEmail, {
          expiresAt: now() + (isVerifiedReviewer ? cacheTtlMs : CLERK_USER_MISS_CACHE_TTL_MS),
          users,
        });
      }
      return users;
    })();

    pending.set(normalizedEmail, request);
    try {
      return await request;
    } finally {
      if (pending.get(normalizedEmail) === request) pending.delete(normalizedEmail);
    }
  };

  lookup.invalidate = (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    cache.delete(normalizedEmail);
    pending.delete(normalizedEmail);
    generations.set(normalizedEmail, (generations.get(normalizedEmail) ?? 0) + 1);
  };
  return lookup;
}

async function getStoredClerkId(userId: string): Promise<string | null> {
  const [user] = await db
    .select({ clerkId: usersTable.clerkId })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return user?.clerkId ?? null;
}

const trustedClerkEmailLookup = createClerkReviewerEmailLookup();

export function invalidateReviewerEmailLookup(email: string): void {
  trustedClerkEmailLookup.invalidate(email);
}

function hasVerifiedPrimaryReviewerEmail(
  user: ClerkReviewerIdentity,
  email: string,
): boolean {
  if (!user.id || !user.primary_email_address_id) return false;

  const primaryEmail = user.email_addresses?.find(
    (address) => address.id === user.primary_email_address_id,
  );
  return Boolean(
    primaryEmail?.verification?.status === "verified" &&
    primaryEmail.email_address?.trim().toLowerCase() === email,
  );
}

/**
 * Reviewer privileges use the configured email mode when present, matching
 * reviewerAuth's email-first configuration. Email authorization is established
 * from Clerk's verified primary email and the immutable Clerk ID linked to the
 * authenticated local user; usersTable.email is never read here. Static Clerk
 * IDs are the fallback only when no reviewer email is configured.
 */
export function createReviewerDesignationChecker(
  lookups: ReviewerLookupDependencies = {
    getStoredClerkId,
    getClerkUsersByEmail: trustedClerkEmailLookup,
  },
): (userId: string | undefined, authenticatedClerkId?: string) => Promise<boolean> {
  return async (userId, authenticatedClerkId) => {
    const configuredEmail = process.env["APP_REVIEW_EMAIL"]?.trim().toLowerCase();
    if (configuredEmail) {
      const candidates = (await lookups.getClerkUsersByEmail(configuredEmail)).filter(
        (user) => user.email_addresses?.some(
          (address) => address.email_address?.trim().toLowerCase() === configuredEmail,
        ),
      );
      if (candidates.length !== 1) return false;

      const reviewer = candidates[0]!;
      if (!hasVerifiedPrimaryReviewerEmail(reviewer, configuredEmail)) return false;

      let clerkId = authenticatedClerkId;
      if (userId) {
        const storedClerkId = await lookups.getStoredClerkId(userId);
        if (!storedClerkId || (clerkId && clerkId !== storedClerkId)) return false;
        clerkId = storedClerkId;
      }
      return Boolean(clerkId && clerkId === reviewer.id);
    }

    const configuredClerkId = (
      process.env["APP_REVIEW_USER_ID"] ??
      process.env["APP_REVIEW_CLERK_USER_ID"]
    )?.trim();
    if (!configuredClerkId) return false;
    if (authenticatedClerkId && authenticatedClerkId !== configuredClerkId) return false;

    if (userId) {
      const storedClerkId = await lookups.getStoredClerkId(userId);
      return storedClerkId === configuredClerkId &&
        (!authenticatedClerkId || storedClerkId === authenticatedClerkId);
    }

    return authenticatedClerkId === configuredClerkId;
  };
}

export const isDesignatedReviewer = createReviewerDesignationChecker();

export async function isDesignatedReviewerClerkId(clerkId: string): Promise<boolean> {
  return isDesignatedReviewer(undefined, clerkId);
}