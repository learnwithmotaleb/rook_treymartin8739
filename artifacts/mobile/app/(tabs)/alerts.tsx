import React, { useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp, Severity, Threat } from "@/context/AppContext";
import { ThreatCard } from "@/components/ThreatCard";

type Filter = "all" | Severity;

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

export default function AlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { threats } = useApp();
  const [filter, setFilter] = useState<Filter>("all");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const filtered = threats.filter((t) => {
    if (t.resolved) return false;
    if (filter === "all") return true;
    return t.severity === filter;
  });

  const filterColor = (f: Filter) => {
    if (f === "high") return colors.danger;
    if (f === "medium") return colors.warning;
    if (f === "low") return colors.success;
    return colors.primary;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Alerts
        </Text>
        <View style={[styles.countBadge, { backgroundColor: colors.danger + "22" }]}>
          <Text style={[styles.countText, { color: colors.danger, fontFamily: "Inter_700Bold" }]}>
            {filtered.length}
          </Text>
        </View>
      </View>

      {/* Filters */}
      <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
        {FILTERS.map((f) => {
          const isActive = filter === f.value;
          const fc = filterColor(f.value);
          return (
            <TouchableOpacity
              key={f.value}
              style={[
                styles.filterBtn,
                isActive && {
                  backgroundColor: fc + "22",
                  borderBottomColor: fc,
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => setFilter(f.value)}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: isActive ? fc : colors.mutedForeground,
                    fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular",
                  },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ThreatCard threat={item} />}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPad + 100 },
        ]}
        scrollEnabled={!!filtered.length}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.success + "22" }]}>
              <Ionicons name="shield-checkmark" size={40} color={colors.success} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              All Clear
            </Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              No active threats detected
            </Text>
          </View>
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
    borderBottomWidth: 1,
  },
  filterBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  filterText: { fontSize: 14 },
  list: { padding: 16, gap: 10 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 16,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 20 },
  emptySub: { fontSize: 15 },
});
