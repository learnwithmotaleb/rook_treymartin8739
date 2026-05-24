import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useLocalSearchParams } from "expo-router";
import { GlassCard } from "@/components/GlassCard";
import {
  createCheckoutSession,
  createPortalSession,
  cancelSubscription,
} from "@/lib/api";

type Tier = "free" | "pro" | "premium";
type Cycle = "monthly" | "yearly";

interface Plan {
  id: Tier;
  name: string;
  icon: string;
  monthlyPrice: string;
  yearlyPrice: string;
  yearlyMonthly: string;
  tagline: string;
  highlight: boolean;
  badge?: string;
  differentiators: Array<{ icon: string; text: string }>;
  cta: string;
  ctaColor?: string;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    icon: "shield-outline",
    monthlyPrice: "$0",
    yearlyPrice: "$0",
    yearlyMonthly: "$0",
    tagline: "Get started with basic protection",
    highlight: false,
    differentiators: [
      { icon: "person", text: "1 social account" },
      { icon: "time", text: "Manual scan every 14 days" },
      { icon: "eye", text: "Basic impersonator detection" },
    ],
    cta: "Current Plan",
  },
  {
    id: "pro",
    name: "Pro",
    icon: "shield-half",
    monthlyPrice: "$14.99",
    yearlyPrice: "$119.99",
    yearlyMonthly: "$10.00",
    tagline: "Your AI identity bodyguard",
    highlight: true,
    badge: "Most Popular",
    differentiators: [
      { icon: "people", text: "3 social accounts" },
      { icon: "refresh-circle", text: "Weekly automated scans" },
      { icon: "notifications", text: "Real-time alerts + full evidence" },
    ],
    cta: "Start 7-Day Free Trial",
    ctaColor: "#3B82F6",
  },
  {
    id: "premium",
    name: "Premium",
    icon: "shield-checkmark",
    monthlyPrice: "$49.99",
    yearlyPrice: "$399.99",
    yearlyMonthly: "$33.33",
    tagline: "Enterprise-grade identity protection",
    highlight: false,
    badge: "Best Value",
    differentiators: [
      { icon: "infinite", text: "Unlimited accounts" },
      { icon: "pulse", text: "Daily deep AI scans" },
      { icon: "analytics", text: "Advanced intelligence + reports" },
    ],
    cta: "Start 7-Day Free Trial",
    ctaColor: "#7C3AED",
  },
];

const YEARLY_SAVINGS: Record<string, string> = {
  pro: "Save 33%",
  premium: "Save 33%",
};

