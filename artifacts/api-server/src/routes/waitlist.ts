import { Router, type IRouter } from "express";
import { JoinWaitlistBody } from "@workspace/api-zod";
import { db, waitlistSignupsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/waitlist", async (req, res): Promise<void> => {
  const parsed = JoinWaitlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const { email } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await db
    .select()
    .from(waitlistSignupsTable)
    .where(eq(waitlistSignupsTable.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    res.json({
      id: row.id,
      email: row.email,
      createdAt: row.createdAt.toISOString(),
      alreadyRegistered: true,
    });
    return;
  }

  const [row] = await db
    .insert(waitlistSignupsTable)
    .values({ email: normalizedEmail })
    .returning();

  res.json({
    id: row.id,
    email: row.email,
    createdAt: row.createdAt.toISOString(),
    alreadyRegistered: false,
  });
});

export default router;
