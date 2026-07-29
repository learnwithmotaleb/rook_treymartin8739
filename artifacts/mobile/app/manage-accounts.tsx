import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
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
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { PlatformIcon } from "@/components/PlatformIcon";
import type { ConnectedAccount } from "@/context/AppContext";
import { getAccountStatus, type AccountStatus } from "@/lib/api";

const SCOPE_LABELS: Record<string, string> = {
  instagram_business_basic: "Profile & Media",
  "tweet.read": "Read Posts",
  "users.read": "Profile",
  "offline.access": "Background Refresh",
  "user.info.basic": "Basic Info",
  email: "Email",
  profile: "Profile",
  openid: "Login",
  "pages_show_list": "Pages",
  "instagram_manage_insights": "Insights",
  "public_profile": "Public Profile",
};

function formatExpiry(tokenExpiresAt: string | null): { label: string; warn: boolean } | null {
  if (!tokenExpiresAt) return null;
  const d = new Date(tokenExpiresAt);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (diffMs < 0) return { label: "Token expired", warn: true };
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return { label: "Expires today", warn: true };
  if (diffDays === 1) return { label: "Expires tomorrow", warn: true };
  if (diffDays <= 7) return { label: `Expires in ${diffDays} days`, warn: true };
  if (diffDays < 30) return { label: `Expires in ${Math.floor(diffDays / 7)}w`, warn: false };
  return { label: `Expires in ${Math.floor(diffDays / 30)}mo`, warn: false };
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  x: "X (Twitter)",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  facebook: "Facebook",
  snapchat: "Snapchat",
};

function formatSync(lastSynced: string | null) {
  if (!lastSynced) return "Never synced";
  const d = new Date(lastSynced);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just synced";
  if (diffMins < 60) return `Synced ${diffMins}m ago`;
  const diffH = Math.floor(diffMins / 60);
  if (diffH < 24) return `Synced ${diffH}h ago`;
  return `Synced ${Math.floor(diffH / 24)}d ago`;
}

const AMBER = "#F59E0B";

