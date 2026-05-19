import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";
import { getDarkWebReport, type DarkWebReport, type DarkWebItem } from "@/lib/api";

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ExposureItem({ item, type }: { item: DarkWebItem; type: "mention" | "breach" }) {
  const colors = useColors();
  const isHigh = item.severity === "high";
  const color = isHigh ? colors.danger : item.severity === "medium" ? colors.warning : colors.success;
  const icon = type === "breach" ? "lock-open" : "eye-off";

  return (
    <GlassCard style={[styles.exposureCard, { borderColor: color + "33" }]}>
      <LinearGradient
        colors={[color + "0C", "transparent"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.exposureHeader}>
        <View style={[styles.exposureIcon, { backgroundColor: color + "22" }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <View style={styles.exposureInfo}>
          <Text style={[styles.exposureTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {item.title}
          </Text>
          <Text style={[styles.exposureTime, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {formatDate(item.detectedAt)}
          </Text>
        </View>
        <View style={[styles.severityBadge, { backgroundColor: color + "22" }]}>
          <Text style={[styles.severityText, { color, fontFamily: "Inter_700Bold" }]}>
            {item.severity.toUpperCase()}
          </Text>
        </View>
      </View>
      <Text style={[styles.exposureDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {item.description}
      </Text>
      <View style={styles.scoreRow}>
        <Text style={[styles.scoreLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Threat score
        </Text>
        <View style={[styles.scoreBarTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.scoreBarFill, { width: `${item.threatScore}%`, backgroundColor: color }]} />
        </View>
        <Text style={[styles.scoreValue, { color, fontFamily: "Inter_700Bold" }]}>
          {item.threatScore}
        </Text>
      </View>
    </GlassCard>
  );
}

export default function DarkWebMonitor() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [report, setReport] = useState<DarkWebReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    getDarkWebReport()
      .then(setReport)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const hasExposures = report && report.totalExposures > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.warning + "0D", "transparent"]}
        style={styles.topGradient}
      />

      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Dark Web Monitor
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.warning} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Scanning dark web databases…
          </Text>
        </View>
      ) : error ? (
        <View style={styles.loadingCenter}>
          <Ionicons name="alert-circle" size={48} color={colors.danger} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {error}
          </Text>
        </View>
      ) : report ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        >
          {/* Status hero */}
          <GlassCard
            style={[
              styles.heroCard,
              {
                borderColor: hasExposures
                  ? colors.warning + "44"
                  : colors.success + "44",
              },
            ]}
          >
            <LinearGradient
              colors={
                hasExposures
                  ? [colors.warning + "18", "transparent"]
                  : [colors.success + "18", "transparent"]
              }
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.heroIcon,
                {
                  backgroundColor: hasExposures
                    ? colors.warning + "22"
                    : colors.success + "22",
                },
              ]}
            >
              <MaterialCommunityIcons
                name="eye-off"
                size={32}
                color={hasExposures ? colors.warning : colors.success}
              />
            </View>
            <View style={styles.heroText}>
              <Text
                style={[
                  styles.heroTitle,
                  {
                    color: hasExposures ? colors.warning : colors.success,
                    fontFamily: "Inter_700Bold",
                  },
                ]}
              >
                {hasExposures
                  ? `${report.totalExposures} Exposure${report.totalExposures !== 1 ? "s" : ""} Found`
                  : "No Exposures Found"}
              </Text>
              <Text style={[styles.heroSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Last checked {formatDate(report.lastChecked)}
              </Text>
            </View>
          </GlassCard>

          {/* What we monitor */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            MONITORED IDENTIFIERS
          </Text>
          <GlassCard style={styles.monitoredCard}>
            {report.monitored.map((entry, i) => {
              const isExposed = entry.status !== "clean";
              const statusColor = isExposed ? colors.warning : colors.success;
              return (
                <View
                  key={i}
                  style={[
                    styles.monitoredItem,
                    i < report.monitored.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <View style={styles.monitoredLeft}>
                    <Text style={[styles.monitoredType, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {entry.type}
                    </Text>
                    <Text style={[styles.monitoredValue, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                      {entry.value}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: statusColor + "22" }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.statusLabel, { color: statusColor, fontFamily: "Inter_600SemiBold" }]}>
                      {entry.status === "clean" ? "Clean" : entry.status === "exposed" ? "Exposed" : "Mentioned"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </GlassCard>

          {/* Dark web mentions */}
          {report.mentions.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                DARK WEB MENTIONS ({report.mentions.length})
              </Text>
              {report.mentions.map((item) => (
                <ExposureItem key={item.id} item={item} type="mention" />
              ))}
            </>
          )}

          {/* Breach findings */}
          {report.breaches.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                DATA BREACHES ({report.breaches.length})
              </Text>
              {report.breaches.map((item) => (
                <ExposureItem key={item.id} item={item} type="breach" />
              ))}
            </>
          )}

          {!hasExposures && (
            <GlassCard style={styles.cleanCard}>
              <View style={[styles.cleanIcon, { backgroundColor: colors.success + "22" }]}>
                <Ionicons name="shield-checkmark" size={36} color={colors.success} />
              </View>
              <Text style={[styles.cleanTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Your identity is secure
              </Text>
              <Text style={[styles.cleanSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No mentions of your email or username were found in dark web databases or known data breaches.
              </Text>
            </GlassCard>
          )}

          {/* Protective actions */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            PROTECTIVE ACTIONS
          </Text>
          <GlassCard style={styles.actionsCard}>
            {[
              { icon: "key", label: "Use a unique password for each account" },
              { icon: "shield-checkmark", label: "Enable 2FA on all critical accounts" },
              { icon: "eye-off", label: "Avoid sharing sensitive data publicly" },
              { icon: "mail", label: "Use email aliases for sign-ups" },
            ].map((action, i) => (
              <View
                key={i}
                style={[
                  styles.actionItem,
                  i < 3 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.primary + "22" }]}>
                  <Ionicons name={action.icon as any} size={16} color={colors.primary} />
                </View>
                <Text style={[styles.actionLabel, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                  {action.label}
                </Text>
              </View>
            ))}
          </GlassCard>

          {/* Recovery CTA */}
          <TouchableOpacity
            style={[styles.recoveryCta, { borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => router.push("/recovery" as any)}
          >
            <Ionicons name="shield" size={16} color={colors.primary} />
            <Text style={[styles.recoveryCtaText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
              Open Recovery Hub for step-by-step guidance
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 250 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, flex: 1, marginLeft: 12 },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  loadingText: { fontSize: 15 },
  content: { padding: 16, gap: 14 },

  heroCard: { flexDirection: "row", alignItems: "center", gap: 16, overflow: "hidden" },
  heroIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  heroText: { flex: 1, gap: 4 },
  heroTitle: { fontSize: 18 },
  heroSub: { fontSize: 12 },

  sectionLabel: { fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 4 },

  monitoredCard: { gap: 0, paddingHorizontal: 0, paddingVertical: 0 },
  monitoredItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  monitoredLeft: { flex: 1, gap: 2 },
  monitoredType: { fontSize: 11 },
  monitoredValue: { fontSize: 14 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 12 },

  exposureCard: { gap: 10, overflow: "hidden" },
  exposureHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  exposureIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  exposureInfo: { flex: 1 },
  exposureTitle: { fontSize: 14 },
  exposureTime: { fontSize: 12 },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  severityText: { fontSize: 10 },
  exposureDesc: { fontSize: 13, lineHeight: 19 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  scoreLabel: { fontSize: 12, width: 80 },
  scoreBarTrack: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  scoreBarFill: { height: "100%", borderRadius: 2 },
  scoreValue: { fontSize: 12, width: 24, textAlign: "right" },

  cleanCard: { alignItems: "center", gap: 12, paddingVertical: 12 },
  cleanIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  cleanTitle: { fontSize: 17 },
  cleanSub: { fontSize: 13, textAlign: "center", lineHeight: 19 },

  actionsCard: { gap: 0, paddingHorizontal: 0, paddingVertical: 0 },
  actionItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  actionIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  actionLabel: { flex: 1, fontSize: 14 },

  recoveryCta: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  recoveryCtaText: { flex: 1, fontSize: 14 },
});
