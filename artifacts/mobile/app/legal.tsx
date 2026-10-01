import React from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";
import { getApiUrl } from "@/lib/api";
import { getAppReleaseInfo } from "@/lib/appRelease";
import { getAppReleaseRows } from "@/lib/appReleaseDisplay";

const LEGAL_LINKS = [
  {
    title: "Privacy Policy",
    subtitle: "How we collect, use, and protect your data",
    icon: "lock-closed" as const,
    path: "/legal/privacy",
  },
  {
    title: "Terms of Service",
    subtitle: "Rules and conditions for using Rook",
    icon: "document-text" as const,
    path: "/legal/terms",
  },
];

const INFO_ROWS = [
  ...getAppReleaseRows(getAppReleaseInfo()),
  { label: "Support", value: "support@getrook.app" },
  { label: "Privacy", value: "support@getrook.app" },
];

export default function Legal() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Unable to open link", "Please check your connection and try again.");
    }
  };

  const openLegal = (path: string) => {
    try {
      void open(getApiUrl(path));
    } catch (error) {
      Alert.alert(
        "Legal link unavailable",
        error instanceof Error ? error.message : "The app could not resolve the legal link."
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          Legal & Privacy
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 32 }]}
      >
        <GlassCard style={styles.card}>
          {LEGAL_LINKS.map((item, i) => (
            <React.Fragment key={item.path}>
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => openLegal(item.path)}
              >
                <View style={[styles.iconWrap, { backgroundColor: colors.primary + "18" }]}>
                  <Ionicons name={item.icon} size={18} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {item.subtitle}
                  </Text>
                </View>
                <Ionicons name="open-outline" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              {i < LEGAL_LINKS.length - 1 && (
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              )}
            </React.Fragment>
          ))}
        </GlassCard>

        <GlassCard style={styles.card}>
          {INFO_ROWS.map((row, i) => (
            <React.Fragment key={row.label}>
              <TouchableOpacity
                style={styles.infoRow}
                activeOpacity={row.value.includes("@") ? 0.7 : 1}
                onPress={row.value.includes("@") ? () => open(`mailto:${row.value}`) : undefined}
              >
                <Text style={[styles.infoLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {row.label}
                </Text>
                <Text style={[styles.infoValue, {
                  color: row.value.includes("@") ? colors.primary : colors.foreground,
                  fontFamily: "Inter_400Regular",
                }]}>
                  {row.value}
                </Text>
              </TouchableOpacity>
              {i < INFO_ROWS.length - 1 && (
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              )}
            </React.Fragment>
          ))}
        </GlassCard>

        <Text style={[styles.copyright, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          © {new Date().getFullYear()} Rook. All rights reserved.{"\n"}
          Made to protect your digital identity.
        </Text>
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
  headerTitle: { fontSize: 17 },
  content: { padding: 20, gap: 16 },
  card: { gap: 0, padding: 0, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15 },
  rowSub: { fontSize: 12 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  copyright: { fontSize: 12, textAlign: "center", lineHeight: 18, marginTop: 8 },
});
