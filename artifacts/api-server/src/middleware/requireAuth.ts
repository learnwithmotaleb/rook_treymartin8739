import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { getOrCreateDemoUser } from "../lib/demoUser";
import { logger } from "../lib/logger";

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auth = getAuth(req);
    const clerkUserId = auth?.userId;
    const hasAuthHeader = !!req.headers["authorization"];

    if (clerkUserId) {
      const dbUser = await getOrCreateUserByClerkId(clerkUserId, auth);
      req.userId = dbUser.id;
      req.log.info({ clerkUserId, userId: dbUser.id }, "requireAuth: clerk user");
      return next();
    }

    if (hasAuthHeader) {
      req.log.warn("requireAuth: auth header present but Clerk could not verify — falling back to demo");
    } else {
      req.log.warn("requireAuth: no auth header — falling back to demo user");
    }

    const demo = await getOrCreateDemoUser();
    req.userId = demo.id;
    next();
  } catch (err) {
    logger.error({ err }, "requireAuth error");
    res.status(500).json({ error: "Auth error" });
  }
}

async function getOrCreateUserByClerkId(
  clerkUserId: string,
  auth: ReturnType<typeof getAuth>
): Promise<{ id: string }> {
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkUserId));

  if (existing) return existing;

  const sessionClaims = auth?.sessionClaims as Record<string, unknown> | undefined;
  const name = (sessionClaims?.["name"] as string | undefined)
    ?? (sessionClaims?.["email"] as string | undefined)?.split("@")[0]
    ?? "Shield User";
  const email = (sessionClaims?.["email"] as string | undefined) ?? null;
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const [user] = await db
    .insert(usersTable)
    .values({
      clerkId: clerkUserId,
      name,
      email,
      username: `@${name.toLowerCase().replace(/\s+/g, "")}`,
      avatarInitials: initials,
      isPremium: false,
      securityScore: 72,
      scoreTrend: 0,
    })
    .returning({ id: usersTable.id });

  if (!user) throw new Error("Failed to create user");

  logger.info({ clerkUserId, userId: user.id }, "JIT-provisioned new user");
  return user;
}
