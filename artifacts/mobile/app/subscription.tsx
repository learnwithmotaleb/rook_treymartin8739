/**
 * Subscription / Paywall — CalAI-style 3-screen flow
 *
 * Screen 0: Intro — "We want to protect your identity, free."
 * Screen 1: Reminder — "We'll alert you before your trial ends"
 * Screen 2: Plan select — Annual (default) vs Monthly + checkout
 *
 * Pricing strategy (best margin per operating cost):
 *   Premium Annual  — $49.99/year ($4.17/mo) | 7-day free trial | SAVE 68%
 *   Premium Monthly — $12.99/month            | 7-day free trial
 *
 * RevenueCat package prices override fallbacks when available.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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
import { useSubscription, isRevenueCatConfigured } from "@/lib/revenuecat";
import { syncSubscriptionTier } from "@/lib/api";

type BillingCycle = "annual" | "monthly";

const FALLBACK = {
  annual: { perMonth: "$4.17", total: "$49.99", savings: "68%" },
  monthly: { perMonth: "$12.99" },
  trialDays: 7,
};

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
          <Text style={[cm.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Start Your Free Trial</Text>
          <Text style={[cm.product, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {pkg.product.title || "Rook Premium"}
          </Text>
          <Text style={[cm.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {FALLBACK.trialDays} days free, then {pkg.product.priceString}{isAnnual ? "/year" : "/month"}
          </Text>
          <Text style={[cm.note, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            No charge until your trial ends. Cancel anytime in your device's subscription settings — at least 24 hours before renewal.
          </Text>
          <TouchableOpacity style={[cm.confirmBtn, { backgroundColor: colors.foreground }]} onPress={onConfirm} activeOpacity={0.85}>
            <Text style={[cm.confirmText, { color: colors.background, fontFamily: "Inter_700Bold" }]}>Start Free Trial</Text>
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
              {threatCount} threat{threatCount !== 1 ? "s" : ""} detected
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

// ─── Screen 2: Plan Select ────────────────────────────────────────────────────
function PlanSelectScreen({ colors, onBack, onContinue, billingCycle, setBillingCycle, isPurchasing, isRestoring, onRestore, getAnnualTotal, getMonthlyPrice, topPad, bottomPad, restoreMsg }: {
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
}) {
  const annualTotal = getAnnualTotal();
  const monthlyPrice = getMonthlyPrice();

  const annualPerMonth = (() => {
    const match = annualTotal.replace(/[^0-9.]/g, "");
    const num = parseFloat(match);
    return isNaN(num) ? FALLBACK.annual.perMonth : `$${(num / 12).toFixed(2)}`;
  })();

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      {/* Hero gradient */}
      <LinearGradient
        colors={[colors.primary + "28", colors.primary + "10", "transparent"]}
        style={[s2.hero]}
        locations={[0, 0.5, 1]}
      />
      <View style={[s2.heroContent, { paddingTop: topPad + 20 }]}>
        <View style={[s2.heroIcon, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "44" }]}>
          <Ionicons name="shield-checkmark" size={44} color={colors.primary} />
        </View>
      </View>

      {/* Back */}
      <TouchableOpacity style={[s2.back, { top: topPad + 16 }]} onPress={onBack} activeOpacity={0.7}>
        <View style={[s2.backCircle, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </View>
      </TouchableOpacity>

      {/* Main content */}
      <View style={[s2.body, { paddingBottom: bottomPad + 24 }]}>
        <Text style={[s2.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Start your {FALLBACK.trialDays}-day free{"\n"}trial to continue
        </Text>

        {/* Plan cards */}
        <View style={{ gap: 10 }}>
          {/* Annual — default */}
          <TouchableOpacity
            style={[s2.planCard, { backgroundColor: colors.card, borderColor: billingCycle === "annual" ? colors.foreground : colors.border, borderWidth: billingCycle === "annual" ? 2 : 1 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBillingCycle("annual"); }}
            activeOpacity={0.85}
          >
            {/* "7 DAYS FREE" badge */}
            <View style={[s2.planTag, { backgroundColor: colors.foreground }]}>
              <Text style={[{ color: colors.background, fontFamily: "Inter_700Bold", fontSize: 11 }]}>{FALLBACK.trialDays} DAYS FREE</Text>
            </View>
            <View style={s2.planRow}>
              <View style={[s2.check, { backgroundColor: billingCycle === "annual" ? colors.foreground : "transparent", borderColor: billingCycle === "annual" ? colors.foreground : colors.mutedForeground + "60" }]}>
                {billingCycle === "annual" && <Ionicons name="checkmark" size={15} color={colors.background} />}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }]}>
                  Start for free & save {FALLBACK.annual.savings}
                </Text>
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }]}>
                  {annualTotal} billed annually
                </Text>
              </View>
              <Text style={[{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }]}>{annualPerMonth}/mo</Text>
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
          style={[s2.cta, { backgroundColor: colors.foreground, opacity: isPurchasing ? 0.7 : 1 }]}
          onPress={onContinue}
          disabled={isPurchasing}
          activeOpacity={0.88}
        >
          {isPurchasing
            ? <ActivityIndicator color={colors.background} size="small" />
            : <Text style={[s2.ctaText, { color: colors.background, fontFamily: "Inter_700Bold" }]}>Continue</Text>}
        </TouchableOpacity>

        {/* Fine print */}
        <Text style={[s2.finePrint, { color: colors.mutedForeground + "99", fontFamily: "Inter_400Regular" }]}>
          {billingCycle === "annual"
            ? `${FALLBACK.trialDays} days free, then ${annualTotal} per year.\nBilled annually and renews automatically unless cancelled in the App Store.`
            : `${FALLBACK.trialDays} days free, then ${monthlyPrice} per month.\nRenews automatically unless cancelled in the App Store.`}
        </Text>

        {/* Links */}
        <View style={s2.links}>
          <TouchableOpacity onPress={onRestore} disabled={isRestoring}>
            {isRestoring
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={[s2.link, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Restore</Text>}
          </TouchableOpacity>
          <Text style={[{ color: colors.mutedForeground + "60" }]}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL("https://rook.app/terms")}>
            <Text style={[s2.link, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Terms</Text>
          </TouchableOpacity>
          <Text style={[{ color: colors.mutedForeground + "60" }]}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL("https://rook.app/privacy")}>
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
  hero:        { position: "absolute", top: 0, left: 0, right: 0, height: 180 },
  heroContent: { alignItems: "center", paddingBottom: 16 },
  heroIcon:    { width: 100, height: 100, borderRadius: 30, alignItems: "center", justifyContent: "center", borderWidth: 1, marginTop: 40 },
  back:        { position: "absolute", left: 20, zIndex: 10 },
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
          {tier.charAt(0).toUpperCase() + tier.slice(1)} — Active
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

  const { offerings, tier: rcTier, isPurchasing, isLoading: rcIsLoading, purchase, restore, isRestoring } = useSubscription();
  const [paywallStep, setPaywallStep]   = useState(0);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("annual");
  const [confirmPkg, setConfirmPkg]     = useState<PurchasesPackage | null>(null);
  const [restoreMsg, setRestoreMsg]     = useState<string | null>(null);
  const [devUpgrading, setDevUpgrading] = useState(false);

  const currentTier = (user.tier ?? "free") as string;
  const alreadySubscribed = currentTier !== "free";

  // ── Package resolution ────────────────────────────────────────────────────
  const getPremiumPackage = useCallback((cycle: BillingCycle): PurchasesPackage | null => {
    const offering = offerings?.all["premium"] ?? offerings?.current ?? null;
    if (!offering) return null;
    if (cycle === "annual") return offering.annual ?? offering.availablePackages.find((p) => p.packageType === "ANNUAL") ?? null;
    return offering.monthly ?? offering.availablePackages.find((p) => p.packageType === "MONTHLY") ?? null;
  }, [offerings]);

  const getAnnualTotal = useCallback((): string => {
    const pkg = getPremiumPackage("annual");
    return pkg?.product?.priceString ?? FALLBACK.annual.total;
  }, [getPremiumPackage]);

  const getMonthlyPrice = useCallback((): string => {
    const pkg = getPremiumPackage("monthly");
    return pkg?.product?.priceString ?? FALLBACK.monthly.perMonth;
  }, [getPremiumPackage]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (isFromOnboarding) { completeOnboarding(); router.replace("/(tabs)" as any); }
    else { router.back(); }
  }, [isFromOnboarding, completeOnboarding]);

  const handleStep0Continue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPaywallStep(1);
  }, []);

  const handleStep1Continue = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Request notification permission (fires native prompt, no-op if already granted/denied)
    try { await Notifications.requestPermissionsAsync(); } catch { /* graceful */ }
    setPaywallStep(2);
  }, []);

  const handleDevUpgrade = useCallback(async () => {
    setDevUpgrading(true);
    try {
      await syncSubscriptionTier("premium");
      await refreshData();
      Alert.alert("✓ Dev Mode", "Plan set to Premium");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed");
    } finally {
      setDevUpgrading(false);
    }
  }, [refreshData]);

  const handleStep2Continue = useCallback(() => {
    const pkg = getPremiumPackage(billingCycle);
    if (!pkg) {
      if (__DEV__) { handleDevUpgrade(); return; }
      Alert.alert("Store not available", "In-app purchases require the App Store or Google Play.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConfirmPkg(pkg);
  }, [billingCycle, getPremiumPackage, handleDevUpgrade]);

  const handleConfirmPurchase = useCallback(async () => {
    if (!confirmPkg) return;
    setConfirmPkg(null);
    try {
      await purchase(confirmPkg);
      await refreshData();
      if (isFromOnboarding) { completeOnboarding(); router.replace("/(tabs)" as any); }
      else { router.back(); }
    } catch (err: any) {
      if (err?.userCancelled) return;
    }
  }, [confirmPkg, purchase, refreshData, isFromOnboarding, completeOnboarding]);

  const handleRestore = useCallback(async () => {
    try {
      await restore();
      await refreshData();
      setRestoreMsg("Purchases restored.");
    } catch {
      setRestoreMsg("Nothing to restore.");
    }
    setTimeout(() => setRestoreMsg(null), 3000);
  }, [restore, refreshData]);

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
        />
        {/* Always show close on intro for users reaching paywall from settings */}
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

  return (
    <>
      <PlanSelectScreen
        colors={colors}
        onBack={() => setPaywallStep(1)}
        onContinue={handleStep2Continue}
        billingCycle={billingCycle}
        setBillingCycle={setBillingCycle}
        isPurchasing={isPurchasing || devUpgrading}
        isRestoring={isRestoring}
        onRestore={handleRestore}
        getAnnualTotal={getAnnualTotal}
        getMonthlyPrice={getMonthlyPrice}
        topPad={topPad}
        bottomPad={bottomPad}
        restoreMsg={restoreMsg}
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
