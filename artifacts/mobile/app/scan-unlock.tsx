/**
 * Scan Unlock Paywall — 3-tier purchase screen.
 *
 * Tier 1: Single Scan ($2.99 one-time) — stored in AsyncStorage until RC product exists
 * Tier 2: Pro ($14.99/mo) — uses RevenueCat
 * Tier 3: Premium ($24.99/mo) — uses RevenueCat
 *
 * After any purchase, navigates to Alerts and fires the post-unlock upsell flag.
 */

import React, { useState } from "react";
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

interface TierOption {
  id: "scan" | "pro" | "premium";
  name: string;
  price: string;
  pricePer: string;
  badge?: string;
  badgeColor?: string;
  headline: string;
  bullets: Array<{ icon: string; text: string }>;
  ctaLabel: string;
  ctaColor: string;
  highlight?: boolean;
}

const TIERS: TierOption[] = [
  {
    id: "scan",
    name: "Single Scan",
    price: "$2.99",
    pricePer: "one-time",
    badge: "Instant Access",
    headline: "Unlock this scan only",
    bullets: [
      { icon: "lock-open", text: "Full results for this scan" },
      { icon: "flag", text: "One-tap report to platform" },
      { icon: "analytics", text: "AI threat analysis" },
      { icon: "close-circle", text: "No subscription required" },
    ],
    ctaLabel: "Unlock for $2.99",
    ctaColor: "#EF4444",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$14.99",
    pricePer: "/mo",
    badge: "Most Popular",
    badgeColor: "#3B82F6",
    headline: "Continuous identity protection",
    bullets: [
      { icon: "shield-checkmark", text: "All scan results + history" },
      { icon: "people", text: "3 connected accounts" },
      { icon: "calendar", text: "Weekly automated monitoring" },
      { icon: "notifications", text: "Real-time threat alerts" },
    ],
    ctaLabel: "Start 7-Day Free Trial",
    ctaColor: "#3B82F6",
    highlight: true,
  },
  {
    id: "premium",
    name: "Premium",
    price: "$24.99",
    pricePer: "/mo",
    badge: "Best Value",
    badgeColor: "#8B5CF6",
    headline: "Enterprise-grade protection",
    bullets: [
      { icon: "infinite", text: "Unlimited accounts + scans" },
      { icon: "flash", text: "Daily automated monitoring" },
      { icon: "document-text", text: "Threat reports + 30-day history" },
      { icon: "analytics", text: "Advanced risk scoring" },
    ],
    ctaLabel: "Start 7-Day Free Trial",
    ctaColor: "#8B5CF6",
  },
];

