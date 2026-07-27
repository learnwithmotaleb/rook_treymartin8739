/**
 * Subscription / Paywall
 *
 * Flow:
 *   Step 0: Intro     — native screen ("We found threats" / "We want to protect your identity, free")
 *   Step 1: Reminder  — native trial-reminder screen with notification opt-in
 *                       (skipped on threat path: fromOnboarding=1 + threatCount > 0)
 *   Step 2: Paywall   — fully remote RevenueCat Paywall component
 *                       Copy, layout, pricing, products, and experiments are all managed
 *                       from the RevenueCat dashboard — zero hardcoded values here.
 *
 * To update the paywall: change the offering/paywall in the RevenueCat dashboard.
 * No app update required.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import type { CustomerInfo, PurchasesOffering, PurchasesError } from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useSubscription, isRevenueCatConfigured, getTierFromCustomerInfo } from "@/lib/revenuecat";
import { syncSubscriptionTier } from "@/lib/api";
import { analytics } from "@/lib/analytics";

/** Normalize legacy "pro" tier to "Premium" in all user-facing labels. */
function displayTier(tier: string): string {
  const normalized = tier === "pro" ? "premium" : tier;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

// ─── Mock threat cards (blurred preview on intro) ─────────────────────────────
function ThreatPreviewCards({ colors, threatCount }: { colors: ReturnType<typeof useColors>; threatCount: number }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.025, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,     duration: 2000, useNativeDriver: true }),
    ])).start();
  }, []);

  const cards = [
    { label: "Impersonator detected", platform: "Instagram", color: "#E1306C" },
    { label: "Stolen photo found",    platform: "Facebook",  color: "#1877F2" },
    { label: "Suspicious account",    platform: "X",         color: "#555"    },
  ].slice(0, Math.max(2, Math.min(3, threatCount || 2)));

  return (
    <View style={{ gap: 10, width: "100%" }}>
      {cards.map((card, i) => (
        <Animated.View key={i} style={{ transform: i === 0 ? [{ scale: pulse }] : [] }}>
          <View style={[tp.card, { backgroundColor: colors.card, borderColor: i === 0 ? "#EF444444" : colors.border }]}>
            <View style={[tp.dot, { backgroundColor: card.color }]} />
            <View style={{ flex: 1, gap: 5 }}>
              <View style={[tp.bar, { width: "70%", backgroundColor: colors.mutedForeground + "30" }]} />
              <View style={[tp.bar, { width: "45%", backgroundColor: colors.mutedForeground + "18" }]} />
            </View>
            <Ionicons name="lock-closed" size={13} color={colors.mutedForeground + "88"} />
          </View>
        </Animated.View>
      ))}
      <View style={[tp.card, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Ionicons name="ellipsis-horizontal" size={14} color={colors.mutedForeground} />
        <Text style={[{ flex: 1, color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }]}>
          Unlock to see full report and take action
        </Text>
        <Ionicons name="lock-closed" size={12} color={colors.mutedForeground + "88"} />
      </View>
    </View>
  );
}
const tp = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 16, borderWidth: 1 },
  dot:  { width: 8, height: 8, borderRadius: 4 },
  bar:  { height: 9, borderRadius: 4 },
});

