import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
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

    await db.transaction(async (tx) => {
      // Serialize token reassignment so one physical device can never receive
      // notifications for two Rook accounts, even if a prior logout failed.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${token}))`);
      // Reassign only this exact token if it belonged to another account.
      // Do not remove the user's other iOS/Android devices.
      await tx.delete(devicePushTokensTable).where(eq(devicePushTokensTable.token, token));
      await tx.insert(devicePushTokensTable).values({ userId, token, platform });
    });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "PATCH /notifications/token failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

const DeleteTokenQuery = z.object({
  token: z.string().min(1).max(512),
}).strict();

router.delete("/notifications/token", async (req, res): Promise<void> => {
  try {
    const userId = req.userId;
    const parsed = DeleteTokenQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "token query parameter is required", details: parsed.error.flatten() });
      return;
    }
    const { token } = parsed.data;
    await db
      .delete(devicePushTokensTable)
      .where(and(
        eq(devicePushTokensTable.userId, userId),
        eq(devicePushTokensTable.token, token),
      ));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /notifications/token failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
