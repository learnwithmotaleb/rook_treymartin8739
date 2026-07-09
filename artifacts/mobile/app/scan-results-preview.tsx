/**
 * Scan Results Preview — shown to free-tier users after a scan completes.
 * Real threat counts are visible; card content is blurred to create urgency.
 * CTAs: unlock for $2.99 (one-time) or subscribe to Pro/Premium.
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { analytics } from "@/lib/analytics";

function BlurredThreatCard({
  color,
  colors,
  label,
  platform,
}: {
  color: string;
  colors: ReturnType<typeof useColors>;
  label: string;
  platform: string;
}) {
  return (
    <View style={[blurStyles.card, { backgroundColor: colors.card, borderColor: color + "44" }]}>
      <View style={[blurStyles.accentBar, { backgroundColor: color + "80" }]} />
      <View style={blurStyles.body}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={[blurStyles.badge, { backgroundColor: color + "22", borderColor: color + "44" }]}>
            <Text style={[blurStyles.badgeText, { color, fontFamily: "Inter_700Bold" }]}>{label}</Text>
          </View>
          <View style={[blurStyles.platBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[blurStyles.platText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {platform}
            </Text>
          </View>
        </View>
        <View style={[blurStyles.blurRow, { backgroundColor: colors.border }]} />
        <View style={[blurStyles.blurRow, { backgroundColor: colors.border, width: "65%" }]} />
      </View>
      <View style={blurStyles.lockWrap}>
        <Ionicons name="lock-closed" size={16} color={colors.mutedForeground} />
      </View>
    </View>
  );
}

const blurStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 72,
  },
  accentBar: { width: 4 },
  body: { flex: 1, padding: 12, gap: 8, justifyContent: "center" },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10 },
  platBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  platText: { fontSize: 11 },
  blurRow: { height: 10, borderRadius: 5 },
  lockWrap: { padding: 14, justifyContent: "center" },
});

export default function ScanResultsPreview() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { threats } = useApp();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  const activeThreats = threats.filter((t) => !t.resolved);
  const highCount = activeThreats.filter((t) => t.severity === "high").length;
  const medCount = activeThreats.filter((t) => t.severity === "medium").length;
  const lowCount = activeThreats.filter((t) => t.severity === "low").length;
  const totalCount = activeThreats.length;

  useEffect(() => {
    analytics.track("preview_viewed", { threat_count: totalCount, high: highCount });
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const urgencyColor = highCount > 0 ? colors.danger : medCount > 0 ? colors.warning : colors.success;
  const urgencyLabel = highCount > 0 ? "High-priority threats found" : medCount > 0 ? "Medium-risk threats found" : "Low-risk activity detected";

  const previewPlatforms =
    activeThreats.length > 0
      ? activeThreats.slice(0, 3).map((t) => t.platform ?? "unknown")
      : ["instagram", "tiktok", "x"];

  const PREVIEW_CARDS = [
    { color: colors.danger, label: "HIGH", platform: previewPlatforms[0] ?? "instagram" },
    { color: colors.warning, label: "MED", platform: previewPlatforms[1] ?? "tiktok" },
    { color: colors.mutedForeground, label: "LOW", platform: previewPlatforms[2] ?? "x" },
  ].slice(0, Math.min(Math.max(totalCount, 2), 3));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.danger + "14", colors.warning + "08", "transparent"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Scan Complete
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], gap: 16 }}>
          {/* Urgency banner */}
          <View style={[styles.urgencyBanner, { backgroundColor: urgencyColor + "18", borderColor: urgencyColor + "44" }]}>
            <MaterialCommunityIcons
              name={highCount > 0 ? "alert-circle" : "shield-alert"}
              size={20}
              color={urgencyColor}
            />
            <Text style={[styles.urgencyText, { color: urgencyColor, fontFamily: "Inter_600SemiBold" }]}>
              {urgencyLabel}
            </Text>
          </View>

          {/* Count hero */}
          <GlassCard style={styles.heroCard}>
            <LinearGradient colors={[colors.danger + "14", "transparent"]} style={StyleSheet.absoluteFill} />
            <Text style={[styles.heroCount, { color: colors.danger, fontFamily: "Inter_700Bold" }]}>
              {totalCount}
            </Text>
            <Text style={[styles.heroLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {totalCount === 1 ? "Threat Found" : "Threats Found"}
            </Text>
            <Text style={[styles.heroSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Unlock to see full details, evidence, and removal steps
            </Text>

            {/* Severity breakdown */}
            <View style={styles.breakdownRow}>
              {highCount > 0 && (
                <View style={[styles.severityChip, { backgroundColor: colors.danger + "18", borderColor: colors.danger + "44" }]}>
                  <View style={[styles.severityDot, { backgroundColor: colors.danger }]} />
                  <Text style={[styles.severityText, { color: colors.danger, fontFamily: "Inter_600SemiBold" }]}>
                    {highCount} High
                  </Text>
                </View>
              )}
              {medCount > 0 && (
                <View style={[styles.severityChip, { backgroundColor: colors.warning + "18", borderColor: colors.warning + "44" }]}>
                  <View style={[styles.severityDot, { backgroundColor: colors.warning }]} />
                  <Text style={[styles.severityText, { color: colors.warning, fontFamily: "Inter_600SemiBold" }]}>
                    {medCount} Medium
                  </Text>
                </View>
              )}
              {lowCount > 0 && (
                <View style={[styles.severityChip, { backgroundColor: colors.success + "18", borderColor: colors.success + "44" }]}>
                  <View style={[styles.severityDot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.severityText, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>
                    {lowCount} Low
                  </Text>
                </View>
              )}
            </View>
          </GlassCard>

          {/* Blurred threat previews */}
          <View style={styles.previewSection}>
            <View style={styles.previewHeader}>
              <Text style={[styles.previewTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Detected Threats
              </Text>
              <View style={[styles.lockBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Ionicons name="lock-closed" size={11} color={colors.mutedForeground} />
                <Text style={[styles.lockText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Locked
                </Text>
              </View>
            </View>

            <View style={styles.cardsStack}>
              {PREVIEW_CARDS.map((card, i) => (
                <BlurredThreatCard key={i} {...card} colors={colors} />
              ))}
              {totalCount > 3 && (
                <View style={[styles.moreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.moreText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    +{totalCount - 3} more threat{totalCount - 3 !== 1 ? "s" : ""} hidden
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* What you'll get */}
          <GlassCard style={[styles.featureCard, { borderColor: colors.primary + "33" }]}>
            <Text style={[styles.featureTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Unlock includes:
            </Text>
            {[
              { icon: "person-remove", text: "Full impersonator profiles with evidence", color: colors.danger },
              { icon: "flag", text: "One-tap report to platform", color: colors.primary },
              { icon: "analytics", text: "AI threat analysis + removal steps", color: colors.warning },
              { icon: "shield-checkmark", text: "This scan's complete results", color: colors.success },
            ].map((item) => (
              <View key={item.text} style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: item.color + "18" }]}>
                  <Ionicons name={item.icon as any} size={14} color={item.color} />
                </View>
                <Text style={[styles.featureText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                  {item.text}
                </Text>
              </View>
            ))}
          </GlassCard>
        </Animated.View>
      </ScrollView>

      {/* Sticky CTA footer */}
      <View style={[styles.footer, { paddingBottom: bottomPad + 12, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.primaryCta, { backgroundColor: colors.danger }]}
          activeOpacity={0.85}
          onPress={() => {
            analytics.track("paywall_viewed", { source: "scan_results_preview", tier: "free" });
            router.push("/scan-unlock" as any);
          }}
        >
          <Ionicons name="lock-open" size={18} color="#fff" />
          <Text style={[styles.primaryCtaText, { fontFamily: "Inter_700Bold" }]}>
            Unlock Full Results — $2.99
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryCta, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}
          activeOpacity={0.85}
          onPress={() => {
            analytics.track("paywall_viewed", { source: "scan_results_preview", tier: "free", option: "pro" });
            router.push({ pathname: "/subscription", params: { fromScan: "1" } } as any);
          }}
        >
          <MaterialCommunityIcons name="crown" size={16} color={colors.primary} />
          <Text style={[styles.secondaryCtaText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
            Start Pro — $14.99/mo · Continuous monitoring
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/scan-unlock" as any)}
          activeOpacity={0.7}
        >
          <Text style={[styles.restoreLink, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Already subscribed? Restore purchases
          </Text>
        </TouchableOpacity>
      </View>
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

  urgencyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  urgencyText: { fontSize: 14, flex: 1 },

  heroCard: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 28,
    overflow: "hidden",
  },
  heroCount: { fontSize: 64, lineHeight: 72 },
  heroLabel: { fontSize: 20 },
  heroSub: { fontSize: 13, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  breakdownRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 4 },
  severityChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  severityText: { fontSize: 12 },

  previewSection: { gap: 10 },
  previewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  previewTitle: { fontSize: 15 },
  lockBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  lockText: { fontSize: 11 },
  cardsStack: { gap: 8 },
  moreCard: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 14, borderWidth: 1 },
  moreText: { fontSize: 13 },

  featureCard: { gap: 12 },
  featureTitle: { fontSize: 14 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  featureText: { fontSize: 13, flex: 1, lineHeight: 19 },

  footer: {
    padding: 20,
    gap: 10,
    borderTopWidth: 1,
  },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 54,
    borderRadius: 27,
  },
  primaryCtaText: { color: "#fff", fontSize: 16 },
  secondaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
  },
  secondaryCtaText: { fontSize: 14 },
  restoreLink: { textAlign: "center", fontSize: 12, paddingVertical: 4 },
});
