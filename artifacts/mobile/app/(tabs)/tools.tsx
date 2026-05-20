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

interface ToolCardProps {
  icon: React.ReactNode;
  accentColor: string;
  title: string;
  description: string;
  buttonLabel: string;
  onPress: () => void;
  badge?: string;
  alertCount?: number;
}

function ToolCard({
  icon,
  accentColor,
  title,
  description,
  buttonLabel,
  onPress,
  badge,
  alertCount,
}: ToolCardProps) {
  const colors = useColors();
  return (
    <GlassCard style={styles.toolCard}>
      <View style={styles.toolCardTop}>
        <View style={[styles.toolIcon, { backgroundColor: accentColor + "22" }]}>
          {icon}
        </View>
        <View style={styles.toolBadges}>
          {badge && (
            <View style={[styles.badge, { backgroundColor: colors.primary + "22" }]}>
              <Text style={[styles.badgeText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                {badge}
              </Text>
            </View>
          )}
          {alertCount !== undefined && alertCount > 0 && (
            <View style={[styles.alertBadge, { backgroundColor: colors.danger }]}>
              <Text style={styles.alertBadgeText}>{alertCount}</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={[styles.toolTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
        {title}
      </Text>
      <Text style={[styles.toolDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {description}
      </Text>
      <TouchableOpacity
        style={[styles.toolBtn, { backgroundColor: accentColor }]}
        activeOpacity={0.8}
        onPress={onPress}
      >
        <Text style={[styles.toolBtnText, { fontFamily: "Inter_600SemiBold" }]}>
          {buttonLabel}
        </Text>
      </TouchableOpacity>
    </GlassCard>
  );
}

export default function ToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { threats } = useApp();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const mediaThreats = threats.filter(
    (t) => !t.resolved && ["stolen_photo", "impersonator", "fake_account", "scam"].includes(t.type)
  ).length;
  const darkWebThreats = threats.filter(
    (t) => !t.resolved && ["dark_web", "leaked_password"].includes(t.type)
  ).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#3B82F611", "transparent"]}
        style={styles.topGradient}
      />
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border },
        ]}
      >
        <Text
          style={[
            styles.headerTitle,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          Protection Tools
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 100 },
        ]}
      >
        <ToolCard
          accentColor={colors.primary}
          icon={<MaterialCommunityIcons name="brain" size={28} color={colors.primary} />}
          title="AI Scam Analyzer"
          description="Paste a suspicious message, link, or screenshot. Our AI will analyze it and explain the threat in plain English."
          buttonLabel="Analyze Now"
          badge="AI"
          onPress={() => router.push("/scam-analyzer" as any)}
        />

        <ToolCard
          accentColor="#8B5CF6"
          icon={<MaterialCommunityIcons name="image-search" size={28} color="#8B5CF6" />}
          title="Photo Monitor"
          description="We scan the web to find where your photos are being used without permission across all major platforms."
          buttonLabel="View Results"
          alertCount={mediaThreats}
          onPress={() => router.push("/photo-monitor" as any)}
        />

        <ToolCard
          accentColor={colors.success}
          icon={<Ionicons name="shield" size={28} color={colors.success} />}
          title="Recovery Hub"
          description="Step-by-step guides and one-tap tools to secure and recover compromised accounts quickly."
          buttonLabel="Open Hub"
          onPress={() => router.push("/recovery" as any)}
        />

        <ToolCard
          accentColor={colors.warning}
          icon={<MaterialCommunityIcons name="eye-off" size={28} color={colors.warning} />}
          title="Dark Web Monitor"
          description="Continuously monitors dark web databases, forums, and breach databases for your personal information."
          buttonLabel="View Report"
          alertCount={darkWebThreats}
          onPress={() => router.push("/dark-web" as any)}
        />
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
  content: { padding: 16, gap: 12 },
  toolCard: { gap: 12 },
  toolCardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  toolIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  toolBadges: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: { fontSize: 11 },
  alertBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  alertBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  toolTitle: { fontSize: 17 },
  toolDesc: { fontSize: 14, lineHeight: 21 },
  toolBtn: {
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  toolBtnText: { color: "#FFFFFF", fontSize: 14 },
});
