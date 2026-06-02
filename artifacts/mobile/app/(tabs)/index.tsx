import React, { useCallback, useState } from "react";
import {
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
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { SecurityScoreRing } from "@/components/SecurityScoreRing";
import { ThreatCard } from "@/components/ThreatCard";
import { PlatformIcon } from "@/components/PlatformIcon";
import { GlassCard } from "@/components/GlassCard";

function StatCard({
  label,
  value,
  valueColor,
  icon,
}: {
  label: string;
  value: string;
  valueColor?: string;
  icon: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <GlassCard style={styles.statCard}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={[styles.statValue, { color: valueColor ?? colors.foreground, fontFamily: "Inter_700Bold" }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {label}
      </Text>
    </GlassCard>
  );
}

function FingerprintStat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.fpStat}>
      <Text style={[styles.fpStatValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        {value}
      </Text>
      <Text style={[styles.fpStatLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {label}
      </Text>
    </View>
  );
}

export default function Dashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, threats, activeThreats, fakeAccounts, leakedPasswords, refreshData } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const recentThreats = threats.filter((t) => !t.resolved).slice(0, 3);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const darkWebCount = threats.filter((t) => !t.resolved && t.type === "dark_web").length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}
      >
        <View style={styles.headerLeft}>
          <View
            style={[styles.logoMark, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}
          >
            <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.logoText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            ShieldID
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.notifBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={() => router.push("/(tabs)/alerts")}
        >
          <Ionicons name="notifications" size={20} color={colors.foreground} />
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
        {/* Status Banner */}
        <GlassCard style={styles.statusBanner}>
          <View style={[styles.statusDot, { backgroundColor: colors.success + "22" }]}>
            <View style={[styles.statusDotInner, { backgroundColor: colors.success }]} />
          </View>
          <View style={styles.statusText}>
            <Text style={[styles.statusTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Identity Shield Active
            </Text>
            <Text style={[styles.statusSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Monitoring {user.monitored} verified accounts 24/7
            </Text>
          </View>
          <Ionicons name="shield-checkmark" size={28} color={colors.success} />
        </GlassCard>

        {/* Security Score */}
        <GlassCard style={styles.scoreCard}>
          <LinearGradient
            colors={["#3B82F611", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          <Text
            style={[styles.scoreCardTitle, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
          >
            Identity Risk Score
          </Text>
          <View style={styles.scoreRow}>
            <SecurityScoreRing score={user.securityScore} size={160} />
            <View style={styles.scoreMeta}>
              <View style={[styles.trendBadge, { backgroundColor: colors.success + "22" }]}>
                <Ionicons name="trending-up" size={14} color={colors.success} />
                <Text style={[styles.trendText, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>
                  +{user.scoreTrend} this week
                </Text>
              </View>
              <Text style={[styles.lastScan, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Last scan: {user.lastScan}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Identity Fingerprint */}
        <GlassCard style={[styles.fingerprintCard, { borderColor: colors.primary + "44" }]}>
          <LinearGradient
            colors={["#3B82F60D", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.fingerprintHeader}>
            <View style={[styles.fpIcon, { backgroundColor: colors.primary + "22" }]}>
              <MaterialCommunityIcons name="fingerprint" size={20} color={colors.primary} />
            </View>
            <View style={styles.fpTextCol}>
              <Text style={[styles.fpTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Identity Fingerprint Active
              </Text>
              <Text style={[styles.fpUpdated, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Updated {user.fingerprintUpdated}
              </Text>
            </View>
            <View style={[styles.fpActiveDot, { backgroundColor: colors.success }]} />
          </View>
          <View style={styles.fpStats}>
            <FingerprintStat label="Photos" value={String(user.totalPhotosIndexed)} />
            <View style={[styles.fpDivider, { backgroundColor: colors.border }]} />
            <FingerprintStat label="Captions" value={String(user.totalCaptionsIndexed)} />
            <View style={[styles.fpDivider, { backgroundColor: colors.border }]} />
            <FingerprintStat label="Reels" value={String(user.reelsIndexed)} />
            <View style={[styles.fpDivider, { backgroundColor: colors.border }]} />
            <FingerprintStat label="Platforms" value={String(user.monitored)} />
          </View>
        </GlassCard>

        {/* Overview Stats */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Overview
          </Text>
        </View>
        <View style={styles.statsGrid}>
          <StatCard
            label="Active Threats"
            value={String(activeThreats)}
            valueColor={activeThreats > 0 ? colors.danger : colors.success}
            icon={
              <MaterialCommunityIcons
                name="alert-circle"
                size={22}
                color={activeThreats > 0 ? colors.danger : colors.success}
              />
            }
          />
          <StatCard
            label="Fake Accounts"
            value={String(fakeAccounts)}
            valueColor={fakeAccounts > 0 ? colors.warning : colors.success}
            icon={
              <Ionicons
                name="search"
                size={22}
                color={fakeAccounts > 0 ? colors.warning : colors.success}
              />
            }
          />
          <StatCard
            label="Leaked Credentials"
            value={String(leakedPasswords)}
            valueColor={leakedPasswords > 0 ? colors.warning : colors.success}
            icon={
              <Ionicons
                name="lock-open"
                size={22}
                color={leakedPasswords > 0 ? colors.warning : colors.success}
              />
            }
          />
          <StatCard
            label="Dark Web"
            value={darkWebCount > 0 ? `${darkWebCount} Found` : "Clean"}
            valueColor={darkWebCount > 0 ? colors.warning : colors.success}
            icon={
              <MaterialCommunityIcons
                name="eye-off"
                size={22}
                color={darkWebCount > 0 ? colors.warning : colors.success}
              />
            }
          />
        </View>

        {/* Connected Accounts */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Verified Accounts
          </Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile" as any)}>
            <Text style={[styles.seeAll, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
              Manage
            </Text>
          </TouchableOpacity>
        </View>
        <GlassCard style={styles.accountsCard}>
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
                  <Text style={[styles.accountPhotos, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {acc.photosIndexed} photos
                  </Text>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.addAccount, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              >
                <Ionicons name="add" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </GlassCard>

        {/* Photo Monitor quick action */}
        <TouchableOpacity
          style={[styles.photoMonitorBanner, { backgroundColor: "#8B5CF611", borderColor: "#8B5CF633" }]}
          activeOpacity={0.8}
          onPress={() => router.push("/photo-monitor" as any)}
        >
          <View style={[styles.photoMonitorIconWrap, { backgroundColor: "#8B5CF622" }]}>
            <MaterialCommunityIcons name="image-search" size={20} color="#8B5CF6" />
          </View>
          <View style={styles.photoMonitorInfo}>
            <Text style={[styles.photoMonitorTitle, { color: "#8B5CF6", fontFamily: "Inter_600SemiBold" }]}>
              Photo Monitor
            </Text>
            <Text style={[styles.photoMonitorSub, { color: "#8B5CF6AA", fontFamily: "Inter_400Regular" }]}>
              Scan for stolen profile photos
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#8B5CF6" />
        </TouchableOpacity>

        {/* Recent Alerts */}
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
        {recentThreats.length === 0 ? (
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
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  logoText: { fontSize: 20 },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  notifBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700" },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },

  statusBanner: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statusDotInner: { width: 10, height: 10, borderRadius: 5 },
  statusText: { flex: 1, gap: 2 },
  statusTitle: { fontSize: 14 },
  statusSub: { fontSize: 12 },

  scoreCard: { overflow: "hidden", gap: 12 },
  scoreCardTitle: { fontSize: 14 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  scoreMeta: { flex: 1, gap: 12 },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  trendText: { fontSize: 12 },
  lastScan: { fontSize: 12 },

  fingerprintCard: { overflow: "hidden", gap: 14 },
  fingerprintHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  fpIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  fpTextCol: { flex: 1 },
  fpTitle: { fontSize: 14 },
  fpUpdated: { fontSize: 11 },
  fpActiveDot: { width: 8, height: 8, borderRadius: 4 },
  fpStats: { flexDirection: "row", alignItems: "center" },
  fpStat: { flex: 1, alignItems: "center", gap: 2 },
  fpStatValue: { fontSize: 18 },
  fpStatLabel: { fontSize: 11 },
  fpDivider: { width: 1, height: 32 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16 },
  seeAll: { fontSize: 14 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "47.5%", alignItems: "flex-start", gap: 8 },
  statIcon: { marginBottom: 2 },
  statValue: { fontSize: 22 },
  statLabel: { fontSize: 12 },

  accountsCard: { paddingVertical: 12 },
  accountsRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  accountItem: { alignItems: "center", gap: 4 },
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
  accountPhotos: { fontSize: 10 },
  addAccount: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
  },

  noThreats: { alignItems: "center", gap: 10, paddingVertical: 8 },
  noThreatsText: { fontSize: 14 },

  photoMonitorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  photoMonitorIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  photoMonitorInfo: { flex: 1 },
  photoMonitorTitle: { fontSize: 14 },
  photoMonitorSub: { fontSize: 12, marginTop: 1 },
});