// ─── Screen 0: Intro ──────────────────────────────────────────────────────────
function IntroScreen({ colors, onContinue, threatCount, isFromOnboarding, topPad, bottomPad }: {
  colors: ReturnType<typeof useColors>;
  onContinue: () => void;
  threatCount: number;
  isFromOnboarding: boolean;
  topPad: number;
  bottomPad: number;
}) {
  const shieldAnim = useRef(new Animated.Value(0)).current;
  const glowAnim   = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.spring(shieldAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.4, duration: 2200, useNativeDriver: true }),
    ])).start();
  }, []);

  const hasThreats = isFromOnboarding && threatCount > 0;

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      <LinearGradient
        colors={hasThreats ? ["#EF444415", colors.primary + "12", "transparent"] : [colors.primary + "18", colors.primary + "06", "transparent"]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.5, 1]}
      />

      {/* Top content */}
      <View style={[s0.top, { paddingTop: topPad + 20 }]}>
        {hasThreats && (
          <View style={[s0.badge, { backgroundColor: "#EF444414", borderColor: "#EF444440" }]}>
            <View style={[s0.badgeDot, { backgroundColor: "#EF4444" }]} />
            <Text style={[{ color: "#EF4444", fontFamily: "Inter_600SemiBold", fontSize: 13 }]}>
              {threatCount} potential match{threatCount !== 1 ? "es" : ""} found
            </Text>
          </View>
        )}
        <Text style={[s0.headline, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {hasThreats
            ? "We found threats.\nSee your full report."
            : "We want to protect\nyour identity,\nfree."}
        </Text>
      </View>

      {/* Center visual */}
      <View style={s0.center}>
        <Animated.View style={{ alignItems: "center", opacity: shieldAnim, transform: [{ scale: shieldAnim }] }}>
          <Animated.View style={[s0.glow, { opacity: glowAnim, backgroundColor: hasThreats ? "#EF444420" : colors.primary + "20" }]} />
          <View style={[s0.shieldBg, { backgroundColor: hasThreats ? "#EF444418" : colors.primary + "18", borderColor: hasThreats ? "#EF444440" : colors.primary + "40" }]}>
            <Ionicons name={hasThreats ? "alert-circle" : "shield-checkmark"} size={60} color={hasThreats ? "#EF4444" : colors.primary} />
          </View>
        </Animated.View>
        <View style={{ marginTop: 24, width: "100%", paddingHorizontal: 24 }}>
          <ThreatPreviewCards colors={colors} threatCount={hasThreats ? threatCount : 2} />
        </View>
      </View>

      {/* Bottom CTA */}
      <View style={[s0.bottom, { paddingBottom: bottomPad + 24 }]}>
        <View style={s0.noPayRow}>
          <Ionicons name="checkmark" size={16} color={colors.foreground} />
          <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>No Payment Due Now</Text>
        </View>
        <TouchableOpacity style={[s0.cta, { backgroundColor: colors.foreground }]} onPress={onContinue} activeOpacity={0.88}>
          <Text style={[s0.ctaText, { color: colors.background, fontFamily: "Inter_700Bold" }]}>Try Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const s0 = StyleSheet.create({
  top:      { paddingHorizontal: 28, gap: 12 },
  badge:    { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  headline: { fontSize: 36, lineHeight: 44 },
  center:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 0 },
  glow:     { position: "absolute", width: 200, height: 200, borderRadius: 100, top: -60 },
  shieldBg: { width: 120, height: 120, borderRadius: 36, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  bottom:   { paddingHorizontal: 24, gap: 14 },
  noPayRow: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  cta:      { height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  ctaText:  { fontSize: 18 },
});

// ─── Screen 1: Trial Reminder ─────────────────────────────────────────────────
function ReminderScreen({ colors, onBack, onContinue, topPad, bottomPad }: {
  colors: ReturnType<typeof useColors>;
  onBack: () => void;
  onContinue: () => void;
  topPad: number;
  bottomPad: number;
}) {
  const bellAnim  = useRef(new Animated.Value(0)).current;
  const badgeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(bellAnim,  { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
      Animated.spring(badgeAnim, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      <LinearGradient colors={[colors.primary + "10", "transparent"]} style={StyleSheet.absoluteFill} />

      {/* Back */}
      <TouchableOpacity style={[s1.back, { top: topPad + 16 }]} onPress={onBack} activeOpacity={0.7}>
        <View style={[s1.backCircle, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </View>
      </TouchableOpacity>

      {/* Center content */}
      <View style={[s1.content, { paddingTop: topPad + 72 }]}>
        {/* Bell visual */}
        <View style={s1.bellWrap}>
          <Animated.View style={{ opacity: bellAnim, transform: [{ scale: bellAnim }] }}>
            <View style={[s1.bellBg, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Ionicons name="notifications" size={64} color={colors.mutedForeground} />
            </View>
          </Animated.View>
          <Animated.View style={[s1.badge, { opacity: badgeAnim, transform: [{ scale: badgeAnim }] }]}>
            <Text style={[s1.badgeNum, { fontFamily: "Inter_700Bold" }]}>1</Text>
          </Animated.View>
        </View>

        {/* Text */}
        <View style={{ gap: 10, alignItems: "center" }}>
          <Text style={[s1.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            We'll alert you before{"\n"}your trial ends
          </Text>
          <Text style={[s1.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            As long as notifications are enabled
          </Text>
        </View>
      </View>

      {/* Bottom CTA */}
      <View style={[s1.bottom, { paddingBottom: bottomPad + 24 }]}>
        <View style={s1.noPayRow}>
          <Ionicons name="checkmark" size={16} color={colors.foreground} />
          <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>No Payment Due Now</Text>
        </View>
        <TouchableOpacity style={[s1.cta, { backgroundColor: colors.foreground }]} onPress={onContinue} activeOpacity={0.88}>
          <Text style={[s1.ctaText, { color: colors.background, fontFamily: "Inter_700Bold" }]}>Continue for FREE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const s1 = StyleSheet.create({
  back:      { position: "absolute", left: 20, zIndex: 10 },
  backCircle:{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  content:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 40, paddingHorizontal: 28 },
  bellWrap:  { position: "relative", alignItems: "center", justifyContent: "center" },
  bellBg:    { width: 140, height: 140, borderRadius: 42, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  badge:     { position: "absolute", top: 4, right: 4, width: 36, height: 36, borderRadius: 18, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  badgeNum:  { color: "#fff", fontSize: 18 },
  title:     { fontSize: 30, textAlign: "center", lineHeight: 38 },
  sub:       { fontSize: 15, textAlign: "center" },
  bottom:    { paddingHorizontal: 24, gap: 14 },
  noPayRow:  { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  cta:       { height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  ctaText:   { fontSize: 18 },
});

// ─── Screen 2: RC Remote Paywall ──────────────────────────────────────────────
// All copy, layout, pricing, products, and A/B experiments are controlled
// from the RevenueCat dashboard. No hardcoded values here.
function RCPaywallScreen({
  colors,
  onBack,
  onSuccess,
  onDismiss,
  offering,
  topPad,
  isLoading,
}: {
  colors: ReturnType<typeof useColors>;
  onBack: () => void;
  onSuccess: (info: CustomerInfo) => Promise<void>;
  onDismiss: () => void;
  offering: PurchasesOffering | null | undefined;
  topPad: number;
  isLoading: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  // Loading state while offerings are being fetched from RC
  if (isLoading) {
    return (
      <View style={[pwl.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={[colors.primary + "18", "transparent"]} style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={[pwl.backBtn, { top: topPad + 16 }]} onPress={onBack} activeOpacity={0.7}>
          <View style={[pwl.backCircle, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </View>
        </TouchableOpacity>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[pwl.loadingText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Loading plans…
        </Text>
      </View>
    );
  }

  // Offline / no offering fallback
  if (!offering && !isLoading) {
    return (
      <View style={[pwl.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={[colors.primary + "18", "transparent"]} style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={[pwl.backBtn, { top: topPad + 16 }]} onPress={onBack} activeOpacity={0.7}>
          <View style={[pwl.backCircle, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </View>
        </TouchableOpacity>
        <View style={pwl.fallbackContent}>
          <View style={[pwl.fallbackIcon, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}>
            <Ionicons name="wifi-outline" size={36} color={colors.primary} />
          </View>
          <Text style={[pwl.fallbackTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Plans unavailable
          </Text>
          <Text style={[pwl.fallbackSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Check your connection and try again. Your data and scan results are safe.
          </Text>
          <TouchableOpacity
            style={[pwl.retryBtn, { backgroundColor: colors.foreground }]}
            onPress={onBack}
            activeOpacity={0.88}
          >
            <Text style={[pwl.retryText, { color: colors.background, fontFamily: "Inter_600SemiBold" }]}>
              Go Back
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={pwl.restoreLink}
            onPress={() => Linking.openURL(
              Platform.OS === "ios"
                ? "https://apps.apple.com/account/subscriptions"
                : "https://play.google.com/store/account/subscriptions"
            )}
          >
            <Text style={[pwl.restoreLinkText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Already subscribed? Restore purchase
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      {/* Back navigation sits above the RC paywall */}
      <TouchableOpacity style={[pwl.backBtn, { top: topPad + 16 }]} onPress={onBack} activeOpacity={0.7}>
        <View style={[pwl.backCircle, { backgroundColor: "rgba(0,0,0,0.35)", borderColor: "rgba(255,255,255,0.15)" }]}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </View>
      </TouchableOpacity>

      {error && (
        <View style={[pwl.errorBanner, { backgroundColor: "#EF444422", borderColor: "#EF444440" }]}>
          <Text style={[{ color: "#EF4444", fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" }]}>
            {error}
          </Text>
        </View>
      )}

      {/* RevenueCat remote paywall — all content managed from RC dashboard */}
      <RevenueCatUI.Paywall
        options={{ offering: offering ?? undefined }}
        onPurchaseCompleted={async ({ customerInfo }: { customerInfo: CustomerInfo }) => {
          analytics.track("subscription_started");
          await onSuccess(customerInfo);
        }}
        onPurchaseCancelled={() => {
          analytics.track("upsell_dismissed");
        }}
        onPurchaseError={({ error: purchaseError }: { error: PurchasesError }) => {
          const msg = (purchaseError as any)?.message ?? "Purchase failed. Please try again.";
          setError(msg);
          setTimeout(() => setError(null), 4000);
        }}
        onRestoreCompleted={async ({ customerInfo }: { customerInfo: CustomerInfo }) => {
          analytics.track("subscription_restored");
          await onSuccess(customerInfo);
        }}
        onRestoreError={() => {
          setError("Nothing to restore. No prior purchases found.");
          setTimeout(() => setError(null), 3500);
        }}
        onDismiss={onDismiss}
      />
    </View>
  );
}
const pwl = StyleSheet.create({
  container:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  backBtn:         { position: "absolute", left: 20, zIndex: 10 },
  backCircle:      { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  loadingText:     { fontSize: 14, marginTop: 8 },
  fallbackContent: { alignItems: "center", gap: 14, paddingHorizontal: 36 },
  fallbackIcon:    { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  fallbackTitle:   { fontSize: 22, textAlign: "center" },
  fallbackSub:     { fontSize: 14, textAlign: "center", lineHeight: 21 },
  retryBtn:        { height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, marginTop: 8 },
  retryText:       { fontSize: 16 },
  restoreLink:     { paddingVertical: 8 },
  restoreLinkText: { fontSize: 13, textDecorationLine: "underline" },
  errorBanner:     { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, padding: 12, borderBottomWidth: 1 },
});

// ─── Already Subscribed ───────────────────────────────────────────────────────
function ManageScreen({ colors, tier, onClose, topPad }: {
  colors: ReturnType<typeof useColors>;
  tier: string;
  onClose: () => void;
  topPad: number;
}) {
  const handleManage = () => {
    Alert.alert(
      "Manage Subscription",
      "Subscriptions are managed through your device's app store settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: Platform.OS === "ios" ? "Open App Store" : "Open Play Store",
          onPress: () => Linking.openURL(Platform.OS === "ios" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions"),
        },
      ]
    );
  };

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background, padding: 28 }]}>
      <LinearGradient colors={[colors.primary + "18", "transparent"]} style={StyleSheet.absoluteFill} />
      <TouchableOpacity style={{ position: "absolute", top: topPad + 16, right: 20, zIndex: 10 }} onPress={onClose}>
        <View style={[{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }]}>
          <Ionicons name="close" size={18} color={colors.foreground} />
        </View>
      </TouchableOpacity>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 20 }}>
        <View style={[{ width: 88, height: 88, borderRadius: 28, backgroundColor: colors.primary + "18", borderWidth: 1, borderColor: colors.primary + "40", alignItems: "center", justifyContent: "center" }]}>
          <Ionicons name="shield-checkmark" size={44} color={colors.primary} />
        </View>
        <Text style={[{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 24, textAlign: "center" }]}>
          {displayTier(tier)} — Active
        </Text>
        <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center", lineHeight: 23 }]}>
          You're fully protected. Rook continuously monitors your identity across all connected platforms.
        </Text>
        <TouchableOpacity
          style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }]}
          onPress={handleManage}
          activeOpacity={0.8}
        >
          <Text style={[{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15 }]}>Manage Subscription</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Subscription() {
  const colors      = useColors();
  const insets      = useSafeAreaInsets();
  const { user, completeOnboarding, refreshData } = useApp();
  const { fromOnboarding, threatCount: rawThreatCount } = useLocalSearchParams<{
    fromOnboarding?: string;
    threatCount?: string;
  }>();

  const isFromOnboarding = fromOnboarding === "1";
  const threatCount      = parseInt(rawThreatCount ?? "0", 10) || 0;
  const topPad           = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad        = Platform.OS === "web" ? 34 : insets.bottom;

  // Use the current offering from the RC context.
  // Pricing, copy, layout, products, and experiments all come from the RC dashboard.
  // To target a specific placement, configure "paywall" in the RC dashboard and call
  // Purchases.getCurrentOfferingForPlacement("paywall") — the current offering is the
  // safe default that works out of the box without any extra dashboard setup.
  const { offerings, tier: rcTier, isLoading: rcIsLoading, refetch } = useSubscription();
  const activeOffering = offerings?.current ?? null;

  const [paywallStep, setPaywallStep] = useState(0);

  const currentTier      = (user.tier ?? "free") as string;
  const alreadySubscribed = currentTier !== "free";

  // ── Analytics: paywall view ───────────────────────────────────────────────
  useEffect(() => {
    analytics.track("paywall_viewed", { from_onboarding: isFromOnboarding ? "1" : "0", threat_count: threatCount });
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (isFromOnboarding) { completeOnboarding(); router.replace("/(tabs)" as any); }
    else { router.back(); }
  }, [isFromOnboarding, completeOnboarding]);

  const handleStep0Continue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // High-urgency threat path: skip the trial-reminder and go straight to paywall
    if (isFromOnboarding && threatCount > 0) {
      setPaywallStep(2);
    } else {
      setPaywallStep(1);
    }
  }, [isFromOnboarding, threatCount]);

  const handleStep1Continue = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await Notifications.requestPermissionsAsync(); } catch { /* graceful */ }
    setPaywallStep(2);
  }, []);

  const handlePurchaseSuccess = useCallback(async (info: CustomerInfo) => {
    const newTier = getTierFromCustomerInfo(info);
    try { await syncSubscriptionTier(newTier); } catch { /* graceful */ }
    await refreshData();
    if (isFromOnboarding) { completeOnboarding(); router.replace("/(tabs)" as any); }
    else { router.back(); }
  }, [refreshData, isFromOnboarding, completeOnboarding]);

  const handlePaywallDismiss = useCallback(() => {
    analytics.track("upsell_dismissed");
    // Dismissed from within the RC paywall — go back to step 1 or close
    if (paywallStep === 2) {
      setPaywallStep(isFromOnboarding && threatCount > 0 ? 0 : 1);
    } else {
      handleClose();
    }
  }, [paywallStep, isFromOnboarding, threatCount, handleClose]);

  // ── Already subscribed ────────────────────────────────────────────────────
  if (alreadySubscribed) {
    return <ManageScreen colors={colors} tier={currentTier} onClose={handleClose} topPad={topPad} />;
  }

  // ── RC not configured ─────────────────────────────────────────────────────
  if (!isRevenueCatConfigured) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 28 }]}>
        <LinearGradient colors={[colors.primary + "20", "transparent"]} style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={{ position: "absolute", top: topPad + 16, right: 20 }} onPress={handleClose}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[{ width: 80, height: 80, borderRadius: 24, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center", marginBottom: 20 }]}>
          <Ionicons name="shield-checkmark" size={40} color={colors.primary} />
        </View>
        <Text style={[{ fontSize: 24, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center", marginBottom: 12 }]}>
          Subscriptions Coming Soon
        </Text>
        <Text style={[{ fontSize: 15, color: colors.mutedForeground, textAlign: "center", lineHeight: 23 }]}>
          In-app purchases are being configured.{"\n"}Check back soon.
        </Text>
      </View>
    );
  }

  // ── Step 0: Intro ─────────────────────────────────────────────────────────
  if (paywallStep === 0) {
    return (
      <>
        <IntroScreen
          colors={colors}
          onContinue={handleStep0Continue}
          threatCount={threatCount}
          isFromOnboarding={isFromOnboarding}
          topPad={topPad}
          bottomPad={bottomPad}
        />
        {!isFromOnboarding && (
          <TouchableOpacity style={{ position: "absolute", top: topPad + 16, right: 20, zIndex: 20 }} onPress={handleClose}>
            <View style={[{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="close" size={18} color="#fff" />
            </View>
          </TouchableOpacity>
        )}
      </>
    );
  }

  // ── Step 1: Trial Reminder ────────────────────────────────────────────────
  if (paywallStep === 1) {
    return (
      <ReminderScreen
        colors={colors}
        onBack={() => setPaywallStep(0)}
        onContinue={handleStep1Continue}
        topPad={topPad}
        bottomPad={bottomPad}
      />
    );
  }

  // ── Step 2: RevenueCat Remote Paywall ─────────────────────────────────────
  return (
    <RCPaywallScreen
      colors={colors}
      onBack={() => setPaywallStep(isFromOnboarding && threatCount > 0 ? 0 : 1)}
      onSuccess={handlePurchaseSuccess}
      onDismiss={handlePaywallDismiss}
      offering={activeOffering}
      topPad={topPad}
      isLoading={rcIsLoading}
    />
  );
}
