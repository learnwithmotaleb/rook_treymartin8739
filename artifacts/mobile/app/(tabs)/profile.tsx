import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { useAuth, useClerk } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { PlatformIcon } from "@/components/PlatformIcon";

const TIER_LABELS: Record<string, string> = {
  free: "Free Plan",
  pro: "Pro",
  premium: "Premium",
};

function SettingsRow({
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
          { color: danger ? colors.danger : colors.foreground, fontFamily: "Inter_500Medium" },
        ]}
      >
        {label}
      </Text>
      <View style={styles.settingsRight}>
        {value ? (
          <Text style={[styles.settingsValue, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {value}
          </Text>
        ) : null}
        {!danger && (
          <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useApp();
  const { signOut, getToken } = useAuth();
  const { signOut: clerkSignOut } = useClerk();

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
        onPress: async () => {
          await signOut();
          logout();
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      const token = await getToken();
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const base = domain ? `https://${domain}/api` : "/api";
      const resp = await fetch(`${base}/me`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok && resp.status !== 204) {
        throw new Error("Failed to delete account");
      }
      await clerkSignOut();
      logout();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not delete account. Please try again.");
    } finally {
      setDeleteLoading(false);
      setDeleteModalVisible(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Profile
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={() => router.push("/edit-profile" as any)} activeOpacity={0.85}>
            <View style={[styles.avatar, { borderColor: colors.primary + "66" }]}>
              <LinearGradient
                colors={[colors.primaryDark, colors.primary, colors.primaryForeground]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.6, 1]}
              />
              <Text style={[styles.avatarText, { color: "#FFFFFF", fontFamily: "Inter_700Bold" }]}>
                {user.avatarInitials}
              </Text>
            </View>
            <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="pencil" size={12} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.userName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {user.name}
          </Text>
          <Text style={[styles.userHandle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
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
                  backgroundColor: isPaid ? colors.warning + "22" : colors.secondary,
                  borderColor: isPaid ? colors.warning + "44" : colors.border,
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
                  { color: isPaid ? colors.warning : colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {tierLabel}
              </Text>
              <Ionicons name="chevron-forward" size={12} color={isPaid ? colors.warning : colors.mutedForeground} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Upgrade CTA for free users */}
        {!isPaid && (
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.push("/subscription" as any)}>
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
                  <Text style={[styles.upgradeTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    Upgrade to Pro or Premium
                  </Text>
                  <Text style={[styles.upgradeSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    Automated alerts, photo monitoring & more
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.premium} />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Connected Accounts */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            Connected Accounts
          </Text>
          <TouchableOpacity onPress={() => router.push("/manage-accounts" as any)}>
            <Text style={[styles.manageLink, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
              Manage
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity activeOpacity={0.85} onPress={() => router.push("/manage-accounts" as any)}>
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
                        style={[styles.connectedUsername, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
                        numberOfLines={1}
                      >
                        {acc.username}
                      </Text>
                    </View>
                  ))}
                </View>
                {user.connectedAccounts.length < 7 && (
                  <View style={[styles.addAccountRow, { borderTopColor: colors.border }]}>
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

        {/* Settings */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          Settings
        </Text>
        <GlassCard noPadding>
          <SettingsRow
            icon={<Ionicons name="person" size={20} color={colors.primary} />}
            label="Edit Profile"
            onPress={() => router.push("/edit-profile" as any)}
          />
          <SettingsRow
            icon={<MaterialCommunityIcons name="crown" size={20} color={colors.warning} />}
            label="Subscription"
            value={tierLabel}
            onPress={() => router.push("/subscription" as any)}
          />
          <SettingsRow
            icon={<Ionicons name="notifications" size={20} color={colors.primary} />}
            label="Notifications"
            onPress={() => router.push("/notification-settings" as any)}
          />
          <SettingsRow
            icon={<Ionicons name="lock-closed" size={20} color={colors.success} />}
            label="Security"
            onPress={() => router.push("/security-settings" as any)}
          />
          <SettingsRow
            icon={<Ionicons name="help-circle" size={20} color={colors.mutedForeground} />}
            label="Help & Support"
            onPress={() => router.push("/support" as any)}
          />
          <SettingsRow
            icon={<Ionicons name="document-text-outline" size={20} color={colors.mutedForeground} />}
            label="Legal & Privacy"
            onPress={() => router.push("/legal" as any)}
            last
          />
        </GlassCard>

        {/* Sign Out */}
        <GlassCard noPadding>
          <SettingsRow
            icon={<Ionicons name="log-out" size={20} color={colors.danger} />}
            label="Sign Out"
            onPress={handleLogout}
            danger
            last
          />
        </GlassCard>

        {/* Delete Account */}
        <GlassCard noPadding>
          <SettingsRow
            icon={<Ionicons name="trash-outline" size={20} color={colors.danger} />}
            label="Delete Account"
            onPress={() => setDeleteModalVisible(true)}
            danger
            last
          />
        </GlassCard>

        <Text style={[styles.version, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          ShieldID v1.0.0 · All data encrypted end-to-end
        </Text>
      </ScrollView>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !deleteLoading && setDeleteModalVisible(false)}
      >
        <View style={styles.deleteOverlay}>
          <View style={[styles.deleteSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.deleteIconWrap, { backgroundColor: colors.danger + "22" }]}>
              <Ionicons name="warning-outline" size={32} color={colors.danger} />
            </View>
            <Text style={[styles.deleteTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Delete Account
            </Text>
            <Text style={[styles.deleteBody, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              This will permanently delete your account, connected social accounts, identity fingerprint, all threat history, and cancel any active subscription.{"\n\n"}This action cannot be undone.
            </Text>
            <TouchableOpacity
              style={[styles.deleteConfirmBtn, { backgroundColor: colors.danger, opacity: deleteLoading ? 0.7 : 1 }]}
              activeOpacity={0.8}
              onPress={handleDeleteAccount}
              disabled={deleteLoading}
            >
              {deleteLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={[styles.deleteConfirmText, { fontFamily: "Inter_700Bold" }]}>
                  Yes, Delete My Account
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteCancelBtn, { backgroundColor: colors.secondary }]}
              activeOpacity={0.8}
              onPress={() => setDeleteModalVisible(false)}
              disabled={deleteLoading}
            >
              <Text style={[styles.deleteCancelText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  avatarSection: { alignItems: "center", gap: 8, marginBottom: 8 },
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

  upgradeBorderWrapper: { borderRadius: 16, padding: 2 },
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

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 8,
  },
  manageLink: { fontSize: 14 },

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

  version: { fontSize: 12, textAlign: "center", marginTop: 12 },

  deleteOverlay: { flex: 1, backgroundColor: "#00000099", alignItems: "center", justifyContent: "center", padding: 24 },
  deleteSheet: { width: "100%", maxWidth: 380, borderRadius: 20, borderWidth: 1, padding: 28, alignItems: "center", gap: 16 },
  deleteIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  deleteTitle: { fontSize: 20, textAlign: "center" },
  deleteBody: { fontSize: 14, lineHeight: 22, textAlign: "center" },
  deleteConfirmBtn: { width: "100%", height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  deleteConfirmText: { color: "#FFFFFF", fontSize: 16 },
  deleteCancelBtn: { width: "100%", height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  deleteCancelText: { fontSize: 15 },
});
