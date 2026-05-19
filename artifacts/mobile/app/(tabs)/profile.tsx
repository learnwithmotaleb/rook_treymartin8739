import React from "react";
import {
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
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { PlatformIcon } from "@/components/PlatformIcon";

function SettingsItem({
  icon,
  label,
  value,
  onPress,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.settingsItem, { borderBottomColor: colors.border }]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={[styles.settingsIcon, { backgroundColor: colors.secondary }]}>
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
        <Ionicons
          name="chevron-forward"
          size={16}
          color={danger ? colors.danger : colors.mutedForeground}
        />
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useApp();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleLogout = () => {
    logout();
    router.replace("/auth");
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
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.primary + "33", borderColor: colors.primary + "66" },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                { color: colors.primary, fontFamily: "Inter_700Bold" },
              ]}
            >
              {user.avatarInitials}
            </Text>
          </View>
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
          <View
            style={[
              styles.tierBadge,
              {
                backgroundColor: user.isPremium
                  ? colors.warning + "22"
                  : colors.secondary,
                borderColor: user.isPremium
                  ? colors.warning + "44"
                  : colors.border,
              },
            ]}
          >
            {user.isPremium ? (
              <MaterialCommunityIcons name="crown" size={14} color={colors.warning} />
            ) : (
              <Ionicons name="shield-outline" size={14} color={colors.mutedForeground} />
            )}
            <Text
              style={[
                styles.tierText,
                {
                  color: user.isPremium ? colors.warning : colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              {user.isPremium ? "Premium" : "Free Plan"}
            </Text>
          </View>
        </View>

        {/* Subscription CTA */}
        {!user.isPremium && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push("/subscription" as any)}
          >
            <GlassCard style={[styles.upgradeCta, { borderColor: colors.primary + "44" }]}>
              <MaterialCommunityIcons name="crown" size={20} color={colors.warning} />
              <View style={styles.upgradeText}>
                <Text
                  style={[
                    styles.upgradeTitle,
                    { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  Upgrade to Premium
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
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </GlassCard>
          </TouchableOpacity>
        )}

        {/* Connected Accounts */}
        <Text
          style={[
            styles.sectionLabel,
            { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
          ]}
        >
          Connected Accounts
        </Text>
        <GlassCard style={styles.connectedCard}>
          <View style={styles.connectedGrid}>
            {user.connectedAccounts.map((acc) => (
              <View key={acc.platform} style={styles.connectedItem}>
                <PlatformIcon platform={acc.platform!} size={40} />
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
        </GlassCard>

        {/* Settings Sections */}
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
            icon={<Ionicons name="notifications" size={18} color={colors.primary} />}
            label="Push Alerts"
            value="Enabled"
            onPress={() => {}}
          />
          <SettingsItem
            icon={<Ionicons name="mail" size={18} color={colors.primary} />}
            label="Email Alerts"
            value="Premium"
            onPress={() => router.push("/subscription" as any)}
          />
        </GlassCard>

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
            icon={<Ionicons name="lock-closed" size={18} color={colors.success} />}
            label="Two-Factor Auth"
            value="Off"
            onPress={() => {}}
          />
          <SettingsItem
            icon={<Ionicons name="finger-print" size={18} color={colors.success} />}
            label="Biometric Login"
            value="Enabled"
            onPress={() => {}}
          />
        </GlassCard>

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
            icon={<Ionicons name="person" size={18} color={colors.primary} />}
            label="Edit Profile"
            onPress={() => {}}
          />
          <SettingsItem
            icon={<MaterialCommunityIcons name="crown" size={18} color={colors.warning} />}
            label="Subscription"
            value={user.isPremium ? "Premium" : "Free"}
            onPress={() => router.push("/subscription" as any)}
          />
          <SettingsItem
            icon={<Ionicons name="help-circle" size={18} color={colors.mutedForeground} />}
            label="Support"
            onPress={() => {}}
          />
          <SettingsItem
            icon={<Ionicons name="log-out" size={18} color={colors.danger} />}
            label="Sign Out"
            onPress={handleLogout}
            danger
          />
        </GlassCard>

        <Text
          style={[
            styles.version,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          ShieldID v1.0.0
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
  content: { paddingHorizontal: 16, paddingTop: 20, gap: 12 },
  avatarSection: { alignItems: "center", gap: 8, marginBottom: 8 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  avatarText: { fontSize: 28 },
  userName: { fontSize: 22 },
  userHandle: { fontSize: 15 },
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
  upgradeCta: { flexDirection: "row", alignItems: "center", gap: 12 },
  upgradeText: { flex: 1 },
  upgradeTitle: { fontSize: 15 },
  upgradeSub: { fontSize: 12 },
  sectionLabel: { fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 4 },
  connectedCard: {},
  connectedGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  connectedItem: { alignItems: "center", gap: 6, width: "28%" },
  connectedUsername: { fontSize: 11 },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingsIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsLabel: { flex: 1, fontSize: 15 },
  settingsRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  settingsValue: { fontSize: 13 },
  version: { fontSize: 12, textAlign: "center", marginTop: 8 },
});
