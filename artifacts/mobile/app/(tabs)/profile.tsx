import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { PlatformIcon } from "@/components/PlatformIcon";

const NOTIF_KEY = "shieldid:notification_prefs";
const SECURITY_KEY = "shieldid:security_prefs";

function useStoredPrefs() {
  const [pushOn, setPushOn] = useState(true);
  const [emailOn, setEmailOn] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([NOTIF_KEY, SECURITY_KEY]).then((pairs) => {
      for (const [key, val] of pairs) {
        if (!val) continue;
        try {
          const parsed = JSON.parse(val) as Record<string, unknown>;
          if (key === NOTIF_KEY) {
            if (typeof parsed.pushAlerts === "boolean") setPushOn(parsed.pushAlerts);
            if (typeof parsed.emailAlerts === "boolean") setEmailOn(parsed.emailAlerts);
          }
          if (key === SECURITY_KEY) {
            if (typeof parsed.biometricLogin === "boolean") setBiometric(parsed.biometricLogin);
            if (typeof parsed.twoFactorEnabled === "boolean") setTwoFactor(parsed.twoFactorEnabled);
          }
        } catch {}
      }
    });
  }, []);

  return { pushOn, emailOn, biometric, twoFactor };
}

const TIER_LABELS: Record<string, string> = {
  free: "Free Plan",
  pro: "Pro",
  premium: "Premium",
};

