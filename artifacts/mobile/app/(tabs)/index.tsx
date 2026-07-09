import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { SecurityScoreRing } from "@/components/SecurityScoreRing";
import { ThreatCard } from "@/components/ThreatCard";
import { PlatformIcon } from "@/components/PlatformIcon";
import { GlassCard } from "@/components/GlassCard";
import { Skeleton } from "@/components/Skeleton";

function StatCard({
  label,
  value,
  valueColor,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  valueColor?: string;
  icon: React.ReactNode;
  onPress?: () => void;
}) {
  const colors = useColors();
  const inner = (
    <GlassCard style={[styles.statCard, onPress ? { width: "100%" } : undefined]}>
      {icon}
      <Text style={[styles.statValue, { color: valueColor ?? colors.foreground, fontFamily: "Inter_700Bold" }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {label}
      </Text>
    </GlassCard>
  );
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={{ width: "48%" }}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

export default function Dashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    user,
    threats,
    activeThreats,
    resolvedCount,
    indexedPhotos,
    refreshData,
    isLoading,
    hasSeenOnboarding,
    isInitializing,
    completeOnboarding,
  } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const recentThreats = threats.filter((t) => !t.resolved).slice(0, 3);

  // Auto-complete onboarding for returning users who already have data.
  // The tab layout handles the /auth and /onboarding redirects — we only
  // need this to skip onboarding for users who arrived before it was added.
  useEffect(() => {
    if (isInitializing) return;
    if (!hasSeenOnboarding && (user.connectedAccounts.length > 0 || user.name)) {
      completeOnboarding();
    }
  }, [isInitializing, hasSeenOnboarding, user.connectedAccounts.length, user.name, completeOnboarding]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const monitoredCount = user.connectedAccounts.length;

  // Tier-driven state machine:
  //  not_protected  — no accounts connected (any tier)
  //  scan_available — accounts exist but never scanned (any tier)
  //  results_locked — free user who has scanned (results gated behind paywall)
  //  monitoring_active — pro/premium subscriber with at least one scan
  const dashState =
    monitoredCount === 0 ? ("not_protected" as const) :
    user.lastScan === "Never" ? ("scan_available" as const) :
    user.tier === "free" ? ("results_locked" as const) :
    ("monitoring_active" as const);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Image
            source={require("../../assets/images/logo-mark.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </View>
        <TouchableOpacity style={styles.notifBtn} onPress={() => router.push("/(tabs)/alerts")}>
          <Ionicons name="notifications" size={24} color={colors.foreground} />
          {activeThreats > 0 && (
            <View style={[styles.notifBadge, { backgroundColor: colors.danger }]}>
              <Text style={styles.notifBadgeText}>{activeThreats}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Dashboard State Banner */}
        {dashState === "not_protected" && (
          <Animated.View entering={FadeInDown.delay(0).springify()}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => router.push("/manage-accounts" as any)}
              style={[styles.stateBanner, { backgroundColor: colors.danger + "14", borderColor: colors.danger + "44" }]}
            >
              <View style={[styles.stateBannerIcon, { backgroundColor: colors.danger + "22" }]}>
                <Ionicons name="shield-outline" size={20} color={colors.danger} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.stateBannerTitle, { color: colors.danger, fontFamily: "Inter_700Bold" }]}>
                  Not Protected
                </Text>
                <Text style={[styles.stateBannerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Connect a social account to start monitoring
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.danger} />
            </TouchableOpacity>
          </Animated.View>
        )}
        {dashState === "scan_available" && (
          <Animated.View entering={FadeInDown.delay(0).springify()}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => router.push("/(tabs)/scan" as any)}
              style={[styles.stateBanner, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "44" }]}
            >
              <View style={[styles.stateBannerIcon, { backgroundColor: colors.primary + "22" }]}>
                <MaterialCommunityIcons name="radar" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.stateBannerTitle, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                  Scan Available
                </Text>
                <Text style={[styles.stateBannerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Run your first scan to detect threats across your platforms
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          </Animated.View>
        )}
        {dashState === "results_locked" && (
          <Animated.View entering={FadeInDown.delay(0).springify()}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => router.push("/scan-results-preview" as any)}
              style={[styles.stateBanner, { backgroundColor: colors.warning + "14", borderColor: colors.warning + "44" }]}
            >
              <View style={[styles.stateBannerIcon, { backgroundColor: colors.warning + "22" }]}>
                <Ionicons name="lock-closed" size={20} color={colors.warning} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.stateBannerTitle, { color: colors.warning, fontFamily: "Inter_700Bold" }]}>
                  Results Ready — Locked
                </Text>
                <Text style={[styles.stateBannerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Tap to unlock your scan results or upgrade to Pro
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.warning} />
            </TouchableOpacity>
          </Animated.View>
        )}
        {dashState === "monitoring_active" && (
          <Animated.View entering={FadeInDown.delay(0).springify()}>
            <View style={[styles.stateBanner, { backgroundColor: colors.success + "14", borderColor: colors.success + "33" }]}>
              <View style={[styles.stateBannerIcon, { backgroundColor: colors.success + "22" }]}>
                <Ionicons name="shield-checkmark" size={20} color={colors.success} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.stateBannerTitle, { color: colors.success, fontFamily: "Inter_700Bold" }]}>
                  Monitoring Active
                </Text>
                <Text style={[styles.stateBannerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {monitoredCount} platform{monitoredCount !== 1 ? "s" : ""} · {activeThreats} active threat{activeThreats !== 1 ? "s" : ""} · Last scan: {user.lastScan}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Security Score */}
        <Animated.View entering={FadeInDown.delay(0).springify()}>
          <GlassCard style={styles.scoreCard}>
            <LinearGradient colors={["#3B82F611", "transparent"]} style={StyleSheet.absoluteFill} />
            <Text style={[styles.scoreCardTitle, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              Identity Risk Score
            </Text>
            <View style={styles.scoreRow}>
              <SecurityScoreRing score={user.securityScore} size={180} />
            </View>
            <Text style={[styles.lastScan, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Last scan: {user.lastScan}
            </Text>
          </GlassCard>
        </Animated.View>

        {/* Overview Stats */}
        <Animated.View entering={FadeInDown.delay(80).springify()}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Overview
            </Text>
          </View>
          {isLoading ? (
            <View style={styles.statsGrid}>
              <Skeleton height={110} width="48%" borderRadius={14} />
              <Skeleton height={110} width="48%" borderRadius={14} />
              <Skeleton height={110} width="48%" borderRadius={14} />
              <Skeleton height={110} width="48%" borderRadius={14} />
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <StatCard
                label="Threats Detected"
                value={String(activeThreats)}
                valueColor={activeThreats > 0 ? colors.danger : colors.success}
                icon={
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={24}
                    color={activeThreats > 0 ? colors.danger : colors.success}
                  />
                }
              />
              <StatCard
                label="Resolutions"
                value={resolvedCount > 0 ? String(resolvedCount) : "—"}
                valueColor={resolvedCount > 0 ? colors.success : colors.mutedForeground}
                icon={
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={resolvedCount > 0 ? colors.success : colors.mutedForeground}
                  />
                }
                onPress={() => router.push({ pathname: "/(tabs)/alerts", params: { tab: "resolved" } } as any)}
              />
              <StatCard
                label="Platforms Monitored"
                value={monitoredCount > 0 ? String(monitoredCount) : "None"}
                valueColor={monitoredCount > 0 ? colors.success : colors.mutedForeground}
                icon={
                  <MaterialCommunityIcons
                    name="shield-check"
                    size={24}
                    color={monitoredCount > 0 ? colors.success : colors.mutedForeground}
                  />
                }
              />
              <StatCard
                label="Photos Indexed"
                value={indexedPhotos.length > 0 ? String(indexedPhotos.length) : "—"}
                valueColor={indexedPhotos.length > 0 ? colors.primary : colors.mutedForeground}
                icon={
                  <Ionicons
                    name="images"
                    size={24}
                    color={indexedPhotos.length > 0 ? colors.primary : colors.mutedForeground}
                  />
                }
              />
            </View>
          )}
        </Animated.View>

        {/* Connected Accounts */}
        <Animated.View entering={FadeInDown.delay(160).springify()}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Verified Accounts
            </Text>
            <TouchableOpacity onPress={() => router.push("/manage-accounts" as any)}>
              <Text style={[styles.seeAll, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
                Manage
              </Text>
            </TouchableOpacity>
          </View>
          <GlassCard style={styles.accountsCard}>
            {user.connectedAccounts.length === 0 ? (
              <TouchableOpacity
                style={styles.accountsEmpty}
                onPress={() => router.push("/manage-accounts" as any)}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
                <Text style={[styles.accountsEmptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Connect a social account to start monitoring
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.accountsRow}>
                  {user.connectedAccounts.map((acc) => (
                    <View key={acc.platform} style={styles.accountItem}>
                      <View style={styles.accountIconWrap}>
                        <PlatformIcon platform={acc.platform!} size={46} />
                        <View style={[styles.verifiedDot, { backgroundColor: colors.success, borderColor: colors.card }]}>
                          <Ionicons name="checkmark" size={8} color="#FFFFFF" />
                        </View>
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[styles.addAccount, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                    onPress={() => router.push("/manage-accounts" as any)}
                  >
                    <Ionicons name="add" size={24} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </GlassCard>
        </Animated.View>

        {/* Recent Threats */}
        <Animated.View entering={FadeInDown.delay(240).springify()}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Recent Threats
            </Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/alerts")}>
              <Text style={[styles.seeAll, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
                View All
              </Text>
            </TouchableOpacity>
          </View>
          {isLoading ? (
            <View style={{ gap: 10 }}>
              <Skeleton height={80} borderRadius={14} />
              <Skeleton height={80} borderRadius={14} />
            </View>
          ) : recentThreats.length === 0 ? (
            <GlassCard style={styles.noThreats}>
              <Ionicons name="shield-checkmark" size={32} color={colors.success} />
              <Text style={[styles.noThreatsText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No active threats detected
              </Text>
            </GlassCard>
          ) : (
            recentThreats.map((t) => (
              <ThreatCard key={t.id} threat={t} compact />
            ))
          )}
        </Animated.View>
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
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerLogo: {
    width: 44,
    height: 44,
  },
  notifBtn: { position: "relative", padding: 4 },
  notifBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700" },
  content: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },

  scoreCard: { alignItems: "center", gap: 16, paddingVertical: 24 },
  scoreCardTitle: { fontSize: 15 },
  scoreRow: { alignItems: "center", justifyContent: "center" },
  lastScan: { fontSize: 13, marginTop: 4 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  sectionTitle: { fontSize: 16 },
  seeAll: { fontSize: 14 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: { width: "48%", alignItems: "flex-start", gap: 12, padding: 18 },
  statValue: { fontSize: 24 },
  statLabel: { fontSize: 13 },

  accountsCard: { paddingVertical: 16 },
  accountsEmpty: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  accountsEmptyText: { flex: 1, fontSize: 14 },
  accountsRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  accountItem: { alignItems: "center" },
  accountIconWrap: { position: "relative" },
  verifiedDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  addAccount: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
  },

  noThreats: { alignItems: "center", gap: 10, paddingVertical: 12 },
  noThreatsText: { fontSize: 14 },

  stateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  stateBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stateBannerTitle: { fontSize: 14, lineHeight: 20 },
  stateBannerSub: { fontSize: 12, lineHeight: 17 },
});
