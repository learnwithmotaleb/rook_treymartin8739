import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, connectedAccountsTable } from "@workspace/db";

import { getSubscription } from "../services/subscriptionService";
import { PLAN_CONFIG } from "../lib/planConfig";

const router: IRouter = Router();

const VALID_PLATFORMS = [
  "instagram", "x", "tiktok", "linkedin", "youtube", "facebook", "snapchat",
];

router.get("/accounts", async (req, res): Promise<void> => {
  const userId = req.userId;

  const accounts = await db
    .select()
    .from(connectedAccountsTable)
    .where(eq(connectedAccountsTable.userId, userId));

  res.json(
    accounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      username: a.username,
      displayName: a.displayName,
      followers: a.followers,
      verified: a.verified,
      photosIndexed: a.photosIndexed,
      captionsIndexed: a.captionsIndexed,
      reelsIndexed: a.reelsIndexed,
      lastSynced: a.lastSynced?.toISOString() ?? null,
    }))
  );
});

router.post("/accounts", async (req, res): Promise<void> => {
  const userId = req.userId;

  const { platform, username, accessToken } = req.body as {
    platform?: string;
    username?: string;
    accessToken?: string;
  };

  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    res.status(400).json({ error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}` });
    return;
  }

  if (!username) {
    res.status(400).json({ error: "username is required" });
    return;
  }

  const existing = await db
    .select({ id: connectedAccountsTable.id })
    .from(connectedAccountsTable)
    .where(
      and(
        eq(connectedAccountsTable.userId, userId),
        eq(connectedAccountsTable.platform, platform)
      )
    );

  if (existing.length > 0) {
    res.status(400).json({ error: `${platform} account is already connected` });
    return;
  }

  const sub = await getSubscription(userId);
  const limits = PLAN_CONFIG[sub.tier as keyof typeof PLAN_CONFIG] ?? PLAN_CONFIG.free;
  const allAccounts = await db
    .select({ id: connectedAccountsTable.id })
    .from(connectedAccountsTable)
    .where(eq(connectedAccountsTable.userId, userId));

  if (limits.maxAccounts !== -1 && allAccounts.length >= limits.maxAccounts) {
    res.status(403).json({
      error: "account_limit_reached",
      message: `Your ${limits.label} plan supports up to ${limits.maxAccounts} connected account${limits.maxAccounts === 1 ? "" : "s"}. Upgrade to add more.`,
      currentTier: sub.tier,
      limit: limits.maxAccounts,
    });
    return;
  }

  const [account] = await db
    .insert(connectedAccountsTable)
    .values({
      userId,
      platform,
      username,
      accessToken: accessToken ?? null,
      verified: !!accessToken,
      followers: 0,
      photosIndexed: 0,
      captionsIndexed: 0,
      reelsIndexed: 0,
      lastSynced: accessToken ? new Date() : null,
    })
    .returning();

  if (!account) {
    res.status(500).json({ error: "Failed to connect account" });
    return;
  }

  res.status(201).json({
    id: account.id,
    platform: account.platform,
    username: account.username,
    displayName: account.displayName,
    followers: account.followers,
    verified: account.verified,
    photosIndexed: account.photosIndexed,
    captionsIndexed: account.captionsIndexed,
    reelsIndexed: account.reelsIndexed,
    lastSynced: account.lastSynced?.toISOString() ?? null,
  });
});

router.patch("/accounts/:accountId", async (req, res): Promise<void> => {
  const userId = req.userId;
  const accountId = Array.isArray(req.params.accountId)
    ? req.params.accountId[0]
    : req.params.accountId;

  const { accessToken, displayName, followers, platformUserId } = req.body as {
    accessToken?: string;
    displayName?: string;
    followers?: number;
    platformUserId?: string;
  };

  const [updated] = await db
    .update(connectedAccountsTable)
    .set({
      ...(accessToken !== undefined && { accessToken }),
      ...(displayName !== undefined && { displayName }),
      ...(followers !== undefined && { followers }),
      ...(platformUserId !== undefined && { platformUserId }),
      verified: accessToken ? true : undefined,
      lastSynced: new Date(),
    })
    .where(
      and(
        eq(connectedAccountsTable.id, accountId),
        eq(connectedAccountsTable.userId, userId)
      )
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  res.json({
    id: updated.id,
    platform: updated.platform,
    username: updated.username,
    displayName: updated.displayName,
    followers: updated.followers,
    verified: updated.verified,
    photosIndexed: updated.photosIndexed,
    captionsIndexed: updated.captionsIndexed,
    reelsIndexed: updated.reelsIndexed,
    lastSynced: updated.lastSynced?.toISOString() ?? null,
  });
});

router.delete("/accounts/:accountId", async (req, res): Promise<void> => {
  const userId = req.userId;
  const accountId = Array.isArray(req.params.accountId)
    ? req.params.accountId[0]
    : req.params.accountId;

  const [deleted] = await db
    .delete(connectedAccountsTable)
    .where(
      and(
        eq(connectedAccountsTable.id, accountId),
        eq(connectedAccountsTable.userId, userId)
      )
    )
    .returning({ id: connectedAccountsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
