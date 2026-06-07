import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { useSessionList, useSession, useUser } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";

const STORAGE_KEY = "shieldid:security_prefs";

interface SecurityPrefs {
  biometricLogin: boolean;
  sessionNotifications: boolean;
}

const DEFAULTS: SecurityPrefs = {
  biometricLogin: false,
  sessionNotifications: true,
};

function formatLastActive(date: Date | null | undefined): string {
  if (!date) return "Unknown";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 2) return "Now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffH = Math.floor(diffMins / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySession = any;

function getLatestActivity(session: AnySession) {
  return session?.latestActivity ?? null;
}

function formatSessionDevice(session: AnySession): string {
  const activity = getLatestActivity(session);
  if (!activity) return "Unknown device";
  const browser: string = activity.browserName ?? "";
  const deviceType: string = activity.deviceType ?? "";
  if (deviceType === "mobile") return "Mobile device";
  if (browser) return `${browser} — Desktop`;
  return "Desktop";
}

function formatSessionLocation(session: AnySession): string {
  const activity = getLatestActivity(session);
  if (!activity) return "";
  const parts = [activity.city, activity.country].filter(Boolean) as string[];
  return parts.join(", ") || "Unknown location";
}

function isMobileSession(session: AnySession): boolean {
  const activity = getLatestActivity(session);
  return activity?.deviceType === "mobile" || activity?.isMobile === true;
}

