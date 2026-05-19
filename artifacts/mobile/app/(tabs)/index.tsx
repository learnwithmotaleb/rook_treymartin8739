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
      <Text
        style={[
          styles.statValue,
          {
            color: valueColor ?? colors.foreground,
            fontFamily: "Inter_700Bold",
          },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.statLabel,
          { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
        ]}
      >
        {label}
      </Text>
    </GlassCard>
  );
}

export default function Dashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, threats, activeThreats, fakeAccounts, leakedPasswords } =
    useApp();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const recentThreats = threats.filter((t) => !t.resolved).slice(0, 3);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.logoMark,
              {
                backgroundColor: colors.primary + "22",
                borderColor: colors.primary + "44",
              },
            ]}
          >
            <Ionicons
              name="shield-checkmark"
              size={18}
              color={colors.primary}
            />
          </View>
          <Text
            style={[
              styles.logoText,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            ShieldID
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.notifBtn,
            { backgroundColor: colors.secondary, borderColor: colors.border },
          ]}
          onPress={() => router.push("/(tabs)/alerts")}
        >
          <Ionicons name="notifications" size={20} color={colors.foreground} />
          {activeThreats > 0 && (
            <View
              style={[styles.notifBadge, { backgroundColor: colors.danger }]}
            >
              <Text style={styles.notifBadgeText}>{activeThreats}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 100 },
        ]}
      >
        {/* Status Banner */}
        <GlassCard style={styles.statusBanner}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: colors.success + "22" },
            ]}
          >
            <View
              style={[styles.statusDotInner, { backgroundColor: colors.success }]}
            />
          </View>
          <View style={styles.statusText}>
            <Text
              style={[
                styles.statusTitle,
                {
                  color: colors.foreground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              Your Identity Shield is Active
            </Text>
            <Text
              style={[
                styles.statusSub,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              Monitoring {user.monitored} accounts 24/7
            </Text>
          </View>
          <Ionicons
            name="shield-checkmark"
            size={28}
            color={colors.success}
          />
        </GlassCard>

        {/* Security Score */}
        <GlassCard style={styles.scoreCard}>
          <LinearGradient
            colors={["#3B82F611", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          <Text
            style={[
              styles.scoreCardTitle,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            Identity Risk Score
          </Text>
          <View style={styles.scoreRow}>
            <SecurityScoreRing score={user.securityScore} size={160} />
            <View style={styles.scoreMeta}>
              <View
                style={[
                  styles.trendBadge,
                  { backgroundColor: colors.success + "22" },
                ]}
              >
                <Ionicons
                  name="trending-up"
                  size={14}
                  color={colors.success}
                />
                <Text
                  style={[
                    styles.trendText,
                    {
                      color: colors.success,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  +{user.scoreTrend} from last week
                </Text>
              </View>
              <Text
                style={[
                  styles.lastScan,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                Last scan: {user.lastScan}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Overview Stats */}
        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
            ]}
          >
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
            label="Leaked Passwords"
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
            value="1 Found"
            valueColor={colors.warning}
            icon={
              <MaterialCommunityIcons
                name="eye-off"
                size={22}
                color={colors.warning}
              />
            }
          />
        </View>

        {/* Connected Accounts */}
        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            Connected Accounts
          </Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile" as any)}>
            <Text
              style={[
                styles.seeAll,
                { color: colors.primary, fontFamily: "Inter_500Medium" },
              ]}
            >
              Manage
            </Text>
          </TouchableOpacity>
        </View>
        <GlassCard style={styles.accountsCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.accountsRow}>
              {user.connectedAccounts.map((acc) => (
                <PlatformIcon
                  key={acc.platform}
                  platform={acc.platform!}
                  size={46}
                />
              ))}
              <TouchableOpacity
                style={[
                  styles.addAccount,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="add"
                  size={22}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </GlassCard>

        {/* Recent Alerts */}
        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            Recent Alerts
          </Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/alerts")}>
            <Text
              style={[
                styles.seeAll,
                { color: colors.primary, fontFamily: "Inter_500Medium" },
              ]}
            >
              View All
            </Text>
          </TouchableOpacity>
        </View>
        {recentThreats.map((t) => (
          <ThreatCard key={t.id} threat={t} compact />
        ))}
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
  notifBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statusDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: { flex: 1, gap: 2 },
  statusTitle: { fontSize: 14 },
  statusSub: { fontSize: 12 },
  scoreCard: { overflow: "hidden", gap: 12 },
  scoreCardTitle: { fontSize: 14, letterSpacing: 0.2 },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16 },
  seeAll: { fontSize: 14 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "47.5%",
    alignItems: "flex-start",
    gap: 8,
  },
  statIcon: { marginBottom: 2 },
  statValue: { fontSize: 22 },
  statLabel: { fontSize: 12 },
  accountsCard: { paddingVertical: 12 },
  accountsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
});
