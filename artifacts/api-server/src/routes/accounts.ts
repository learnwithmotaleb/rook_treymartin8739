import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, connectedAccountsTable } from "@workspace/db";
import { resolveUserId } from "../lib/demoUser";

const router: IRouter = Router();

const VALID_PLATFORMS = [
  "instagram", "x", "tiktok", "linkedin", "youtube", "facebook", "snapchat",
];

router.get("/accounts", async (req, res): Promise<void> => {
  const userId = await resolveUserId(req.headers["x-user-id"]);

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
  const userId = await resolveUserId(req.headers["x-user-id"]);

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

router.delete("/accounts/:accountId", async (req, res): Promise<void> => {
  const userId = await resolveUserId(req.headers["x-user-id"]);
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
