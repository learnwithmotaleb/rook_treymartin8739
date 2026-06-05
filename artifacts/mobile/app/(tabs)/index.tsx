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
import Animated, { FadeInDown } from "react-native-reanimated";
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
      {icon}
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
  const { user, threats, activeThreats, fakeAccounts, refreshData } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const recentThreats = threats.filter((t) => !t.resolved).slice(0, 3);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const monitoredCount = user.connectedAccounts.length;

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
            <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.logoText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            ShieldID
          </Text>
        </View>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => router.push("/(tabs)/alerts")}
        >
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
        {/* Security Score */}
        <Animated.View entering={FadeInDown.delay(0).springify()}>
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
          <View style={styles.statsGrid}>
            <StatCard
              label="Active Threats"
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
              label="Fake Accounts"
              value={String(fakeAccounts)}
              valueColor={fakeAccounts > 0 ? colors.warning : colors.success}
              icon={
                <Ionicons
                  name="search"
                  size={24}
                  color={fakeAccounts > 0 ? colors.warning : colors.success}
                />
              }
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
              value={user.totalPhotosIndexed > 0 ? String(user.totalPhotosIndexed) : "—"}
              valueColor={user.totalPhotosIndexed > 0 ? colors.primary : colors.mutedForeground}
              icon={
                <Ionicons
                  name="images"
                  size={24}
                  color={user.totalPhotosIndexed > 0 ? colors.primary : colors.mutedForeground}
                />
              }
            />
          </View>
        </Animated.View>

        {/* Identity Fingerprint */}
        <Animated.View entering={FadeInDown.delay(160).springify()}>
          <GlassCard style={styles.fingerprintCard}>
            <LinearGradient
              colors={["#3B82F60D", "transparent"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.fingerprintHeader}>
              <MaterialCommunityIcons name="fingerprint" size={24} color={colors.primary} />
              <View style={styles.fpTextCol}>
                <Text style={[styles.fpTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  Identity Fingerprint
                </Text>
                <Text style={[styles.fpSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Your indexed digital footprint
                </Text>
              </View>
              <View style={[styles.fpActiveDot, { backgroundColor: colors.success }]} />
            </View>
            <View style={styles.fpStats}>
              <FingerprintStat label="Photos" value={String(user.totalPhotosIndexed)} />
              <FingerprintStat label="Captions" value={String(user.totalCaptionsIndexed)} />
              <FingerprintStat label="Reels" value={String(user.reelsIndexed)} />
              <FingerprintStat label="Platforms" value={String(user.monitored)} />
            </View>
          </GlassCard>
        </Animated.View>

        {/* Connected Accounts */}
        <Animated.View entering={FadeInDown.delay(240).springify()}>
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

        {/* Recent Alerts */}
        <Animated.View entering={FadeInDown.delay(320).springify()}>
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
  logoMark: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  logoText: { fontSize: 20 },
  notifBtn: {
    position: "relative",
    padding: 4,
  },
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

  fingerprintCard: { gap: 16 },
  fingerprintHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  fpTextCol: { flex: 1 },
  fpTitle: { fontSize: 15 },
  fpSubtitle: { fontSize: 12, marginTop: 1 },
  fpActiveDot: { width: 8, height: 8, borderRadius: 4 },
  fpStats: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  fpStat: { alignItems: "center", gap: 4 },
  fpStatValue: { fontSize: 18 },
  fpStatLabel: { fontSize: 12 },

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
});
