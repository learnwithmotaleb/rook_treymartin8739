import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { ScanPulse } from "@/components/ScanPulse";
import { GlassCard } from "@/components/GlassCard";

const SCAN_STEPS = [
  "Indexing connected accounts…",
  "Comparing visual fingerprints…",
  "Scanning Instagram…",
  "Scanning TikTok…",
  "Scanning X & Facebook…",
  "Checking breach databases…",
  "Running AI threat analysis…",
  "Finalizing report…",
];

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, isScanning, scanProgress, startScan, activeThreats, fakeAccounts, threats } = useApp();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [lastResult, setLastResult] = useState<{ threatsFound: number; time: string } | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const prevScanning = useRef(false);

  useEffect(() => {
    if (isScanning) {
      prevScanning.current = true;
      const stepIdx = Math.min(
        Math.floor((scanProgress / 100) * SCAN_STEPS.length),
        SCAN_STEPS.length - 1
      );
      setCurrentStepIndex(stepIdx);
    } else if (prevScanning.current) {
      prevScanning.current = false;
      const activeCount = threats.filter((t) => !t.resolved).length;
      setLastResult({
        threatsFound: activeCount,
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      });
      resultOpacity.setValue(0);
      Animated.timing(resultOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [isScanning, scanProgress, threats, resultOpacity]);

  const handleScan = () => {
    if (isScanning) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLastResult(null);
    startScan();
  };

  const currentStep = isScanning ? SCAN_STEPS[currentStepIndex] : null;
  const statusText = isScanning ? `${scanProgress}% complete` : "All systems active";
  const statusColor = isScanning ? colors.primary : colors.success;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#3B82F611", "transparent"]}
        style={[styles.topGradient, { height: 300 }]}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border },
        ]}
      >
        <Text
          style={[
            styles.headerTitle,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          Identity Scan
        </Text>
      </View>

      <View style={[styles.content, { paddingBottom: bottomPad + 100 }]}>
        {/* Scan Animation */}
        <View style={styles.scanCenter}>
          <View style={[styles.scanContainer, { width: 220, height: 220 }]}>
            <ScanPulse size={220} active={isScanning} />
            <View
              style={[
                styles.scanCore,
                {
                  backgroundColor: isScanning
                    ? colors.primary + "22"
                    : colors.success + "22",
                  borderColor: isScanning
                    ? colors.primary + "66"
                    : colors.success + "66",
                },
              ]}
            >
              {isScanning ? (
                <ActivityIndicator color={colors.primary} size="large" />
              ) : (
                <Ionicons
                  name="shield-checkmark"
                  size={52}
                  color={colors.success}
                />
              )}
            </View>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColor + "22", borderColor: statusColor + "44" },
            ]}
          >
            <View
              style={[styles.statusDot, { backgroundColor: statusColor }]}
            />
            <Text
              style={[
                styles.statusText,
                { color: statusColor, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {statusText}
            </Text>
          </View>

          {currentStep ? (
            <Text style={[styles.stepText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {currentStep}
            </Text>
          ) : null}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <GlassCard style={styles.statItem}>
            <MaterialCommunityIcons
              name="radar"
              size={22}
              color={colors.primary}
            />
            <Text
              style={[
                styles.statValue,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              {user.monitored}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}
            >
              Accounts
            </Text>
          </GlassCard>
          <GlassCard style={styles.statItem}>
            <Ionicons
              name="alert-circle"
              size={22}
              color={activeThreats > 0 ? colors.danger : colors.success}
            />
            <Text
              style={[
                styles.statValue,
                {
                  color:
                    activeThreats > 0 ? colors.danger : colors.success,
                  fontFamily: "Inter_700Bold",
                },
              ]}
            >
              {activeThreats}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}
            >
              Threats
            </Text>
          </GlassCard>
          <GlassCard style={styles.statItem}>
            <MaterialCommunityIcons
              name="account-multiple-remove"
              size={22}
              color={fakeAccounts > 0 ? colors.warning : colors.success}
            />
            <Text
              style={[
                styles.statValue,
                {
                  color: fakeAccounts > 0 ? colors.warning : colors.success,
                  fontFamily: "Inter_700Bold",
                },
              ]}
            >
              {fakeAccounts}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}
            >
              Fake Accts
            </Text>
          </GlassCard>
        </View>

        {/* Last scan */}
        <View style={styles.lastScanRow}>
          <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
          <Text
            style={[
              styles.lastScan,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            Last scan: {user.lastScan}
          </Text>
        </View>

        {/* Progress bar when scanning */}
        {isScanning && (
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: `${scanProgress}%`,
                },
              ]}
            />
          </View>
        )}

        {/* Scan result card after completion */}
        {lastResult && !isScanning && (
          <Animated.View style={{ opacity: resultOpacity, width: "100%" }}>
            <GlassCard
              style={[
                styles.resultCard,
                {
                  borderColor:
                    lastResult.threatsFound > 0
                      ? colors.danger + "44"
                      : colors.success + "44",
                },
              ]}
            >
              <View
                style={[
                  styles.resultIcon,
                  {
                    backgroundColor:
                      lastResult.threatsFound > 0
                        ? colors.danger + "22"
                        : colors.success + "22",
                  },
                ]}
              >
                <Ionicons
                  name={lastResult.threatsFound > 0 ? "alert-circle" : "shield-checkmark"}
                  size={22}
                  color={lastResult.threatsFound > 0 ? colors.danger : colors.success}
                />
              </View>
              <View style={styles.resultText}>
                <Text
                  style={[
                    styles.resultTitle,
                    {
                      color:
                        lastResult.threatsFound > 0 ? colors.danger : colors.success,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  Scan Complete · {lastResult.time}
                </Text>
                <Text
                  style={[styles.resultSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
                >
                  {lastResult.threatsFound > 0
                    ? `${lastResult.threatsFound} active threat${lastResult.threatsFound !== 1 ? "s" : ""} detected`
                    : "No new threats found — you're protected"}
                </Text>
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* Scan button */}
        <TouchableOpacity
          style={[
            styles.scanBtn,
            {
              backgroundColor: isScanning ? colors.secondary : colors.primary,
              borderColor: isScanning ? colors.border : colors.primary,
            },
          ]}
          activeOpacity={0.8}
          onPress={handleScan}
          disabled={isScanning}
        >
          {isScanning ? (
            <>
              <ActivityIndicator color={colors.mutedForeground} size="small" />
              <Text
                style={[
                  styles.scanBtnText,
                  { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                Scanning…
              </Text>
            </>
          ) : (
            <>
              <MaterialCommunityIcons name="radar" size={20} color="#FFFFFF" />
              <Text
                style={[
                  styles.scanBtnText,
                  { color: "#FFFFFF", fontFamily: "Inter_600SemiBold" },
                ]}
              >
                Start Full Scan
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text
          style={[
            styles.scanHint,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          Scans all {user.monitored} connected accounts for impersonators,
          stolen photos, and data breaches
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24 },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 20,
    alignItems: "center",
  },
  scanCenter: { alignItems: "center", gap: 16 },
  scanContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  scanCore: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14 },
  stepText: { fontSize: 13, textAlign: "center" },
  statsRow: { flexDirection: "row", gap: 10, width: "100%" },
  statItem: { flex: 1, alignItems: "center", gap: 6 },
  statValue: { fontSize: 20 },
  statLabel: { fontSize: 11, textAlign: "center" },
  lastScanRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  lastScan: { fontSize: 13 },
  progressTrack: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 2 },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  resultText: { flex: 1, gap: 2 },
  resultTitle: { fontSize: 13 },
  resultSub: { fontSize: 12 },
  scanBtn: {
    width: "100%",
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
  },
  scanBtnText: { fontSize: 16 },
  scanHint: { fontSize: 13, textAlign: "center", lineHeight: 20, opacity: 0.8 },
});
