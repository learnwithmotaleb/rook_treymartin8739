import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db, connectedAccountsTable } from "@workspace/db";

import { getSubscription } from "../services/subscriptionService";
import { PLAN_CONFIG, normalizeTier } from "../lib/planConfig";
import { recomputeForUser } from "../services/identityAnchorService";

const router: IRouter = Router();

const VALID_PLATFORMS = [
  "instagram", "x", "tiktok", "linkedin", "youtube", "facebook", "snapchat",
];

router.get("/accounts", async (req, res): Promise<void> => {
  try {
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
        needsReconnect: a.needsReconnect,
        photosIndexed: a.photosIndexed,
        captionsIndexed: a.captionsIndexed,
        reelsIndexed: a.reelsIndexed,
        lastSynced: a.lastSynced?.toISOString() ?? null,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "GET /accounts failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

const PostAccountBody = z.object({
  platform: z.string(),
  username: z.string().min(1),
  accessToken: z.string().optional(),
  displayName: z.string().optional(),
});

const PatchAccountBody = z.object({
  accessToken: z.string().optional(),
  displayName: z.string().optional(),
  followers: z.number().int().nonnegative().optional(),
  platformUserId: z.string().optional(),
});

router.post("/accounts", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;

    const parsed = PostAccountBody.safeParse(req.body);
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      if (field === "username") {
        res.status(400).json({ error: "username is required" });
      } else {
        res.status(400).json({ error: "platform and username are required" });
      }
      return;
    }
    const { platform, username, accessToken, displayName } = parsed.data;

    if (!VALID_PLATFORMS.includes(platform)) {
      res.status(400).json({ error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}` });
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
    const limits = PLAN_CONFIG[normalizeTier(sub.tier)] ?? PLAN_CONFIG.free;
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
        displayName: displayName ?? null,
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
      needsReconnect: account.needsReconnect,
      photosIndexed: account.photosIndexed,
      captionsIndexed: account.captionsIndexed,
      reelsIndexed: account.reelsIndexed,
      lastSynced: account.lastSynced?.toISOString() ?? null,
    });

    recomputeForUser(userId).catch(() => {});
  } catch (err) {
    req.log.error({ err }, "POST /accounts failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/accounts/:accountId", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const accountId = Array.isArray(req.params.accountId)
      ? req.params.accountId[0]
      : req.params.accountId;

    const parsedPatch = PatchAccountBody.safeParse(req.body);
    if (!parsedPatch.success) {
      res.status(400).json({ error: parsedPatch.error.issues[0]?.message ?? "Invalid request body" });
      return;
    }
    const { accessToken, displayName, followers, platformUserId } = parsedPatch.data;

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
  } catch (err) {
    req.log.error({ err }, "PATCH /accounts/:accountId failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

const PLATFORM_SCOPES: Record<string, string[]> = {
  instagram: ["View basic profile info", "Read posts & photos"],
  facebook: ["View public profile"],
  x: ["Read tweets", "View profile", "Auto-refresh tokens"],
  tiktok: ["View basic profile info"],
  linkedin: ["View profile"],
  youtube: ["View public channel info"],
  snapchat: ["View public profile"],
};

/**
 * GET /accounts/:accountId/status
 * Returns live token health for a specific account.
 */
router.get("/accounts/:accountId/status", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const accountId = Array.isArray(req.params.accountId)
      ? req.params.accountId[0]!
      : req.params.accountId;

    const [account] = await db
      .select({
        verified: connectedAccountsTable.verified,
        tokenExpiresAt: connectedAccountsTable.tokenExpiresAt,
        needsReconnect: connectedAccountsTable.needsReconnect,
        platform: connectedAccountsTable.platform,
      })
      .from(connectedAccountsTable)
      .where(
        and(
          eq(connectedAccountsTable.id, accountId),
          eq(connectedAccountsTable.userId, userId)
        )
      );

    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    res.json({
      verified: account.verified,
      tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
      needsReconnect: account.needsReconnect,
      scopesGranted: PLATFORM_SCOPES[account.platform] ?? [],
    });
  } catch (err) {
    req.log.error({ err }, "GET /accounts/:accountId/status failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /accounts/:accountId/media
 * Returns real media items for a connected account using the platform adapter.
 * Requires an OAuth access token — accounts without one return hasAccess: false.
 */
router.get("/accounts/:accountId/media", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const accountId = Array.isArray(req.params.accountId)
      ? req.params.accountId[0]!
      : req.params.accountId;

    const [account] = await db
      .select()
      .from(connectedAccountsTable)
      .where(
        and(
          eq(connectedAccountsTable.id, accountId),
          eq(connectedAccountsTable.userId, userId)
        )
      );

    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    if (!account.accessToken || !account.verified) {
      res.json({ items: [], hasAccess: false, reason: "no_oauth_token" });
      return;
    }

    const { getAdapter } = await import("../adapters/platformAdapter");
    const adapter = getAdapter(account.platform);
    if (!adapter) {
      res.json({ items: [], hasAccess: false, reason: "unsupported_platform" });
      return;
    }

    const limitParsed = z.coerce.number().int().min(1).max(50).default(30).safeParse(req.query["limit"]);
    if (!limitParsed.success) {
      res.status(400).json({ error: "limit must be a number between 1 and 50" });
      return;
    }
    const limit = limitParsed.data;
    const mediaItems = await adapter.getMediaItems(
      account.accessToken,
      account.platformUserId ?? "",
      limit
    );

    res.json({
      items: mediaItems
        .filter((m) => m.url)
        .map((m) => ({
          id: m.platformMediaId,
          type: m.type,
          url: m.url,
          thumbnailUrl: m.thumbnailUrl ?? m.url,
          caption: m.caption ?? null,
          postedAt: m.postedAt?.toISOString() ?? null,
        })),
      hasAccess: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "GET /accounts/:accountId/media failed");
    res.status(500).json({ error: "Failed to fetch media from platform", detail: message });
  }
});

router.delete("/accounts/:accountId", async (req, res): Promise<void> => {
  try {
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

    recomputeForUser(userId).catch(() => {});
  } catch (err) {
    req.log.error({ err }, "DELETE /accounts/:accountId failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
