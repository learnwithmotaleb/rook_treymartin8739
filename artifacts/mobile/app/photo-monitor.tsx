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
import { GlassCard } from "@/components/GlassCard";
import { PlatformIcon } from "@/components/PlatformIcon";

const MOCK_MATCHES = [
  {
    id: "1",
    platform: "tiktok" as const,
    username: "@alex.clone.2024",
    similarity: 89,
    followers: 4100,
    detectedAt: "5h ago",
    status: "active",
  },
  {
    id: "2",
    platform: "instagram" as const,
    username: "@real.alex.official",
    similarity: 94,
    followers: 2300,
    detectedAt: "2m ago",
    status: "active",
  },
  {
    id: "3",
    platform: "facebook" as const,
    username: "Alex Johnson Fan Page",
    similarity: 76,
    followers: 890,
    detectedAt: "2d ago",
    status: "reported",
  },
];

export default function PhotoMonitor() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#8B5CF611", "transparent"]}
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
          Photo Monitor
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
        {/* Stats */}
        <View style={styles.statsRow}>
          <GlassCard style={styles.statCard}>
            <MaterialCommunityIcons name="image-search" size={24} color="#8B5CF6" />
            <Text style={[styles.statNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              3
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Matches Found
            </Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Ionicons name="camera" size={24} color={colors.primary} />
            <Text style={[styles.statNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              6
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Photos Tracked
            </Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <MaterialCommunityIcons name="radar" size={24} color={colors.success} />
            <Text style={[styles.statNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              6
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Platforms Scanned
            </Text>
          </GlassCard>
        </View>

        {/* Info card */}
        <GlassCard style={[styles.infoCard, { borderColor: "#8B5CF644" }]}>
          <MaterialCommunityIcons name="image-search" size={20} color="#8B5CF6" />
          <View style={styles.infoText}>
            <Text style={[styles.infoTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              How Photo Monitoring Works
            </Text>
            <Text style={[styles.infoDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              ShieldID creates a visual fingerprint of your profile photos and scans the web every 24 hours for accounts using them without permission.
            </Text>
          </View>
        </GlassCard>

        {/* Matches */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          Suspected Matches ({MOCK_MATCHES.length})
        </Text>

        {MOCK_MATCHES.map((match) => (
          <GlassCard key={match.id} style={styles.matchCard}>
            <View style={styles.matchHeader}>
              <PlatformIcon platform={match.platform} size={40} />
              <View style={styles.matchInfo}>
                <Text style={[styles.matchUsername, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {match.username}
                </Text>
                <Text style={[styles.matchFollowers, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {match.followers.toLocaleString()} followers · {match.detectedAt}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      match.status === "active"
                        ? colors.danger + "22"
                        : colors.success + "22",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        match.status === "active"
                          ? colors.danger
                          : colors.success,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {match.status === "active" ? "Active" : "Reported"}
                </Text>
              </View>
            </View>

            {/* Similarity bar */}
            <View style={styles.similarityRow}>
              <Text style={[styles.similarityLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Photo similarity
              </Text>
              <Text
                style={[
                  styles.similarityPct,
                  {
                    color: match.similarity >= 85 ? colors.danger : colors.warning,
                    fontFamily: "Inter_700Bold",
                  },
                ]}
              >
                {match.similarity}%
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${match.similarity}%`,
                    backgroundColor:
                      match.similarity >= 85 ? colors.danger : colors.warning,
                  },
                ]}
              />
            </View>

            {match.status === "active" && (
              <TouchableOpacity
                style={[styles.reportBtn, { backgroundColor: colors.danger + "22", borderColor: colors.danger + "44" }]}
                activeOpacity={0.8}
              >
                <Ionicons name="flag" size={16} color={colors.danger} />
                <Text style={[styles.reportBtnText, { color: colors.danger, fontFamily: "Inter_600SemiBold" }]}>
                  Report This Account
                </Text>
              </TouchableOpacity>
            )}
          </GlassCard>
        ))}
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
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, alignItems: "center", gap: 6 },
  statNum: { fontSize: 22 },
  statLabel: { fontSize: 11, textAlign: "center" },
  infoCard: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  infoText: { flex: 1, gap: 6 },
  infoTitle: { fontSize: 14 },
  infoDesc: { fontSize: 13, lineHeight: 20 },
  sectionTitle: { fontSize: 16 },
  matchCard: { gap: 12 },
  matchHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  matchInfo: { flex: 1 },
  matchUsername: { fontSize: 15 },
  matchFollowers: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12 },
  similarityRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  similarityLabel: { fontSize: 13 },
  similarityPct: { fontSize: 14 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
  },
  reportBtnText: { fontSize: 14 },
});
