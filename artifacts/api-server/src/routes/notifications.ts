import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, devicePushTokensTable } from "@workspace/db";

const router: IRouter = Router();

router.patch("/notifications/token", async (req, res): Promise<void> => {
  const userId = req.userId;
  const { token, platform } = req.body as { token?: string; platform?: string };

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token is required" });
    return;
  }
  if (!platform || !["ios", "android"].includes(platform)) {
    res.status(400).json({ error: "platform must be 'ios' or 'android'" });
    return;
  }

  const existing = await db
    .select({ id: devicePushTokensTable.id })
    .from(devicePushTokensTable)
    .where(
      and(
        eq(devicePushTokensTable.userId, userId),
        eq(devicePushTokensTable.platform, platform)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(devicePushTokensTable)
      .set({ token, updatedAt: new Date() })
      .where(
        and(
          eq(devicePushTokensTable.userId, userId),
          eq(devicePushTokensTable.platform, platform)
        )
      );
  } else {
    await db.insert(devicePushTokensTable).values({ userId, token, platform });
  }

  res.json({ ok: true });
});

router.delete("/notifications/token", async (req, res): Promise<void> => {
  const userId = req.userId;
  const platform = (req.query["platform"] as string) || "";

  if (platform && ["ios", "android"].includes(platform)) {
    await db
      .delete(devicePushTokensTable)
      .where(
        and(
          eq(devicePushTokensTable.userId, userId),
          eq(devicePushTokensTable.platform, platform)
        )
      );
  } else {
    await db
      .delete(devicePushTokensTable)
      .where(eq(devicePushTokensTable.userId, userId));
  }

  res.json({ ok: true });
});

export default router;
