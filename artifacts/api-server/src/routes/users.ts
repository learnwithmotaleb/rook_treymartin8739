import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  connectedAccountsTable,
} from "@workspace/db";

import { getFingerprintForUser } from "../services/fingerprintService";
import { scanJobsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { getSubscription } from "../services/subscriptionService";

const router: IRouter = Router();

router.get("/me", async (req, res): Promise<void> => {
  const userId = req.userId;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const accounts = await db
    .select()
    .from(connectedAccountsTable)
    .where(eq(connectedAccountsTable.userId, userId));

  const fingerprint = await getFingerprintForUser(userId);

  const [lastScanJob] = await db
    .select({ completedAt: scanJobsTable.completedAt })
    .from(scanJobsTable)
    .where(eq(scanJobsTable.userId, userId))
    .orderBy(desc(scanJobsTable.startedAt))
    .limit(1);

  const lastScan = lastScanJob?.completedAt
    ? formatRelativeTime(lastScanJob.completedAt)
    : "Never";

  const fingerprintUpdated = fingerprint.lastUpdated
    ? formatRelativeTime(new Date(fingerprint.lastUpdated))
    : "Never";

  const sub = await getSubscription(userId);

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    avatarInitials: user.avatarInitials,
    isPremium: user.isPremium,
    tier: sub.tier,
    securityScore: user.securityScore,
    scoreTrend: user.scoreTrend,
    monitored: accounts.length,
    lastScan,
    totalPhotosIndexed: fingerprint.totalPhotosIndexed,
    totalCaptionsIndexed: fingerprint.totalCaptionsIndexed,
    reelsIndexed: fingerprint.reelsIndexed,
    fingerprintUpdated,
  });
});

router.patch("/me", async (req, res): Promise<void> => {
  const userId = req.userId;

  const { name, username, email } = req.body as {
    name?: string;
    username?: string;
    email?: string;
  };

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) {
      res.status(400).json({ error: "Name cannot be empty" });
      return;
    }
    updates.name = trimmed;
    const initials = trimmed
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");
    updates.avatarInitials = initials;
  }

  if (username !== undefined) updates.username = username.trim();
  if (email !== undefined) updates.email = email.trim() || null;

  await db
    .update(usersTable)
    .set(updates as Parameters<typeof db.update>[0] extends infer T ? any : never)
    .where(eq(usersTable.id, userId));

  const [updated] = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, username: usersTable.username, avatarInitials: usersTable.avatarInitials })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  res.json(updated);
});

router.delete("/me", async (req, res): Promise<void> => {
  const userId = req.userId;

  const [user] = await db
    .select({ id: usersTable.id, clerkId: usersTable.clerkId })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Fetch connected accounts so we can revoke OAuth tokens before deleting.
  const accounts = await db
    .select({
      platform: connectedAccountsTable.platform,
      accessToken: connectedAccountsTable.accessToken,
      platformUserId: connectedAccountsTable.platformUserId,
    })
    .from(connectedAccountsTable)
    .where(eq(connectedAccountsTable.userId, userId));

  // Best-effort OAuth token revocation per platform (errors are non-fatal).
  await Promise.allSettled(
    accounts
      .filter((a) => a.accessToken)
      .map(async (account) => {
        const token = account.accessToken!;
        try {
          if (account.platform === "facebook" || account.platform === "instagram") {
            // Meta revocation endpoint
            await fetch(
              `https://graph.facebook.com/${account.platformUserId ?? "me"}/permissions?access_token=${token}`,
              { method: "DELETE" }
            );
          }
          // Other platforms (X, TikTok, LinkedIn, etc.) require server-to-server
          // revocation with app credentials — handled separately if credentials are available.
        } catch (err) {
          req.log.warn({ platform: account.platform, err }, "Token revocation failed (non-fatal)");
        }
      })
  );

  // Cascade delete: connected_accounts, visual_fingerprints, scan_jobs, threats, etc.
  // all have onDelete:"cascade" referencing usersTable.id, so one delete suffices.
  await db.delete(usersTable).where(eq(usersTable.id, userId));

  req.log.info({ userId }, "User account deleted");
  res.status(204).end();
});

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default router;