export default function Subscription() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, completeOnboarding } = useApp();
  const { fromOnboarding } = useLocalSearchParams<{ fromOnboarding?: string }>();
  const isFromOnboarding = fromOnboarding === "1";

  const [billingCycle, setBillingCycle] = useState<Cycle>("monthly");
  const [loading, setLoading] = useState<Tier | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const currentTier = user.tier ?? "free";
  const isOnPaidPlan = currentTier !== "free";

  const TIER_ORDER: Record<Tier, number> = { free: 0, pro: 1, premium: 2 };

  const handleUpgrade = async (plan: Plan) => {
    if (plan.id === "free" || plan.id === currentTier) return;
    if (TIER_ORDER[plan.id] < TIER_ORDER[currentTier]) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(plan.id);

    try {
      const result = await createCheckoutSession(
        plan.id as "pro" | "premium",
        billingCycle
      );
      if (result.url) {
        await WebBrowser.openBrowserAsync(result.url);
      } else {
        Alert.alert("Checkout", "Checkout session created. Complete payment in your browser.");
      }
    } catch (err: any) {
      if (err?.message?.includes("stripe_not_configured") || err?.message?.includes("not configured")) {
        Alert.alert(
          "Stripe Not Configured",
          "Connect your Stripe account to enable payments. Add STRIPE_SECRET_KEY and Price IDs to your environment secrets.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Error", err?.message ?? "Failed to start checkout. Please try again.");
      }
    } finally {
      setLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setLoading("free");
    try {
      const result = await createPortalSession();
      if (result.url) {
        await WebBrowser.openBrowserAsync(result.url);
      }
    } catch {
      Alert.alert("Error", "Could not open billing portal. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const getPlanPrice = (plan: Plan) => {
    if (plan.id === "free") return "$0";
    return billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyMonthly;
  };

  const getPlanCtaLabel = (plan: Plan): string => {
    if (plan.id === currentTier) return "Current Plan";
    if (plan.id === "free") return "Downgrade to Free";
    if (TIER_ORDER[plan.id] < TIER_ORDER[currentTier]) return `Downgrade to ${plan.name}`;
    if (currentTier !== "free") return `Upgrade to ${plan.name}`;
    return plan.cta;
  };

  const getPlanCtaDisabled = (plan: Plan): boolean => {
    return plan.id === currentTier || plan.id === "free";
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#1D4ED822", "#7C3AED11", "transparent"]}
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
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              billingCycle === "monthly" && [styles.toggleBtnActive, { backgroundColor: colors.card }],
              { borderRadius: 10 },
            ]}
            onPress={() => setBillingCycle("monthly")}
          >
            <Text style={[
              styles.toggleLabel,
              { color: billingCycle === "monthly" ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
            ]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              billingCycle === "yearly" && [styles.toggleBtnActive, { backgroundColor: colors.card }],
              { borderRadius: 10 },
            ]}
            onPress={() => setBillingCycle("yearly")}
          >
            <Text style={[
              styles.toggleLabel,
              { color: billingCycle === "yearly" ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
            ]}>
              Yearly
            </Text>
            <View style={[styles.savingsBadge, { backgroundColor: colors.success }]}>
              <Text style={[styles.savingsText, { fontFamily: "Inter_700Bold" }]}>Save 33%</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Plan cards */}
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentTier;
          const isUpgrade = TIER_ORDER[plan.id] > TIER_ORDER[currentTier];
          const isLoading = loading === plan.id;
          const disabled = getPlanCtaDisabled(plan);
          const price = getPlanPrice(plan);

          let borderColor = colors.border;
          if (isCurrent) borderColor = colors.primary;
          if (plan.id === "premium") borderColor = "#7C3AED44";

          return (
            <GlassCard
              key={plan.id}
              style={[styles.planCard, { borderColor, borderWidth: isCurrent ? 1.5 : 1 }]}
            >
              {/* Badge row */}
              <View style={styles.planBadgeRow}>
                {plan.badge ? (
                  <View style={[
                    styles.planBadge,
                    { backgroundColor: plan.id === "premium" ? "#7C3AED" : colors.primary },
                  ]}>
                    <Text style={[styles.planBadgeText, { fontFamily: "Inter_700Bold" }]}>
                      {plan.badge}
                    </Text>
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

              {/* Plan header */}
              <View style={styles.planHeader}>
                <View style={[
                  styles.planIconBg,
                  { backgroundColor: plan.id === "premium" ? "#7C3AED22" : colors.primary + "18" },
                ]}>
                  <Ionicons
                    name={plan.icon as any}
                    size={22}
                    color={plan.id === "premium" ? "#7C3AED" : colors.primary}
                  />
                </View>
                <View style={styles.planNameBlock}>
                  <Text style={[styles.planName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    {plan.name}
                  </Text>
                  <Text style={[styles.planTagline, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {plan.tagline}
                  </Text>
                </View>
                <View style={styles.planPriceBlock}>
                  <Text style={[
                    styles.planPrice,
                    { color: plan.id === "premium" ? "#7C3AED" : plan.id === "pro" ? colors.primary : colors.foreground, fontFamily: "Inter_700Bold" },
                  ]}>
                    {price}
                  </Text>
                  {plan.id !== "free" && (
                    <Text style={[styles.planPricePer, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      /mo
                    </Text>
                  )}
                </View>
              </View>

              {billingCycle === "yearly" && plan.id !== "free" && (
                <Text style={[styles.yearlyNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Billed {plan.yearlyPrice}/year · {YEARLY_SAVINGS[plan.id]}
                </Text>
              )}

              {/* Differentiators */}
              <View style={[styles.diffList, { borderTopColor: colors.border }]}>
                {plan.differentiators.map((d, i) => (
                  <View key={i} style={styles.diffRow}>
                    <View style={[
                      styles.diffIcon,
                      { backgroundColor: plan.id === "premium" ? "#7C3AED18" : colors.primary + "14" },
                    ]}>
                      <Ionicons
                        name={d.icon as any}
                        size={13}
                        color={plan.id === "premium" ? "#7C3AED" : colors.primary}
                      />
                    </View>
                    <Text style={[styles.diffText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                      {d.text}
                    </Text>
                  </View>
                ))}
              </View>

              {/* CTA */}
              {!disabled && (
                <TouchableOpacity
                  style={[
                    styles.planCta,
                    {
                      backgroundColor: plan.ctaColor ?? colors.primary,
                      opacity: isLoading ? 0.7 : 1,
                    },
                  ]}
                  disabled={isLoading}
                  activeOpacity={0.8}
                  onPress={() => handleUpgrade(plan)}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="crown" size={16} color="#FFFFFF" />
                      <Text style={[styles.planCtaText, { fontFamily: "Inter_700Bold" }]}>
                        {getPlanCtaLabel(plan)}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              {isCurrent && (
                <View style={[styles.planCurrentRow, { borderTopColor: colors.border }]}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={[styles.planCurrentText, { color: colors.success, fontFamily: "Inter_500Medium" }]}>
                    Active — you're protected
                  </Text>
                </View>
              )}
            </GlassCard>
          );
        })}

        {/* Manage billing for paid users */}
        {isOnPaidPlan && (
          <TouchableOpacity
            style={[styles.manageRow, { borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={handleManageBilling}
            disabled={loading === "free"}
          >
            {loading === "free" ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Ionicons name="card-outline" size={18} color={colors.primary} />
            )}
            <Text style={[styles.manageText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
              Manage Billing & Subscription
            </Text>
            <Ionicons name="open-outline" size={14} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* Trust signals */}
        <View style={styles.trustRow}>
          {[
            { icon: "lock-closed", text: "Cancel anytime" },
            { icon: "shield-checkmark", text: "7-day free trial" },
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
          Subscriptions renew automatically. Cancel anytime from billing settings. Pro and Premium include a 7-day free trial for new subscribers.
        </Text>
      </ScrollView>
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
  planCurrentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  planCurrentText: { fontSize: 14 },

  manageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  manageText: { flex: 1, fontSize: 15 },

  trustRow: { flexDirection: "row", justifyContent: "center", gap: 20 },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  trustText: { fontSize: 12 },

  legal: { fontSize: 11, textAlign: "center", lineHeight: 16, opacity: 0.7 },
});
