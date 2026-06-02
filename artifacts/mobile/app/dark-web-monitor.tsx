import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
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
import { GlassCard } from "@/components/GlassCard";
import { getDarkWebReport, type DarkWebReport, type DarkWebItem } from "@/lib/api";

const ACCENT = "#7C3AED";

function StatusBadge({ status }: { status: "clean" | "exposed" | "mentioned" }) {
  const colors = useColors();
  const cfg = {
    clean: { color: colors.success, bg: colors.success + "18", label: "Clean" },
    exposed: { color: colors.danger, bg: colors.danger + "18", label: "Exposed" },
    mentioned: { color: colors.warning, bg: colors.warning + "18", label: "Mentioned" },
  }[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: cfg.color }]} />
      <Text style={[styles.badgeText, { color: cfg.color, fontFamily: "Inter_600SemiBold" }]}>
        {cfg.label}
      </Text>
    </View>
  );
}

function SeverityBar({ severity }: { severity: "high" | "medium" | "low" }) {
  const colors = useColors();
  const color = severity === "high" ? colors.danger : severity === "medium" ? colors.warning : colors.success;
  const label = severity === "high" ? "HIGH" : severity === "medium" ? "MED" : "LOW";
  return (
    <View style={[styles.severityBar, { backgroundColor: color + "22", borderColor: color + "44" }]}>
      <View style={[styles.severityDot, { backgroundColor: color }]} />
      <Text style={[styles.severityText, { color, fontFamily: "Inter_700Bold" }]}>{label}</Text>
    </View>
  );
}

