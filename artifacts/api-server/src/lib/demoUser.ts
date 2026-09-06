/**
 * Demo User Helper
 *
 * Creates and seeds a demo user with connected accounts and fingerprint data
 * for local development demonstrations only. Production requests must be
 * authenticated and must never be assigned this shared account.
 */

import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  connectedAccountsTable,
  visualFingerprintsTable,
  type User,
} from "@workspace/db";
import { logger } from "./logger";

const DEMO_EMAIL = "demo@getrook.app";
const isDevelopment = process.env["NODE_ENV"] === "development";

export class DemoUserDisabledError extends Error {
  constructor() {
    super("Demo users are available only when NODE_ENV=development.");
    this.name = "DemoUserDisabledError";
  }
}

function requireDevelopmentDemoMode(): void {
  if (!isDevelopment) {
    throw new DemoUserDisabledError();
  }
}

const DEMO_ACCOUNTS = [
  { platform: "instagram", username: "@alexjohnson", followers: 12400, photosIndexed: 84, captionsIndexed: 72, reelsIndexed: 18 },
  { platform: "x", username: "@alexjohnson", followers: 8200, photosIndexed: 31, captionsIndexed: 48, reelsIndexed: 0 },
  { platform: "tiktok", username: "@alexj", followers: 24100, photosIndexed: 67, captionsIndexed: 31, reelsIndexed: 23 },
  { platform: "linkedin", username: "alex-johnson", followers: 1800, photosIndexed: 12, captionsIndexed: 18, reelsIndexed: 0 },
  { platform: "youtube", username: "AlexJohnson", followers: 5600, photosIndexed: 38, captionsIndexed: 8, reelsIndexed: 0 },
  { platform: "facebook", username: "alexjohnson", followers: 3200, photosIndexed: 15, captionsIndexed: 6, reelsIndexed: 0 },
];

export async function getOrCreateDemoUser(): Promise<User> {
  requireDevelopmentDemoMode();

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, DEMO_EMAIL));

  if (existing) return existing;

  logger.info("Creating demo user and seeding initial data");

  const [user] = await db
    .insert(usersTable)
    .values({
      email: DEMO_EMAIL as string,
      name: "Alex Johnson",
      username: "@alexjohnson",
      avatarInitials: "AJ",
      securityScore: 72,
      scoreTrend: 12,
    })
    .returning();

  if (!user) throw new Error("Failed to create demo user");

  for (const acct of DEMO_ACCOUNTS) {
    await db.insert(connectedAccountsTable).values({
      userId: user.id,
      platform: acct.platform,
      username: acct.username,
      followers: acct.followers,
      verified: true,
      photosIndexed: acct.photosIndexed,
      captionsIndexed: acct.captionsIndexed,
      reelsIndexed: acct.reelsIndexed,
      lastSynced: new Date(),
    });
  }

  const totalPhotos = DEMO_ACCOUNTS.reduce((s, a) => s + a.photosIndexed, 0);
  const totalCaptions = DEMO_ACCOUNTS.reduce((s, a) => s + a.captionsIndexed, 0);
  const totalReels = DEMO_ACCOUNTS.reduce((s, a) => s + a.reelsIndexed, 0);

  await db.insert(visualFingerprintsTable).values({
    userId: user.id,
    totalPhotosIndexed: totalPhotos,
    totalCaptionsIndexed: totalCaptions,
    reelsIndexed: totalReels,
    lastUpdated: new Date(),
  });

  logger.info({ userId: user.id }, "Demo user seeded successfully");
  return user;
}

export async function resolveUserId(headerValue: string | string[] | undefined): Promise<string> {
  requireDevelopmentDemoMode();

  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const id = raw?.trim() ?? "";

  if (!id || id === "demo") {
    const demo = await getOrCreateDemoUser();
    return demo.id;
  }

  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, id));

  if (!user) {
    const demo = await getOrCreateDemoUser();
    return demo.id;
  }

  return user.id;
}
