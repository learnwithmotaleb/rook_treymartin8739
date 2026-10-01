import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import Animated, { FadeInDown, Layout } from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";
import { useApp, Severity, type Threat } from "@/context/AppContext";
import { ThreatCard } from "@/components/ThreatCard";
import { PlatformIcon } from "@/components/PlatformIcon";
import { ReviewerDemoBanner } from "@/components/ReviewerDemoBanner";

type Tab = "active" | "resolved";
type Filter = "all" | Severity;

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

const RESOLVE_ACTION_META: Record<string, { label: string; color: string; icon: string; isReal: boolean }> = {
  reported_to_platform: { label: "Reported", color: "#EF4444", icon: "flag",          isReal: true  },
  resolved_manually:    { label: "Removed",  color: "#F97316", icon: "shield-checkmark", isReal: true  },
  false_positive:       { label: "False Positive", color: "#6B7280", icon: "close-circle", isReal: false },
  approved:             { label: "Approved", color: "#3B82F6", icon: "checkmark-circle", isReal: false },
};

function ResolutionBadge({ action, colors }: { action: string | null; colors: ReturnType<typeof useColors> }) {
  const meta = action ? RESOLVE_ACTION_META[action] : null;
  if (!meta) return null;
  const badgeColor = meta.isReal ? meta.color : colors.mutedForeground;
  return (
    <View style={[resolutionStyles.badge, { backgroundColor: badgeColor + "18", borderColor: badgeColor + "44" }]}>
      <Ionicons name={meta.icon as any} size={11} color={badgeColor} />
      <Text style={[resolutionStyles.badgeText, { color: badgeColor, fontFamily: "Inter_600SemiBold" }]}>
        {meta.label}
      </Text>
    </View>
  );
}

