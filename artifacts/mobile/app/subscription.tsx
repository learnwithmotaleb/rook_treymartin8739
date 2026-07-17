/**
 * Subscription / Paywall screen — CalAI-style single-focus design
 *
 * - Clean, uncluttered single-plan paywall
 * - Monthly / Annual toggle
 * - One prominent CTA
 * - Urgency variant when arriving from onboarding (fromOnboarding=1)
 * - All RevenueCat purchase logic preserved
 */

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import type { PurchasesPackage } from "react-native-purchases";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Platform as SocialPlatform } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { PlatformIcon } from "@/components/PlatformIcon";
import { useSubscription, isRevenueCatConfigured } from "@/lib/revenuecat";
import { syncSubscriptionTier } from "@/lib/api";

type Tier = "free" | "pro" | "premium";
type Cycle = "monthly" | "yearly";

const FALLBACK_PRICES = {
  pro:     { monthly: "$14.99", yearlyPerMonth: "$9.99",  yearlyTotal: "$119.88" },
  premium: { monthly: "$24.99", yearlyPerMonth: "$16.99", yearlyTotal: "$203.88" },
};

const FEATURES = [
  { icon: "scan-circle",        text: "Continuous monitoring across all platforms" },
  { icon: "notifications",      text: "Instant alerts the moment a threat is detected" },
  { icon: "shield-checkmark",   text: "Takedown request assistance" },
  { icon: "analytics",          text: "Full threat history & AI risk analysis" },
];

