import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { requestPushPermission } from "@/hooks/useNotifications";
import { registerPushToken, deregisterPushToken } from "@/lib/api";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

const STORAGE_KEY = "shieldid:notification_prefs";

interface NotifPrefs {
  pushAlerts: boolean;
  emailAlerts: boolean;
  impersonatorAlerts: boolean;
  dataBreachAlerts: boolean;
  photoTheftAlerts: boolean;
  loginAlerts: boolean;
  scamAlerts: boolean;
  frequency: "immediate" | "hourly" | "daily";
}

const DEFAULTS: NotifPrefs = {
  pushAlerts: true,
  emailAlerts: false,
  impersonatorAlerts: true,
  dataBreachAlerts: true,
  photoTheftAlerts: true,
  loginAlerts: true,
  scamAlerts: true,
  frequency: "immediate",
};

function ToggleRow({
  icon,
  iconColor,
  label,
  sublabel,
  value,
  onToggle,
  locked,
  lockedLabel,
  last,
}: {
  icon: string;
  iconColor: string;
  label: string;
  sublabel?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  locked?: boolean;
  lockedLabel?: string;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconColor + "18" }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={[styles.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {locked ? (
        <TouchableOpacity
          style={[styles.lockedBadge, { backgroundColor: colors.warning + "22", borderColor: colors.warning + "44" }]}
          onPress={() => router.push("/subscription" as any)}
        >
          <MaterialCommunityIcons name="crown" size={11} color={colors.warning} />
          <Text style={[styles.lockedText, { color: colors.warning, fontFamily: "Inter_600SemiBold" }]}>
            {lockedLabel ?? "Pro"}
          </Text>
        </TouchableOpacity>
      ) : (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: "#3A3A3A", true: "#3B82F6" }}
          thumbColor={value ? "#FFFFFF" : "#AAAAAA"}
          ios_backgroundColor="#3A3A3A"
        />
      )}
    </View>
  );
}

