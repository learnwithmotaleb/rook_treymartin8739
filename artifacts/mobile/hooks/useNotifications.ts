import { useEffect, useRef, useCallback } from "react";
import { Alert, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { registerPushToken, deregisterPushToken } from "@/lib/api";

const PUSH_TOKEN_STORED_KEY = "shieldid:push_token_sent";
const NOTIF_PREFS_KEY = "shieldid:notification_prefs";
const PERMISSION_ASKED_KEY = "shieldid:push_permission_asked";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function getPrefs(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function isPushEnabled(): Promise<boolean> {
  const prefs = await getPrefs();
  return prefs.pushAlerts !== false;
}

async function isCategoryEnabled(key: "scanComplete" | "newThreats" | "weeklyDigest"): Promise<boolean> {
  const prefs = await getPrefs();
  if (prefs.pushAlerts === false) return false;
  return prefs[key] !== false;
}

export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  if (existing === "denied") return false;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  await AsyncStorage.setItem(PERMISSION_ASKED_KEY, "true");
  return status === "granted";
}

function showPrePrompt(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Stay Protected in Real-Time",
      "ShieldID will send you instant alerts when threats to your identity are detected — impersonators, fake profiles, and stolen photos. You can adjust this anytime in Settings.",
      [
        { text: "Not Now", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Enable Alerts",
          onPress: () => resolve(true),
        },
      ]
    );
  });
}

async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return data;
  } catch {
    return null;
  }
}

async function upsertToken(): Promise<void> {
  const token = await getExpoPushToken();
  if (!token) return;
  const cached = await AsyncStorage.getItem(PUSH_TOKEN_STORED_KEY);
  if (cached === token) return;
  const platform = Platform.OS === "ios" ? "ios" : "android";
  await registerPushToken(token, platform);
  await AsyncStorage.setItem(PUSH_TOKEN_STORED_KEY, token);
}

async function removeToken(): Promise<void> {
  const platform = Platform.OS === "ios" ? "ios" : "android";
  await deregisterPushToken(platform);
  await AsyncStorage.removeItem(PUSH_TOKEN_STORED_KEY);
}

export async function scheduleScanCompleteNotification(
  threatsFound: number
): Promise<void> {
  if (Platform.OS === "web") return;
  const enabled = await isCategoryEnabled("scanComplete");
  if (!enabled) return;

  const title = threatsFound > 0 ? "⚠️ Threats Detected" : "✅ Scan Complete";
  const body =
    threatsFound > 0
      ? `${threatsFound} active threat${threatsFound !== 1 ? "s" : ""} found — tap to review`
      : "No new threats found. Your identity is protected.";

  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { screen: "scan", threatsFound }, sound: true },
    trigger: null,
  });
}

export async function scheduleThreatNotification(
  threatTitle: string,
  threatId: string
): Promise<void> {
  if (Platform.OS === "web") return;
  const enabled = await isCategoryEnabled("newThreats");
  if (!enabled) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🚨 New Threat Detected",
      body: threatTitle,
      data: { screen: "threat", threatId },
      sound: true,
    },
    trigger: null,
  });
}

async function scheduleWeeklyReminder(): Promise<void> {
  if (Platform.OS === "web") return;
  const enabled = await isCategoryEnabled("weeklyDigest");
  if (!enabled) {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const weeklyId = scheduled.find(
      (n) => (n.content.data as any)?.screen === "dashboard"
    )?.identifier;
    if (weeklyId) await Notifications.cancelScheduledNotificationAsync(weeklyId);
    return;
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const alreadyScheduled = scheduled.some(
    (n) => (n.content.data as any)?.screen === "dashboard"
  );
  if (alreadyScheduled) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🛡️ Your Identity is Protected",
      body: "ShieldID has been monitoring your accounts. Tap to see your security status.",
      data: { screen: "dashboard" },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 2,
      hour: 10,
      minute: 0,
    },
  });
}

export async function applyNotificationPreferences(): Promise<void> {
  if (Platform.OS === "web") return;
  const prefs = await getPrefs();
  const pushOn = prefs.pushAlerts !== false;
  const weeklyOn = pushOn && prefs.weeklyDigest !== false;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const weeklyNotif = scheduled.find(
    (n) => (n.content.data as any)?.screen === "dashboard"
  );

  if (!weeklyOn) {
    if (weeklyNotif) {
      await Notifications.cancelScheduledNotificationAsync(weeklyNotif.identifier);
    }
  } else {
    if (!weeklyNotif) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🛡️ Your Identity is Protected",
          body: "ShieldID has been monitoring your accounts. Tap to see your security status.",
          data: { screen: "dashboard" },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: 2,
          hour: 10,
          minute: 0,
        },
      });
    }
  }
}

export function useNotifications(isLoggedIn: boolean): {
  registerPush: () => Promise<void>;
  deregisterPush: () => Promise<void>;
} {
  const listenerRef = useRef<Notifications.EventSubscription | null>(null);

  const registerPush = useCallback(async () => {
    if (Platform.OS === "web") return;
    const granted = await requestPushPermission();
    if (!granted) return;
    await upsertToken();
    await scheduleWeeklyReminder();
  }, []);

  const deregisterPush = useCallback(async () => {
    if (Platform.OS === "web") return;
    await removeToken();
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const weeklyId = scheduled.find(
      (n) => (n.content.data as any)?.screen === "dashboard"
    )?.identifier;
    if (weeklyId) {
      await Notifications.cancelScheduledNotificationAsync(weeklyId);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn || Platform.OS === "web") return;

    (async () => {
      const pushEnabled = await isPushEnabled();
      const { status } = await Notifications.getPermissionsAsync();

      if (status === "granted") {
        if (pushEnabled) {
          await upsertToken();
          await scheduleWeeklyReminder();
        }
        return;
      }

      const alreadyAsked = await AsyncStorage.getItem(PERMISSION_ASKED_KEY);
      if (alreadyAsked) return;

      if (!pushEnabled) return;

      const userWants = await showPrePrompt();
      if (!userWants) {
        await AsyncStorage.setItem(PERMISSION_ASKED_KEY, "pre-declined");
        return;
      }

      const granted = await requestPushPermission();
      if (granted) {
        await upsertToken();
        await scheduleWeeklyReminder();
      }
    })();

    listenerRef.current = Notifications.addNotificationResponseReceivedListener(
      () => {}
    );

    return () => {
      listenerRef.current?.remove();
    };
  }, [isLoggedIn]);

  return { registerPush, deregisterPush };
}