function BreachCard({ item }: { item: DarkWebItem }) {
  const colors = useColors();
  const date = new Date(item.detectedAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  return (
    <GlassCard style={styles.breachCard}>
      <View style={styles.breachTop}>
        <View style={[styles.breachIcon, { backgroundColor: ACCENT + "20" }]}>
          <MaterialCommunityIcons name="shield-alert" size={20} color={ACCENT} />
        </View>
        <View style={styles.breachMeta}>
          <Text style={[styles.breachTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {item.title}
          </Text>
          <Text style={[styles.breachDate, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Detected {date}
          </Text>
        </View>
        <SeverityBar severity={item.severity} />
      </View>
      <Text style={[styles.breachDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {item.description}
      </Text>
      <View style={styles.scoreRow}>
        <View style={[styles.scoreChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Ionicons name="warning" size={11} color={colors.warning} />
          <Text style={[styles.scoreText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            Risk score: {item.threatScore}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}

export default function DarkWebMonitor() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { startScan } = useApp();
  const [report, setReport] = useState<DarkWebReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const loadReport = useCallback(async () => {
    try {
      setError(null);
      const data = await getDarkWebReport();
      setReport(data);
    } catch (err: any) {
      setError(err.message ?? "Failed to load report");
    }
  }, []);

  useEffect(() => {
    loadReport().finally(() => setLoading(false));
  }, [loadReport]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadReport();
    setRefreshing(false);
  }, [loadReport]);

  const handleRunScan = useCallback(async () => {
    setScanning(true);
    try {
      await startScan();
      await new Promise((r) => setTimeout(r, 3000));
      await loadReport();
    } finally {
      setScanning(false);
    }
  }, [startScan, loadReport]);

  const allFindings = [...(report?.mentions ?? []), ...(report?.breaches ?? [])];
  const isClean = allFindings.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={[ACCENT + "18", "transparent"]} style={styles.topGradient} />

      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Dark Web Monitor
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Scanning dark web databases…
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ACCENT}
            />
          }
        >
          {error ? (
            <GlassCard style={styles.errorCard}>
              <Ionicons name="warning" size={24} color={colors.warning} />
              <Text style={[styles.errorText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {error}
              </Text>
              <TouchableOpacity
                style={[styles.retryBtn, { backgroundColor: ACCENT }]}
                onPress={loadReport}
              >
                <Text style={[styles.retryBtnText, { fontFamily: "Inter_600SemiBold" }]}>Retry</Text>
              </TouchableOpacity>
            </GlassCard>
          ) : (
            <>
              {/* Status Hero */}
              <GlassCard style={styles.heroCard}>
                <View style={styles.heroTop}>
                  <View style={[styles.heroIcon, {
                    backgroundColor: isClean ? colors.success + "20" : ACCENT + "20",
                    borderColor: isClean ? colors.success + "40" : ACCENT + "40",
                  }]}>
                    <MaterialCommunityIcons
                      name={isClean ? "shield-check" : "shield-alert"}
                      size={40}
                      color={isClean ? colors.success : ACCENT}
                    />
                  </View>
                  <View style={styles.heroText}>
                    <Text style={[styles.heroTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                      {isClean ? "No Exposures Found" : `${report?.totalExposures} Exposure${report!.totalExposures !== 1 ? "s" : ""} Detected`}
                    </Text>
                    <Text style={[styles.heroSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {isClean
                        ? "Your credentials were not found in any known breach databases."
                        : "Your data was found in known breach databases. Review below."}
                    </Text>
                  </View>
                </View>

                {report && (
                  <View style={[styles.lastChecked, { borderTopColor: colors.border }]}>
                    <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.lastCheckedText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      Last checked {new Date(report.lastChecked).toLocaleString()}
                    </Text>
                  </View>
                )}
              </GlassCard>

              {/* Monitored Identifiers */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  Monitored Identifiers
                </Text>
              </View>

              <GlassCard style={styles.monitoredCard}>
                {report?.monitored.map((item, i) => (
                  <View
                    key={item.type}
                    style={[
                      styles.monitoredRow,
                      i < (report.monitored.length - 1) && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    ]}
                  >
                    <View style={[styles.monitoredIcon, { backgroundColor: ACCENT + "15" }]}>
                      <Ionicons
                        name={item.type === "Email Address" ? "mail" : item.type === "Username" ? "at" : "lock-closed"}
                        size={16}
                        color={ACCENT}
                      />
                    </View>
                    <View style={styles.monitoredText}>
                      <Text style={[styles.monitoredType, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {item.type}
                      </Text>
                      <Text style={[styles.monitoredValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                        {item.value}
                      </Text>
                    </View>
                    <StatusBadge status={item.status} />
                  </View>
                ))}
              </GlassCard>

              {/* Findings */}
              {allFindings.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                      Findings
                    </Text>
                    <View style={[styles.countPill, { backgroundColor: colors.danger + "18" }]}>
                      <Text style={[styles.countText, { color: colors.danger, fontFamily: "Inter_700Bold" }]}>
                        {allFindings.length}
                      </Text>
                    </View>
                  </View>
                  {allFindings.map((item) => (
                    <BreachCard key={item.id} item={item} />
                  ))}
                </>
              )}

              {/* Protection tips */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  Stay Protected
                </Text>
              </View>

              {[
                { icon: "key", color: "#F59E0B", tip: "Use a unique password for every account", sub: "A password manager makes this easy" },
                { icon: "shield-checkmark", color: "#10B981", tip: "Enable two-factor authentication", sub: "Add a second layer to every login" },
                { icon: "notifications", color: "#3B82F6", tip: "Monitor breach alerts regularly", sub: "Run a scan after major data breach news" },
              ].map((t) => (
                <GlassCard key={t.tip} style={styles.tipCard}>
                  <View style={[styles.tipIcon, { backgroundColor: t.color + "20" }]}>
                    <Ionicons name={t.icon as any} size={18} color={t.color} />
                  </View>
                  <View style={styles.tipText}>
                    <Text style={[styles.tipTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                      {t.tip}
                    </Text>
                    <Text style={[styles.tipSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {t.sub}
                    </Text>
                  </View>
                </GlassCard>
              ))}

              {/* CTA */}
              <TouchableOpacity
                style={[styles.scanBtn, { backgroundColor: ACCENT, opacity: scanning ? 0.7 : 1 }]}
                onPress={handleRunScan}
                activeOpacity={0.8}
                disabled={scanning}
              >
                {scanning ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <MaterialCommunityIcons name="magnify-scan" size={20} color="#fff" />
                )}
                <Text style={[styles.scanBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                  {scanning ? "Scanning…" : "Run Full Scan Now"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 300 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18 },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  loadingText: { fontSize: 14 },

  content: { padding: 16, gap: 12 },

  errorCard: { alignItems: "center", gap: 12, paddingVertical: 24 },
  errorText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  retryBtnText: { color: "#fff", fontSize: 14 },

  heroCard: { gap: 14 },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  heroIcon: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: "center", justifyContent: "center", borderWidth: 1,
  },
  heroText: { flex: 1, gap: 6 },
  heroTitle: { fontSize: 18, lineHeight: 24 },
  heroSub: { fontSize: 13, lineHeight: 19 },
  lastChecked: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingTop: 12, borderTopWidth: 1,
  },
  lastCheckedText: { fontSize: 12 },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 15, flex: 1 },
  countPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText: { fontSize: 12 },

  monitoredCard: { gap: 0, padding: 0, overflow: "hidden" },
  monitoredRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  monitoredIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  monitoredText: { flex: 1, gap: 2 },
  monitoredType: { fontSize: 11 },
  monitoredValue: { fontSize: 14 },

  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11 },

  breachCard: { gap: 10 },
  breachTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  breachIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  breachMeta: { flex: 1, gap: 2 },
  breachTitle: { fontSize: 14, lineHeight: 20 },
  breachDate: { fontSize: 12 },
  breachDesc: { fontSize: 13, lineHeight: 19 },
  scoreRow: { flexDirection: "row" },
  scoreChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1,
  },
  scoreText: { fontSize: 12 },

  severityBar: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1,
  },
  severityDot: { width: 5, height: 5, borderRadius: 3 },
  severityText: { fontSize: 10 },

  tipCard: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  tipIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tipText: { flex: 1, gap: 3 },
  tipTitle: { fontSize: 14 },
  tipSub: { fontSize: 12 },

  scanBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, height: 52, borderRadius: 26, marginTop: 4,
  },
  scanBtnText: { color: "#fff", fontSize: 15 },
});
