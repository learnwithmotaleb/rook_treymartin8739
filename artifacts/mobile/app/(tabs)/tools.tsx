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
import { MaterialCommunityIcons } from "@expo/vector-icons";
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
        {/* Photo Monitor — primary tool */}
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

        {/* Coming soon placeholder */}
        <GlassCard style={[styles.comingSoonCard, { borderColor: colors.border }]}>
          <Text style={[styles.comingSoonLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            More tools coming soon
          </Text>
          <Text style={[styles.comingSoonSub, { color: colors.mutedForeground + "99", fontFamily: "Inter_400Regular" }]}>
            AI Scam Analyzer · Dark Web Monitor · Recovery Hub
          </Text>
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
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  alertPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  alertPillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  heroTitle: { fontSize: 22 },
  heroDesc: { fontSize: 14, lineHeight: 22 },
  heroFeatures: { gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureDot: { width: 6, height: 6, borderRadius: 3 },
  featureText: { fontSize: 13 },
  heroBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 24,
  },
  heroBtnText: { color: "#FFFFFF", fontSize: 15 },

  comingSoonCard: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 20,
    borderStyle: "dashed",
    borderWidth: 1,
  },
  comingSoonLabel: { fontSize: 13 },
  comingSoonSub: { fontSize: 12, textAlign: "center" },
});