export default function SecuritySettings() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<SecurityPrefs>(DEFAULTS);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { sessions, isLoaded: sessionsLoaded } = useSessionList();
  const { session: currentSession } = useSession();
  const { user } = useUser();

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then(setBiometricAvailable);
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v) {
        try { setPrefs({ ...DEFAULTS, ...JSON.parse(v) }); } catch {}
      }
    });
  }, []);

  const save = (next: SecurityPrefs) => {
    setPrefs(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handleBiometricToggle = async (v: boolean) => {
    if (v) {
      if (!biometricAvailable) {
        Alert.alert(
          "Not Available",
          "Biometric authentication is not set up on this device. Enable Face ID or Touch ID in your device settings first."
        );
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to enable biometric login",
        cancelLabel: "Cancel",
      });
      if (result.success) {
        save({ ...prefs, biometricLogin: true });
        Alert.alert("Biometric Login Enabled", "You can now log in with Face ID or Touch ID.");
      } else {
        Alert.alert("Authentication Failed", "Could not verify your identity.");
      }
    } else {
      Alert.alert(
        "Disable Biometric Login",
        "You'll need to use your password to log in.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Disable", style: "destructive", onPress: () => save({ ...prefs, biometricLogin: false }) },
        ]
      );
    }
  };

  const handleRevokeSession = (sessionId: string, deviceLabel: string) => {
    Alert.alert(
      "Sign Out Device",
      `Remove "${deviceLabel}" from your active sessions?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setRevokingId(sessionId);
            try {
              const target = sessions?.find((s) => s.id === sessionId) as AnySession;
              await target?.revoke?.();
            } catch {
              Alert.alert("Error", "Could not remove this session. Please try again.");
            } finally {
              setRevokingId(null);
            }
          },
        },
      ]
    );
  };

  const twoFactorEnabled = user?.twoFactorEnabled ?? false;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Security
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Security score card */}
        <GlassCard style={[styles.scoreCard, { borderColor: colors.success + "44" }]}>
          <View style={[styles.scoreIconWrap, { backgroundColor: colors.success + "18" }]}>
            <Ionicons name="shield-checkmark" size={28} color={colors.success} />
          </View>
          <View style={styles.scoreInfo}>
            <Text style={[styles.scoreTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Account Security
            </Text>
            <Text style={[styles.scoreStatus, { color: colors.success, fontFamily: "Inter_500Medium" }]}>
              {twoFactorEnabled && prefs.biometricLogin
                ? "Excellent — fully protected"
                : twoFactorEnabled || prefs.biometricLogin
                  ? "Good — consider enabling more features"
                  : "Basic — enable 2FA to improve security"}
            </Text>
          </View>
        </GlassCard>

        {/* Authentication */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          Authentication
        </Text>
        <GlassCard noPadding>
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <View style={[styles.rowIcon, { backgroundColor: colors.success + "18" }]}>
              <Ionicons name="finger-print" size={18} color={colors.success} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                Biometric Login
              </Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {biometricAvailable ? "Use Face ID or Touch ID to log in" : "Not available on this device"}
              </Text>
            </View>
            <Switch
              value={prefs.biometricLogin}
              onValueChange={handleBiometricToggle}
              disabled={Platform.OS === "web"}
              trackColor={{ false: "#3A3A3A", true: "#10B981" }}
              thumbColor={prefs.biometricLogin ? "#FFFFFF" : "#AAAAAA"}
              ios_backgroundColor="#3A3A3A"
            />
          </View>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: colors.primary + "18" }]}>
              <Ionicons name="lock-closed" size={18} color={colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                Two-Factor Auth
              </Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {twoFactorEnabled ? "Active — managed by your account" : "Not enabled — managed by your account"}
              </Text>
            </View>
            <View style={[
              styles.statusBadge,
              { backgroundColor: twoFactorEnabled ? colors.success + "22" : colors.secondary },
            ]}>
              <Text style={[
                styles.statusBadgeText,
                { color: twoFactorEnabled ? colors.success : colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
              ]}>
                {twoFactorEnabled ? "On" : "Off"}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Activity Notifications */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          Account Activity
        </Text>
        <GlassCard noPadding>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: colors.warning + "18" }]}>
              <Ionicons name="phone-portrait" size={18} color={colors.warning} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                New Device Alert
              </Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Notify when a new device logs in
              </Text>
            </View>
            <Switch
              value={prefs.sessionNotifications}
              onValueChange={(v) => save({ ...prefs, sessionNotifications: v })}
              trackColor={{ false: "#3A3A3A", true: "#3B82F6" }}
              thumbColor={prefs.sessionNotifications ? "#FFFFFF" : "#AAAAAA"}
              ios_backgroundColor="#3A3A3A"
            />
          </View>
        </GlassCard>

        {/* Active Sessions */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          Active Sessions
        </Text>
        <GlassCard noPadding>
          {!sessionsLoaded ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Loading sessions…
              </Text>
            </View>
          ) : !sessions || sessions.length === 0 ? (
            <View style={styles.loadingRow}>
              <Ionicons name="phone-portrait-outline" size={18} color={colors.mutedForeground} />
              <Text style={[styles.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No active sessions found
              </Text>
            </View>
          ) : (
            sessions.map((session, i) => {
              const isCurrent = session.id === currentSession?.id;
              const deviceLabel = formatSessionDevice(session);
              const location = formatSessionLocation(session);
              const isRevoking = revokingId === session.id;
              return (
                <View
                  key={session.id}
                  style={[
                    styles.sessionRow,
                    i < sessions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: isCurrent ? colors.success + "18" : colors.secondary }]}>
                    <Ionicons
                      name={isMobileSession(session) ? "phone-portrait-outline" : "laptop-outline"}
                      size={18}
                      color={isCurrent ? colors.success : colors.mutedForeground}
                    />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                      {deviceLabel}
                      {isCurrent ? (
                        <Text style={{ color: colors.success }}> · Current</Text>
                      ) : null}
                    </Text>
                    <Text style={[styles.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {[location, formatLastActive(session.lastActiveAt)].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  {!isCurrent && (
                    isRevoking ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <TouchableOpacity onPress={() => handleRevokeSession(session.id, deviceLabel)}>
                        <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
                      </TouchableOpacity>
                    )
                  )}
                </View>
              );
            })
          )}
        </GlassCard>

        {/* Recent Activity — empty state until a real event log is wired up */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          Recent Activity
        </Text>
        <GlassCard style={[styles.activityEmpty, { borderColor: colors.border }]}>
          <View style={[styles.activityEmptyIcon, { backgroundColor: colors.secondary }]}>
            <Ionicons name="time-outline" size={22} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.activityEmptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Security events — new sign-ins, scan completions, and device changes — will appear here.
          </Text>
        </GlassCard>
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
  scoreCard: { flexDirection: "row", gap: 14, alignItems: "center", borderWidth: 1 },
  scoreIconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  scoreInfo: { flex: 1 },
  scoreTitle: { fontSize: 17, marginBottom: 3 },
  scoreStatus: { fontSize: 13, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15 },
  rowSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 12 },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  activityEmpty: { flexDirection: "row", alignItems: "center", gap: 14 },
  activityEmptyIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  activityEmptyText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
