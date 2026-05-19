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
import { useApp } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";

const RECOVERY_GUIDES = [
  {
    id: "impersonation",
    threatTypes: ["impersonator", "fake_account"],
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
    id: "password",
    threatTypes: ["leaked_password"],
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
    id: "photos",
    threatTypes: ["stolen_photo"],
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
    id: "phishing",
    threatTypes: ["scam"],
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
  {
    id: "darkweb",
    threatTypes: ["dark_web"],
    icon: "eye-off" as const,
    title: "Dark Web Exposure",
    steps: [
      "Change passwords on all mentioned accounts immediately",
      "Enable two-factor authentication on all critical accounts",
      "Freeze your credit at all three major bureaus if PII exposed",
      "Monitor accounts for unauthorized access attempts",
      "Consider identity theft protection services",
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

type ThreatIconName =
  | "impersonator"
  | "fake_account"
  | "stolen_photo"
  | "leaked_password"
  | "scam"
  | "dark_web";

function threatLabel(type: string): string {
  const MAP: Record<string, string> = {
    impersonator: "Impersonator",
    fake_account: "Fake Account",
    stolen_photo: "Stolen Photo",
    leaked_password: "Leaked Password",
    scam: "Scam",
    dark_web: "Dark Web",
  };
  return MAP[type] ?? type;
}

function threatIcon(type: string): React.ComponentProps<typeof Ionicons>["name"] {
  const MAP: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
    impersonator: "person-remove",
    fake_account: "person-remove",
    stolen_photo: "image",
    leaked_password: "lock-open",
    scam: "alert-circle",
    dark_web: "eye-off",
  };
  return MAP[type] ?? "warning";
}

export default function Recovery() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { threats } = useApp();
  const [expanded, setExpanded] = useState<string | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const activeThreats = threats.filter((t) => !t.resolved);
  const urgentGuides = RECOVERY_GUIDES.filter((g) =>
    g.threatTypes.some((type) => activeThreats.some((t) => t.type === type))
  );
  const otherGuides = RECOVERY_GUIDES.filter(
    (g) => !urgentGuides.includes(g)
  );

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
        {/* Active threats banner */}
        {activeThreats.length > 0 && (
          <GlassCard style={[styles.activeCard, { borderColor: colors.danger + "44" }]}>
            <LinearGradient
              colors={[colors.danger + "14", "transparent"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.activeHeader}>
              <Ionicons name="flash" size={16} color={colors.danger} />
              <Text style={[styles.activeTitle, { color: colors.danger, fontFamily: "Inter_700Bold" }]}>
                {activeThreats.length} Active Threat{activeThreats.length !== 1 ? "s" : ""} — Action Needed
              </Text>
            </View>
            <View style={styles.activeThreatList}>
              {activeThreats.slice(0, 4).map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.activeThreatRow, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/threat/${t.id}` as any)}
                >
                  <View style={[styles.activeThreatIcon, { backgroundColor: colors.danger + "22" }]}>
                    <Ionicons name={threatIcon(t.type)} size={14} color={colors.danger} />
                  </View>
                  <View style={styles.activeThreatText}>
                    <Text style={[styles.activeThreatLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]} numberOfLines={1}>
                      {t.title}
                    </Text>
                    <Text style={[styles.activeThreatType, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {threatLabel(t.type)} · {t.severity} severity
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          </GlassCard>
        )}

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

        {/* Urgent guides (matching active threats) */}
        {urgentGuides.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Recommended for You
              </Text>
              <View style={[styles.urgentBadge, { backgroundColor: colors.danger + "22" }]}>
                <Text style={[styles.urgentBadgeText, { color: colors.danger, fontFamily: "Inter_700Bold" }]}>
                  URGENT
                </Text>
              </View>
            </View>
            {urgentGuides.map((guide) => (
              <GuideCard
                key={guide.id}
                guide={guide}
                isExpanded={expanded === guide.id}
                onToggle={() => setExpanded(expanded === guide.id ? null : guide.id)}
                accentColor={colors.danger}
                colors={colors}
                urgent
              />
            ))}
          </>
        )}

        {/* All guides */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          {urgentGuides.length > 0 ? "All Recovery Guides" : "Recovery Guides"}
        </Text>

        {(urgentGuides.length > 0 ? otherGuides : RECOVERY_GUIDES).map((guide) => (
          <GuideCard
            key={guide.id}
            guide={guide}
            isExpanded={expanded === guide.id}
            onToggle={() => setExpanded(expanded === guide.id ? null : guide.id)}
            accentColor={colors.success}
            colors={colors}
            urgent={false}
          />
        ))}

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

type GuideCardProps = {
  guide: (typeof RECOVERY_GUIDES)[number];
  isExpanded: boolean;
  onToggle: () => void;
  accentColor: string;
  colors: ReturnType<typeof useColors>;
  urgent: boolean;
};

function GuideCard({ guide, isExpanded, onToggle, accentColor, colors, urgent }: GuideCardProps) {
  return (
    <GlassCard
      style={[styles.guideCard, urgent && { borderColor: accentColor + "33" }]}
      noPadding
    >
      {urgent && (
        <LinearGradient
          colors={[accentColor + "0C", "transparent"]}
          style={StyleSheet.absoluteFill}
        />
      )}
      <TouchableOpacity
        style={styles.guideHeader}
        activeOpacity={0.75}
        onPress={onToggle}
      >
        <View style={[styles.guideIcon, { backgroundColor: accentColor + "22" }]}>
          <Ionicons name={guide.icon} size={20} color={accentColor} />
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
              <View style={[styles.guideStepNum, { backgroundColor: accentColor + "22" }]}>
                <Text style={[styles.guideStepNumText, { color: accentColor, fontFamily: "Inter_700Bold" }]}>
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

  activeCard: { gap: 12, overflow: "hidden" },
  activeHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  activeTitle: { fontSize: 14 },
  activeThreatList: { gap: 6 },
  activeThreatRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  activeThreatIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  activeThreatText: { flex: 1 },
  activeThreatLabel: { fontSize: 13 },
  activeThreatType: { fontSize: 11 },

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

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitle: { fontSize: 16, flex: 1 },
  urgentBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  urgentBadgeText: { fontSize: 10, letterSpacing: 0.5 },

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
