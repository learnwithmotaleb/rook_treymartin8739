import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { eq, inArray } from "drizzle-orm";
import { db, devicePushTokensTable } from "@workspace/db";
import { logger } from "../lib/logger.js";

const expo = new Expo();

export async function sendPushToUser(
  userId: string,
  notification: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }
): Promise<void> {
  const rows = await db
    .select({ token: devicePushTokensTable.token })
    .from(devicePushTokensTable)
    .where(eq(devicePushTokensTable.userId, userId));

  if (rows.length === 0) return;

  const messages: ExpoPushMessage[] = rows
    .map((r) => r.token)
    .filter((t): t is string => Expo.isExpoPushToken(t))
    .map((to) => ({
      to,
      sound: "default" as const,
      title: notification.title,
      body: notification.body,
      data: notification.data ?? {},
    }));

  if (messages.length === 0) return;

  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      const invalidTokens: string[] = [];
      tickets.forEach((ticket, index) => {
        if (ticket.status === "error") {
          logger.warn({ details: ticket.details }, "Expo push ticket error (non-fatal)");
          if (ticket.details?.error === "DeviceNotRegistered") {
            const token = chunk[index]?.to;
            if (typeof token === "string") invalidTokens.push(token);
          }
        }
      });
      if (invalidTokens.length > 0) {
        await db.delete(devicePushTokensTable).where(inArray(devicePushTokensTable.token, invalidTokens));
      }
    } catch (err) {
      logger.warn({ err }, "Expo push chunk failed (non-fatal)");
    }
  }
}

export async function sendScanCompleteNotification(
  userId: string,
  threatsFound: number
): Promise<void> {
  await sendPushToUser(userId, {
    title: threatsFound > 0 ? "⚠️ New threats detected" : "✅ Scan complete",
    body:
      threatsFound > 0
        ? `${threatsFound} new threat${threatsFound === 1 ? "" : "s"} found — tap to review your alerts.`
        : "No new threats found. Your identity looks secure.",
    data: { screen: threatsFound > 0 ? "alerts" : "home" },
  });
}

export async function sendThreatNotification(
  userId: string,
  platform: string,
  suspiciousUsername: string
): Promise<void> {
  await sendPushToUser(userId, {
    title: "🚨 Impersonator detected",
    body: `${suspiciousUsername} on ${platform} is impersonating your identity.`,
    data: { screen: "alerts" },
  });
}