function ResolvedThreatRow({ threat, colors }: { threat: Threat; colors: ReturnType<typeof useColors> }) {
  const severityColor =
    threat.severity === "high" ? colors.danger :
    threat.severity === "medium" ? colors.warning : colors.success;
  const severityLabel =
    threat.severity === "high" ? "HIGH" : threat.severity === "medium" ? "MED" : "LOW";
  const meta = threat.resolveAction ? RESOLVE_ACTION_META[threat.resolveAction] : null;
  const isReal = meta?.isReal ?? false;
  const accentColor = isReal ? colors.danger : colors.mutedForeground;
  const resolvedDate = threat.resolvedAt
    ? new Date(threat.resolvedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push(`/threat/${threat.id}` as any)}
      style={[resolvedStyles.row, { backgroundColor: colors.card, borderColor: accentColor + "22" }]}
    >
      <View style={[resolvedStyles.accentBar, { backgroundColor: accentColor + "60" }]} />
      <View style={resolvedStyles.body}>
        <View style={resolvedStyles.topRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <View style={[resolvedStyles.severityPill, { backgroundColor: severityColor + "18", borderColor: severityColor + "40" }]}>
              <Text style={[resolvedStyles.severityText, { color: severityColor, fontFamily: "Inter_700Bold" }]}>
                {severityLabel}
              </Text>
            </View>
            {threat.platform && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <PlatformIcon platform={threat.platform} size={13} />
                <Text style={[resolvedStyles.platformText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {threat.platform.charAt(0).toUpperCase() + threat.platform.slice(1)}
                </Text>
              </View>
            )}
          </View>
          {threat.isSample ? (
            <View
              style={[resolvedStyles.sampleBadge, { backgroundColor: colors.warning + "18", borderColor: colors.warning + "44" }]}
              accessible
              accessibilityLabel="Sample example. This is not a live detected account."
            >
              <Text style={[resolvedStyles.sampleBadgeText, { color: colors.warning, fontFamily: "Inter_700Bold" }]}>
                SAMPLE · NOT LIVE
              </Text>
            </View>
          ) : <ResolutionBadge action={threat.resolveAction} colors={colors} />}
        </View>

        <Text style={[resolvedStyles.title, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
          {threat.title}
        </Text>

        <View style={resolvedStyles.bottomRow}>
          {threat.suspiciousUsername ? (
            <Text style={[resolvedStyles.username, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {threat.suspiciousUsername}
            </Text>
          ) : null}
          {resolvedDate && (
            <Text style={[resolvedStyles.date, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {resolvedDate}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function PaywallBanner({ threats, colors }: { threats: Threat[]; colors: ReturnType<typeof useColors> }) {
  const high = threats.filter((t) => t.severity === "high").length;
  const medium = threats.filter((t) => t.severity === "medium").length;
  const low = threats.filter((t) => t.severity === "low").length;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => router.push("/subscription" as any)}
      style={[paywallStyles.banner, { borderColor: colors.premium + "55", backgroundColor: colors.card }]}
    >
      <LinearGradient
        colors={[colors.premium + "18", colors.primary + "12"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={paywallStyles.topRow}>
        <View style={[paywallStyles.crownBadge, { backgroundColor: colors.premium + "22", borderColor: colors.premium + "44" }]}>
          <MaterialCommunityIcons name="crown" size={13} color={colors.premium} />
          <Text style={[paywallStyles.crownLabel, { color: colors.premium, fontFamily: "Inter_700Bold" }]}>
            Rook Premium
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.premium + "99"} />
      </View>

      <Text style={[paywallStyles.headline, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        {threats.length} threat{threats.length !== 1 ? "s" : ""} hidden behind paywall
      </Text>
      <Text style={[paywallStyles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        Upgrade to see every alert and take action before damage is done.
      </Text>

      <View style={paywallStyles.severityRow}>
        {high > 0 && (
          <View style={[paywallStyles.chip, { backgroundColor: colors.danger + "18", borderColor: colors.danger + "40" }]}>
            <View style={[paywallStyles.chipDot, { backgroundColor: colors.danger }]} />
            <Text style={[paywallStyles.chipText, { color: colors.danger, fontFamily: "Inter_600SemiBold" }]}>
              {high} High
            </Text>
          </View>
        )}
        {medium > 0 && (
          <View style={[paywallStyles.chip, { backgroundColor: colors.warning + "18", borderColor: colors.warning + "40" }]}>
            <View style={[paywallStyles.chipDot, { backgroundColor: colors.warning }]} />
            <Text style={[paywallStyles.chipText, { color: colors.warning, fontFamily: "Inter_600SemiBold" }]}>
              {medium} Medium
            </Text>
          </View>
        )}
        {low > 0 && (
          <View style={[paywallStyles.chip, { backgroundColor: colors.success + "18", borderColor: colors.success + "40" }]}>
            <View style={[paywallStyles.chipDot, { backgroundColor: colors.success }]} />
            <Text style={[paywallStyles.chipText, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>
              {low} Low
            </Text>
          </View>
        )}
      </View>

      <View style={[paywallStyles.ctaRow, { borderTopColor: colors.border }]}>
        <Text style={[paywallStyles.ctaText, { color: colors.premium, fontFamily: "Inter_600SemiBold" }]}>
          Unlock All Alerts
        </Text>
        <Ionicons name="arrow-forward" size={15} color={colors.premium} />
      </View>
    </TouchableOpacity>
  );
}

export default function AlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { threats, refreshData, user, resolveThreat, isReviewerDemo } = useApp();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === "resolved" ? "resolved" : "active");
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  const hasMounted = useRef(false);
  const lastFocusRefreshAt = useRef(0);
  // When the dashboard taps "Resolutions", deep-link opens this screen on the resolved tab.
  useEffect(() => {
    if (params.tab === "resolved") setTab("resolved");
  }, [params.tab]);

  // Refresh user profile + threats when this tab comes into focus — but no
  // more than once every 30 seconds to avoid hammering the API on rapid tab
  // switches. The initial load after login already populates the data; this
  // effect handles the case where the user upgrades their plan mid-session or
  // receives a new threat between app opens.
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (!hasMounted.current) {
        hasMounted.current = true;
        return;
      }
      const now = Date.now();
      if (now - lastFocusRefreshAt.current < 30_000) return;
      lastFocusRefreshAt.current = now;
      refreshData().catch(() => {});
    });
    return unsubscribe;
  }, [navigation, refreshData]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const isFree = user.tier === "free" && !isReviewerDemo;

  const activeFiltered = threats.filter((t) => {
    if (t.resolved) return false;
    if (filter === "all") return true;
    return t.severity === filter;
  });
  const filtered = activeFiltered; // alias used by handleClearAll

  const resolvedThreats = threats
    .filter((t) => t.resolved)
    .sort((a, b) => {
      const dateA = a.resolvedAt ? new Date(a.resolvedAt).getTime() : 0;
      const dateB = b.resolvedAt ? new Date(b.resolvedAt).getTime() : 0;
      return dateB - dateA;
    });

  const confirmedImpersonators = resolvedThreats.filter(
    (t) => t.resolveAction === "reported_to_platform" || t.resolveAction === "resolved_manually"
  ).length;
  const falsePositives = resolvedThreats.filter(
    (t) => t.resolveAction === "false_positive" || t.resolveAction === "approved"
  ).length;

  // Free users always see locked threat cards — detail is a Premium feature.
  // Premium users see all threats fully unlocked.
  const visibleThreats = activeFiltered;
  const lockedThreats: typeof activeFiltered = [];

  const filterColor = (f: Filter) => {
    if (f === "high") return colors.danger;
    if (f === "medium") return colors.warning;
    if (f === "low") return colors.success;
    return colors.primary;
  };

  const [clearingAll, setClearingAll] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const handleClearAll = useCallback(() => {
    if (filtered.length === 0 || clearingAll) return;
    Alert.alert(
      "Clear All",
      `Mark all ${filtered.length} visible threat${filtered.length !== 1 ? "s" : ""} as resolved?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            setClearingAll(true);
            try {
              await Promise.all(filtered.map((t) => resolveThreat(t.id)));
            } catch {
              Alert.alert("Error", "Some threats could not be resolved. Please try again.");
            } finally {
              setClearingAll(false);
            }
          },
        },
      ]
    );
  }, [filtered, clearingAll, resolveThreat]);

  const renderItem = useCallback(
    ({ item, index }: { item: Threat; index: number }) => (
      // Cap delay at 300ms so items deep in the list don't take >1s to appear
      <Animated.View entering={FadeInDown.delay(Math.min(index * 80, 300)).springify()}>
        <ThreatCard threat={item} isLocked={isFree} />
      </Animated.View>
    ),
    [isFree]
  );

  const renderResolved = useCallback(
    ({ item, index }: { item: Threat; index: number }) => (
      <Animated.View entering={FadeInDown.delay(Math.min(index * 60, 300)).springify()}>
        <ResolvedThreatRow threat={item} colors={colors} />
      </Animated.View>
    ),
    [colors]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Alerts
          </Text>
          <View style={[styles.countBadge, { backgroundColor: colors.primary + "22" }]}>
            <Text style={[styles.countText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
              {tab === "resolved" ? resolvedThreats.length : activeFiltered.length}
            </Text>
          </View>
        </View>
        {tab === "active" && filtered.length > 0 && (
          <TouchableOpacity
            onPress={handleClearAll}
            disabled={clearingAll}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {clearingAll ? (
              <ActivityIndicator size="small" color={colors.mutedForeground} />
            ) : (
              <Text style={[styles.clearAllText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Clear All
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {isReviewerDemo && <ReviewerDemoBanner />}

      {/* Tab switcher: Active | Resolved */}
      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {(["active", "resolved"] as Tab[]).map((t) => {
          const isActive = tab === t;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, isActive && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabLabel, { color: isActive ? colors.primary : colors.mutedForeground, fontFamily: isActive ? "Inter_600SemiBold" : "Inter_500Medium" }]}>
                {t === "active" ? "Active" : "Resolved"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === "active" ? (
        <>
          <View style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {FILTERS.map((f) => {
                const isActive = filter === f.value;
                const fc = filterColor(f.value);
                return (
                  <TouchableOpacity
                    key={f.value}
                    style={[styles.filterPill, isActive && { backgroundColor: fc + "22" }]}
                    onPress={() => setFilter(f.value)}
                  >
                    <Text style={[styles.filterText, { color: isActive ? fc : colors.mutedForeground, fontFamily: isActive ? "Inter_600SemiBold" : "Inter_500Medium" }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <FlatList
            data={visibleThreats}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 100 }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
            ListHeaderComponent={
              isFree && activeFiltered.length > 0
                ? <PaywallBanner threats={activeFiltered} colors={colors} />
                : null
            }
            ListFooterComponent={null}
            ListEmptyComponent={
              <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.success + "22" }]}>
                  <Ionicons name="shield-checkmark" size={48} color={colors.success} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>All Clear</Text>
                <Text style={[styles.emptySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {filter === "all"
                    ? "No active threats detected. Run a scan to check for new impersonators."
                    : `No ${filter}-severity threats detected. Run a scan anytime to check for new results.`}
                </Text>
                {filter === "all" && (
                  <TouchableOpacity style={[styles.runScanBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/(tabs)/scan" as any)} activeOpacity={0.85}>
                    <Ionicons name="scan" size={18} color="#FFFFFF" />
                    <Text style={[styles.runScanBtnText, { fontFamily: "Inter_600SemiBold" }]}>Run a Scan</Text>
                  </TouchableOpacity>
                )}
              </Animated.View>
            }
          />
        </>
      ) : (
        <>
          {resolvedThreats.length > 0 && (
            <View style={[resolvedStyles.summary, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <View style={resolvedStyles.summaryItem}>
                <View style={[resolvedStyles.summaryDot, { backgroundColor: colors.danger }]} />
                <Text style={[resolvedStyles.summaryLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {confirmedImpersonators}
                </Text>
                <Text style={[resolvedStyles.summaryDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Confirmed
                </Text>
              </View>
              <View style={[resolvedStyles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={resolvedStyles.summaryItem}>
                <View style={[resolvedStyles.summaryDot, { backgroundColor: colors.mutedForeground }]} />
                <Text style={[resolvedStyles.summaryLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {falsePositives}
                </Text>
                <Text style={[resolvedStyles.summaryDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Not a threat
                </Text>
              </View>
              <View style={[resolvedStyles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={resolvedStyles.summaryItem}>
                <View style={[resolvedStyles.summaryDot, { backgroundColor: colors.primary }]} />
                <Text style={[resolvedStyles.summaryLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {resolvedThreats.length}
                </Text>
                <Text style={[resolvedStyles.summaryDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Total
                </Text>
              </View>
            </View>
          )}

          <FlatList
            data={resolvedThreats}
            keyExtractor={(item) => item.id}
            renderItem={renderResolved}
            contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 100 }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
            ListEmptyComponent={
              <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "22" }]}>
                  <Ionicons name="checkmark-done-circle" size={48} color={colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>No Resolutions Yet</Text>
                <Text style={[styles.emptySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  When you mark a threat as resolved, it will appear here with its category so you can track every result you've reviewed.
                </Text>
              </Animated.View>
            }
          />
        </>
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
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerTitle: { fontSize: 24 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  countText: { fontSize: 13 },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 20,
  },
  tabBtn: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginRight: 24,
  },
  tabLabel: { fontSize: 14 },
  filterRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  filterText: { fontSize: 14 },
  list: { padding: 20, gap: 12 },
  lockedSection: { gap: 12, marginTop: 4 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 20,
    gap: 16,
  },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 22 },
  emptySub: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  clearAllText: { fontSize: 14 },
  runScanBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 8 },
  runScanBtnText: { fontSize: 15, color: "#FFFFFF" },
});
const resolutionStyles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, letterSpacing: 0.3 },
});

const resolvedStyles = StyleSheet.create({
  summary: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 0,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 3 },
  summaryDivider: { width: 1, alignSelf: "stretch", marginVertical: 4 },
  summaryDot: { width: 7, height: 7, borderRadius: 4, marginBottom: 2 },
  summaryLabel: { fontSize: 18 },
  summaryDesc: { fontSize: 11 },
  row: {
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  accentBar: { width: 4, alignSelf: "stretch" },
  body: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  severityPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  severityText: { fontSize: 10, letterSpacing: 0.6 },
  platformText: { fontSize: 11 },
  sampleBadge: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  sampleBadgeText: { fontSize: 9, letterSpacing: 0.4 },
  title: { fontSize: 14, lineHeight: 20 },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  username: { fontSize: 12 },
  date: { fontSize: 12 },
});


const paywallStyles = StyleSheet.create({
  banner: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    padding: 16,
    gap: 10,
    marginBottom: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  crownBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  crownLabel: { fontSize: 11, letterSpacing: 0.3 },
  headline: { fontSize: 17, lineHeight: 22 },
  sub: { fontSize: 13, lineHeight: 18, opacity: 0.85 },
  severityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 12 },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 10,
    marginTop: 2,
    borderTopWidth: 1,
  },
  ctaText: { fontSize: 14 },
});
