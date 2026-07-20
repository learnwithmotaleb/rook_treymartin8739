/**
 * Scan Unlock Paywall — focused single-tier screen.
 *
 * Primary offer  : Premium subscription ($9.99/mo or $69.99/yr, 7-day free trial)
 * Secondary offer: Single scan unlock ($4.99 one-time) — visible only below the trial CTA
 *                  as a "not ready to commit?" fallback.
 *
 * Pro tier is fully removed. RC product IDs:
 *   premium_monthly_v2  — monthly subscription
 *   premium_annual_v2   — annual subscription
 *   scan_unlock_v2      — one-time scan unlock (LIFETIME entitlement)
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { useSubscription, isRevenueCatConfigured } from "@/lib/revenuecat";
import { syncSubscriptionTier } from "@/lib/api";
import { analytics } from "@/lib/analytics";

export const SCAN_UNLOCK_KEY = "rook:scan_unlocked";
export const SHOW_UPSELL_KEY = "rook:show_post_unlock_upsell";

async function markScanUnlocked() {
  await Promise.all([
    AsyncStorage.setItem(SCAN_UNLOCK_KEY, "1"),
    AsyncStorage.setItem(SHOW_UPSELL_KEY, "1"),
  ]);
}

const FALLBACK = {
  annual:     { perMonth: "$5.83", total: "$69.99", savings: "42%" },
  monthly:    { perMonth: "$9.99" },
  scanUnlock: "$4.99",
  trialDays:  7,
};

const PREMIUM_FEATURES = [
  { icon: "shield-checkmark" as const, text: "Full scan results + 30-day history" },
  { icon: "infinite"         as const, text: "Unlimited accounts & scans" },
  { icon: "flash"            as const, text: "Daily automated monitoring" },
  { icon: "notifications"    as const, text: "Real-time threat alerts" },
  { icon: "analytics"        as const, text: "Advanced risk scoring" },
];

export default function ScanUnlock() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const { offerings, purchase, restore, isPurchasing, isRestoring } = useSubscription();

  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [cycle, setCycle]             = useState<"annual" | "monthly">("annual");
  const [loadingTier, setLoadingTier] = useState<"premium" | "scan" | null>(null);
  const [restoreMsg, setRestoreMsg]   = useState<string | null>(null);

  useEffect(() => {
    analytics.paywallViewed({ source: "scan_unlock" });
  }, []);

  // ── Package helpers ──────────────────────────────────────────────────────
  const getPremiumPackage = () => {
    if (!isRevenueCatConfigured) return null;
    const offering = offerings?.all["premium"] ?? offerings?.current ?? null;
    if (!offering) return null;
    if (cycle === "annual")
      return offering.annual ?? offering.availablePackages.find((p) => p.packageType === "ANNUAL") ?? null;
    return offering.monthly ?? offering.availablePackages.find((p) => p.packageType === "MONTHLY") ?? null;
  };

  const getScanUnlockPackage = () => {
    if (!isRevenueCatConfigured) return null;
    const offering = offerings?.all["scan_unlock"];
    return (
      offering?.lifetime ??
      offering?.availablePackages.find((p) => p.packageType === "LIFETIME") ??
      offering?.availablePackages[0] ??
      null
    );
  };

  const annualPrice  = getPremiumPackage()?.product?.priceString ?? FALLBACK.annual.total;
  const monthlyPrice = getPremiumPackage()?.product?.priceString ?? FALLBACK.monthly.perMonth;
  const scanPrice    = getScanUnlockPackage()?.product?.priceString ?? FALLBACK.scanUnlock;

  const annualPerMonth = (() => {
    const match = annualPrice.replace(/[^0-9.]/g, "");
    const num   = parseFloat(match);
    return isNaN(num) ? FALLBACK.annual.perMonth : `$${(num / 12).toFixed(2)}`;
  })();

  // ── Purchase handlers ────────────────────────────────────────────────────
  const handleSubscribe = async () => {
    setLoadingTier("premium");
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (isRevenueCatConfigured) {
        const pkg = getPremiumPackage();
        if (!pkg) {
          Alert.alert("Not Available", "Subscription products are loading. Please try again in a moment.");
          return;
        }
        await purchase(pkg);
        await syncSubscriptionTier("premium");
      }
      await markScanUnlocked();
      analytics.subscriptionStarted({ tier: "premium", source: "scan_unlock" });
      router.replace("/(tabs)/alerts" as any);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Purchase failed";
      if (!msg.includes("cancelled") && !msg.includes("cancel")) {
        Alert.alert("Purchase Failed", msg);
      }
    } finally {
      setLoadingTier(null);
    }
  };

  const handleUnlockScan = async () => {
    setLoadingTier("scan");
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (isRevenueCatConfigured) {
        const pkg = getScanUnlockPackage();
        if (!pkg) {
          Alert.alert(
            "Not Available",
            "The single-scan product isn't available right now. Choose a subscription or try again later."
          );
          return;
        }
        await purchase(pkg);
      }
      await markScanUnlocked();
      analytics.scanPurchased({ price: "4.99", via: isRevenueCatConfigured ? "revenuecat" : "dev_mode" });
      router.replace("/(tabs)/alerts" as any);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Purchase failed";
      if (!msg.includes("cancelled") && !msg.includes("cancel")) {
        Alert.alert("Purchase Failed", msg);
      }
    } finally {
      setLoadingTier(null);
    }
  };

  const handleRestore = async () => {
    try {
      const info       = await restore();
      const hasPremium    = !!info.entitlements.active["premium"];
      const hasScanUnlock = !!info.entitlements.active["scan_unlocked"];
      if (hasPremium || hasScanUnlock) {
        await markScanUnlocked();
        analytics.subscriptionRestored({ source: "scan_unlock" });
        if (hasPremium) syncSubscriptionTier("premium").catch(() => {});
        router.replace("/(tabs)/alerts" as any);
      } else {
        setRestoreMsg("No active purchase found for this account.");
      }
    } catch {
      setRestoreMsg("Restore failed. Please try again.");
    }
  };

  const isLoading = loadingTier !== null || isPurchasing;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primary + "18", "transparent"]}
        style={styles.topGradient}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Unlock Your Results
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "33" }]}>
            <MaterialCommunityIcons name="shield-lock" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Premium Protection
          </Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Unlock full results and keep your identity monitored every day.
          </Text>
        </View>

        {/* ── Primary offer card ──────────────────────────────────────── */}
        <GlassCard style={[styles.primaryCard, { borderColor: colors.primary + "55", borderWidth: 2 }]}>
          <LinearGradient
            colors={[colors.primary + "0A", "transparent"]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Billing toggle */}
          <View style={[styles.toggle, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.toggleBtn, cycle === "annual" && { backgroundColor: colors.foreground }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCycle("annual"); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, { color: cycle === "annual" ? colors.background : colors.mutedForeground, fontFamily: cycle === "annual" ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                Annual
              </Text>
              <View style={[styles.saveBadge, { backgroundColor: "#10B981", opacity: cycle === "annual" ? 1 : 0 }]}>
                <Text style={[styles.saveBadgeText, { fontFamily: "Inter_700Bold" }]}>SAVE {FALLBACK.annual.savings}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, cycle === "monthly" && { backgroundColor: colors.foreground }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCycle("monthly"); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, { color: cycle === "monthly" ? colors.background : colors.mutedForeground, fontFamily: cycle === "monthly" ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                Monthly
              </Text>
            </TouchableOpacity>
          </View>

          {/* Price display */}
          <View style={styles.priceRow}>
            <Text style={[styles.priceMain, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
              {cycle === "annual" ? annualPerMonth : monthlyPrice}
            </Text>
            <Text style={[styles.pricePer, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              /mo
            </Text>
            {cycle === "annual" && (
              <Text style={[styles.priceSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                · {annualPrice}/yr
              </Text>
            )}
          </View>

          {/* Feature list */}
          <View style={styles.featureList}>
            {PREMIUM_FEATURES.map((f) => (
              <View key={f.text} style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: colors.primary + "18" }]}>
                  <Ionicons name={f.icon} size={13} color={colors.primary} />
                </View>
                <Text style={[styles.featureText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                  {f.text}
                </Text>
              </View>
            ))}
          </View>

          {/* Trial CTA */}
          <TouchableOpacity
            style={[styles.trialCta, { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }]}
            onPress={handleSubscribe}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {loadingTier === "premium" || isPurchasing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="crown" size={16} color="#fff" />
                <Text style={[styles.trialCtaText, { fontFamily: "Inter_700Bold" }]}>
                  Start {FALLBACK.trialDays}-Day Free Trial
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={[styles.trialNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            No charge until your trial ends · cancel anytime
          </Text>
        </GlassCard>

        {/* ── Secondary fallback ──────────────────────────────────────── */}
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Not ready to commit?
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <TouchableOpacity
          style={[styles.scanUnlockRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleUnlockScan}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <View style={[styles.scanUnlockIcon, { backgroundColor: colors.secondary }]}>
            <Ionicons name="lock-open-outline" size={18} color={colors.mutedForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.scanUnlockTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              Unlock just this scan
            </Text>
            <Text style={[styles.scanUnlockSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              One-time · no subscription required
            </Text>
          </View>
          {loadingTier === "scan" ? (
            <ActivityIndicator color={colors.mutedForeground} size="small" />
          ) : (
            <Text style={[styles.scanUnlockPrice, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {scanPrice}
            </Text>
          )}
        </TouchableOpacity>

        {/* Restore */}
        <TouchableOpacity
          style={[styles.restoreRow, { borderColor: colors.border }]}
          onPress={handleRestore}
          disabled={isRestoring}
          activeOpacity={0.7}
        >
          {isRestoring ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Ionicons name="refresh-circle-outline" size={18} color={colors.primary} />
          )}
          <Text style={[styles.restoreText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
            Restore Purchases
          </Text>
        </TouchableOpacity>
        {restoreMsg && (
          <Text style={[styles.restoreStatus, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {restoreMsg}
          </Text>
        )}

        {/* Trust signals */}
        <View style={styles.trustRow}>
          {[
            { icon: "lock-closed",       text: "Cancel anytime" },
            { icon: "checkmark-circle",  text: "No contracts" },
            { icon: "card",              text: "Secure checkout" },
          ].map((item) => (
            <View key={item.text} style={styles.trustItem}>
              <Ionicons name={item.icon as any} size={13} color={colors.mutedForeground} />
              <Text style={[styles.trustText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {item.text}
              </Text>
            </View>
          ))}
        </View>

        <Text style={[styles.legal, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Subscriptions renew automatically. Cancel anytime from your device's subscription settings.
          Single-scan purchase is non-refundable.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 240 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17 },
  content:     { padding: 20, gap: 16 },

  hero:      { alignItems: "center", gap: 12, paddingVertical: 8 },
  heroIcon:  { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  heroTitle: { fontSize: 22, textAlign: "center" },
  heroSub:   { fontSize: 14, textAlign: "center", lineHeight: 21, maxWidth: 300 },

  primaryCard: { gap: 16, padding: 20, overflow: "hidden" },

  toggle:        { flexDirection: "row", borderRadius: 14, borderWidth: 1, padding: 3, gap: 2 },
  toggleBtn:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 11 },
  toggleText:    { fontSize: 14 },
  saveBadge:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  saveBadgeText: { color: "#fff", fontSize: 10 },

  priceRow:  { flexDirection: "row", alignItems: "baseline", gap: 4 },
  priceMain: { fontSize: 34 },
  pricePer:  { fontSize: 16 },
  priceSub:  { fontSize: 13 },

  featureList: { gap: 10 },
  featureRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  featureIcon: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  featureText: { fontSize: 13, flex: 1, lineHeight: 18 },

  trialCta:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 54, borderRadius: 27 },
  trialCtaText: { color: "#fff", fontSize: 16 },
  trialNote:    { fontSize: 11, textAlign: "center" },

  divider:     { flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },

  scanUnlockRow:   { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, borderWidth: 1 },
  scanUnlockIcon:  { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  scanUnlockTitle: { fontSize: 14, lineHeight: 20 },
  scanUnlockSub:   { fontSize: 12 },
  scanUnlockPrice: { fontSize: 16 },

  restoreRow:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, borderRadius: 14, borderWidth: 1 },
  restoreText:   { fontSize: 15 },
  restoreStatus: { fontSize: 12, textAlign: "center" },

  trustRow:  { flexDirection: "row", justifyContent: "center", gap: 20 },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  trustText: { fontSize: 12 },

  legal: { fontSize: 11, textAlign: "center", lineHeight: 16, opacity: 0.7 },
});
