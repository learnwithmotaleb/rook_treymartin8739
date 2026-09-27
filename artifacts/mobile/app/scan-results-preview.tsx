/**
 * Scan Results Preview — shown to free-tier users after a scan completes.
 * Free members receive a meaningful safety summary. Premium gates the underlying
 * evidence, advanced analysis, and continuous monitoring—not the fact that a
 * potential threat exists or the immediate protective action to take.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { SecurityScoreRing } from "@/components/SecurityScoreRing";
import { analytics } from "@/lib/analytics";

function FreeThreatCard({
  colors,
  threat,
  isSample,
}: {
  colors: ReturnType<typeof useColors>;
  isSample: boolean;
  threat: {
    title: string;
    platform: string | null;
    severity: "high" | "medium" | "low";
    threatScore: number;
    evidenceCount: number;
    matchedMediaCount: number;
  };
}) {
  const color = threat.severity === "high" ? colors.danger : threat.severity === "medium" ? colors.warning : colors.success;
  const platform = threat.platform ?? "Unknown platform";
  const evidenceCount = Math.max(threat.evidenceCount, threat.matchedMediaCount);
  return (
    <View style={[blurStyles.card, { backgroundColor: colors.card, borderColor: color + "44" }]}>
      <View style={[blurStyles.accentBar, { backgroundColor: color + "80" }]} />
      <View style={blurStyles.body}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={[blurStyles.badge, { backgroundColor: color + "22", borderColor: color + "44" }]}>
            <Text style={[blurStyles.badgeText, { color, fontFamily: "Inter_700Bold" }]}>{threat.severity.toUpperCase()}</Text>
          </View>
          <View style={[blurStyles.platBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[blurStyles.platText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {platform}
            </Text>
          </View>
        </View>
        <Text style={[blurStyles.threatTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
          {threat.title}
        </Text>
        {isSample && (
          <Text
            style={[blurStyles.sampleLabel, { color: colors.warning, fontFamily: "Inter_700Bold" }]}
            accessibilityLabel="Sample example. Not a live detected account."
          >
            SAMPLE · EXAMPLE, NOT LIVE
          </Text>
        )}
        <Text style={[blurStyles.threatMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {isSample
            ? `Example score ${threat.threatScore} · ${evidenceCount} example signal${evidenceCount === 1 ? "" : "s"}`
            : `${threat.threatScore}% confidence · ${evidenceCount} evidence signal${evidenceCount === 1 ? "" : "s"}`}
        </Text>
        <Text style={[blurStyles.threatAction, { color, fontFamily: "Inter_500Medium" }]}>
          {isSample ? "Example only — no live account was detected" : "Next: review and report or block this account"}
        </Text>
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
  threatTitle: { fontSize: 13 },
  threatMeta: { fontSize: 11 },
  threatAction: { fontSize: 11 },
  sampleLabel: { fontSize: 10, letterSpacing: 0.3 },
  lockWrap: { padding: 14, justifyContent: "center" },
});

export default function ScanResultsPreview() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { lastScanThreats, user, indexedPhotos } = useApp();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  const [perceivedRisk, setPerceivedRisk] = useState<number | null>(null);

  // This page describes the just-completed scan only. Historical unresolved
  // alerts remain available in Alerts and must not influence this scan's
  // severity breakdown or preview cards.
  const activeThreats = lastScanThreats.filter((t) => !t.resolved);
  const liveThreats = activeThreats.filter((threat) => !threat.isSample);
  const sampleThreats = activeThreats.filter((threat) => threat.isSample);
  const highCount = liveThreats.filter((t) => t.severity === "high").length;
  const medCount = liveThreats.filter((t) => t.severity === "medium").length;
  const lowCount = liveThreats.filter((t) => t.severity === "low").length;
  const totalCount = liveThreats.length;

  useEffect(() => {
    analytics.previewViewed({ threat_count: totalCount, high: highCount });
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
    AsyncStorage.getItem("onboardingAnswers").then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.perceivedRisk === "number") setPerceivedRisk(parsed.perceivedRisk);
      } catch { /* no-op */ }
    });
  }, []);

  const urgencyColor = highCount > 0 ? colors.danger : medCount > 0 ? colors.warning : colors.success;
  const urgencyLabel = totalCount === 0
    ? "No potential threats found"
    : highCount > 0 ? "High-priority threats found" : medCount > 0 ? "Medium-risk threats found" : "Potential threats found";

  const previewThreats = [...liveThreats, ...sampleThreats].slice(0, 3);

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
          {sampleThreats.length > 0 && (
            <View
              style={[styles.sampleNotice, { backgroundColor: colors.warning + "14", borderColor: colors.warning + "44" }]}
              accessible
              accessibilityRole="summary"
              accessibilityLabel={`${sampleThreats.length} sample example${sampleThreats.length === 1 ? "" : "s"} shown separately from live scan results. These are not live detected accounts.`}
            >
              <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
              <Text style={[styles.sampleNoticeText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                {sampleThreats.length} sample example{sampleThreats.length !== 1 ? "s" : ""} shown below. These are not live detections and are excluded from scan totals.
              </Text>
            </View>
          )}

          {/* Score + stats hero */}
          <GlassCard style={styles.heroCard}>
            <LinearGradient colors={[colors.danger + "14", "transparent"]} style={StyleSheet.absoluteFill} />
            <SecurityScoreRing score={user.securityScore} size={130} />
            {/* Quick-stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.danger, fontFamily: "Inter_700Bold" }]}>
                  {totalCount}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {totalCount === 1 ? "Threat" : "Threats"}
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                  {indexedPhotos.length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Photos{"\n"}Analyzed
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.warning, fontFamily: "Inter_700Bold" }]}>
                  {user.connectedAccounts.length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Platforms{"\n"}Scanned
                </Text>
              </View>
            </View>
            {perceivedRisk !== null && (() => {
              const felt = perceivedRisk;
              const actual = user.securityScore;
              const gap = felt - actual;
              const surprising = Math.abs(gap) >= 20;
              const moreExposed = gap > 0;
              return surprising ? (
                <View style={[styles.confidenceRow, { backgroundColor: moreExposed ? colors.danger + "14" : colors.success + "14", borderColor: moreExposed ? colors.danger + "40" : colors.success + "40" }]}>
                  <Ionicons name={moreExposed ? "trending-down" : "trending-up"} size={15} color={moreExposed ? colors.danger : colors.success} />
                  <Text style={[styles.confidenceText, { color: moreExposed ? colors.danger : colors.success, fontFamily: "Inter_500Medium" }]}>
                    {moreExposed
                      ? `You felt ${felt}% safe — your actual score is ${actual}. You're more exposed than you thought.`
                      : `You felt ${felt}% safe — your actual score is ${actual}. You're better protected than expected!`}
                  </Text>
                </View>
              ) : null;
            })()}
            <Text style={[styles.heroSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
               Premium unlocks detailed evidence, advanced analysis, and guided removal support.
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

          {/* Free safety summary: results stay useful without exposing evidence. */}
          <View style={styles.previewSection}>
            <View style={styles.previewHeader}>
              <Text style={[styles.previewTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {totalCount === 0 && sampleThreats.length > 0 ? "Sample examples" : totalCount === 0 ? "Your result" : "Potential threats"}
              </Text>
              <View style={[styles.lockBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Ionicons name="lock-closed" size={11} color={colors.mutedForeground} />
                <Text style={[styles.lockText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Evidence locked
                </Text>
              </View>
            </View>

            <View style={styles.cardsStack}>
              {totalCount === 0 && sampleThreats.length === 0 ? (
                <View style={[styles.cleanResult, { backgroundColor: colors.success + "12", borderColor: colors.success + "44" }]}>
                  <Ionicons name="shield-checkmark" size={22} color={colors.success} />
                  <Text style={[styles.cleanResultTitle, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>No potential threats found</Text>
                  <Text style={[styles.cleanResultText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>We found no potential threats in this scan. Keep an eye on your accounts and scan again when your monthly allowance resets.</Text>
                </View>
              ) : previewThreats.map((threat) => (
                <FreeThreatCard key={threat.id} threat={threat} colors={colors} isSample={threat.isSample} />
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

      {/* Sticky CTA footer — Rook Premium is the only paid offer. */}
      <View style={[styles.footer, { paddingBottom: bottomPad + 12, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.primaryCta, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
          onPress={() => {
            analytics.paywallViewed({ source: "scan_results_preview", tier: "free", option: "premium" });
            router.push("/subscription" as any);
          }}
        >
          <MaterialCommunityIcons name="crown" size={18} color="#fff" />
          <Text style={[styles.primaryCtaText, { fontFamily: "Inter_700Bold" }]}>
            View Rook Premium Plans
          </Text>
        </TouchableOpacity>

        <Text style={[styles.trialNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Monthly or annual plan · cancel anytime
        </Text>

        <TouchableOpacity
          onPress={() => router.push("/subscription" as any)}
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
  sampleNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  sampleNoticeText: { flex: 1, fontSize: 13, lineHeight: 18 },

  heroCard: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 24,
    overflow: "hidden",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    width: "100%",
    justifyContent: "center",
  },
  statItem: { flex: 1, alignItems: "center", gap: 3 },
  statDivider: { width: 1, height: 36, opacity: 0.5, marginHorizontal: 8 },
  statValue: { fontSize: 24, lineHeight: 28 },
  statLabel: { fontSize: 10, textAlign: "center", lineHeight: 14, opacity: 0.75 },
  heroSub: { fontSize: 13, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  confidenceRow: { flexDirection: "row", alignItems: "flex-start", gap: 7, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, width: "100%" },
  confidenceText: { fontSize: 12, lineHeight: 17, flex: 1 },
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
  cleanResult: { alignItems: "center", gap: 8, padding: 18, borderRadius: 14, borderWidth: 1 },
  cleanResultTitle: { fontSize: 14 },
  cleanResultText: { fontSize: 12, textAlign: "center", lineHeight: 18 },

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
  trialNote:   { textAlign: "center", fontSize: 11 },
  restoreLink: { textAlign: "center", fontSize: 12, paddingVertical: 4 },
});
