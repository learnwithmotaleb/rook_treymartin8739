import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  ScrollView,
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
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { ScanPulse } from "@/components/ScanPulse";
import { GlassCard } from "@/components/GlassCard";

function formatNextScan(iso: string): string {
  const due = new Date(iso);
  const diffMs = due.getTime() - Date.now();
  if (diffMs <= 0) return "scheduled";
  const h = Math.floor(diffMs / 3_600_000);
  if (h < 24) return `in ${h}h`;
  const d = Math.floor(h / 24);
  return `in ${d} day${d !== 1 ? "s" : ""}`;
}

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    user,
    isScanning,
    scanProgress,
    scanCurrentStep,
    scanQuotaError,
    startScan,
    threats,
    indexedPhotos,
  } = useApp();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [lastResult, setLastResult] = useState<{
    threatsFound: number;
    photoThreats: number;
    time: string;
  } | null>(null);
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const prevScanning = useRef(false);

  const btnScale = useSharedValue(1);

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: withTiming(`${scanProgress}%` as any, { duration: 300 }),
  }));

  const animatedBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  useEffect(() => {
    if (isScanning) {
      prevScanning.current = true;
    } else if (prevScanning.current) {
      prevScanning.current = false;
      const activeCount = threats.filter((t) => !t.resolved).length;
      const photoCount = threats.filter(
        (t) => !t.resolved && t.type === "stolen_photo"
      ).length;
      setLastResult({
        threatsFound: activeCount,
        photoThreats: photoCount,
        time: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
      resultOpacity.setValue(0);
      Animated.timing(resultOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        if (activeCount > 0) {
          setTimeout(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.push("/(tabs)/alerts");
          }, 2000);
        }
      });
    }
  }, [isScanning, threats, resultOpacity]);

  const hasAccounts = user.connectedAccounts.length > 0;
  const photoCount = indexedPhotos.length;
  const photoMatches = threats.filter(
    (t) => !t.resolved && t.type === "stolen_photo"
  ).length;

  const canScan = hasAccounts || photoCount > 0;

  const handleScan = () => {
    if (isScanning || !canScan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLastResult(null);
    startScan();
  };

  const isIdle = !isScanning;
  const statusColor = isScanning ? colors.primary : colors.success;
  const statusText = isScanning
    ? `${scanProgress}%  complete`
    : "All systems active";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primary + "18", "transparent"]}
        style={styles.topGradient}
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
        <Text
          style={[
            styles.headerSub,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          Last scan: {user.lastScan}
        </Text>
        {user.nextScanDue && (
          <Text
            style={[
              styles.headerSub,
              { color: colors.success + "CC", fontFamily: "Inter_400Regular" },
            ]}
          >
            Auto-scan {formatNextScan(user.nextScanDue)}
          </Text>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 110 },
        ]}
      >
        {/* ── Scan Animation ── */}
        <View style={styles.scanCenter}>
          <View style={styles.scanContainer}>
            <ScanPulse size={220} active={isScanning} />
            <View
              style={[
                styles.scanCore,
                {
                  backgroundColor: isScanning
                    ? colors.primary + "22"
                    : colors.success + "22",
                  borderColor: isScanning
                    ? colors.primary + "55"
                    : colors.success + "55",
                },
              ]}
            >
              {isScanning ? (
                <MaterialCommunityIcons
                  name="radar"
                  size={52}
                  color={colors.primary}
                />
              ) : (
                <Ionicons
                  name="shield-checkmark"
                  size={56}
                  color={colors.success}
                />
              )}
            </View>
          </View>

          {/* Status badge */}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusColor + "18",
                borderColor: statusColor + "44",
              },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text
              style={[
                styles.statusText,
                { color: statusColor, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {statusText}
            </Text>
          </View>

          {/* Step text during scan */}
          {isScanning && scanCurrentStep ? (
            <Text
              style={[
                styles.stepText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {scanCurrentStep}
            </Text>
          ) : null}
        </View>

        {/* ── Progress Bar ── */}
        {isScanning && (
          <View style={styles.progressSection}>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: colors.border },
              ]}
            >
              <Reanimated.View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.primary },
                  animatedProgressStyle,
                ]}
              />
            </View>
            <Text
              style={[
                styles.progressPct,
                {
                  color: colors.primary,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              {scanProgress}%
            </Text>
          </View>
        )}

        {/* ── Photo Monitor card ── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/photo-monitor" as any)}
        >
          <GlassCard
            style={[
              styles.photoCard,
              photoMatches > 0 && {
                borderColor: colors.danger + "44",
                backgroundColor: colors.danger + "08",
              },
            ]}
          >
            <View
              style={[
                styles.photoCardIcon,
                {
                  backgroundColor:
                    photoMatches > 0
                      ? colors.danger + "22"
                      : photoCount > 0
                      ? colors.primary + "22"
                      : colors.secondary,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={photoMatches > 0 ? "image-off" : "image-search"}
                size={22}
                color={
                  photoMatches > 0
                    ? colors.danger
                    : photoCount > 0
                    ? colors.primary
                    : colors.mutedForeground
                }
              />
            </View>

            <View style={styles.photoCardBody}>
              <Text
                style={[
                  styles.photoCardTitle,
                  {
                    color:
                      photoMatches > 0 ? colors.danger : colors.foreground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                {photoMatches > 0
                  ? `${photoMatches} photo match${photoMatches !== 1 ? "es" : ""} found`
                  : photoCount > 0
                  ? `${photoCount} photo${photoCount !== 1 ? "s" : ""} being monitored`
                  : "Photo Monitor"}
              </Text>
              <Text
                style={[
                  styles.photoCardSub,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {photoMatches > 0
                  ? "Tap to review unauthorized use detected"
                  : photoCount > 0
                  ? "Included in next scan · Tap to manage"
                  : "Upload photos to monitor for unauthorized use"}
              </Text>
            </View>

            <View style={styles.photoCardChevron}>
              {photoMatches > 0 && (
                <View
                  style={[
                    styles.matchBadge,
                    { backgroundColor: colors.danger },
                  ]}
                >
                  <Text style={styles.matchBadgeText}>{photoMatches}</Text>
                </View>
              )}
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.mutedForeground}
              />
            </View>
          </GlassCard>
        </TouchableOpacity>

        {/* ── Scan result card (post-scan) ── */}
        {lastResult && isIdle && (
          <Animated.View style={{ opacity: resultOpacity }}>
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
                  styles.resultIconWrap,
                  {
                    backgroundColor:
                      lastResult.threatsFound > 0
                        ? colors.danger + "22"
                        : colors.success + "22",
                  },
                ]}
              >
                <Ionicons
                  name={
                    lastResult.threatsFound > 0
                      ? "alert-circle"
                      : "shield-checkmark"
                  }
                  size={40}
                  color={
                    lastResult.threatsFound > 0 ? colors.danger : colors.success
                  }
                />
              </View>
              <View style={styles.resultBody}>
                <Text
                  style={[
                    styles.resultTitle,
                    {
                      color:
                        lastResult.threatsFound > 0
                          ? colors.danger
                          : colors.success,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  Scan Complete · {lastResult.time}
                </Text>
                <Text
                  style={[
                    styles.resultSub,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {lastResult.threatsFound > 0
                    ? `${lastResult.threatsFound} active threat${lastResult.threatsFound !== 1 ? "s" : ""}${lastResult.photoThreats > 0 ? ` · ${lastResult.photoThreats} photo match${lastResult.photoThreats !== 1 ? "es" : ""}` : ""} detected`
                    : photoCount > 0
                    ? `No threats found · ${photoCount} photos verified clean`
                    : "No new threats found — you're protected"}
                </Text>
                {lastResult.threatsFound > 0 && (
                  <Text
                    style={[
                      styles.resultHint,
                      {
                        color: colors.primary,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    Navigating to Alerts…
                  </Text>
                )}
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* ── Bottom action area ── */}
        {!canScan && isIdle ? (
          /* No accounts AND no photos */
          <GlassCard
            style={[styles.ctaCard, { borderColor: colors.border }]}
          >
            <View
              style={[
                styles.ctaIcon,
                { backgroundColor: colors.primary + "18" },
              ]}
            >
              <Ionicons name="person-add" size={28} color={colors.primary} />
            </View>
            <Text
              style={[
                styles.ctaTitle,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              Nothing to scan yet
            </Text>
            <Text
              style={[
                styles.ctaSub,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              Connect a social account or upload photos to Photo Monitor — either one lets you start scanning.
            </Text>
            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
              onPress={() => router.push("/photo-monitor" as any)}
            >
              <Ionicons name="image" size={16} color="#fff" />
              <Text
                style={[styles.ctaBtnText, { fontFamily: "Inter_600SemiBold" }]}
              >
                Upload a Photo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctaBtnSecondary, { borderColor: colors.border }]}
              activeOpacity={0.85}
              onPress={() => router.push("/connect-account" as any)}
            >
              <Ionicons name="link" size={16} color={colors.foreground} />
              <Text
                style={[styles.ctaBtnSecondaryText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
              >
                Connect Account
              </Text>
            </TouchableOpacity>
          </GlassCard>
        ) : scanQuotaError && isIdle ? (
          /* Quota reached */
          <GlassCard
            style={[
              styles.ctaCard,
              { borderColor: colors.warning + "44" },
            ]}
          >
            <View
              style={[
                styles.ctaIcon,
                { backgroundColor: colors.warning + "18" },
              ]}
            >
              <Ionicons
                name="shield-half"
                size={28}
                color={colors.warning}
              />
            </View>
            <Text
              style={[
                styles.ctaTitle,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              Scan limit reached
            </Text>
            <Text
              style={[
                styles.ctaSub,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {scanQuotaError.message}
            </Text>
            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: colors.warning }]}
              activeOpacity={0.85}
              onPress={() => router.push("/subscription" as any)}
            >
              <Ionicons name="arrow-up-circle" size={16} color="#fff" />
              <Text
                style={[styles.ctaBtnText, { fontFamily: "Inter_600SemiBold" }]}
              >
                Upgrade to{" "}
                {scanQuotaError.upgradeTo.charAt(0).toUpperCase() +
                  scanQuotaError.upgradeTo.slice(1)}
              </Text>
            </TouchableOpacity>
          </GlassCard>
        ) : (
          /* Scan button */
          <>
            {/* Soft nudge: photo-only mode — suggest connecting an account */}
            {!hasAccounts && photoCount > 0 && isIdle && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push("/connect-account" as any)}
              >
                <GlassCard style={[styles.nudgeCard, { borderColor: colors.primary + "33" }]}>
                  <View style={[styles.nudgeIcon, { backgroundColor: colors.primary + "18" }]}>
                    <Ionicons name="link" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.nudgeBody}>
                    <Text style={[styles.nudgeTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                      Photo scan ready
                    </Text>
                    <Text style={[styles.nudgeSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      Connect a social account to also catch impersonators & fake profiles
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </GlassCard>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              activeOpacity={1}
              onPressIn={() => {
                if (!isScanning) btnScale.value = withSpring(0.97);
              }}
              onPressOut={() => {
                btnScale.value = withSpring(1);
              }}
              onPress={handleScan}
              disabled={isScanning}
            >
              <Reanimated.View
                style={[
                  styles.scanBtn,
                  {
                    backgroundColor: isScanning
                      ? colors.secondary
                      : colors.primary,
                    borderColor: isScanning ? colors.border : colors.primary,
                  },
                  animatedBtnStyle,
                ]}
              >
                {!isScanning && (
                  <LinearGradient
                    colors={["#FFFFFF18", "transparent"]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                  />
                )}
                {isScanning ? (
                  <>
                    <MaterialCommunityIcons
                      name="radar"
                      size={22}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.scanBtnText,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      Scanning…
                    </Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="radar"
                      size={22}
                      color="#FFFFFF"
                    />
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

            {!isScanning && (
              <Text
                style={[
                  styles.scanHint,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {hasAccounts && photoCount > 0
                  ? `Scans ${user.connectedAccounts.length} account${user.connectedAccounts.length !== 1 ? "s" : ""} · checks ${photoCount} photo${photoCount !== 1 ? "s" : ""} for misuse`
                  : hasAccounts
                  ? `Scans ${user.connectedAccounts.length} connected account${user.connectedAccounts.length !== 1 ? "s" : ""} for impersonators & fake profiles`
                  : `Checks ${photoCount} photo${photoCount !== 1 ? "s" : ""} for unauthorized use across the web`}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 380 },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24 },
  headerSub: { fontSize: 13, marginTop: 2 },

  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 18,
    alignItems: "center",
  },

  /* Scan animation */
  scanCenter: { alignItems: "center", gap: 16, width: "100%" },
  scanContainer: {
    width: 220,
    height: 220,
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
  stepText: { fontSize: 13, textAlign: "center", opacity: 0.8, paddingHorizontal: 20 },

  /* Progress */
  progressSection: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  progressPct: { fontSize: 13, width: 36, textAlign: "right" },

  /* Photo Monitor card */
  photoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    paddingVertical: 14,
  },
  photoCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  photoCardBody: { flex: 1, gap: 3 },
  photoCardTitle: { fontSize: 15 },
  photoCardSub: { fontSize: 13 },
  photoCardChevron: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  matchBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  matchBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },

  /* Result card */
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    width: "100%",
    padding: 18,
  },
  resultIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  resultBody: { flex: 1, gap: 4 },
  resultTitle: { fontSize: 15 },
  resultSub: { fontSize: 13, lineHeight: 18 },
  resultHint: { fontSize: 13, marginTop: 2 },

  /* CTA cards */
  ctaCard: {
    width: "100%",
    alignItems: "center",
    gap: 10,
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  ctaIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  ctaTitle: { fontSize: 16, textAlign: "center" },
  ctaSub: { fontSize: 14, textAlign: "center", lineHeight: 20, opacity: 0.8 },
  ctaBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
  },
  ctaBtnText: { fontSize: 15, color: "#fff" },
  ctaBtnSecondary: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 28,
    borderWidth: 1,
  },
  ctaBtnSecondaryText: { fontSize: 15 },

  /* Photo-only nudge */
  nudgeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    paddingVertical: 14,
  },
  nudgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  nudgeBody: { flex: 1, gap: 2 },
  nudgeTitle: { fontSize: 14 },
  nudgeSub: { fontSize: 12, lineHeight: 17, opacity: 0.85 },

  /* Scan button */
  scanBtn: {
    height: 60,
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 40,
    minWidth: 240,
  },
  scanBtnText: { fontSize: 18 },
  scanHint: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    opacity: 0.8,
    paddingHorizontal: 10,
  },
});
