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
import { router, useNavigation } from "expo-router";
import Animated, { FadeInDown, Layout } from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";
import { useApp, Severity, type Threat } from "@/context/AppContext";
import { ThreatCard } from "@/components/ThreatCard";
import { PlatformIcon } from "@/components/PlatformIcon";

type Filter = "all" | Severity;

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

const FREE_VISIBLE_THREATS = 5;

function LockedThreatCard({ threat, colors }: { threat: Threat; colors: ReturnType<typeof useColors> }) {
  const severityColor =
    threat.severity === "high"
      ? colors.danger
      : threat.severity === "medium"
      ? colors.warning
      : colors.success;

  const severityLabel =
    threat.severity === "high" ? "HIGH" : threat.severity === "medium" ? "MED" : "LOW";

  return (
    <View style={[lockedStyles.wrapper, { backgroundColor: colors.card, borderColor: severityColor + "30" }]}>
      <View style={[lockedStyles.accentBar, { backgroundColor: severityColor }]} />
      <View style={lockedStyles.body}>
        <View style={lockedStyles.topRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={[lockedStyles.severityPill, { backgroundColor: severityColor + "20", borderColor: severityColor + "50" }]}>
              <View style={[lockedStyles.severityDot, { backgroundColor: severityColor }]} />
              <Text style={[lockedStyles.severityText, { color: severityColor, fontFamily: "Inter_700Bold" }]}>
                {severityLabel}
              </Text>
            </View>
            {threat.platform ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <PlatformIcon platform={threat.platform} size={14} />
                <Text style={[lockedStyles.platformLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {threat.platform.charAt(0).toUpperCase() + threat.platform.slice(1)}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={[lockedStyles.lockBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Ionicons name="lock-closed" size={11} color={colors.mutedForeground} />
          </View>
        </View>
        <View style={lockedStyles.skeletonGroup}>
          <Text style={[lockedStyles.threatHint, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {threat.type === "impersonator" || threat.type === "fake_account"
              ? "Impersonation detected"
              : threat.type === "stolen_photo"
              ? "Photo theft found"
              : "Identity threat detected"}
          </Text>
          <View style={[lockedStyles.skeletonLine, { backgroundColor: colors.border, width: "45%", opacity: 0.4 }]} />
        </View>
        <View style={lockedStyles.bottomRow}>
          <View style={[lockedStyles.skeletonChip, { backgroundColor: colors.border }]} />
        </View>
      </View>
      <LinearGradient
        colors={["transparent", colors.card + "E0"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        pointerEvents="none"
      />
    </View>
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
            ShieldID Pro
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
  const { threats, refreshData, user, resolveThreat } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  const hasMounted = useRef(false);

  // Refresh user profile + threats every time this tab comes into focus so
  // that tier/premium changes (e.g. after a subscription upgrade) are reflected
  // immediately without requiring a full app restart.
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (!hasMounted.current) {
        hasMounted.current = true;
        return;
      }
      refreshData().catch(() => {});
    });
    return unsubscribe;
  }, [navigation, refreshData]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const isFree = user.tier === "free";

  const filtered = threats.filter((t) => {
    if (t.resolved) return false;
    if (filter === "all") return true;
    return t.severity === filter;
  });

  const visibleThreats = isFree ? filtered.slice(0, FREE_VISIBLE_THREATS) : filtered;
  const lockedThreats = isFree ? filtered.slice(FREE_VISIBLE_THREATS) : [];

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
      <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
        <ThreatCard threat={item} />
      </Animated.View>
    ),
    []
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
              {filtered.length}
            </Text>
          </View>
        </View>
        {filtered.length > 0 && (
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

      <View style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => {
            const isActive = filter === f.value;
            const fc = filterColor(f.value);
            return (
              <TouchableOpacity
                key={f.value}
                style={[
                  styles.filterPill,
                  isActive && { backgroundColor: fc + "22" },
                ]}
                onPress={() => setFilter(f.value)}
              >
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: isActive ? fc : colors.mutedForeground,
                      fontFamily: isActive ? "Inter_600SemiBold" : "Inter_500Medium",
                    },
                  ]}
                >
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
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPad + 100 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListFooterComponent={
          <>
            {lockedThreats.length > 0 && (
              <View style={styles.lockedSection}>
                <PaywallBanner threats={lockedThreats} colors={colors} />
                {lockedThreats.map((t, index) => (
                  <Animated.View key={t.id} entering={FadeInDown.delay((visibleThreats.length + index) * 80).springify()}>
                    <LockedThreatCard threat={t} colors={colors} />
                  </Animated.View>
                ))}
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          lockedThreats.length > 0 ? null : (
            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.success + "22" }]}>
                <Ionicons name="shield-checkmark" size={48} color={colors.success} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                All Clear
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {filter === "all"
                  ? "No active threats detected. Run a scan to check for new impersonators."
                  : `No ${filter}-severity threats detected. You're fully protected.`}
              </Text>
              {filter === "all" && (
                <TouchableOpacity
                  style={[styles.runScanBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push("/(tabs)/scan" as any)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="scan" size={18} color="#FFFFFF" />
                  <Text style={[styles.runScanBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                    Run a Scan
                  </Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          )
        }
      />
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: { fontSize: 24 },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  countText: { fontSize: 13 },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
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
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 22 },
  emptySub: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  clearAllText: { fontSize: 14 },
  runScanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  runScanBtnText: { fontSize: 15, color: "#FFFFFF" },
});

const lockedStyles = StyleSheet.create({
  wrapper: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
    height: 100,
  },
  accentBar: {
    width: 4,
    alignSelf: "stretch",
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    justifyContent: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  severityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  severityText: { fontSize: 11, letterSpacing: 0.6 },
  lockBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonGroup: { gap: 7 },
  skeletonLine: { height: 9, borderRadius: 5 },
  bottomRow: { flexDirection: "row", gap: 8 },
  skeletonChip: { height: 7, width: 64, borderRadius: 4 },
  platformLabel: { fontSize: 11 },
  threatHint: { fontSize: 13, opacity: 0.5 },
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
