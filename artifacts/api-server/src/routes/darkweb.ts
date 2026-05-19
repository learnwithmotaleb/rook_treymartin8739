import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, threatsTable, usersTable } from "@workspace/db";
import { resolveUserId } from "../lib/demoUser";

const router: IRouter = Router();

router.get("/dark-web", async (req, res): Promise<void> => {
  const userId = await resolveUserId(req.headers["x-user-id"]);

  const [user] = await db
    .select({ email: usersTable.email, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const darkWebThreats = await db
    .select()
    .from(threatsTable)
    .where(
      and(
        eq(threatsTable.userId, userId),
        eq(threatsTable.type, "dark_web"),
        eq(threatsTable.resolved, false)
      )
    );

  const breachThreats = await db
    .select()
    .from(threatsTable)
    .where(
      and(
        eq(threatsTable.userId, userId),
        eq(threatsTable.type, "leaked_password"),
        eq(threatsTable.resolved, false)
      )
    );

  const mentions = darkWebThreats.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    severity: t.severity,
    threatScore: t.threatScore,
    resolved: t.resolved,
    detectedAt: t.createdAt.toISOString(),
  }));

  const breaches = breachThreats.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    severity: t.severity,
    threatScore: t.threatScore,
    resolved: t.resolved,
    detectedAt: t.createdAt.toISOString(),
  }));

  res.json({
    monitoredEmail: maskEmail(user.email),
    monitoredUsername: user.username,
    mentions,
    breaches,
    totalExposures: mentions.length + breaches.length,
    lastChecked: new Date().toISOString(),
    monitored: [
      { type: "Email Address", value: maskEmail(user.email), status: mentions.length + breaches.length > 0 ? "exposed" : "clean" },
      { type: "Username", value: user.username, status: darkWebThreats.some((t) => !t.resolved) ? "mentioned" : "clean" },
      { type: "Passwords", value: "Hashed credentials", status: breachThreats.some((t) => !t.resolved) ? "exposed" : "clean" },
    ],
  });
});

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const masked =
    local.length > 3
      ? local[0] + "*".repeat(local.length - 2) + local[local.length - 1]
      : local[0] + "***";
  return `${masked}@${domain}`;
}

export default router;
