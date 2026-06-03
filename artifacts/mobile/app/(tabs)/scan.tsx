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
import { router } from "expo-router";
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { ScanPulse } from "@/components/ScanPulse";
import { GlassCard } from "@/components/GlassCard";

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    user,
    isScanning,
    scanProgress,
    scanCurrentStep,
    startScan,
    activeThreats,
    fakeAccounts,
    threats,
  } = useApp();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [lastResult, setLastResult] = useState<{ threatsFound: number; time: string } | null>(null);
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const prevScanning = useRef(false);

  const btnScale = useSharedValue(1);

  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(`${scanProgress}%`, { duration: 300 }),
    };
  });

  const animatedBtnStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: btnScale.value }],
    };
  });

  useEffect(() => {
    if (isScanning) {
      prevScanning.current = true;
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
      }).start(() => {
        if (activeCount > 0) {
          // Pause briefly so the user sees the result card, then navigate to Alerts
          setTimeout(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.push("/(tabs)/alerts");
          }, 1800);
        }
      });
    }
  }, [isScanning, threats, resultOpacity]);

  const hasAccounts = user.connectedAccounts.length > 0;

  const handleScan = () => {
    if (isScanning || !hasAccounts) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLastResult(null);
    startScan();
  };

  const currentStep = isScanning ? (scanCurrentStep ?? "Initializing scan…") : null;
  const statusText = isScanning ? `${scanProgress}% complete` : "All systems active";
  const statusColor = isScanning ? colors.primary : colors.success;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primary + "1A", "transparent"]}
        style={[styles.topGradient, { height: 400 }]}
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
                  size={60}
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
              size={24}
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
              size={24}
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
              size={24}
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
            <Reanimated.View
              style={[
                styles.progressFill,
                { backgroundColor: colors.primary },
                animatedProgressStyle,
              ]}
            />
          </View>
        )}

        {/* Scan result card after completion */}
        {lastResult && !isScanning && (
          <Animated.View style={{ opacity: resultOpacity, width: "100%" }}>
            <GlassCard
              accent
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
                  size={48}
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

        {/* No accounts CTA */}
        {!hasAccounts && !isScanning ? (
          <GlassCard style={[styles.noAccountsCard, { borderColor: colors.border }]}>
            <View style={[styles.noAccountsIcon, { backgroundColor: colors.primary + "18" }]}>
              <Ionicons name="person-add" size={26} color={colors.primary} />
            </View>
            <Text style={[styles.noAccountsTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Connect an account first
            </Text>
            <Text style={[styles.noAccountsSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Link at least one social account so ShieldID knows who to protect.
            </Text>
            <TouchableOpacity
              style={[styles.connectBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
              onPress={() => router.push("/connect-account" as any)}
            >
              <Ionicons name="link" size={16} color="#fff" />
              <Text style={[styles.connectBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                Connect Account
              </Text>
            </TouchableOpacity>
          </GlassCard>
        ) : (
          <>
            {/* Scan button */}
            <TouchableOpacity
              activeOpacity={1}
              onPressIn={() => btnScale.value = withSpring(0.97)}
              onPressOut={() => btnScale.value = withSpring(1)}
              onPress={handleScan}
              disabled={isScanning}
              style={{ width: "100%" }}
            >
              <Reanimated.View
                style={[
                  styles.scanBtn,
                  {
                    backgroundColor: isScanning ? colors.secondary : colors.primary,
                    borderColor: isScanning ? colors.border : colors.primary,
                  },
                  animatedBtnStyle,
                ]}
              >
                {!isScanning && (
                  <LinearGradient
                    colors={[colors.primaryForeground + "11", "transparent"]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                  />
                )}
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
                    <MaterialCommunityIcons name="radar" size={24} color="#FFFFFF" />
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
              </Reanimated.View>
            </TouchableOpacity>

            <Text
              style={[
                styles.scanHint,
                { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}
            >
              Scans all {user.monitored} connected account{user.monitored !== 1 ? "s" : ""} for impersonators,
              stolen photos, and data breaches.
            </Text>
          </>
        )}
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
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14 },
  stepText: { fontSize: 13, textAlign: "center" },
  statsRow: { flexDirection: "row", gap: 10, width: "100%" },
  statItem: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 14 },
  statValue: { fontSize: 20 },
  statLabel: { fontSize: 11, textAlign: "center" },
  lastScanRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  lastScan: { fontSize: 13 },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    width: "100%",
    padding: 20,
  },
  resultIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  resultText: { flex: 1, gap: 2 },
  resultTitle: { fontSize: 15 },
  resultSub: { fontSize: 13 },
  scanBtn: {
    width: "100%",
    height: 60,
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  scanBtnText: { fontSize: 18 },
  scanHint: { fontSize: 14, textAlign: "center", lineHeight: 22, opacity: 0.8 },
  noAccountsCard: {
    width: "100%",
    alignItems: "center",
    gap: 10,
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  noAccountsIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  noAccountsTitle: { fontSize: 16, textAlign: "center" },
  noAccountsSub: { fontSize: 14, textAlign: "center", lineHeight: 20, opacity: 0.8 },
  connectBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
  },
  connectBtnText: { fontSize: 15, color: "#fff" },
});