// ─── Confirm purchase modal ──────────────────────────────────────────────────
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
          <View style={[cm.shieldRow]}>
            <View style={[cm.shieldIcon, { backgroundColor: colors.primary + "18" }]}>
              <Ionicons name="shield-checkmark" size={28} color={colors.primary} />
            </View>
          </View>
          <Text style={[cm.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Start Your Free Trial
          </Text>
          <Text style={[cm.product, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {pkg.product.title || "Rook Pro"}
          </Text>
          <Text style={[cm.price, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            7 days free, then {pkg.product.priceString}{isAnnual ? "/year" : "/month"}
          </Text>
          <Text style={[cm.note, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Your free trial begins today. You will not be charged until the trial ends. Cancel anytime from your device's subscription settings — at least 24 hours before renewal.
          </Text>
          <TouchableOpacity style={[cm.confirmBtn, { backgroundColor: colors.primary }]} onPress={onConfirm} activeOpacity={0.85}>
            <Text style={[cm.confirmText, { fontFamily: "Inter_700Bold" }]}>Start Free Trial</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} style={cm.cancelBtn}>
            <Text style={[cm.cancelText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
const cm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 28, gap: 10 },
  shieldRow: { alignItems: "center", marginBottom: 4 },
  shieldIcon: { width: 60, height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, textAlign: "center" },
  product: { fontSize: 15, textAlign: "center" },
  price: { fontSize: 14, textAlign: "center" },
  note: { fontSize: 12, textAlign: "center", lineHeight: 18, opacity: 0.85 },
  confirmBtn: { height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", marginTop: 6 },
  confirmText: { color: "#fff", fontSize: 16 },
  cancelBtn: { alignItems: "center", paddingVertical: 8 },
  cancelText: { fontSize: 14 },
});

// ─── Urgency result cards (from onboarding scan) ──────────────────────────────
function UrgencyResultCards({ colors, threatCount }: { colors: ReturnType<typeof useColors>; threatCount: number }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.02, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
    ])).start();
  }, []);

  const MOCK: Array<{ platform: NonNullable<SocialPlatform>; label: string }> = [
    { platform: "instagram", label: "Account flagged" },
    { platform: "facebook",  label: "Potential match" },
    { platform: "x",         label: "Suspicious activity" },
  ];
  const cards = MOCK.slice(0, Math.min(3, Math.max(2, threatCount)));

  return (
    <View style={{ gap: 8 }}>
      {cards.map((card, i) => (
        <Animated.View key={i} style={{ transform: i === 0 ? [{ scale: pulse }] : [] }}>
          <View style={[uc.card, { backgroundColor: colors.card, borderColor: i === 0 ? "#EF444444" : colors.border }]}>
            <View style={[uc.platBadge, { backgroundColor: colors.secondary }]}>
              <PlatformIcon platform={card.platform} size={20} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>{card.label}</Text>
              <View style={[{ height: 8, width: 100, borderRadius: 4, backgroundColor: colors.mutedForeground + "28" }]} />
              <View style={[{ height: 8, width: 65, borderRadius: 4, backgroundColor: colors.mutedForeground + "18" }]} />
            </View>
            <View style={[uc.lock, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Ionicons name="lock-closed" size={13} color={colors.mutedForeground} />
            </View>
          </View>
        </Animated.View>
      ))}
      <View style={[uc.more, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Ionicons name="ellipsis-horizontal" size={14} color={colors.mutedForeground} />
        <Text style={[{ flex: 1, color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }]}>
          Unlock to see full details and take action
        </Text>
        <Ionicons name="lock-closed" size={12} color={colors.mutedForeground} />
      </View>
    </View>
  );
}
const uc = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  platBadge: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  lock: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  more: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
});

// ─── Main Paywall ─────────────────────────────────────────────────────────────
export default function Subscription() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, completeOnboarding, refreshData } = useApp();
  const { fromOnboarding, fromScan, threatCount: rawThreatCount } = useLocalSearchParams<{
    fromOnboarding?: string;
    fromScan?: string;
    threatCount?: string;
  }>();
  const isFromOnboarding = fromOnboarding === "1";
  const threatCount = parseInt(rawThreatCount ?? "0", 10) || 0;

  const { offerings, tier: rcTier, isPurchasing, isLoading: rcIsLoading, purchase, restore, isRestoring } = useSubscription();
  const [billingCycle, setBillingCycle] = useState<Cycle>("monthly");
  const [confirmPkg, setConfirmPkg] = useState<PurchasesPackage | null>(null);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [devUpgrading, setDevUpgrading] = useState(false);
  const [activeTier, setActiveTier] = useState<"pro" | "premium">("pro");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const currentTier = (user.tier ?? "free") as Tier;
  const alreadySubscribed = currentTier !== "free";

  const getPackage = (tier: "pro" | "premium", cycle: Cycle): PurchasesPackage | null => {
    const offering = offerings?.all[tier];
    if (!offering) return null;
    if (cycle === "yearly") return offering.annual ?? offering.availablePackages.find((p) => p.packageType === "ANNUAL") ?? null;
    return offering.monthly ?? offering.availablePackages.find((p) => p.packageType === "MONTHLY") ?? null;
  };

  const getDisplayPrice = (tier: "pro" | "premium"): string => {
    const pkg = getPackage(tier, billingCycle);
    if (pkg) {
      if (billingCycle === "yearly") return `$${(pkg.product.price / 12).toFixed(2)}`;
      return pkg.product.priceString;
    }
    return billingCycle === "yearly" ? FALLBACK_PRICES[tier].yearlyPerMonth : FALLBACK_PRICES[tier].monthly;
  };

  const getYearlyTotal = (tier: "pro" | "premium"): string => {
    const pkg = getPackage(tier, "yearly");
    if (pkg) return pkg.product.priceString;
    return FALLBACK_PRICES[tier].yearlyTotal;
  };

  const handleDevUpgrade = async () => {
    setDevUpgrading(true);
    try {
      await syncSubscriptionTier(activeTier);
      await refreshData();
      Alert.alert("✓ Dev Mode", `Plan set to ${activeTier}`);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed");
    } finally {
      setDevUpgrading(false);
    }
  };

  const handleSubscribe = () => {
    const pkg = getPackage(activeTier, billingCycle);
    if (!pkg) {
      if (__DEV__) { handleDevUpgrade(); return; }
      Alert.alert("Store not available", "In-app purchases require the App Store or Google Play.", [{ text: "OK" }]);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConfirmPkg(pkg);
  };

  const handleConfirmPurchase = async () => {
    if (!confirmPkg) return;
    setConfirmPkg(null);
    try {
      await purchase(confirmPkg);
      await refreshData();
      // Navigate to tabs after successful purchase
      if (isFromOnboarding) {
        completeOnboarding();
        router.replace("/(tabs)" as any);
      } else {
        router.back();
      }
    } catch (err: any) {
      if (err?.userCancelled) return;
    }
  };

  const handleRestore = async () => {
    try {
      await restore();
      await refreshData();
      setRestoreMsg("Purchases restored successfully.");
    } catch {
      setRestoreMsg("Nothing to restore, or an error occurred.");
    }
    setTimeout(() => setRestoreMsg(null), 3000);
  };

  const handleClose = () => {
    if (isFromOnboarding) {
      completeOnboarding();
      router.replace("/(tabs)" as any);
    } else {
      router.back();
    }
  };

  const handleManageSubscription = () => {
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

  // ── RC not configured ────────────────────────────────────────────────────────
  if (!isRevenueCatConfigured) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 32 }]}>
        <LinearGradient colors={[colors.primary + "22", "transparent"]} style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={{ position: "absolute", top: topPad + 16, right: 20 }} onPress={handleClose}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[{ width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary + "18", marginBottom: 20 }]}>
          <Ionicons name="shield-checkmark" size={36} color={colors.primary} />
        </View>
        <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center", marginBottom: 12 }}>Subscriptions Coming Soon</Text>
        <Text style={{ fontSize: 15, color: colors.mutedForeground, textAlign: "center", lineHeight: 22 }}>In-app purchases are being set up.{"\n"}Check back soon for Pro and Premium plans.</Text>
      </View>
    );
  }

  const priceLabel = getDisplayPrice(activeTier);
  const yearlyNote = `${getYearlyTotal(activeTier)}/year — saves ~33%`;
  const annualSavings = activeTier === "pro" ? "Save $60" : "Save $100";

  return (
    <View style={[pw.container, { backgroundColor: colors.background }]}>
      {/* Background gradient */}
      <LinearGradient
        colors={isFromOnboarding && threatCount > 0
          ? ["#EF444410", colors.primary + "14", "transparent"]
          : [colors.primary + "22", colors.primary + "08", "transparent"]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.35, 0.8]}
      />

      {/* Close button */}
      <TouchableOpacity
        style={[pw.closeBtn, { top: topPad + 14 }]}
        onPress={handleClose}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <View style={[pw.closeBg, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Ionicons name="close" size={16} color={colors.mutedForeground} />
        </View>
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[pw.content, { paddingTop: topPad + 52, paddingBottom: bottomPad + 24 }]}
      >
        {/* ── Star rating ───────────────────────────────────────────────── */}
        <View style={pw.starRow}>
          <View style={{ flexDirection: "row", gap: 2 }}>
            {[0,1,2,3,4].map((i) => <Ionicons key={i} name="star" size={14} color="#F59E0B" />)}
          </View>
          <Text style={[pw.starText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>4.8</Text>
          <Text style={[pw.starSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>· 50,000+ identities protected</Text>
        </View>

        {/* ── Headline ─────────────────────────────────────────────────── */}
        {isFromOnboarding ? (
          <View style={{ gap: 10 }}>
            {threatCount > 0 ? (
              <>
                <View style={[pw.urgencyBadge, { backgroundColor: "#EF444414", borderColor: "#EF444444" }]}>
                  <View style={[pw.urgencyDot, { backgroundColor: "#EF4444" }]} />
                  <Text style={[{ color: "#EF4444", fontFamily: "Inter_600SemiBold", fontSize: 13 }]}>Identity scan complete</Text>
                </View>
                <Text style={[pw.headline, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  We found{" "}
                  <Text style={{ color: "#EF4444" }}>{threatCount} potential match{threatCount !== 1 ? "es" : ""}</Text>
                  .{"\n"}Unlock your report.
                </Text>
              </>
            ) : (
              <>
                <View style={[pw.urgencyBadge, { backgroundColor: colors.success + "14", borderColor: colors.success + "33" }]}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={[{ color: colors.success, fontFamily: "Inter_600SemiBold", fontSize: 13 }]}>Initial scan complete</Text>
                </View>
                <Text style={[pw.headline, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  Stay protected{"\n"}automatically.
                </Text>
                <Text style={[pw.subhead, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  No threats found today — but impersonators don't wait. Continuous monitoring keeps you safe as new threats emerge.
                </Text>
              </>
            )}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {alreadySubscribed ? (
              <Text style={[pw.headline, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Your subscription</Text>
            ) : (
              <>
                <Text style={[pw.headline, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  Stop wondering.{"\n"}Start knowing.
                </Text>
                <Text style={[pw.subhead, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Continuous AI monitoring across all your platforms, so you find out first — not last.
                </Text>
              </>
            )}
          </View>
        )}

        {/* ── Urgency blurred result cards ─────────────────────────────── */}
        {isFromOnboarding && threatCount > 0 && (
          <UrgencyResultCards colors={colors} threatCount={threatCount} />
        )}

        {/* ── Feature list ─────────────────────────────────────────────── */}
        {!alreadySubscribed && (
          <View style={pw.features}>
            {FEATURES.map((f) => (
              <View key={f.text} style={pw.featureRow}>
                <View style={[pw.featureIcon, { backgroundColor: colors.primary + "18" }]}>
                  <Ionicons name={f.icon as any} size={18} color={colors.primary} />
                </View>
                <Text style={[pw.featureText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{f.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Already subscribed ────────────────────────────────────────── */}
        {alreadySubscribed && (
          <GlassCard style={{ gap: 12, borderColor: colors.success + "33" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[{ color: colors.success, fontFamily: "Inter_600SemiBold", fontSize: 15 }]}>
                {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} — Active
              </Text>
            </View>
            <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 }]}>
              You're fully protected. Rook is continuously monitoring your identity across all connected platforms.
            </Text>
            <TouchableOpacity
              style={[pw.manageBtn, { borderColor: colors.border }]}
              onPress={handleManageSubscription}
              activeOpacity={0.8}
            >
              <Text style={[{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }]}>Manage Subscription</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </GlassCard>
        )}

        {/* ── Plan toggle (pro / premium) ───────────────────────────────── */}
        {!alreadySubscribed && (
          <View style={{ gap: 12 }}>
            <View style={[pw.planToggle, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              {(["pro", "premium"] as const).map((tier) => {
                const isActive = activeTier === tier;
                return (
                  <TouchableOpacity
                    key={tier}
                    style={[pw.planBtn, isActive && [pw.planBtnActive, { backgroundColor: colors.card, borderColor: colors.primary + "44" }]]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTier(tier); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[pw.planBtnLabel, { color: isActive ? colors.primary : colors.mutedForeground, fontFamily: isActive ? "Inter_700Bold" : "Inter_400Regular" }]}>
                      {tier === "pro" ? "Pro" : "Premium"}
                    </Text>
                    {tier === "pro" && <View style={[pw.popularPill, { backgroundColor: colors.primary }]}><Text style={[{ color: "#fff", fontSize: 9, fontFamily: "Inter_600SemiBold" }]}>POPULAR</Text></View>}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Billing cycle toggle ──────────────────────────────────── */}
            <View style={[pw.cycleToggle, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[pw.cycleBtn, billingCycle === "monthly" && [pw.cycleBtnActive, { backgroundColor: colors.card, borderColor: colors.border }]]}
                onPress={() => setBillingCycle("monthly")}
                activeOpacity={0.8}
              >
                <Text style={[pw.cycleBtnText, { color: billingCycle === "monthly" ? colors.foreground : colors.mutedForeground, fontFamily: billingCycle === "monthly" ? "Inter_600SemiBold" : "Inter_400Regular" }]}>Monthly</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[pw.cycleBtn, billingCycle === "yearly" && [pw.cycleBtnActive, { backgroundColor: colors.card, borderColor: colors.border }]]}
                onPress={() => setBillingCycle("yearly")}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[pw.cycleBtnText, { color: billingCycle === "yearly" ? colors.foreground : colors.mutedForeground, fontFamily: billingCycle === "yearly" ? "Inter_600SemiBold" : "Inter_400Regular" }]}>Annual</Text>
                  <View style={[pw.savePill, { backgroundColor: "#10B981" }]}>
                    <Text style={[{ color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" }]}>{annualSavings}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* ── Price display ─────────────────────────────────────────── */}
            <View style={pw.priceBlock}>
              <Text style={[pw.priceMain, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{priceLabel}</Text>
              <Text style={[pw.pricePer, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>/mo</Text>
            </View>
            {billingCycle === "yearly" && (
              <Text style={[pw.yearlyNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{yearlyNote}</Text>
            )}

            {/* ── CTA ───────────────────────────────────────────────────── */}
            <TouchableOpacity
              style={[pw.cta, { backgroundColor: colors.primary, opacity: isPurchasing || devUpgrading ? 0.7 : 1 }]}
              onPress={handleSubscribe}
              disabled={isPurchasing || devUpgrading}
              activeOpacity={0.85}
            >
              {isPurchasing || devUpgrading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="crown" size={18} color="#fff" />
                  <Text style={[pw.ctaText, { fontFamily: "Inter_700Bold" }]}>Start Free 7-Day Trial</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={[pw.trialNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {billingCycle === "yearly" ? `Then ${getYearlyTotal(activeTier)}/year` : `Then ${priceLabel}/month`} · Cancel anytime
            </Text>

            {/* ── Trust strip ──────────────────────────────────────────── */}
            <View style={pw.trustRow}>
              {[
                { icon: "lock-closed", text: "Secure payment" },
                { icon: "ban", text: "No commitment" },
                { icon: "refresh-circle", text: "Cancel anytime" },
              ].map((t) => (
                <View key={t.text} style={pw.trustItem}>
                  <Ionicons name={t.icon as any} size={13} color={colors.mutedForeground} />
                  <Text style={[pw.trustText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{t.text}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Restore + legal ──────────────────────────────────────────── */}
        <View style={pw.footer}>
          <View style={{ flexDirection: "row", gap: 16, justifyContent: "center" }}>
            <TouchableOpacity onPress={handleRestore} disabled={isRestoring}>
              {isRestoring
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text style={[pw.footerLink, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>Restore Purchases</Text>}
            </TouchableOpacity>
            <Text style={[{ color: colors.border, fontFamily: "Inter_400Regular" }]}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL("https://rook.app/terms")}>
              <Text style={[pw.footerLink, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Terms</Text>
            </TouchableOpacity>
            <Text style={[{ color: colors.border, fontFamily: "Inter_400Regular" }]}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL("https://rook.app/privacy")}>
              <Text style={[pw.footerLink, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Privacy</Text>
            </TouchableOpacity>
          </View>
          {restoreMsg && (
            <Text style={[pw.restoreMsg, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{restoreMsg}</Text>
          )}
          <Text style={[pw.legal, { color: colors.mutedForeground + "88", fontFamily: "Inter_400Regular" }]}>
            Subscriptions auto-renew. Cancel at least 24 hours before renewal in your device settings.
          </Text>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={!!confirmPkg}
        pkg={confirmPkg}
        onConfirm={handleConfirmPurchase}
        onCancel={() => setConfirmPkg(null)}
      />
    </View>
  );
}

const pw = StyleSheet.create({
  container: { flex: 1 },
  closeBtn: { position: "absolute", right: 20, zIndex: 10 },
  closeBg: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  content: { paddingHorizontal: 24, gap: 24 },

  starRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  starText: { fontSize: 14 },
  starSub: { fontSize: 13 },

  urgencyBadge: { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  urgencyDot: { width: 6, height: 6, borderRadius: 3 },

  headline: { fontSize: 32, lineHeight: 40 },
  subhead: { fontSize: 15, lineHeight: 23 },

  features: { gap: 14 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  featureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  featureText: { flex: 1, fontSize: 15, lineHeight: 22 },

  planToggle: { flexDirection: "row", borderRadius: 14, borderWidth: 1, padding: 4, gap: 4 },
  planBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  planBtnActive: { borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  planBtnLabel: { fontSize: 14 },
  popularPill: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },

  cycleToggle: { flexDirection: "row", borderRadius: 14, borderWidth: 1, padding: 4, gap: 4 },
  cycleBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 10 },
  cycleBtnActive: { borderWidth: 1 },
  cycleBtnText: { fontSize: 14 },
  savePill: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },

  priceBlock: { flexDirection: "row", alignItems: "baseline", gap: 2, justifyContent: "center" },
  priceMain: { fontSize: 48, lineHeight: 54 },
  pricePer: { fontSize: 16 },
  yearlyNote: { fontSize: 13, textAlign: "center", marginTop: -8 },

  cta: { height: 58, borderRadius: 29, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  ctaText: { color: "#fff", fontSize: 17 },
  trialNote: { fontSize: 13, textAlign: "center", marginTop: -8 },

  trustRow: { flexDirection: "row", justifyContent: "center", gap: 16 },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  trustText: { fontSize: 11 },

  manageBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },

  footer: { gap: 10, paddingTop: 8 },
  footerLink: { fontSize: 13 },
  restoreMsg: { fontSize: 13, textAlign: "center" },
  legal: { fontSize: 11, textAlign: "center", lineHeight: 17 },
});