function AccountCard({
  account,
  onDelete,
  onReconnect,
  deleting,
}: {
  account: ConnectedAccount;
  onDelete: (id: string) => void;
  onReconnect: (id: string, platform: string) => void;
  deleting: boolean;
}) {
  const colors = useColors();
  const [status, setStatus] = useState<AccountStatus | null>(null);

  useEffect(() => {
    if (!account.verified) return;
    getAccountStatus(account.id)
      .then(setStatus)
      .catch(() => {});
  }, [account.id, account.verified]);

  // The reconnect strip should only display when the token is ACTUALLY expired.
  // If the token is still valid (tokenExpiresAt in the future), the needsReconnect
  // flag may be stale from a previous failure that was later auto-recovered by the
  // proactive refresh loop. Suppress the strip until we confirm expiry.
  const tokenIsActuallyExpired =
    !status?.tokenExpiresAt ||
    new Date(status.tokenExpiresAt) < new Date();
  const needsReconnect = account.needsReconnect && tokenIsActuallyExpired;

  const handleDelete = () => {
    Alert.alert(
      "Remove Account",
      `Remove ${account.username} from ${PLATFORM_LABELS[account.platform ?? ""] ?? account.platform}? Rook will stop monitoring this account.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => onDelete(account.id),
        },
      ]
    );
  };

  return (
    <GlassCard
      style={[
        styles.accountCard,
        needsReconnect && { borderColor: AMBER + "66", borderWidth: 1.5 },
      ]}
    >
      {/* Reconnect warning strip */}
      {needsReconnect && (
        <View style={[styles.reconnectStrip, { backgroundColor: AMBER + "18" }]}>
          <Ionicons name="warning" size={13} color={AMBER} />
          <Text style={[styles.reconnectStripText, { color: AMBER, fontFamily: "Inter_600SemiBold" }]}>
            Reconnection required — token expired
          </Text>
        </View>
      )}

      <View style={styles.accountTop}>
        <PlatformIcon platform={account.platform ?? "instagram"} size={48} />
        <View style={styles.accountInfo}>
          <View style={styles.accountNameRow}>
            <Text
              style={[styles.accountUsername, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
              numberOfLines={1}
            >
              {account.username}
            </Text>
            {needsReconnect ? (
              <View style={[styles.verifiedBadge, { backgroundColor: AMBER + "22" }]}>
                <Ionicons name="warning" size={12} color={AMBER} />
                <Text style={[styles.verifiedText, { color: AMBER, fontFamily: "Inter_600SemiBold" }]}>
                  Expired
                </Text>
              </View>
            ) : account.verified ? (
              <View style={[styles.verifiedBadge, { backgroundColor: colors.primary + "22" }]}>
                <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                <Text style={[styles.verifiedText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                  Verified
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.platformLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {PLATFORM_LABELS[account.platform ?? ""] ?? account.platform}
          </Text>
          <Text style={[styles.syncLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {formatSync(account.lastSynced)}
          </Text>
        </View>
        {deleting ? (
          <ActivityIndicator color={colors.danger} size="small" />
        ) : (
          <TouchableOpacity
            onPress={handleDelete}
            style={[styles.deleteBtn, { backgroundColor: colors.danger + "18" }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>

      {/* Stats row */}
      <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
        <View style={styles.stat}>
          <Ionicons name="camera" size={13} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {account.photosIndexed}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            photos
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Ionicons name="document-text" size={13} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {account.captionsIndexed}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            captions
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Ionicons name="people" size={13} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {account.followers > 0 ? account.followers.toLocaleString() : "—"}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            followers
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: needsReconnect
                  ? AMBER
                  : account.verified
                  ? colors.success
                  : colors.warning,
              },
            ]}
          />
          <Text
            style={[
              styles.statValue,
              {
                color: needsReconnect
                  ? AMBER
                  : account.verified
                  ? colors.success
                  : colors.warning,
                fontFamily: "Inter_600SemiBold",
              },
            ]}
          >
            {needsReconnect ? "Expired" : account.verified ? "Auth'd" : "Manual"}
          </Text>
        </View>
      </View>

      {/* Reconnect CTA — shown when token has expired */}
      {needsReconnect && !["tiktok"].includes(account.platform ?? "") && (
        <TouchableOpacity
          style={[styles.authCta, { borderColor: AMBER + "55", backgroundColor: AMBER + "0E" }]}
          activeOpacity={0.7}
          onPress={() => onReconnect(account.id, account.platform ?? "")}
        >
          <Ionicons name="refresh-circle-outline" size={15} color={AMBER} />
          <Text style={[styles.authCtaText, { color: AMBER, fontFamily: "Inter_500Medium" }]}>
            Reconnect to restore monitoring
          </Text>
          <Ionicons name="chevron-forward" size={13} color={AMBER} />
        </TouchableOpacity>
      )}

      {/* Token status row — scopes + expiry for verified accounts */}
      {account.verified && status && !needsReconnect && (
        <View style={[styles.statusSection, { borderTopColor: colors.border }]}>
          {status.scopesGranted.length > 0 && (
            <View style={styles.scopeRow}>
              <Ionicons name="key-outline" size={13} color={colors.mutedForeground} />
              <View style={styles.scopePills}>
                {status.scopesGranted.map((scope) => (
                  <View key={scope} style={[styles.scopePill, { backgroundColor: colors.primary + "18" }]}>
                    <Text style={[styles.scopePillText, { color: colors.primary, fontFamily: "Inter_400Regular" }]}>
                      {SCOPE_LABELS[scope] ?? scope}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {(() => {
            const expiry = formatExpiry(status.tokenExpiresAt);
            if (!expiry) return null;
            return (
              <View style={styles.expiryRow}>
                <Ionicons
                  name={expiry.warn ? "time" : "checkmark-circle-outline"}
                  size={13}
                  color={expiry.warn ? AMBER : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.expiryText,
                    { color: expiry.warn ? AMBER : colors.mutedForeground, fontFamily: "Inter_400Regular" },
                  ]}
                >
                  {expiry.label}
                </Text>
              </View>
            );
          })()}
          {!["tiktok"].includes(account.platform ?? "") && (
            <TouchableOpacity
              style={[styles.refreshCta, { borderColor: colors.primary + "33", backgroundColor: colors.primary + "0C" }]}
              activeOpacity={0.7}
              onPress={() => onReconnect(account.id, account.platform ?? "")}
            >
              <Ionicons name="refresh-outline" size={14} color={colors.primary} />
              <Text style={[styles.refreshCtaText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
                Refresh token
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Verify CTA — shown for unverified accounts that don't need reconnect */}
      {!needsReconnect && !account.verified && !["tiktok"].includes(account.platform ?? "") && (
        <TouchableOpacity
          style={[styles.authCta, { borderColor: colors.primary + "44", backgroundColor: colors.primary + "0C" }]}
          activeOpacity={0.7}
          onPress={() => router.push({ pathname: "/connect-account", params: { platform: account.platform ?? "", existingId: account.id } } as any)}
        >
          <Ionicons name="log-in-outline" size={15} color={colors.primary} />
          <Text style={[styles.authCtaText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
            Authenticate to verify ownership
          </Text>
          <Ionicons name="chevron-forward" size={13} color={colors.primary} />
        </TouchableOpacity>
      )}
    </GlassCard>
  );
}

export default function ManageAccounts() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, removeAccount, refreshData } = useApp();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const accounts = user.connectedAccounts;

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        await removeAccount(id);
      } catch {
        Alert.alert("Error", "Failed to remove account. Please try again.");
      } finally {
        setDeletingId(null);
      }
    },
    [removeAccount]
  );

  const handleReconnect = useCallback((id: string, platform: string) => {
    router.push({ pathname: "/connect-account", params: { platform, existingId: id } } as any);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={["#3B82F611", "transparent"]} style={styles.topGradient} />

      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Connected Accounts
        </Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/connect-account" as any)}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={[styles.addBtnText, { fontFamily: "Inter_600SemiBold" }]}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Summary card */}
        <GlassCard style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {accounts.length}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Connected
            </Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: colors.success, fontFamily: "Inter_700Bold" }]}>
              {accounts.filter((a) => a.verified).length}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Verified
            </Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {accounts.reduce((s, a) => s + a.photosIndexed, 0)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Photos
            </Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {7 - accounts.length}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Remaining
            </Text>
          </View>
        </GlassCard>

        {/* Account cards */}
        {accounts.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Ionicons name="person-add" size={36} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              No accounts connected
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Connect your social accounts so Rook can monitor them for impersonators and threats.
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/connect-account" as any)}
              activeOpacity={0.8}
            >
              <Text style={[styles.emptyBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                Connect First Account
              </Text>
            </TouchableOpacity>
          </GlassCard>
        ) : (
          accounts.map((acc) => (
            <AccountCard
              key={acc.id}
              account={acc}
              onDelete={handleDelete}
              onReconnect={handleReconnect}
              deleting={deletingId === acc.id}
            />
          ))
        )}

        {/* Add more platforms CTA */}
        {accounts.length > 0 && accounts.length < 7 && (
          <TouchableOpacity
            style={[styles.addMoreCard, { borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => router.push("/connect-account" as any)}
          >
            <View style={[styles.addMoreIcon, { backgroundColor: colors.primary + "18" }]}>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
            </View>
            <View style={styles.addMoreText}>
              <Text style={[styles.addMoreTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                Add another account
              </Text>
              <Text style={[styles.addMoreSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {7 - accounts.length} platform{7 - accounts.length !== 1 ? "s" : ""} remaining
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}

        {/* Info card */}
        <GlassCard style={[styles.infoCard, { borderColor: colors.primary + "33" }]}>
          <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
          <View style={styles.infoText}>
            <Text style={[styles.infoTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Why connect accounts?
            </Text>
            <Text style={[styles.infoDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Connected accounts let Rook index your photos and captions to build your identity fingerprint — the foundation of impersonator detection. Authenticated accounts get real-time sync.
            </Text>
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 200 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, flex: 1 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: "#FFFFFF", fontSize: 14 },
  content: { padding: 16, gap: 14 },

  summaryCard: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  summaryItem: { flex: 1, alignItems: "center", gap: 2 },
  summaryNum: { fontSize: 22 },
  summaryLabel: { fontSize: 11 },
  summaryDivider: { width: 1, height: 28 },

  accountCard: { gap: 12 },
  accountTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  accountInfo: { flex: 1, gap: 3 },
  accountNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  accountUsername: { fontSize: 16, flexShrink: 1 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  verifiedText: { fontSize: 11 },
  platformLabel: { fontSize: 13 },
  syncLabel: { fontSize: 11 },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  stat: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  statValue: { fontSize: 13 },
  statLabel: { fontSize: 11 },
  statDivider: { width: 1, height: 18 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  reconnectStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginBottom: 4,
  },
  reconnectStripText: { fontSize: 12, flex: 1 },
  authCta: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  authCtaText: { flex: 1, fontSize: 13 },

  emptyCard: { alignItems: "center", gap: 12, paddingVertical: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18 },
  emptyDesc: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  emptyBtnText: { color: "#FFFFFF", fontSize: 15 },

  addMoreCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, borderWidth: 1 },
  addMoreIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  addMoreText: { flex: 1, gap: 2 },
  addMoreTitle: { fontSize: 15 },
  addMoreSub: { fontSize: 12 },

  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  infoText: { flex: 1, gap: 4 },
  infoTitle: { fontSize: 14 },
  infoDesc: { fontSize: 13, lineHeight: 19 },

  statusSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 8,
  },
  scopeRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  scopePills: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  scopePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  scopePillText: { fontSize: 11 },
  expiryRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  expiryText: { fontSize: 12 },
  refreshCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  refreshCtaText: { fontSize: 13 },
});
