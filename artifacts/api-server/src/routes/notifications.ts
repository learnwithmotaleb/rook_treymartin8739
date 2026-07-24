import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db, devicePushTokensTable } from "@workspace/db";

const router: IRouter = Router();

const TokenBody = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android"]),
});

router.patch("/notifications/token", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;

    const parsed = TokenBody.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.path[0] === "token") {
        res.status(400).json({ error: "token is required" });
      } else {
        res.status(400).json({ error: "platform must be 'ios' or 'android'" });
      }
      return;
    }
    const { token, platform } = parsed.data;

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
  } catch (err) {
    req.log.error({ err }, "PATCH /notifications/token failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/notifications/token", async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    req.log.error({ err }, "DELETE /notifications/token failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
