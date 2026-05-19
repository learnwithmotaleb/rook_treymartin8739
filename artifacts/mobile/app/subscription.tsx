import React, { useState } from "react";
import {
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
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";

const PLANS = [
  {
    id: "premium",
    name: "Premium",
    price: "$9.99",
    period: "/month",
    highlight: true,
    features: [
      "Unlimited accounts monitored",
      "Real-time push alerts",
      "AI Scam Analyzer",
      "Photo monitoring",
      "Recovery tools",
      "Dark web monitoring",
    ],
  },
  {
    id: "family",
    name: "Family",
    price: "$19.99",
    period: "/month",
    highlight: false,
    features: [
      "Everything in Premium",
      "Up to 5 users",
      "Shared dashboard",
      "Family monitoring",
      "Priority support",
    ],
  },
];

const FEATURES = [
  { icon: "notifications", label: "Real-time alerts" },
  { icon: "image", label: "Photo monitoring" },
  { icon: "shield", label: "24/7 protection" },
  { icon: "brain", label: "AI scam analysis", lib: "mci" as const },
  { icon: "eye-off", label: "Dark web scans", lib: "mci" as const },
  { icon: "lock-closed", label: "Recovery tools" },
];

export default function Subscription() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState("premium");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSubscribe = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#1D4ED822", "transparent"]}
        style={styles.topGradient}
      />

      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          Upgrade
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 24 },
        ]}
      >
        <View style={styles.heroSection}>
          <View
            style={[
              styles.heroIcon,
              { backgroundColor: colors.warning + "22" },
            ]}
          >
            <MaterialCommunityIcons name="crown" size={44} color={colors.warning} />
          </View>
          <Text
            style={[
              styles.heroTitle,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            ShieldID Premium
          </Text>
          <Text
            style={[
              styles.heroSub,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            Full identity protection with real-time AI monitoring
          </Text>
        </View>

        {/* Feature grid */}
        <View style={styles.featuresGrid}>
          {FEATURES.map((f, i) => (
            <View
              key={i}
              style={[
                styles.featureItem,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <View
                style={[styles.featureIcon, { backgroundColor: colors.primary + "22" }]}
              >
                {f.lib === "mci" ? (
                  <MaterialCommunityIcons name={f.icon as any} size={20} color={colors.primary} />
                ) : (
                  <Ionicons name={f.icon as any} size={20} color={colors.primary} />
                )}
              </View>
              <Text
                style={[
                  styles.featureLabel,
                  { color: colors.foreground, fontFamily: "Inter_500Medium" },
                ]}
              >
                {f.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Plan selector */}
        <Text
          style={[
            styles.sectionLabel,
            { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
          ]}
        >
          Choose a Plan
        </Text>
        {PLANS.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          return (
            <TouchableOpacity
              key={plan.id}
              activeOpacity={0.85}
              onPress={() => setSelectedPlan(plan.id)}
            >
              <GlassCard
                style={[
                  styles.planCard,
                  isSelected && { borderColor: colors.primary },
                ]}
              >
                {plan.highlight && (
                  <View
                    style={[
                      styles.popularBadge,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.popularText,
                        { fontFamily: "Inter_600SemiBold" },
                      ]}
                    >
                      Most Popular
                    </Text>
                  </View>
                )}
                <View style={styles.planHeader}>
                  <View>
                    <Text
                      style={[
                        styles.planName,
                        { color: colors.foreground, fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      {plan.name}
                    </Text>
                    <View style={styles.planPriceRow}>
                      <Text
                        style={[
                          styles.planPrice,
                          { color: isSelected ? colors.primary : colors.foreground, fontFamily: "Inter_700Bold" },
                        ]}
                      >
                        {plan.price}
                      </Text>
                      <Text
                        style={[
                          styles.planPeriod,
                          { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                        ]}
                      >
                        {plan.period}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.radioBtn,
                      {
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primary : "transparent",
                      },
                    ]}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </View>
                </View>
                {plan.features.map((feat, i) => (
                  <View key={i} style={styles.planFeature}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={colors.success}
                    />
                    <Text
                      style={[
                        styles.planFeatureText,
                        { color: colors.foreground, fontFamily: "Inter_400Regular" },
                      ]}
                    >
                      {feat}
                    </Text>
                  </View>
                ))}
              </GlassCard>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.subscribeBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
          onPress={handleSubscribe}
        >
          <MaterialCommunityIcons name="crown" size={20} color="#FFFFFF" />
          <Text
            style={[
              styles.subscribeBtnText,
              { fontFamily: "Inter_700Bold" },
            ]}
          >
            Start Free Trial
          </Text>
        </TouchableOpacity>

        <Text
          style={[
            styles.legal,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          7-day free trial, then billed monthly. Cancel anytime.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 300 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18 },
  content: { padding: 20, gap: 16 },
  heroSection: { alignItems: "center", gap: 12, marginBottom: 8 },
  heroIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { fontSize: 26, textAlign: "center" },
  heroSub: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  featuresGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  featureItem: {
    width: "30%",
    alignItems: "center",
    padding: 14,
    gap: 8,
    borderWidth: 1,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  featureLabel: { fontSize: 11, textAlign: "center" },
  sectionLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  planCard: { gap: 12, overflow: "hidden" },
  popularBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  popularText: { color: "#FFFFFF", fontSize: 11 },
  planHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  planName: { fontSize: 18 },
  planPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  planPrice: { fontSize: 26 },
  planPeriod: { fontSize: 14 },
  radioBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  planFeature: { flexDirection: "row", alignItems: "center", gap: 8 },
  planFeatureText: { fontSize: 14 },
  subscribeBtn: {
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  subscribeBtnText: { color: "#FFFFFF", fontSize: 17 },
  legal: { fontSize: 12, textAlign: "center", opacity: 0.7 },
});
