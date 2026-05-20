import React, { useEffect, useState } from "react";
import {
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
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";

const STORAGE_KEY = "shieldid:security_prefs";

interface SecurityPrefs {
  biometricLogin: boolean;
  twoFactorEnabled: boolean;
  sessionNotifications: boolean;
}

const DEFAULTS: SecurityPrefs = {
  biometricLogin: false,
  twoFactorEnabled: false,
  sessionNotifications: true,
};

const MOCK_SESSIONS = [
  { id: "1", device: "iPhone 15 Pro", location: "San Francisco, CA", current: true, lastSeen: "Now" },
  { id: "2", device: "Chrome — MacBook Pro", location: "San Francisco, CA", current: false, lastSeen: "2h ago" },
];

const MOCK_EVENTS = [
  { id: "1", icon: "log-in", color: "#10B981", label: "Successful login", time: "Today, 9:41 AM" },
  { id: "2", icon: "shield-checkmark", color: "#3B82F6", label: "Scan completed", time: "Today, 8:00 AM" },
  { id: "3", icon: "warning", color: "#F59E0B", label: "New device detected", time: "Yesterday, 6:32 PM" },
];

export default function SecuritySettings() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<SecurityPrefs>(DEFAULTS);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

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

  const handle2FAToggle = (v: boolean) => {
    if (v) {
      setShow2FAModal(true);
    } else {
      Alert.alert(
        "Disable Two-Factor Auth",
        "Disabling 2FA reduces the security of your account. Are you sure?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disable",
            style: "destructive",
            onPress: () => save({ ...prefs, twoFactorEnabled: false }),
          },
        ]
      );
    }
  };

  const confirm2FA = () => {
    setShow2FAModal(false);
    save({ ...prefs, twoFactorEnabled: true });
    Alert.alert("2FA Enabled", "Two-factor authentication is now active. A verification code will be required when logging in.");
  };

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
              {prefs.twoFactorEnabled && prefs.biometricLogin
                ? "Excellent — fully protected"
                : prefs.twoFactorEnabled || prefs.biometricLogin
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
                {prefs.twoFactorEnabled ? "Active — email verification required" : "Adds a second layer of protection"}
              </Text>
            </View>
            <Switch
              value={prefs.twoFactorEnabled}
              onValueChange={handle2FAToggle}
              trackColor={{ false: "#3A3A3A", true: "#3B82F6" }}
              thumbColor={prefs.twoFactorEnabled ? "#FFFFFF" : "#AAAAAA"}
              ios_backgroundColor="#3A3A3A"
            />
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
          {MOCK_SESSIONS.map((session, i) => (
            <View
              key={session.id}
              style={[
                styles.sessionRow,
                i < MOCK_SESSIONS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}
            >
              <View style={[styles.rowIcon, { backgroundColor: session.current ? colors.success + "18" : colors.secondary }]}>
                <Ionicons
                  name={session.device.includes("Chrome") ? "laptop-outline" : "phone-portrait-outline"}
                  size={18}
                  color={session.current ? colors.success : colors.mutedForeground}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {session.device}
                  {session.current ? (
                    <Text style={{ color: colors.success }}> · Current</Text>
                  ) : null}
                </Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {session.location} · {session.lastSeen}
                </Text>
              </View>
              {!session.current && (
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert("Sign Out Device", `Remove ${session.device} from your active sessions?`, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Remove", style: "destructive", onPress: () => {} },
                    ])
                  }
                >
                  <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </GlassCard>

        {/* Recent Security Events */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          Recent Activity
        </Text>
        <GlassCard noPadding>
          {MOCK_EVENTS.map((event, i) => (
            <View
              key={event.id}
              style={[
                styles.eventRow,
                i < MOCK_EVENTS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}
            >
              <View style={[styles.eventDot, { backgroundColor: event.color + "22" }]}>
                <Ionicons name={event.icon as any} size={14} color={event.color} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {event.label}
                </Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {event.time}
                </Text>
              </View>
            </View>
          ))}
        </GlassCard>
      </ScrollView>

      {/* 2FA Setup Modal */}
      {show2FAModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modal2FAIcon, { backgroundColor: colors.primary + "18" }]}>
              <Ionicons name="lock-closed" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.modal2FATitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Enable Two-Factor Auth
            </Text>
            <Text style={[styles.modal2FASub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              When you log in, ShieldID will send a 6-digit code to your registered email address. Enter the code to verify your identity.
            </Text>
            <View style={styles.modal2FASteps}>
              {["We'll send a code to your email", "Enter the code when prompted", "Stays active until you disable it"].map((step, i) => (
                <View key={i} style={styles.step}>
                  <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.stepNumText, { fontFamily: "Inter_700Bold" }]}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                    {step}
                  </Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.modal2FAConfirm, { backgroundColor: colors.primary }]}
              onPress={confirm2FA}
            >
              <Text style={[styles.modal2FAConfirmText, { fontFamily: "Inter_700Bold" }]}>Enable 2FA</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShow2FAModal(false)}>
              <Text style={[styles.modal2FACancel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  eventRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  eventDot: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  modalOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "#00000088",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    alignItems: "center",
    gap: 16,
    width: "100%",
  },
  modal2FAIcon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  modal2FATitle: { fontSize: 20, textAlign: "center" },
  modal2FASub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  modal2FASteps: { width: "100%", gap: 12 },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: "#FFFFFF", fontSize: 12 },
  stepText: { flex: 1, fontSize: 14 },
  modal2FAConfirm: { width: "100%", height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  modal2FAConfirmText: { color: "#FFFFFF", fontSize: 16 },
  modal2FACancel: { fontSize: 14, paddingVertical: 4 },
});
