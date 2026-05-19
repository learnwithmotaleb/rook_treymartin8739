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
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";

const RECOVERY_GUIDES = [
  {
    id: "1",
    icon: "person-remove" as const,
    title: "Account Impersonation",
    steps: [
      "Report the impersonating account on the platform",
      "Document evidence with screenshots before reporting",
      "File a report with the platform's trust & safety team",
      "Notify your followers about the fake account",
      "Contact ShieldID support for additional assistance",
    ],
    platforms: ["Instagram", "TikTok", "X", "Facebook"],
  },
  {
    id: "2",
    icon: "lock-open" as const,
    title: "Compromised Password",
    steps: [
      "Immediately change your password on the affected account",
      "Enable two-factor authentication",
      "Check for any unauthorized activity in account history",
      "Update the same password on other accounts",
      "Scan for other potential exposures",
    ],
    platforms: [],
  },
  {
    id: "3",
    icon: "image" as const,
    title: "Stolen Profile Photos",
    steps: [
      "File a DMCA copyright takedown request",
      "Report the account directly on the platform",
      "Add a visible watermark to future photos",
      "Document all instances for legal records",
      "Consider consulting a digital rights attorney",
    ],
    platforms: ["All Platforms"],
  },
  {
    id: "4",
    icon: "alert-circle" as const,
    title: "Phishing / Scam Account",
    steps: [
      "Report the account for fraud immediately",
      "Alert your followers not to engage",
      "Contact the platform's fraud team directly",
      "File a report with your local cybercrime authority",
      "Monitor for new impersonation attempts",
    ],
    platforms: [],
  },
];

const EMERGENCY_STEPS = [
  { icon: "lock-closed" as const, label: "Secure all accounts", color: "#10B981" },
  { icon: "eye-off" as const, label: "Review privacy settings", color: "#3B82F6" },
  { icon: "alert" as const, label: "Alert your network", color: "#F59E0B" },
  { icon: "shield" as const, label: "Report all threats", color: "#EF4444" },
];

export default function Recovery() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<string | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#10B98111", "transparent"]}
        style={styles.topGradient}
      />
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          Recovery Hub
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
        {/* Emergency Checklist */}
        <GlassCard style={[styles.emergencyCard, { borderColor: colors.danger + "44" }]}>
          <View style={styles.emergencyHeader}>
            <Ionicons name="flash" size={20} color={colors.danger} />
            <Text style={[styles.emergencyTitle, { color: colors.danger, fontFamily: "Inter_700Bold" }]}>
              Emergency Lockdown
            </Text>
          </View>
          <Text style={[styles.emergencyDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            If you believe your identity has been compromised, take these steps immediately:
          </Text>
          <View style={styles.emergencySteps}>
            {EMERGENCY_STEPS.map((step, i) => (
              <View key={i} style={[styles.emergencyStep, { borderColor: colors.border }]}>
                <View style={[styles.stepNum, { backgroundColor: step.color + "22" }]}>
                  <Text style={[styles.stepNumText, { color: step.color, fontFamily: "Inter_700Bold" }]}>
                    {i + 1}
                  </Text>
                </View>
                <Ionicons name={step.icon} size={18} color={step.color} />
                <Text style={[styles.stepLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {step.label}
                </Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* Recovery Guides */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          Recovery Guides
        </Text>

        {RECOVERY_GUIDES.map((guide) => {
          const isExpanded = expanded === guide.id;
          return (
            <GlassCard key={guide.id} style={styles.guideCard} noPadding>
              <TouchableOpacity
                style={styles.guideHeader}
                activeOpacity={0.75}
                onPress={() => setExpanded(isExpanded ? null : guide.id)}
              >
                <View style={[styles.guideIcon, { backgroundColor: colors.success + "22" }]}>
                  <Ionicons name={guide.icon} size={20} color={colors.success} />
                </View>
                <Text style={[styles.guideTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {guide.title}
                </Text>
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={[styles.guideContent, { borderTopColor: colors.border }]}>
                  {guide.steps.map((step, i) => (
                    <View key={i} style={styles.guideStep}>
                      <View style={[styles.guideStepNum, { backgroundColor: colors.primary + "22" }]}>
                        <Text style={[styles.guideStepNumText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                          {i + 1}
                        </Text>
                      </View>
                      <Text style={[styles.guideStepText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                        {step}
                      </Text>
                    </View>
                  ))}
                  {guide.platforms.length > 0 && (
                    <View style={[styles.platformTags, { borderTopColor: colors.border }]}>
                      <Text style={[styles.platformTagsLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                        Applies to:
                      </Text>
                      <View style={styles.tags}>
                        {guide.platforms.map((p, i) => (
                          <View key={i} style={[styles.tag, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                            <Text style={[styles.tagText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                              {p}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </GlassCard>
          );
        })}

        {/* Contact Support */}
        <GlassCard style={[styles.supportCard, { borderColor: colors.primary + "44" }]}>
          <Ionicons name="headset" size={24} color={colors.primary} />
          <View style={styles.supportText}>
            <Text style={[styles.supportTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Need Help?
            </Text>
            <Text style={[styles.supportDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Our identity protection team is available 24/7 for Premium users.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.contactBtnText, { fontFamily: "Inter_600SemiBold" }]}>
              Contact
            </Text>
          </TouchableOpacity>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 200 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, flex: 1, marginLeft: 12 },
  content: { padding: 16, gap: 14 },
  emergencyCard: { gap: 12 },
  emergencyHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  emergencyTitle: { fontSize: 16 },
  emergencyDesc: { fontSize: 13, lineHeight: 20 },
  emergencySteps: { gap: 8 },
  emergencyStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { fontSize: 13 },
  stepLabel: { fontSize: 14, flex: 1 },
  sectionTitle: { fontSize: 16 },
  guideCard: { overflow: "hidden" },
  guideHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  guideIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  guideTitle: { flex: 1, fontSize: 15 },
  guideContent: { padding: 16, gap: 12, borderTopWidth: 1 },
  guideStep: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  guideStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  guideStepNumText: { fontSize: 12 },
  guideStepText: { fontSize: 14, lineHeight: 21, flex: 1 },
  platformTags: { borderTopWidth: 1, paddingTop: 12, gap: 8 },
  platformTagsLabel: { fontSize: 12 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  tagText: { fontSize: 12 },
  supportCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  supportText: { flex: 1, gap: 4 },
  supportTitle: { fontSize: 15 },
  supportDesc: { fontSize: 13, lineHeight: 18 },
  contactBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  contactBtnText: { color: "#FFFFFF", fontSize: 13 },
});
