/**
 * Subscription / Paywall — CalAI-style flow
 *
 * Screen 0: Intro — Rook Premium protection overview
 * Screen 1: Reminder — store-confirmed introductory-offer eligibility
 *           (SKIPPED on threat path: fromOnboarding=1 + threatCount > 0)
 * Screen 2: Plan select — Annual (default) vs Monthly + checkout
 *
 * Rook Premium is the only paid tier. The current RevenueCat offering provides
 * monthly and annual packages; store metadata supplies localized prices and
 * introductory-offer eligibility.
 *
 * Store-provided RevenueCat prices are the only purchasable prices.
 * RC product IDs: premium_monthly_v2, premium_annual_v2
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/expo";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image as RNImage,
  Linking,
  Modal,
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
import type { PurchasesPackage } from "react-native-purchases";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { ReviewerDemoBanner } from "@/components/ReviewerDemoBanner";
import {
  getValidatedPremiumOffering,
  identifyRevenueCatUser,
  useSubscription,
  isRevenueCatConfigured,
} from "@/lib/revenuecat";
import { getSubscription, listThreats } from "@/lib/api";
import type { ThreatSummary } from "@/lib/api";

type BillingCycle = "annual" | "monthly";

function displayTier(tier: string): string {
  return tier === "free" ? "Free" : "Rook Premium";
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ visible, pkg, onConfirm, onCancel }: {
  visible: boolean;
  pkg: PurchasesPackage | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const colors = useColors();
  if (!pkg) return null;
  const isAnnual = pkg.packageType === "ANNUAL";
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={cm.overlay}>
        <View style={[cm.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={cm.center}>
            <View style={[cm.icon, { backgroundColor: colors.primary + "18" }]}>
              <Ionicons name="shield-checkmark" size={30} color={colors.primary} />
            </View>
          </View>
          <Text style={[cm.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Review Rook Premium</Text>
          <Text style={[cm.product, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {pkg.product.title || "Rook Premium"}
          </Text>
          <Text style={[cm.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {pkg.product.priceString}{isAnnual ? "/year" : "/month"}
          </Text>
          <Text style={[cm.note, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Your app store purchase sheet will confirm whether you qualify for an introductory trial, the exact price, and the first charge date. Cancel at least 24 hours before renewal.
          </Text>
          <TouchableOpacity style={[cm.confirmBtn, { backgroundColor: colors.foreground }]} onPress={onConfirm} activeOpacity={0.85}>
            <Text style={[cm.confirmText, { color: colors.background, fontFamily: "Inter_700Bold" }]}>Continue to App Store</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} style={cm.cancelBtn}>
            <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14 }]}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
const cm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: 28, gap: 12 },
  center: { alignItems: "center" },
  icon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { fontSize: 22, textAlign: "center" },
  product: { fontSize: 15, textAlign: "center" },
  sub: { fontSize: 14, textAlign: "center" },
  note: { fontSize: 12, textAlign: "center", lineHeight: 18 },
  confirmBtn: { height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginTop: 4 },
  confirmText: { fontSize: 17 },
  cancelBtn: { alignItems: "center", paddingVertical: 6 },
});

// ─── Platform display helpers ──────────────────────────────────────────────────
function platformLabel(p: string | null): string {
  switch ((p ?? "").toLowerCase()) {
    case "x":         return "X (Twitter)";
    case "instagram": return "Instagram";
    case "tiktok":    return "TikTok";
    case "facebook":  return "Facebook";
    default:          return p ?? "Unknown Platform";
  }
}
function platformColor(p: string | null): string {
  switch ((p ?? "").toLowerCase()) {
    case "x":         return "#1DA1F2";
    case "instagram": return "#E1306C";
    case "tiktok":    return "#69C9D0";
    case "facebook":  return "#4267B2";
    default:          return "#888";
  }
}
function severityColor(s: string): string {
  return s === "high" ? "#EF4444" : s === "medium" ? "#F59E0B" : "#22C55E";
}

function ReviewerBillingPreviewNotice({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ gap: 6 }}>
      <ReviewerDemoBanner message="Demo product data · StoreKit billing stays live." />
      <Text style={{ color: colors.warning, fontFamily: "Inter_500Medium", fontSize: 11, lineHeight: 16, textAlign: "center" }}>
        Store prices, purchase, and Restore use actual StoreKit sandbox behavior. Review billing in TestFlight; demo data does not grant Premium.
      </Text>
    </View>
  );
}

// ─── Real investigation report preview (Screen 0 hero) ────────────────────────
// Shows the user's actual top threat when available; falls back to a generic
// "identity monitoring active" card — never fabricates specific findings.
function ReportPreview({ colors, threat, isReviewerDemo }: {
  colors: ReturnType<typeof useColors>;
  threat: ThreatSummary | null;
  isReviewerDemo: boolean;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.018, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,     duration: 2200, useNativeDriver: true }),
    ])).start();
  }, []);

  const sev   = threat?.severity ?? "low";
  const sColor = severityColor(sev);

  return (
    <View style={{ gap: 9, width: "100%" }}>
      {/* ── Row 1: Real finding or generic protection card ── */}
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <View style={[rp.card, { backgroundColor: colors.card, borderColor: sColor + "33" }]}>
          <View style={rp.topRow}>
            <View style={[rp.severityBadge, { backgroundColor: sColor + "18", borderColor: sColor + "40" }]}>
              <View style={[rp.severityDot, { backgroundColor: sColor }]} />
              <Text style={[rp.severityText, { color: sColor, fontFamily: "Inter_700Bold" }]}>
                {threat ? `${sev.toUpperCase()} SEVERITY` : isReviewerDemo ? "DEMO PREVIEW" : "PROTECTION PREVIEW"}
              </Text>
            </View>
            {threat && (
              <View style={[rp.scoreBadge, { backgroundColor: sColor + "18", borderColor: sColor + "44" }]}>
                <Text style={[rp.scoreNum, { color: sColor, fontFamily: "Inter_700Bold" }]}>{threat.threatScore}</Text>
                <Text style={[rp.scoreDenom, { color: sColor + "99", fontFamily: "Inter_400Regular" }]}>/100</Text>
              </View>
            )}
          </View>

          {threat ? (
            /* Real threat data */
            <>
              <View style={rp.midRow}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[rp.username, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    {threat.suspiciousUsername ? `@${threat.suspiciousUsername}` : threat.title}
                  </Text>
                  {threat.platform && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <View style={[rp.platformDot, { backgroundColor: platformColor(threat.platform) }]} />
                      <Text style={[rp.platformLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {platformLabel(threat.platform)}
                      </Text>
                    </View>
                  )}
                  <Text style={[rp.findingText, { color: sColor, fontFamily: "Inter_600SemiBold" }]}>
                    {threat.description}
                  </Text>
                </View>
              </View>
              <View style={rp.matchRow}>
                <Ionicons name="alert-circle-outline" size={12} color={colors.mutedForeground} />
                <Text style={[rp.matchText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {threat.matchedMediaCount > 0
                    ? `${threat.matchedMediaCount} potential photo match${threat.matchedMediaCount !== 1 ? "es" : ""} · visual similarity detection`
                    : "Potential impersonation match · upgrade to view full details"}
                </Text>
              </View>
            </>
          ) : (
            /* Fallback — no threats yet, show a protective framing */
            <>
              <View style={rp.midRow}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[rp.username, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                     {isReviewerDemo ? "Sample Monitoring Preview" : "Identity Monitoring Active"}
                  </Text>
                  <Text style={[rp.findingText, { color: sColor, fontFamily: "Inter_600SemiBold" }]}>
                    {isReviewerDemo ? "No live scan results or discoveries" : "Periodic scan across connected platforms"}
                  </Text>
                </View>
                <View style={[rp.shieldIcon, { backgroundColor: sColor + "18", borderColor: sColor + "30" }]}>
                  <Ionicons name="shield-checkmark" size={22} color={sColor} />
                </View>
              </View>
              <View style={rp.matchRow}>
                <Ionicons name="eye-outline" size={12} color={colors.mutedForeground} />
                <Text style={[rp.matchText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {isReviewerDemo ? "Preview only · no social accounts queried" : "Searches X, Instagram, TikTok, Facebook & more"}
                </Text>
              </View>
            </>
          )}
        </View>
      </Animated.View>

      {/* Never imply there are hidden findings when this user has none. */}
      {threat && (
        <View style={{ position: "relative" }}>
          <View style={[rp.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={rp.topRow}>
              <View style={[rp.severityBadge, { backgroundColor: "#F59E0B18", borderColor: "#F59E0B33" }]}>
                <View style={[rp.severityDot, { backgroundColor: "#F59E0B" }]} />
                <Text style={[rp.severityText, { color: "#F59E0B", fontFamily: "Inter_700Bold" }]}>MORE MONITORING</Text>
              </View>
            </View>
            <View style={rp.midRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={[rp.redactBar, { width: "55%", backgroundColor: colors.mutedForeground + "25" }]} />
                <View style={[rp.redactBar, { width: "38%", backgroundColor: colors.mutedForeground + "18" }]} />
                <View style={[rp.redactBar, { width: "66%", backgroundColor: colors.mutedForeground + "15" }]} />
              </View>
            </View>
          </View>
          <View style={[rp.lockOverlay, { backgroundColor: colors.background + "D0" }]}>
            <View style={[rp.lockIcon, { backgroundColor: colors.border, borderColor: colors.border }]}>
              <Ionicons name="lock-closed" size={16} color={colors.mutedForeground} />
            </View>
            <Text style={[rp.lockText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              Premium adds continuous monitoring
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
const rp = StyleSheet.create({
  card:          { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  topRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  severityBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  severityDot:   { width: 5, height: 5, borderRadius: 3 },
  severityText:  { fontSize: 10, letterSpacing: 0.5 },
  scoreBadge:    { flexDirection: "row", alignItems: "baseline", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  scoreNum:      { fontSize: 17 },
  scoreDenom:    { fontSize: 11 },
  midRow:        { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  username:      { fontSize: 17 },
  platformDot:   { width: 7, height: 7, borderRadius: 3.5 },
  platformLabel: { fontSize: 12 },
  findingText:   { fontSize: 12, marginTop: 1 },
  matchRow:      { flexDirection: "row", alignItems: "center", gap: 5 },
  matchText:     { fontSize: 11, lineHeight: 16 },
  redactBar:     { height: 10, borderRadius: 5 },
  lockOverlay:   { ...StyleSheet.absoluteFillObject, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  lockIcon:      { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  lockText:      { fontSize: 13 },
  shieldIcon:    { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
});

// ─── Screen 0: Intro ──────────────────────────────────────────────────────────
function IntroScreen({ colors, onContinue, threatCount, isFromOnboarding, topPad, bottomPad, topThreat, isReviewerDemo }: {
  colors: ReturnType<typeof useColors>;
  onContinue: () => void;
  threatCount: number;
  isFromOnboarding: boolean;
  topPad: number;
  bottomPad: number;
  topThreat: ThreatSummary | null;
  isReviewerDemo: boolean;
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
        {isReviewerDemo && <ReviewerBillingPreviewNotice colors={colors} />}
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
            : "Protect your identity\nwith Rook Premium."}
        </Text>
      </View>

      {/* Center visual — real investigation report preview */}
      <View style={s0.center}>
        <Animated.View style={{ width: "100%", paddingHorizontal: 20, opacity: shieldAnim }}>
          <ReportPreview colors={colors} threat={topThreat} isReviewerDemo={isReviewerDemo} />
        </Animated.View>
      </View>

      {/* Bottom CTA */}
      <View style={[s0.bottom, { paddingBottom: bottomPad + 24 }]}>
        <View style={s0.noPayRow}>
          <Ionicons name="checkmark" size={16} color={colors.foreground} />
          <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>Review plans before purchase</Text>
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
  center:   { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  bottom:   { paddingHorizontal: 24, gap: 14 },
  noPayRow: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  cta:      { height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  ctaText:  { fontSize: 18 },
});

// ─── Screen 1: Trial Reminder ─────────────────────────────────────────────────
function ReminderScreen({ colors, onBack, onContinue, topPad, bottomPad, isTrialEligible, isReviewerDemo }: {
  colors: ReturnType<typeof useColors>;
  onBack: () => void;
  onContinue: () => void;
  topPad: number;
  bottomPad: number;
  isTrialEligible: boolean;
  isReviewerDemo: boolean;
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

      {/* Text — pinned to top of screen */}
      <View style={[s1.topText, { paddingTop: topPad + 72 }]}>
        {isReviewerDemo && <ReviewerBillingPreviewNotice colors={colors} />}
        <Text style={[s1.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {isTrialEligible ? "Your app store confirms\ntrial eligibility" : "Review your plan\nbefore purchase"}
        </Text>
        <Text style={[s1.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {isTrialEligible
            ? "Your introductory offer will be shown in the purchase sheet"
            : "Your app store will show the final price and terms"}
        </Text>
      </View>

      {/* Bell — true center of remaining space */}
      <View style={s1.bellCenter}>
        <View style={s1.bellWrap}>
          <Animated.View style={{ opacity: bellAnim, transform: [{ scale: bellAnim }] }}>
            <View style={[s1.bellBg, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Ionicons name="notifications" size={64} color={colors.foreground} />
            </View>
          </Animated.View>
          <Animated.View style={[s1.badge, { opacity: badgeAnim, transform: [{ scale: badgeAnim }] }]}>
            <Text style={[s1.badgeNum, { fontFamily: "Inter_700Bold" }]}>1</Text>
          </Animated.View>
        </View>
      </View>

      {/* Bottom CTA */}
      <View style={[s1.bottom, { paddingBottom: bottomPad + 24 }]}>
        <View style={s1.noPayRow}>
          <Ionicons name="checkmark" size={16} color={colors.foreground} />
          <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>Final terms appear before purchase</Text>
        </View>
        <TouchableOpacity style={[s1.cta, { backgroundColor: colors.foreground }]} onPress={onContinue} activeOpacity={0.88}>
          <Text style={[s1.ctaText, { color: colors.background, fontFamily: "Inter_700Bold" }]}>View Plans</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const s1 = StyleSheet.create({
  back:       { position: "absolute", left: 20, zIndex: 10 },
  backCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  // Text pinned to the top of the screen
  topText:    { paddingHorizontal: 28, gap: 10, alignItems: "center" },
  // Bell fills and centres in the remaining space between text and CTA
  bellCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  bellWrap:   { position: "relative", alignItems: "center", justifyContent: "center" },
  bellBg:     { width: 140, height: 140, borderRadius: 42, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  badge:      { position: "absolute", top: 4, right: 4, width: 36, height: 36, borderRadius: 18, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  badgeNum:   { color: "#fff", fontSize: 18 },
  title:      { fontSize: 30, textAlign: "center", lineHeight: 38 },
  sub:        { fontSize: 15, textAlign: "center" },
  bottom:     { paddingHorizontal: 24, gap: 14 },
  noPayRow:   { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  cta:        { height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  ctaText:    { fontSize: 18 },
});

// ─── Screen 2: Plan Select ────────────────────────────────────────────────────
function PlanSelectScreen({ colors, onBack, onContinue, billingCycle, setBillingCycle, isPurchasing, isRestoring, onRestore, getAnnualTotal, getMonthlyPrice, topPad, bottomPad, restoreMsg, isOfferingAvailable, isTrialEligible, isLoadingOffering, isReviewerDemo }: {
  colors: ReturnType<typeof useColors>;
  onBack: () => void;
  onContinue: () => void;
  billingCycle: BillingCycle;
  setBillingCycle: (c: BillingCycle) => void;
  isPurchasing: boolean;
  isRestoring: boolean;
  onRestore: () => void;
  getAnnualTotal: () => string;
  getMonthlyPrice: () => string;
  topPad: number;
  bottomPad: number;
  restoreMsg: string | null;
  isOfferingAvailable: boolean;
  isTrialEligible: boolean;
  isLoadingOffering: boolean;
  isReviewerDemo: boolean;
}) {
  const annualTotal = getAnnualTotal();
  const monthlyPrice = getMonthlyPrice();

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>

      {/* Hero — pre-cropped image, aspect-ratio container, instant display */}
      <View style={s2.heroWrap} pointerEvents="none">
        <RNImage
          source={require("../assets/images/paywall-hero-cropped.jpg")}
          style={s2.heroImage}
          resizeMode="cover"
          fadeDuration={0}
        />
        <LinearGradient
          colors={["transparent", colors.background + "C8", colors.background]}
          locations={[0.45, 0.82, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Back — floats over the hero */}
      <TouchableOpacity style={[s2.back, { top: topPad + 16 }]} onPress={onBack} activeOpacity={0.7}>
        <View style={[s2.backCircle, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </View>
      </TouchableOpacity>

      {/* Main content scrolls up from below the hero */}
      <View style={[s2.body, { paddingBottom: bottomPad + 24 }]}>
        {isReviewerDemo && (
          <ReviewerBillingPreviewNotice colors={colors} />
        )}
        <Text style={[s2.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Start your Rook Premium{"\n"}protection plan
        </Text>

        {/* Plan cards */}
        <View style={{ gap: 10 }}>
          {/* Annual — default */}
          <TouchableOpacity
            style={[s2.planCard, { backgroundColor: colors.card, borderColor: billingCycle === "annual" ? colors.foreground : colors.border, borderWidth: billingCycle === "annual" ? 2 : 1 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBillingCycle("annual"); }}
            activeOpacity={0.85}
          >
            {isTrialEligible && (
              <View style={[s2.planTag, { backgroundColor: colors.foreground }]}>
                <Text style={[{ color: colors.background, fontFamily: "Inter_700Bold", fontSize: 11 }]}>INTRO OFFER AVAILABLE</Text>
              </View>
            )}
            <View style={s2.planRow}>
              <View style={[s2.check, { backgroundColor: billingCycle === "annual" ? colors.foreground : "transparent", borderColor: billingCycle === "annual" ? colors.foreground : colors.mutedForeground + "60" }]}>
                {billingCycle === "annual" && <Ionicons name="checkmark" size={15} color={colors.background} />}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }]}>
                  Annual
                </Text>
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }]}>
                  {annualTotal} billed annually
                </Text>
              </View>
              <Text style={[{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }]}>{annualTotal}</Text>
            </View>
          </TouchableOpacity>

          {/* Monthly */}
          <TouchableOpacity
            style={[s2.planCard, { backgroundColor: colors.card, borderColor: billingCycle === "monthly" ? colors.foreground : colors.border, borderWidth: billingCycle === "monthly" ? 2 : 1 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBillingCycle("monthly"); }}
            activeOpacity={0.85}
          >
            <View style={s2.planRow}>
              <View style={[s2.check, { backgroundColor: billingCycle === "monthly" ? colors.foreground : "transparent", borderColor: billingCycle === "monthly" ? colors.foreground : colors.mutedForeground + "60" }]}>
                {billingCycle === "monthly" && <Ionicons name="checkmark" size={15} color={colors.background} />}
              </View>
              <Text style={[{ flex: 1, color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15 }]}>Monthly</Text>
              <Text style={[{ color: billingCycle === "monthly" ? colors.foreground : colors.mutedForeground, fontFamily: billingCycle === "monthly" ? "Inter_700Bold" : "Inter_400Regular", fontSize: 16 }]}>
                {monthlyPrice}/mo
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[s2.cta, { backgroundColor: colors.foreground, opacity: isPurchasing || !isOfferingAvailable ? 0.5 : 1 }]}
          onPress={onContinue}
          disabled={isPurchasing || !isOfferingAvailable}
          activeOpacity={0.88}
        >
          {isPurchasing
            ? <ActivityIndicator color={colors.background} size="small" />
            : <Text style={[s2.ctaText, { color: colors.background, fontFamily: "Inter_700Bold" }]}>
                {isOfferingAvailable ? "Continue" : isLoadingOffering ? "Loading plans…" : "Plans unavailable"}
              </Text>}
        </TouchableOpacity>
        {!isOfferingAvailable && (
          <Text style={[s2.finePrint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            We can’t load the approved App Store or Google Play plans right now. Checkout is unavailable; please try again later.
          </Text>
        )}

        {/* Fine print */}
        <Text style={[s2.finePrint, { color: colors.mutedForeground + "99", fontFamily: "Inter_400Regular" }]}>
          {isTrialEligible
            ? "Your app store will confirm your introductory offer, exact price, and first charge date before purchase."
            : billingCycle === "annual"
              ? `${annualTotal} billed annually. Renews automatically unless cancelled in your app store.`
              : `${monthlyPrice} billed monthly. Renews automatically unless cancelled in your app store.`}
        </Text>

        {/* Links */}
        <View style={s2.links}>
          <TouchableOpacity onPress={onRestore} disabled={isRestoring}>
            {isRestoring
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={[s2.link, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Restore</Text>}
          </TouchableOpacity>
          <Text style={[{ color: colors.mutedForeground + "60" }]}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL("https://tryrook.app/terms")}>
            <Text style={[s2.link, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Terms</Text>
          </TouchableOpacity>
          <Text style={[{ color: colors.mutedForeground + "60" }]}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL("https://tryrook.app/privacy")}>
            <Text style={[s2.link, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Privacy</Text>
          </TouchableOpacity>
        </View>
        {restoreMsg && (
          <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" }]}>{restoreMsg}</Text>
        )}
      </View>
    </View>
  );
}
const s2 = StyleSheet.create({
  // In-flow hero: aspect-ratio matches the pre-cropped 800×1056 image exactly → cover fills with no clipping
  heroWrap:  { width: "100%", aspectRatio: 800 / 1056, overflow: "hidden" },
  heroImage: { width: "100%", height: "100%" },
  back:      { position: "absolute", left: 20, zIndex: 10 },
  backCircle:  { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  body:        { flex: 1, paddingHorizontal: 22, gap: 16, justifyContent: "flex-end" },
  title:       { fontSize: 28, lineHeight: 36, textAlign: "center" },
  planCard:    { borderRadius: 18, padding: 16, gap: 10 },
  planTag:     { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  planRow:     { flexDirection: "row", alignItems: "center", gap: 14 },
  check:       { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  cta:         { height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  ctaText:     { fontSize: 18 },
  finePrint:   { fontSize: 11, textAlign: "center", lineHeight: 17 },
  links:       { flexDirection: "row", gap: 12, justifyContent: "center", alignItems: "center" },
  link:        { fontSize: 13 },
});

// ─── Already Subscribed ───────────────────────────────────────────────────────
function ManageScreen({ colors, tier, onClose, topPad, isReviewerDemo }: {
  colors: ReturnType<typeof useColors>;
  tier: string;
  onClose: () => void;
  topPad: number;
  isReviewerDemo: boolean;
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
        {isReviewerDemo && (
          <>
            <ReviewerDemoBanner message="Demo product data · this shows your actual store entitlement." />
            <Text style={[{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center", lineHeight: 19 }]}>
              Use TestFlight to review real StoreKit sandbox purchase and Restore flows. The demo does not alter your actual entitlement.
            </Text>
          </>
        )}
        <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center", lineHeight: 23 }]}>
          Rook periodically scans for potential misuse of your identity across connected platforms.
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
  const { user: clerkUser } = useUser();
  const colors      = useColors();
  const insets      = useSafeAreaInsets();
  const { user, completeOnboarding, refreshData, isReviewerDemo } = useApp();
  const { fromOnboarding, threatCount: rawThreatCount } = useLocalSearchParams<{
    fromOnboarding?: string;
    threatCount?: string;
  }>();

  const isFromOnboarding = fromOnboarding === "1";
  const threatCount      = isReviewerDemo ? 0 : parseInt(rawThreatCount ?? "0", 10) || 0;
  const topPad           = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad        = Platform.OS === "web" ? 34 : insets.bottom;

  const {
    offerings,
    isPurchasing,
    isLoading: rcIsLoading,
    purchase,
    restore,
    isRestoring,
    isTrialEligible,
    trialEligibleProductIds,
  } = useSubscription();
  const [paywallStep, setPaywallStep]   = useState(0);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("annual");
  const [confirmPkg, setConfirmPkg]     = useState<PurchasesPackage | null>(null);
  const [restoreMsg, setRestoreMsg]     = useState<string | null>(null);
  const [topThreat, setTopThreat]       = useState<ThreatSummary | null>(null);
  const [serverTier, setServerTier]     = useState<string | null>(null);
  const [subscriptionCheckDone, setSubscriptionCheckDone] = useState(false);

  // The paywall can be reached directly from onboarding before AppContext's
  // background refresh has populated user.tier. Hydrate the authoritative
  // server subscription here so reviewer/test accounts that were granted
  // Premium do not see a stale purchase screen.
  useEffect(() => {
    let cancelled = false;
    const safetyTimer = setTimeout(() => {
      if (cancelled) return;
      setServerTier((tier) => tier ?? "free");
      setSubscriptionCheckDone(true);
    }, 9_000);

    getSubscription()
      .then((subscription) => {
        if (cancelled) return;
        clearTimeout(safetyTimer);
        setServerTier(subscription.tier);
        setSubscriptionCheckDone(true);
      })
      .catch(() => {
        if (!cancelled) {
          clearTimeout(safetyTimer);
          setServerTier((tier) => tier ?? "free");
          setSubscriptionCheckDone(true);
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, []);

  // Fetch the user's most severe real threat for Screen 0 preview.
  // We only do this once on mount; failure is silently swallowed — the fallback
  // card shows instead of a fake finding.
  useEffect(() => {
    if (isReviewerDemo) {
      setTopThreat(null);
      return;
    }
    if (isFromOnboarding && threatCount === 0) {
      setTopThreat(null);
      return;
    }
    let cancelled = false;
    listThreats({ resolved: false, limit: 5 })
      .then((threats) => {
        if (cancelled || !threats?.length) return;
        // Pick highest severity then highest score
        const order: Record<string, number> = { high: 3, medium: 2, low: 1 };
        const best = [...threats].sort((a, b) => {
          const sevDiff = (order[b.severity] ?? 0) - (order[a.severity] ?? 0);
          return sevDiff !== 0 ? sevDiff : b.threatScore - a.threatScore;
        })[0];
        setTopThreat(best ?? null);
      })
      .catch(() => { /* silently fall back to generic card */ });
    return () => { cancelled = true; };
  }, [isFromOnboarding, threatCount, isReviewerDemo]);

  const currentTier = (serverTier ?? user.tier ?? "free") as string;
  const alreadySubscribed = currentTier !== "free";

  // ── Package resolution ────────────────────────────────────────────────────
  const validatedOffering = getValidatedPremiumOffering(offerings);
  const isSelectedPlanTrialEligible = billingCycle === "annual"
    ? trialEligibleProductIds.includes("premium_annual_v2")
    : trialEligibleProductIds.includes("premium_monthly_v2");
  const getPremiumPackage = useCallback((cycle: BillingCycle): PurchasesPackage | null => {
    if (!validatedOffering) return null;
    return cycle === "annual" ? validatedOffering.annual : validatedOffering.monthly;
  }, [validatedOffering]);

  const getAnnualTotal = useCallback((): string => {
    const pkg = getPremiumPackage("annual");
    return pkg?.product?.priceString ?? "—";
  }, [getPremiumPackage]);

  const getMonthlyPrice = useCallback((): string => {
    const pkg = getPremiumPackage("monthly");
    return pkg?.product?.priceString ?? "—";
  }, [getPremiumPackage]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (isFromOnboarding) { completeOnboarding(); router.replace("/(tabs)" as any); }
    else { router.back(); }
  }, [isFromOnboarding, completeOnboarding]);

  const handleStep0Continue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // On the high-urgency threat path skip the trial-reminder screen (step 1)
    // and jump straight to plan select (step 2) to minimise clicks at peak intent.
    if (isFromOnboarding && threatCount > 0) {
      setPaywallStep(2);
    } else {
      setPaywallStep(1);
    }
  }, [isFromOnboarding, threatCount]);

  const handleStep1Continue = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Request notification permission (fires native prompt, no-op if already granted/denied)
    if (!isReviewerDemo) {
      try { await Notifications.requestPermissionsAsync(); } catch { /* graceful */ }
    }
    setPaywallStep(2);
  }, [isReviewerDemo]);

  const handleStep2Continue = useCallback(() => {
    const pkg = getPremiumPackage(billingCycle);
    if (!pkg) {
      Alert.alert(
        "Plans unavailable",
        "The approved subscription plans could not be loaded. Checkout is unavailable; please try again later.",
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConfirmPkg(pkg);
  }, [billingCycle, getPremiumPackage]);

  const handleConfirmPurchase = useCallback(async () => {
    if (!confirmPkg) return;
    setConfirmPkg(null);
    try {
      if (!clerkUser?.id) throw new Error("Please sign in before purchasing.");
      await identifyRevenueCatUser(clerkUser.id);
      await purchase(confirmPkg);
      await refreshData();
      if (isFromOnboarding) { completeOnboarding(); router.replace("/(tabs)" as any); }
      else { router.back(); }
    } catch (err: unknown) {
      const purchaseError = err as { userCancelled?: boolean; message?: string };
      if (purchaseError.userCancelled) return;
      Alert.alert(
        "Purchase not completed",
        purchaseError.message ?? "The App Store or Google Play purchase could not be completed. Please try again.",
      );
    }
  }, [confirmPkg, clerkUser?.id, purchase, refreshData, isFromOnboarding, completeOnboarding]);

  const handleRestore = useCallback(async () => {
    try {
      if (!clerkUser?.id) throw new Error("Please sign in before restoring purchases.");
      await identifyRevenueCatUser(clerkUser.id);
      const restoredInfo = await restore();
      const hasRestoredPremium = !!(
        restoredInfo.entitlements.active.premium ||
        restoredInfo.entitlements.active.pro
      );
      if (hasRestoredPremium) {
        await refreshData();
        setRestoreMsg("Your Rook Premium purchases were restored.");
      } else {
        setRestoreMsg("No active Rook Premium purchases were found for this store account.");
      }
    } catch (err: unknown) {
      const restoreError = err as { message?: string };
      setRestoreMsg(restoreError.message ?? "Unable to restore purchases. Please try again.");
    }
    setTimeout(() => setRestoreMsg(null), 3000);
  }, [clerkUser?.id, restore, refreshData]);

  if (!subscriptionCheckDone && currentTier === "free") {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 14 }]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 15 }}>
          Checking your Rook plan…
        </Text>
      </View>
    );
  }

  // ── Already subscribed ────────────────────────────────────────────────────
  if (alreadySubscribed) {
    return <ManageScreen colors={colors} tier={currentTier} onClose={handleClose} topPad={topPad} isReviewerDemo={isReviewerDemo} />;
  }

  // Release builds fail explicitly if the billing SDK is unavailable.
  if (!isRevenueCatConfigured && !__DEV__) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 28 }]}>
        <LinearGradient colors={[colors.primary + "20", "transparent"]} style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={{ position: "absolute", top: topPad + 16, right: 20 }} onPress={handleClose}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[{ width: 80, height: 80, borderRadius: 24, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center", marginBottom: 20 }]}>
          <Ionicons name="shield-checkmark" size={40} color={colors.primary} />
        </View>
        <Text style={[{ fontSize: 24, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center", marginBottom: 12 }]}>Subscriptions Coming Soon</Text>
        <Text style={[{ fontSize: 15, color: colors.mutedForeground, textAlign: "center", lineHeight: 23 }]}>In-app purchases are being configured.{"\n"}Check back soon.</Text>
      </View>
    );
  }

  // ── 3-screen paywall ──────────────────────────────────────────────────────
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
          topThreat={topThreat}
          isReviewerDemo={isReviewerDemo}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isFromOnboarding ? "Continue with free plan" : "Close"}
          style={{ position: "absolute", top: topPad + 16, right: 20, zIndex: 20 }}
          onPress={handleClose}
        >
          <View style={[{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" }]}>
            <Ionicons name="close" size={18} color="#fff" />
          </View>
        </TouchableOpacity>
      </>
    );
  }

  if (paywallStep === 1) {
    return (
      <ReminderScreen
        colors={colors}
        onBack={() => setPaywallStep(0)}
        onContinue={handleStep1Continue}
        topPad={topPad}
        bottomPad={bottomPad}
        isTrialEligible={isTrialEligible}
        isReviewerDemo={isReviewerDemo}
      />
    );
  }

  return (
    <>
      <PlanSelectScreen
        colors={colors}
        onBack={() => setPaywallStep(isFromOnboarding && threatCount > 0 ? 0 : 1)}
        onContinue={handleStep2Continue}
        billingCycle={billingCycle}
        setBillingCycle={setBillingCycle}
        isPurchasing={isPurchasing}
        isRestoring={isRestoring}
        onRestore={handleRestore}
        getAnnualTotal={getAnnualTotal}
        getMonthlyPrice={getMonthlyPrice}
        topPad={topPad}
        bottomPad={bottomPad}
        restoreMsg={restoreMsg}
        isOfferingAvailable={!!validatedOffering}
        isTrialEligible={isSelectedPlanTrialEligible}
        isLoadingOffering={rcIsLoading}
        isReviewerDemo={isReviewerDemo}
      />
      <ConfirmModal
        visible={!!confirmPkg}
        pkg={confirmPkg}
        onConfirm={handleConfirmPurchase}
        onCancel={() => setConfirmPkg(null)}
      />
    </>
  );
}
