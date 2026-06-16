/**
 * Subscription / Paywall screen
 *
 * Uses RevenueCat offerings and packages exclusively.
 * - "pro" offering  → Pro tier packages  ($rc_monthly + $rc_annual)
 * - "premium" offering → Premium tier packages ($rc_monthly + $rc_annual)
 * Prices are derived from the RevenueCat SDK; nothing is hardcoded.
 */

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import type { PurchasesPackage } from "react-native-purchases";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useLocalSearchParams } from "expo-router";
import { GlassCard } from "@/components/GlassCard";
import { useSubscription } from "@/lib/revenuecat";
import { syncSubscriptionTier } from "@/lib/api";

type Tier = "free" | "pro" | "premium";
type Cycle = "monthly" | "yearly";

const TIER_ORDER: Record<Tier, number> = { free: 0, pro: 1, premium: 2 };

interface PlanMeta {
  id: Tier;
  name: string;
  icon: string;
  tagline: string;
  highlight: boolean;
  badge?: string;
  ctaColor?: string;
  differentiators: Array<{ icon: string; text: string }>;
}

const PLAN_META: PlanMeta[] = [
  {
    id: "pro",
    name: "Pro",
    icon: "shield-half",
    tagline: "Your AI identity bodyguard",
    highlight: true,
    badge: "Most Popular",
    ctaColor: "#3B82F6",
    differentiators: [
      { icon: "scan", text: "15 manual scans / month" },
      { icon: "calendar", text: "Weekly automated monitoring" },
      { icon: "time", text: "7-day threat history" },
      { icon: "notifications", text: "Real-time alerts + full evidence" },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    icon: "shield-checkmark",
    tagline: "Enterprise-grade identity protection",
    highlight: false,
    badge: "Best Value",
    ctaColor: undefined,
    differentiators: [
      { icon: "infinite", text: "Unlimited scans & accounts" },
      { icon: "flash", text: "Daily automated monitoring" },
      { icon: "calendar", text: "30-day threat history" },
      { icon: "analytics", text: "Priority processing + early access" },
    ],
  },
];

// ─── Confirm purchase modal (required by RC skill — no Alert.alert) ──────────
interface ConfirmModalProps {
  visible: boolean;
  pkg: PurchasesPackage | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ visible, pkg, onConfirm, onCancel }: ConfirmModalProps) {
  const colors = useColors();
  if (!pkg) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={confirmStyles.overlay}>
        <View style={[confirmStyles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[confirmStyles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Confirm Purchase
          </Text>
          <Text style={[confirmStyles.product, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {pkg.product.title || pkg.product.identifier}
          </Text>
          <Text style={[confirmStyles.price, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {pkg.product.priceString}
            {pkg.packageType === "ANNUAL" ? "/year" : "/month"}
          </Text>
          <Text style={[confirmStyles.note, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Your subscription begins with a 7-day free trial. After the trial, you will be charged {pkg.product.priceString}{pkg.packageType === "ANNUAL" ? "/year" : "/month"} unless cancelled at least 24 hours before the renewal date. Cancel anytime in your device's subscription settings.
          </Text>
          <View style={confirmStyles.btnRow}>
            <TouchableOpacity
              style={[confirmStyles.btn, { backgroundColor: colors.secondary }]}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={[confirmStyles.btnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[confirmStyles.btn, { backgroundColor: colors.primary }]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={[confirmStyles.btnText, { color: "#FFFFFF", fontFamily: "Inter_700Bold" }]}>
                Subscribe
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const confirmStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  sheet: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 18, textAlign: "center" },
  product: { fontSize: 16, textAlign: "center" },
  price: { fontSize: 14, textAlign: "center" },
  note: { fontSize: 12, textAlign: "center", lineHeight: 18, opacity: 0.8 },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  btn: { flex: 1, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15 },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function Subscription() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, completeOnboarding, refreshData } = useApp();
  const { fromOnboarding } = useLocalSearchParams<{ fromOnboarding?: string }>();
  const isFromOnboarding = fromOnboarding === "1";

  const { offerings, tier: rcTier, isPurchasing, isLoading: rcIsLoading, purchase, restore, isRestoring } = useSubscription();

  const [billingCycle, setBillingCycle] = useState<Cycle>("monthly");
  const [confirmPkg, setConfirmPkg] = useState<PurchasesPackage | null>(null);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Use AppContext tier as source of truth for UI; RC tier for purchase checks
  const currentTier = (user.tier ?? "free") as Tier;

  /** Get the correct RevenueCat package for a tier + cycle */
  const getPackage = (tier: Tier, cycle: Cycle): PurchasesPackage | null => {
    if (tier === "free") return null;
    const offering = offerings?.all[tier];
    if (!offering) return null;
    if (cycle === "yearly") {
      return offering.annual ?? offering.availablePackages.find((p) => p.packageType === "ANNUAL") ?? null;
    }
    return offering.monthly ?? offering.availablePackages.find((p) => p.packageType === "MONTHLY") ?? null;
  };

  // Fallback prices shown while RC offerings are loading (or in Expo Go test mode)
  const FALLBACK_PRICES: Record<Tier, { monthly: string; yearlyPerMonth: string; yearlyTotal: string }> = {
    free: { monthly: "$0", yearlyPerMonth: "$0", yearlyTotal: "$0" },
    pro: { monthly: "$9.99", yearlyPerMonth: "$6.99", yearlyTotal: "$83.99" },
    premium: { monthly: "$19.99", yearlyPerMonth: "$13.99", yearlyTotal: "$167.99" },
  };

  /** Derive display price string from RC package, with fallback */
  const getDisplayPrice = (tier: Tier): string => {
    const pkg = getPackage(tier, billingCycle);
    if (pkg) {
      if (billingCycle === "yearly") {
        const perMonth = pkg.product.price / 12;
        return `$${perMonth.toFixed(2)}`;
      }
      return pkg.product.priceString;
    }
    // Fallback when RC offerings not yet loaded
    return billingCycle === "yearly"
      ? FALLBACK_PRICES[tier].yearlyPerMonth
      : FALLBACK_PRICES[tier].monthly;
  };

  /** Yearly billed-as string e.g. "$99.99/year" */
  const getYearlyBilled = (tier: Tier): string => {
    const pkg = getPackage(tier, "yearly");
    if (pkg) return `Billed ${pkg.product.priceString}/year · Save ~33%`;
    const fb = FALLBACK_PRICES[tier];
    return fb ? `Billed ${fb.yearlyTotal}/year · Save ~33%` : "";
  };

  const handleManageSubscription = () => {
    Alert.alert(
      "Manage Subscription",
      "Subscriptions are managed through your device's app store settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: Platform.OS === "ios" ? "Open App Store" : "Open Play Store",
          onPress: () => {
            const url =
              Platform.OS === "ios"
                ? "https://apps.apple.com/account/subscriptions"
                : "https://play.google.com/store/account/subscriptions";
            Linking.openURL(url);
          },
        },
      ]
    );
  };

  const [devUpgrading, setDevUpgrading] = useState(false);

  /** DEV ONLY — bypass RevenueCat and sync tier directly to the server. */
  const handleDevUpgrade = async (tier: Tier) => {
    setDevUpgrading(true);
    try {
      await syncSubscriptionTier(tier);
      await refreshData();
      Alert.alert("✓ Dev Mode", `Plan set to ${tier}`);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to set tier");
    } finally {
      setDevUpgrading(false);
    }
  };

  const handleUpgrade = (meta: PlanMeta) => {
    const pkg = getPackage(meta.id, billingCycle);
    if (!pkg) {
      // In dev/test mode, allow direct tier selection without App Store
      if (__DEV__) {
        handleDevUpgrade(meta.id);
        return;
      }
      Alert.alert(
        "Store not available",
        "In-app purchases require the App Store or Google Play. Please open this app from your device's app store to subscribe.",
        [{ text: "OK" }]
      );
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
      // Sync AppContext with the new tier from the server
      await refreshData();
    } catch (err: any) {
      // User cancelled — RC throws a specific error code; ignore it silently
      if (err?.userCancelled) return;
      console.warn("[RC] Purchase error:", err?.message);
    }
  };

  const handleRestore = async () => {
    try {
      await restore();
      setRestoreMsg("Purchases restored successfully.");
    } catch (err: any) {
      setRestoreMsg("Nothing to restore, or an error occurred.");
    }
    setTimeout(() => setRestoreMsg(null), 3000);
  };

  const getPlanCtaLabel = (meta: PlanMeta): string => {
    if (meta.id === currentTier) return "Current Plan";
    if (TIER_ORDER[meta.id] < TIER_ORDER[currentTier]) return `Downgrade to ${meta.name}`;
    if (currentTier !== "free") return `Upgrade to ${meta.name}`;
    return "Choose Plan";
  };

  const getPlanCtaDisabled = (meta: PlanMeta): boolean => {
    return meta.id === currentTier || TIER_ORDER[meta.id] < TIER_ORDER[currentTier];
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primaryDark + "22", colors.premium + "11", "transparent"]}
        style={styles.topGradient}
      />

      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => {
          if (isFromOnboarding) {
            completeOnboarding();
            router.replace("/(tabs)" as any);
          } else {
            router.back();
          }
        }}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          ShieldID Protection
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 32 }]}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: colors.warning + "22" }]}>
            <MaterialCommunityIcons name="crown" size={40} color={colors.warning} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            AI Watching the Internet{"\n"}So You Don't Have To
          </Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Detect impersonators, stolen photos, and fake accounts across every major platform.
          </Text>
        </View>

        {/* Billing cycle toggle */}
        <View style={[styles.toggleRow, { backgroundColor: colors.secondary, borderRadius: 14 }]}>
          {(["monthly", "yearly"] as Cycle[]).map((cycle) => (
            <TouchableOpacity
              key={cycle}
              style={[
                styles.toggleBtn,
                billingCycle === cycle && [styles.toggleBtnActive, { backgroundColor: colors.card }],
                { borderRadius: 10 },
              ]}
              onPress={() => setBillingCycle(cycle)}
            >
              <Text style={[
                styles.toggleLabel,
                { color: billingCycle === cycle ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
              ]}>
                {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
              </Text>
              {cycle === "yearly" && (
                <View style={[styles.savingsBadge, { backgroundColor: colors.success }]}>
                  <Text style={[styles.savingsText, { fontFamily: "Inter_700Bold" }]}>Save 33%</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Free plan card */}
        <GlassCard style={[styles.planCard, {
          borderColor: currentTier === "free" ? colors.primary : colors.border,
          borderWidth: currentTier === "free" ? 1.5 : 1,
        }]}>
          <View style={styles.planBadgeRow}>
            <View />
            {currentTier === "free" && (
              <View style={[styles.currentBadge, { backgroundColor: colors.success + "22", borderColor: colors.success + "55" }]}>
                <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                <Text style={[styles.currentBadgeText, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>
                  Your Plan
                </Text>
              </View>
            )}
          </View>
          <View style={styles.planHeader}>
            <View style={[styles.planIconBg, { backgroundColor: colors.primary + "18" }]}>
              <Ionicons name="shield-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.planNameBlock}>
              <Text style={[styles.planName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Free</Text>
              <Text style={[styles.planTagline, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Get started with basic protection
              </Text>
            </View>
            <View style={styles.planPriceBlock}>
              <Text style={[styles.planPrice, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>$0</Text>
            </View>
          </View>
          <View style={[styles.diffList, { borderTopColor: colors.border }]}>
            {[
              { icon: "scan", text: "3 scans / month" },
              { icon: "person", text: "1 social account" },
              { icon: "time", text: "24h threat history" },
            ].map((d, i) => (
              <View key={i} style={styles.diffRow}>
                <View style={[styles.diffIcon, { backgroundColor: colors.primary + "14" }]}>
                  <Ionicons name={d.icon as any} size={13} color={colors.primary} />
                </View>
                <Text style={[styles.diffText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                  {d.text}
                </Text>
              </View>
            ))}
          </View>
          {currentTier === "free" && (
            <View style={[styles.planCurrentRow, { borderTopColor: colors.border }]}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={[styles.planCurrentText, { color: colors.success, fontFamily: "Inter_500Medium" }]}>
                Active — you're protected
              </Text>
            </View>
          )}
        </GlassCard>

        {/* Pro + Premium plan cards */}
        {PLAN_META.map((meta) => {
          const isCurrent = meta.id === currentTier;
          const disabled = getPlanCtaDisabled(meta);
          const isLoading = isPurchasing || rcIsLoading || devUpgrading;
          const price = getDisplayPrice(meta.id);
          const isPremium = meta.id === "premium";

          let borderColor = colors.border;
          if (isCurrent) borderColor = colors.primary;
          if (isPremium) borderColor = colors.premium + "44";

          return (
            <GlassCard
              key={meta.id}
              style={[styles.planCard, { borderColor, borderWidth: isCurrent ? 1.5 : 1 }]}
            >
              <View style={styles.planBadgeRow}>
                {meta.badge ? (
                  <View style={[
                    styles.planBadge,
                    { backgroundColor: isPremium ? colors.premium : colors.primary },
                  ]}>
                    <Text style={[styles.planBadgeText, { fontFamily: "Inter_700Bold" }]}>{meta.badge}</Text>
                  </View>
                ) : <View />}
                {isCurrent && (
                  <View style={[styles.currentBadge, { backgroundColor: colors.success + "22", borderColor: colors.success + "55" }]}>
                    <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                    <Text style={[styles.currentBadgeText, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>
                      Your Plan
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.planHeader}>
                <View style={[
                  styles.planIconBg,
                  { backgroundColor: isPremium ? colors.premium + "22" : colors.primary + "18" },
                ]}>
                  <Ionicons
                    name={meta.icon as any}
                    size={22}
                    color={isPremium ? colors.premium : colors.primary}
                  />
                </View>
                <View style={styles.planNameBlock}>
                  <Text style={[styles.planName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    {meta.name}
                  </Text>
                  <Text style={[styles.planTagline, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {meta.tagline}
                  </Text>
                </View>
                <View style={styles.planPriceBlock}>
                  <Text style={[
                    styles.planPrice,
                    { color: isPremium ? colors.premium : colors.primary, fontFamily: "Inter_700Bold" },
                  ]}>
                    {price}
                  </Text>
                  <Text style={[styles.planPricePer, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    /mo
                  </Text>
                </View>
              </View>

              {billingCycle === "yearly" && (
                <Text style={[styles.yearlyNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {getYearlyBilled(meta.id)}
                </Text>
              )}

              <View style={[styles.diffList, { borderTopColor: colors.border }]}>
                {meta.differentiators.map((d, i) => (
                  <View key={i} style={styles.diffRow}>
                    <View style={[
                      styles.diffIcon,
                      { backgroundColor: isPremium ? colors.premium + "18" : colors.primary + "14" },
                    ]}>
                      <Ionicons name={d.icon as any} size={13} color={isPremium ? colors.premium : colors.primary} />
                    </View>
                    <Text style={[styles.diffText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                      {d.text}
                    </Text>
                  </View>
                ))}
              </View>

              {!disabled && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.planCta,
                      { backgroundColor: isPremium ? colors.premium : colors.primary, opacity: isLoading ? 0.7 : 1 },
                    ]}
                    disabled={isLoading}
                    activeOpacity={0.8}
                    onPress={() => handleUpgrade(meta)}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="crown" size={16} color="#FFFFFF" />
                        <Text style={[styles.planCtaText, { fontFamily: "Inter_700Bold" }]}>
                          {getPlanCtaLabel(meta)}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <Text style={[styles.trialNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    7-day free trial · then {getDisplayPrice(meta.id)}/mo · cancel anytime
                  </Text>
                </>
              )}

              {isCurrent && (
                <View style={[styles.planCurrentRow, { borderTopColor: colors.border }]}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={[styles.planCurrentText, { color: colors.success, fontFamily: "Inter_500Medium", flex: 1 }]}>
                    Active — you're protected
                  </Text>
                  <TouchableOpacity onPress={handleManageSubscription} activeOpacity={0.7}>
                    <Text style={[styles.manageLink, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      Manage
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </GlassCard>
          );
        })}

        {/* Restore purchases */}
        <TouchableOpacity
          style={[styles.restoreRow, { borderColor: colors.border }]}
          activeOpacity={0.7}
          onPress={handleRestore}
          disabled={isRestoring}
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
          ].map((item, i) => (
            <View key={i} style={styles.trustItem}>
              <Ionicons name={item.icon as any} size={14} color={colors.mutedForeground} />
              <Text style={[styles.trustText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {item.text}
              </Text>
            </View>
          ))}
        </View>

        <Text style={[styles.legal, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Subscriptions renew automatically. Cancel anytime from your device's subscription settings.
        </Text>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },
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
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { fontSize: 22, textAlign: "center", lineHeight: 30 },
  heroSub: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  toggleBtnActive: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleLabel: { fontSize: 14 },
  savingsBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20 },
  savingsText: { color: "#FFFFFF", fontSize: 10 },

  planCard: { gap: 14, padding: 18 },
  planBadgeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  planBadgeText: { color: "#FFFFFF", fontSize: 11 },
  currentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  currentBadgeText: { fontSize: 11 },

  planHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  planIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  planNameBlock: { flex: 1, gap: 2 },
  planName: { fontSize: 18 },
  planTagline: { fontSize: 12, lineHeight: 16 },
  planPriceBlock: { flexDirection: "row", alignItems: "baseline", gap: 1 },
  planPrice: { fontSize: 26 },
  planPricePer: { fontSize: 13 },
  yearlyNote: { fontSize: 12, marginTop: -6 },

  diffList: {
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
  },
  diffRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  diffIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  diffText: { fontSize: 14, flex: 1 },

  planCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 25,
  },
  planCtaText: { color: "#FFFFFF", fontSize: 15 },
  trialNote: { fontSize: 11, textAlign: "center", marginTop: 6 },
  planCurrentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  planCurrentText: { fontSize: 14 },
  manageLink: { fontSize: 13, textDecorationLine: "underline" },

  restoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
  },
  restoreText: { fontSize: 15 },
  restoreStatus: { fontSize: 12, textAlign: "center" },

  trustRow: { flexDirection: "row", justifyContent: "center", gap: 20 },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  trustText: { fontSize: 12 },

  legal: { fontSize: 11, textAlign: "center", lineHeight: 16, opacity: 0.7 },
});