function FrequencyOption({
  label,
  sublabel,
  selected,
  onSelect,
  last,
}: {
  label: string;
  sublabel: string;
  selected: boolean;
  onSelect: () => void;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
          {label}
        </Text>
        <Text style={[styles.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {sublabel}
        </Text>
      </View>
      <View
        style={[
          styles.radio,
          selected
            ? { backgroundColor: "#3B82F6", borderColor: "#3B82F6" }
            : { backgroundColor: "transparent", borderColor: colors.mutedForeground },
        ]}
      >
        {selected && <View style={styles.radioDot} />}
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationSettings() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULTS);
  const isPro = user.tier === "pro" || user.tier === "premium";
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v) {
        try { setPrefs({ ...DEFAULTS, ...JSON.parse(v) }); } catch {}
      }
    });
  }, []);

  const save = useCallback((next: NotifPrefs) => {
    setPrefs(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const toggle = (key: keyof NotifPrefs, value: boolean) => {
    save({ ...prefs, [key]: value });
  };

  const handlePushToggle = (v: boolean) => {
    if (v) {
      (async () => {
        if (Platform.OS === "web") {
          toggle("pushAlerts", true);
          return;
        }
        const { status } = await Notifications.getPermissionsAsync();
        if (status === "denied") {
          Alert.alert(
            "Notifications Blocked",
            "Push notifications are disabled in your device settings. Tap 'Open Settings' to enable them.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Open Settings",
                onPress: () => Linking.openSettings(),
              },
            ]
          );
          return;
        }
        const granted = await requestPushPermission();
        if (granted) {
          toggle("pushAlerts", true);
          try {
            const projectId =
              Constants.expoConfig?.extra?.eas?.projectId ??
              Constants.easConfig?.projectId;
            const { data: token } = await Notifications.getExpoPushTokenAsync(
              projectId ? { projectId } : undefined
            );
            const platform = Platform.OS === "ios" ? "ios" : "android";
            await registerPushToken(token, platform);
          } catch {}
        } else {
          Alert.alert(
            "Permission Required",
            "Please allow notifications in Settings to receive threat alerts.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ]
          );
        }
      })();
    } else {
      Alert.alert(
        "Disable Push Alerts",
        "You won't receive real-time threat notifications. You can re-enable anytime.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disable",
            style: "destructive",
            onPress: async () => {
              toggle("pushAlerts", false);
              try {
                const platform = Platform.OS === "ios" ? "ios" : "android";
                await deregisterPushToken(platform);
              } catch {}
            },
          },
        ]
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Notifications
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Status Banner */}
        {!prefs.pushAlerts && (
          <GlassCard style={[styles.warningBanner, { borderColor: colors.warning + "44" }]}>
            <Ionicons name="warning" size={16} color={colors.warning} />
            <Text style={[styles.warningText, { color: colors.warning, fontFamily: "Inter_500Medium" }]}>
              Push alerts are disabled. You may miss critical threats.
            </Text>
          </GlassCard>
        )}

        {/* Delivery */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          Delivery
        </Text>
        <GlassCard noPadding>
          <ToggleRow
            icon="notifications"
            iconColor={colors.primary}
            label="Push Alerts"
            sublabel="Real-time notifications on this device"
            value={prefs.pushAlerts}
            onToggle={handlePushToggle}
          />
          <ToggleRow
            icon="mail"
            iconColor={colors.primary}
            label="Email Alerts"
            sublabel={isPro ? "Sent to your registered email" : "Upgrade to Pro to enable"}
            value={isPro ? prefs.emailAlerts : false}
            onToggle={(v) => toggle("emailAlerts", v)}
            locked={!isPro}
            lockedLabel="Pro"
            last
          />
        </GlassCard>

        {/* Alert Types */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          Alert Types
        </Text>
        <GlassCard noPadding>
          <ToggleRow
            icon="person-remove"
            iconColor="#EF4444"
            label="Impersonator Detected"
            sublabel="Someone is posing as you on social media"
            value={prefs.impersonatorAlerts}
            onToggle={(v) => toggle("impersonatorAlerts", v)}
          />
          <ToggleRow
            icon="shield"
            iconColor="#8B5CF6"
            label="Data Breach Alerts"
            sublabel="Your data found in a known breach"
            value={prefs.dataBreachAlerts}
            onToggle={(v) => toggle("dataBreachAlerts", v)}
          />
          <ToggleRow
            icon="image"
            iconColor="#F59E0B"
            label="Photo Theft Detected"
            sublabel="Your photos found on other accounts"
            value={prefs.photoTheftAlerts}
            onToggle={(v) => toggle("photoTheftAlerts", v)}
          />
          <ToggleRow
            icon="log-in"
            iconColor="#10B981"
            label="Suspicious Login Attempt"
            sublabel="Unrecognized login to your linked accounts"
            value={prefs.loginAlerts}
            onToggle={(v) => toggle("loginAlerts", v)}
          />
          <ToggleRow
            icon="chatbubble-ellipses"
            iconColor="#3B82F6"
            label="Scam Message Detected"
            sublabel="AI flagged a potential scam targeting you"
            value={prefs.scamAlerts}
            onToggle={(v) => toggle("scamAlerts", v)}
            last
          />
        </GlassCard>

        {/* Frequency */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          Alert Frequency
        </Text>
        <GlassCard noPadding>
          <FrequencyOption
            label="Immediate"
            sublabel="Get alerted the moment a threat is detected"
            selected={prefs.frequency === "immediate"}
            onSelect={() => save({ ...prefs, frequency: "immediate" })}
          />
          <FrequencyOption
            label="Hourly Digest"
            sublabel="Batch alerts into an hourly summary"
            selected={prefs.frequency === "hourly"}
            onSelect={() => save({ ...prefs, frequency: "hourly" })}
          />
          <FrequencyOption
            label="Daily Digest"
            sublabel="One summary email each day"
            selected={prefs.frequency === "daily"}
            onSelect={() => save({ ...prefs, frequency: "daily" })}
            last
          />
        </GlassCard>

        <Text style={[styles.footer, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Preferences are saved locally. Critical security alerts may always be sent regardless of your settings.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17 },
  content: { padding: 20, gap: 14 },
  sectionLabel: { fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 4 },
  warningBanner: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderWidth: 1 },
  warningText: { flex: 1, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15 },
  rowSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  lockedText: { fontSize: 11 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
  footer: { fontSize: 12, textAlign: "center", lineHeight: 18, opacity: 0.7 },
});
