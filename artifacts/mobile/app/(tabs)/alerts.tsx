import React, { useCallback, useState } from "react";
import {
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
import { router } from "expo-router";
import Animated, { FadeInDown, Layout } from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";
import { useApp, Severity, type Threat } from "@/context/AppContext";
import { ThreatCard } from "@/components/ThreatCard";

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

  return (
    <View style={[lockedStyles.wrapper, { borderColor: colors.border }]}>
      <View style={lockedStyles.blur} pointerEvents="none">
        <View style={[lockedStyles.fakeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[lockedStyles.fakeDot, { backgroundColor: severityColor }]} />
          <View style={lockedStyles.fakeLines}>
            <View style={[lockedStyles.fakeLine, { backgroundColor: colors.border, width: "80%" }]} />
            <View style={[lockedStyles.fakeLine, { backgroundColor: colors.border, width: "50%", opacity: 0.6 }]} />
            <View style={[lockedStyles.fakeLine, { backgroundColor: colors.border, width: "40%", opacity: 0.3 }]} />
          </View>
        </View>
      </View>
      <View style={[lockedStyles.overlay, { backgroundColor: colors.background + "CC" }]}>
        <View style={lockedStyles.overlayContent}>
          <View style={[lockedStyles.lockIcon, { backgroundColor: colors.warning + "22", borderColor: colors.warning + "44" }]}>
            <Ionicons name="lock-closed" size={24} color={colors.warning} />
          </View>
          <Text style={[lockedStyles.lockLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {threat.severity === "high" ? "High-Severity" : threat.severity === "medium" ? "Medium-Severity" : "Low-Severity"} Threat Hidden
          </Text>
          <Text style={[lockedStyles.lockSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Upgrade to ShieldID Pro to unlock all alerts
          </Text>
        </View>
      </View>
    </View>
  );
}

function PaywallBanner({ hiddenCount, colors }: { hiddenCount: number; colors: ReturnType<typeof useColors> }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push("/subscription" as any)}
      style={[paywallStyles.banner, { borderColor: colors.premium + "44" }]}
    >
      <LinearGradient
        colors={[colors.primary + "22", colors.premium + "33"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[paywallStyles.iconWrap, { backgroundColor: colors.premium + "33" }]}>
        <MaterialCommunityIcons name="crown" size={20} color={colors.premium} />
      </View>
      <View style={paywallStyles.text}>
        <Text style={[paywallStyles.title, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          {hiddenCount} more threat{hiddenCount !== 1 ? "s" : ""} hidden
        </Text>
        <Text style={[paywallStyles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Upgrade to Pro to see all alerts and take action
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.premium} />
    </TouchableOpacity>
  );
}

export default function AlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { threats, refreshData, user } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const isFree = !user.isPremium && user.tier === "free";

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

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
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Alerts
        </Text>
        <View style={[styles.countBadge, { backgroundColor: colors.primary + "22" }]}>
          <Text style={[styles.countText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
            {filtered.length}
          </Text>
        </View>
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
                <PaywallBanner hiddenCount={lockedThreats.length} colors={colors} />
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
                  ? "We haven't detected any active threats to your identity. We'll keep monitoring."
                  : `No ${filter}-severity threats detected. You're fully protected.`}
              </Text>
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
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
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
});

const lockedStyles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    height: 96,
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.2,
    padding: 16,
    justifyContent: "center",
  },
  fakeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  fakeDot: { width: 10, height: 10, borderRadius: 5 },
  fakeLines: { flex: 1, gap: 8 },
  fakeLine: { height: 10, borderRadius: 5 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  overlayContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 14,
  },
  lockIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  lockLabel: { fontSize: 14, flex: 1 },
  lockSub: { fontSize: 12 },
});

const paywallStyles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 4,
    overflow: "hidden",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 14 },
  sub: { fontSize: 12 },
});