function TierCard({
  tier,
  onPress,
  loading,
  colors,
}: {
  tier: TierOption;
  onPress: () => void;
  loading: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const ctaColor = tier.ctaColor;
  const badgeColor = tier.badgeColor ?? "#6B7280";

  return (
    <GlassCard
      style={[
        styles.tierCard,
        tier.highlight && { borderColor: ctaColor + "55", borderWidth: 2 },
      ]}
    >
      {tier.highlight && (
        <LinearGradient
          colors={[ctaColor + "0A", "transparent"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

      <View style={styles.tierHeader}>
        <View>
          <Text style={[styles.tierName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {tier.name}
          </Text>
          <Text style={[styles.tierHeadline, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {tier.headline}
          </Text>
        </View>
        <View style={styles.tierPriceBlock}>
          <Text style={[styles.tierPrice, { color: ctaColor, fontFamily: "Inter_700Bold" }]}>
            {tier.price}
          </Text>
          <Text style={[styles.tierPricePer, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {tier.pricePer}
          </Text>
        </View>
      </View>

      {tier.badge && (
        <View style={[styles.badge, { backgroundColor: badgeColor + "18", borderColor: badgeColor + "44" }]}>
          <Text style={[styles.badgeText, { color: badgeColor, fontFamily: "Inter_600SemiBold" }]}>
            {tier.badge}
          </Text>
        </View>
      )}

      <View style={styles.bulletList}>
        {tier.bullets.map((b) => (
          <View key={b.text} style={styles.bulletRow}>
            <View style={[styles.bulletIcon, { backgroundColor: ctaColor + "18" }]}>
              <Ionicons name={b.icon as any} size={12} color={ctaColor} />
            </View>
            <Text style={[styles.bulletText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
              {b.text}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.cta, { backgroundColor: ctaColor, opacity: loading ? 0.7 : 1 }]}
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            {tier.id !== "scan" && <MaterialCommunityIcons name="crown" size={16} color="#fff" />}
            <Text style={[styles.ctaText, { fontFamily: "Inter_700Bold" }]}>{tier.ctaLabel}</Text>
          </>
        )}
      </TouchableOpacity>

      {tier.id !== "scan" && (
        <Text style={[styles.trialNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          7-day free trial · then {tier.price}{tier.pricePer} · cancel anytime
        </Text>
      )}
    </GlassCard>
  );
}

export default function ScanUnlock() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const { offerings, purchase, restore, isPurchasing, isRestoring } = useSubscription();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [loadingTier, setLoadingTier] = useState<"scan" | "pro" | "premium" | null>(null);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  const getSubscriptionPackage = (tierId: "pro" | "premium") => {
    if (!isRevenueCatConfigured) return null;
    const offering = offerings?.all[tierId];
    return (
      offering?.monthly ??
      offering?.availablePackages.find((p) => p.packageType === "MONTHLY") ??
      null
    );
  };

  const handleUnlockScan = async () => {
    setLoadingTier("scan");
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await markScanUnlocked();
      analytics.scanPurchased({ price: "2.99", via: "async_storage" });
      router.replace("/(tabs)/alerts" as any);
    } catch {
      Alert.alert("Purchase Failed", "Please try again.");
    } finally {
      setLoadingTier(null);
    }
  };

  const handleSubscribe = async (tierId: "pro" | "premium") => {
    setLoadingTier(tierId);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const pkg = getSubscriptionPackage(tierId);
      if (!pkg) {
        Alert.alert(
          "Not Available",
          "Subscription products are loading. Please try again in a moment."
        );
        return;
      }
      await purchase(pkg);
      await markScanUnlocked();
      analytics.subscriptionStarted({ tier: tierId, source: "scan_unlock" });
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
      const info = await restore();
      const hasPro = !!info.entitlements.active["pro"];
      const hasPremium = !!info.entitlements.active["premium"];
      if (hasPro || hasPremium) {
        await markScanUnlocked();
        analytics.subscriptionRestored({ source: "scan_unlock" });
        syncSubscriptionTier(hasPremium ? "premium" : "pro").catch(() => {});
        router.replace("/(tabs)/alerts" as any);
      } else {
        setRestoreMsg("No active subscription found.");
      }
    } catch {
      setRestoreMsg("Restore failed. Please try again.");
    }
  };

  const handleTierPress = (tierId: "scan" | "pro" | "premium") => {
    if (tierId === "scan") return handleUnlockScan();
    return handleSubscribe(tierId as "pro" | "premium");
  };

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
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "33" }]}>
            <MaterialCommunityIcons name="shield-lock" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Choose Your Protection
          </Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            One-time unlock for this scan, or continuous monitoring with Pro or Premium.
          </Text>
        </View>

        {/* Tier cards */}
        {TIERS.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            colors={colors}
            loading={loadingTier === tier.id || (tier.id !== "scan" && isPurchasing)}
            onPress={() => handleTierPress(tier.id)}
          />
        ))}

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
            { icon: "lock-closed", text: "Cancel anytime" },
            { icon: "checkmark-circle", text: "No contracts" },
            { icon: "card", text: "Secure checkout" },
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
          Subscriptions renew automatically. Cancel anytime from your device's subscription settings. Single scan purchase is non-refundable.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  content: { padding: 20, gap: 16 },

  hero: { alignItems: "center", gap: 12, paddingVertical: 8 },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  heroTitle: { fontSize: 22, textAlign: "center" },
  heroSub: { fontSize: 14, textAlign: "center", lineHeight: 21, maxWidth: 300 },

  tierCard: { gap: 14, padding: 18, overflow: "hidden" },
  tierHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  tierName: { fontSize: 18, lineHeight: 24 },
  tierHeadline: { fontSize: 12, lineHeight: 17 },
  tierPriceBlock: { alignItems: "flex-end", gap: 1 },
  tierPrice: { fontSize: 22 },
  tierPricePer: { fontSize: 12 },

  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: -4,
  },
  badgeText: { fontSize: 11 },

  bulletList: { gap: 9 },
  bulletRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  bulletIcon: { width: 24, height: 24, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  bulletText: { fontSize: 13, flex: 1, lineHeight: 18 },

  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 25,
  },
  ctaText: { color: "#fff", fontSize: 15 },
  trialNote: { fontSize: 11, textAlign: "center", marginTop: -4 },

  restoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  restoreText: { fontSize: 15 },
  restoreStatus: { fontSize: 12, textAlign: "center" },

  trustRow: { flexDirection: "row", justifyContent: "center", gap: 20 },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  trustText: { fontSize: 12 },

  legal: { fontSize: 11, textAlign: "center", lineHeight: 16, opacity: 0.7 },
});
