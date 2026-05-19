import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useApp, Severity } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";

function severityColor(severity: Severity, colors: ReturnType<typeof useColors>) {
  if (severity === "high") return colors.danger;
  if (severity === "medium") return colors.warning;
  return colors.success;
}

export default function ThreatDetail() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { threats, resolveThreat } = useApp();

  const threat = threats.find((t) => t.id === id);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (!threat) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>Threat not found</Text>
      </View>
    );
  }

  const sc = severityColor(threat.severity, colors);

  const handleResolve = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resolveThreat(threat.id);
    router.back();
  };

  const handleReport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          Threat Details
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 24 },
        ]}
      >
        {/* Severity banner */}
        <View
          style={[
            styles.severityBanner,
            { backgroundColor: sc + "22", borderColor: sc + "44" },
          ]}
        >
          <View style={[styles.severityDot, { backgroundColor: sc }]} />
          <Text
            style={[
              styles.severityText,
              { color: sc, fontFamily: "Inter_700Bold" },
            ]}
          >
            {threat.severity.toUpperCase()} SEVERITY
          </Text>
          <Text
            style={[
              styles.timeText,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {threat.time}
          </Text>
        </View>

        {/* Title & description */}
        <View style={styles.titleSection}>
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {threat.title}
          </Text>
          <Text
            style={[
              styles.description,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {threat.description}
          </Text>
        </View>

        {/* Details */}
        <GlassCard style={styles.detailsCard}>
          <Text
            style={[
              styles.cardLabel,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            Incident Details
          </Text>
          <Text
            style={[
              styles.detailsText,
              { color: colors.foreground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {threat.details}
          </Text>
        </GlassCard>

        {/* AI Explanation */}
        <GlassCard
          style={[styles.aiCard, { borderColor: colors.primary + "44" }]}
        >
          <View style={styles.aiHeader}>
            <View
              style={[
                styles.aiIcon,
                { backgroundColor: colors.primary + "22" },
              ]}
            >
              <MaterialCommunityIcons
                name="brain"
                size={20}
                color={colors.primary}
              />
            </View>
            <Text
              style={[
                styles.aiLabel,
                { color: colors.primary, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              AI Analysis
            </Text>
          </View>
          <Text
            style={[
              styles.aiText,
              { color: colors.foreground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {threat.aiExplanation}
          </Text>
        </GlassCard>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.danger }]}
            activeOpacity={0.8}
            onPress={handleReport}
          >
            <Ionicons name="flag" size={18} color="#FFFFFF" />
            <Text style={[styles.primaryBtnText, { fontFamily: "Inter_600SemiBold" }]}>
              Report Account
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              {
                backgroundColor: colors.success + "22",
                borderColor: colors.success + "44",
              },
            ]}
            activeOpacity={0.8}
            onPress={handleResolve}
          >
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text
              style={[
                styles.secondaryBtnText,
                { color: colors.success, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              Mark as Resolved
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recovery link */}
        <TouchableOpacity
          style={[styles.recoveryLink, { borderColor: colors.border }]}
          activeOpacity={0.7}
          onPress={() => router.push("/recovery" as any)}
        >
          <Ionicons name="shield" size={16} color={colors.primary} />
          <Text
            style={[
              styles.recoveryLinkText,
              { color: colors.primary, fontFamily: "Inter_500Medium" },
            ]}
          >
            View Recovery Guide for this Threat
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
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
  headerTitle: { fontSize: 18 },
  content: { padding: 20, gap: 16 },
  severityBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  severityDot: { width: 8, height: 8, borderRadius: 4 },
  severityText: { fontSize: 12, flex: 1 },
  timeText: { fontSize: 12 },
  titleSection: { gap: 8 },
  title: { fontSize: 22, lineHeight: 30 },
  description: { fontSize: 15, lineHeight: 22 },
  detailsCard: { gap: 10 },
  cardLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  detailsText: { fontSize: 14, lineHeight: 22 },
  aiCard: { gap: 12 },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  aiIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  aiLabel: { fontSize: 14 },
  aiText: { fontSize: 14, lineHeight: 22 },
  actions: { gap: 10 },
  primaryBtn: {
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 15 },
  secondaryBtn: {
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 15 },
  recoveryLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  recoveryLinkText: { flex: 1, fontSize: 14 },
});