function SettingsItem({
  icon,
  label,
  value,
  onPress,
  danger,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[
        styles.settingsItem,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={[styles.settingsIcon, { backgroundColor: danger ? "transparent" : colors.secondary }]}>
        {icon}
      </View>
      <Text
        style={[
          styles.settingsLabel,
          {
            color: danger ? colors.danger : colors.foreground,
            fontFamily: "Inter_500Medium",
          },
        ]}
      >
        {label}
      </Text>
      <View style={styles.settingsRight}>
        {value && (
          <Text
            style={[
              styles.settingsValue,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {value}
          </Text>
        )}
        {!danger && (
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.mutedForeground}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useApp();
  const { pushOn, emailOn, biometric, twoFactor } = useStoredPrefs();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const tier = user.tier ?? (user.isPremium ? "premium" : "free");
  const tierLabel = TIER_LABELS[tier] ?? "Free Plan";
  const isPaid = tier === "pro" || tier === "premium";

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          logout();
          router.replace("/auth" as any);
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border },
        ]}
      >
        <Text
          style={[
            styles.headerTitle,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          Profile
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 100 },
        ]}
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={() => router.push("/edit-profile" as any)}
            activeOpacity={0.85}
          >
            <View
              style={[
                styles.avatar,
                { borderColor: colors.primary + "66" },
              ]}
            >
              <LinearGradient
                colors={[colors.primaryDark, colors.primary, colors.primaryForeground]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.6, 1]}
              />
              <Text
                style={[
                  styles.avatarText,
                  { color: "#FFFFFF", fontFamily: "Inter_700Bold" },
                ]}
              >
                {user.avatarInitials}
              </Text>
            </View>
            <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="pencil" size={12} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text
            style={[
              styles.userName,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {user.name}
          </Text>
          <Text
            style={[
              styles.userHandle,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {user.username}
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/subscription" as any)}
            activeOpacity={0.8}
            style={{ marginTop: 4 }}
          >
            <View
              style={[
                styles.tierBadge,
                {
                  backgroundColor: isPaid
                    ? colors.warning + "22"
                    : colors.secondary,
                  borderColor: isPaid
                    ? colors.warning + "44"
                    : colors.border,
                },
              ]}
            >
              {isPaid ? (
                <MaterialCommunityIcons name="crown" size={14} color={colors.warning} />
              ) : (
                <Ionicons name="shield-outline" size={14} color={colors.mutedForeground} />
              )}
              <Text
                style={[
                  styles.tierText,
                  {
                    color: isPaid ? colors.warning : colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                {tierLabel}
              </Text>
              <Ionicons name="chevron-forward" size={12} color={isPaid ? colors.warning : colors.mutedForeground} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Subscription CTA for free users */}
        {!isPaid && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push("/subscription" as any)}
            style={{ marginTop: 8 }}
          >
            <View style={styles.upgradeBorderWrapper}>
              <LinearGradient
                colors={[colors.primary, colors.premium]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={[styles.upgradeInner, { backgroundColor: colors.background }]}>
                <MaterialCommunityIcons name="crown" size={24} color={colors.premium} />
                <View style={styles.upgradeText}>
                  <Text
                    style={[
                      styles.upgradeTitle,
                      { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    Upgrade to Pro or Premium
                  </Text>
                  <Text
                    style={[
                      styles.upgradeSub,
                      { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                    ]}
                  >
                    Real-time alerts, photo monitoring & more
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.premium} />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Connected Accounts */}
        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionLabel,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            Connected Accounts
          </Text>
          <TouchableOpacity onPress={() => router.push("/manage-accounts" as any)}>
            <Text style={[styles.manageLink, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
              Manage
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/manage-accounts" as any)}
        >
          <GlassCard style={styles.connectedCard}>
            {user.connectedAccounts.length === 0 ? (
              <View style={styles.connectedEmpty}>
                <Ionicons name="person-add-outline" size={24} color={colors.mutedForeground} />
                <Text style={[styles.connectedEmptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  No accounts connected yet
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </View>
            ) : (
              <>
                <View style={styles.connectedGrid}>
                  {user.connectedAccounts.slice(0, 6).map((acc) => (
                    <View key={acc.id} style={styles.connectedItem}>
                      <View style={styles.connectedIconWrap}>
                        <PlatformIcon platform={acc.platform!} size={38} />
                        {acc.verified && (
                          <View style={[styles.verifiedDot, { backgroundColor: colors.success, borderColor: colors.card }]}>
                            <Ionicons name="checkmark" size={8} color="#FFFFFF" />
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.connectedUsername,
                          { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                        ]}
                        numberOfLines={1}
                      >
                        {acc.username}
                      </Text>
                    </View>
                  ))}
                </View>
                {user.connectedAccounts.length < 7 && (
                  <View
                    style={[styles.addAccountRow, { borderTopColor: colors.border }]}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                    <Text style={[styles.addAccountText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
                      Add another account
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                  </View>
                )}
              </>
            )}
          </GlassCard>
        </TouchableOpacity>

        {/* Notifications */}
        <Text
          style={[
            styles.sectionLabel,
            { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
          ]}
        >
          Notifications
        </Text>
        <GlassCard noPadding>
          <SettingsItem
            icon={<Ionicons name="notifications" size={20} color={pushOn ? colors.primary : colors.mutedForeground} />}
            label="Push Alerts"
            value={pushOn ? "On" : "Off"}
            onPress={() => router.push("/notification-settings" as any)}
          />
          <SettingsItem
            icon={<Ionicons name="mail" size={20} color={colors.primary} />}
            label="Email Alerts"
            value={!isPaid ? "Pro+" : emailOn ? "On" : "Off"}
            onPress={() => router.push("/notification-settings" as any)}
            last
          />
        </GlassCard>

        {/* Security */}
        <Text
          style={[
            styles.sectionLabel,
            { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
          ]}
        >
          Security
        </Text>
        <GlassCard noPadding>
          <SettingsItem
            icon={<Ionicons name="lock-closed" size={20} color={twoFactor ? colors.success : colors.mutedForeground} />}
            label="Two-Factor Auth"
            value={twoFactor ? "On" : "Off"}
            onPress={() => router.push("/security-settings" as any)}
          />
          <SettingsItem
            icon={<Ionicons name="finger-print" size={20} color={biometric ? colors.success : colors.mutedForeground} />}
            label="Biometric Login"
            value={biometric ? "On" : "Off"}
            onPress={() => router.push("/security-settings" as any)}
            last
          />
        </GlassCard>

        {/* Privacy & Data */}
        <Text
          style={[
            styles.sectionLabel,
            { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
          ]}
        >
          Privacy & Data
        </Text>
        <GlassCard noPadding>
          <SettingsItem
            icon={<Ionicons name="shield-checkmark" size={20} color={colors.primary} />}
            label="Identity Fingerprint"
            value="Active"
            onPress={() => router.push("/manage-accounts" as any)}
          />
          <SettingsItem
            icon={<Ionicons name="eye-off" size={20} color={colors.mutedForeground} />}
            label="Privacy Policy"
            onPress={() => router.push("/support" as any)}
            last
          />
        </GlassCard>

        {/* Account */}
        <Text
          style={[
            styles.sectionLabel,
            { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
          ]}
        >
          Account
        </Text>
        <GlassCard noPadding>
          <SettingsItem
            icon={<Ionicons name="person" size={20} color={colors.primary} />}
            label="Edit Profile"
            onPress={() => router.push("/edit-profile" as any)}
          />
          <SettingsItem
            icon={<MaterialCommunityIcons name="crown" size={20} color={colors.warning} />}
            label="Subscription"
            value={tierLabel}
            onPress={() => router.push("/subscription" as any)}
          />
          <SettingsItem
            icon={<Ionicons name="help-circle" size={20} color={colors.mutedForeground} />}
            label="Help & Support"
            onPress={() => router.push("/support" as any)}
          />
          <SettingsItem
            icon={<Ionicons name="log-out" size={20} color={colors.danger} />}
            label="Sign Out"
            onPress={handleLogout}
            danger
            last
          />
        </GlassCard>

        <Text
          style={[
            styles.version,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          ShieldID v1.0.0 · All data encrypted end-to-end
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24 },
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  avatarSection: { alignItems: "center", gap: 8, marginBottom: 16 },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    overflow: "hidden",
  },
  avatarText: { fontSize: 30, zIndex: 1 },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#070B12",
  },
  userName: { fontSize: 20, marginTop: 16 },
  userHandle: { fontSize: 16 },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  tierText: { fontSize: 13 },
  upgradeBorderWrapper: {
    borderRadius: 16,
    padding: 2,
    marginBottom: 8,
  },
  upgradeInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
  },
  upgradeText: { flex: 1 },
  upgradeTitle: { fontSize: 16 },
  upgradeSub: { fontSize: 13, marginTop: 2 },
  sectionLabel: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginTop: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  manageLink: { fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5 },
  connectedCard: {},
  connectedEmpty: { flexDirection: "row", alignItems: "center", gap: 12 },
  connectedEmptyText: { flex: 1, fontSize: 15 },
  connectedGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  connectedItem: { alignItems: "center", gap: 6, width: "28%" },
  connectedIconWrap: { position: "relative" },
  verifiedDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  connectedUsername: { fontSize: 11 },
  addAccountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addAccountText: { flex: 1, fontSize: 14 },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsLabel: { flex: 1, fontSize: 15 },
  settingsRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  settingsValue: { fontSize: 13 },
  version: { fontSize: 12, textAlign: "center", marginTop: 24 },
});
