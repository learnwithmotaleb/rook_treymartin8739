import React from "react";
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
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";

export default function ToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { threats } = useApp();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const mediaThreats = threats.filter(
    (t) => !t.resolved && ["stolen_photo", "impersonator", "fake_account"].includes(t.type)
  ).length;

  const darkWebThreats = threats.filter(
    (t) => !t.resolved && ["dark_web", "leaked_password"].includes(t.type)
  ).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={["#3B82F611", "transparent"]} style={styles.topGradient} />

      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Protection Tools
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
      >
        {/* Photo Monitor */}
        <GlassCard style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={[styles.heroIcon, { backgroundColor: "#8B5CF622" }]}>
              <MaterialCommunityIcons name="image-search" size={36} color="#8B5CF6" />
            </View>
            {mediaThreats > 0 && (
              <View style={[styles.alertPill, { backgroundColor: colors.danger }]}>
                <Text style={styles.alertPillText}>{mediaThreats} alert{mediaThreats !== 1 ? "s" : ""}</Text>
              </View>
            )}
          </View>

          <Text style={[styles.heroTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Photo Monitor
          </Text>
          <Text style={[styles.heroDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            We scan the web to find where your photos are being used without permission across all major platforms. Powered by perceptual image fingerprinting.
          </Text>

          <View style={styles.heroFeatures}>
            {[
              "Detects stolen profile pictures",
              "Finds impersonator accounts",
              "Compares across Instagram, TikTok & more",
            ].map((f) => (
              <View key={f} style={styles.featureRow}>
                <View style={[styles.featureDot, { backgroundColor: "#8B5CF6" }]} />
                <Text style={[styles.featureText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {f}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.heroBtn, { backgroundColor: "#8B5CF6" }]}
            activeOpacity={0.8}
            onPress={() => router.push("/photo-monitor" as any)}
          >
            <MaterialCommunityIcons name="image-search" size={18} color="#FFFFFF" />
            <Text style={[styles.heroBtnText, { fontFamily: "Inter_600SemiBold" }]}>
              View Photo Scan Results
            </Text>
          </TouchableOpacity>
        </GlassCard>

        {/* Dark Web Monitor */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/dark-web-monitor" as any)}
        >
          <GlassCard style={styles.toolCard}>
            <View style={styles.toolRow}>
              <View style={[styles.toolIcon, { backgroundColor: "#7C3AED22" }]}>
                <MaterialCommunityIcons name="shield-alert" size={28} color="#7C3AED" />
              </View>
              <View style={styles.toolText}>
                <View style={styles.toolTitleRow}>
                  <Text style={[styles.toolTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    Dark Web Monitor
                  </Text>
                  {darkWebThreats > 0 && (
                    <View style={[styles.alertPillSmall, { backgroundColor: colors.danger }]}>
                      <Text style={styles.alertPillTextSmall}>{darkWebThreats}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.toolDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Check if your email or credentials appear in known data breaches
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </View>

            <View style={styles.toolTags}>
              {["Email leaks", "Password breaches", "HIBP database"].map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: "#7C3AED14", borderColor: "#7C3AED33" }]}>
                  <Text style={[styles.tagText, { color: "#7C3AED", fontFamily: "Inter_500Medium" }]}>{tag}</Text>
                </View>
              ))}
            </View>
          </GlassCard>
        </TouchableOpacity>

        {/* AI Scam Analyzer */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/subscription" as any)}
        >
          <GlassCard style={[styles.toolCard, { opacity: 0.75 }]}>
            <View style={styles.toolRow}>
              <View style={[styles.toolIcon, { backgroundColor: "#10B98122" }]}>
                <Ionicons name="sparkles" size={28} color="#10B981" />
              </View>
              <View style={styles.toolText}>
                <View style={styles.toolTitleRow}>
                  <Text style={[styles.toolTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    AI Scam Analyzer
                  </Text>
                  <View style={[styles.proPill, { backgroundColor: "#F59E0B22", borderColor: "#F59E0B55" }]}>
                    <Text style={[styles.proPillText, { color: "#F59E0B", fontFamily: "Inter_700Bold" }]}>PRO</Text>
                  </View>
                </View>
                <Text style={[styles.toolDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Paste a suspicious message and get an instant AI risk assessment
                </Text>
              </View>
              <Ionicons name="lock-closed" size={18} color={colors.mutedForeground} />
            </View>
          </GlassCard>
        </TouchableOpacity>

        {/* Recovery Hub — coming soon */}
        <GlassCard style={[styles.toolCard, styles.comingSoonCard]}>
          <View style={styles.toolRow}>
            <View style={[styles.toolIcon, { backgroundColor: "#3B82F622" }]}>
              <Ionicons name="shield-half" size={28} color="#3B82F6" />
            </View>
            <View style={styles.toolText}>
              <View style={styles.toolTitleRow}>
                <Text style={[styles.toolTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  Recovery Hub
                </Text>
                <View style={[styles.soonPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.soonPillText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>SOON</Text>
                </View>
              </View>
              <Text style={[styles.toolDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Step-by-step guides to report and remove impersonator accounts
              </Text>
            </View>
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 250 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24 },
  content: { padding: 16, gap: 14 },

  heroCard: { gap: 14 },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  heroIcon: {
    width: 64, height: 64, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  alertPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  alertPillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  heroTitle: { fontSize: 22 },
  heroDesc: { fontSize: 14, lineHeight: 22 },
  heroFeatures: { gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureDot: { width: 6, height: 6, borderRadius: 3 },
  featureText: { fontSize: 13 },
  heroBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, height: 48, borderRadius: 24,
  },
  heroBtnText: { color: "#FFFFFF", fontSize: 15 },

  toolCard: { gap: 12 },
  toolRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  toolIcon: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  toolText: { flex: 1, gap: 4 },
  toolTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  toolTitle: { fontSize: 16 },
  toolDesc: { fontSize: 13, lineHeight: 19 },
  toolTags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  tagText: { fontSize: 11 },

  alertPillSmall: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  alertPillTextSmall: { color: "#fff", fontSize: 11, fontWeight: "700" },

  proPill: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1,
  },
  proPillText: { fontSize: 10 },

  soonPill: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1,
  },
  soonPillText: { fontSize: 10 },

  comingSoonCard: { opacity: 0.6 },
});
