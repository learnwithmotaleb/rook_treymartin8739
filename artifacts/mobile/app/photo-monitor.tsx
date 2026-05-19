import React, { useCallback, useState } from "react";
import {
  Platform,
  RefreshControl,
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
import { PlatformIcon } from "@/components/PlatformIcon";

const MEDIA_THREAT_TYPES = ["stolen_photo", "impersonator", "fake_account", "scam"];

export default function PhotoMonitor() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, threats, refreshData } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const mediaThreats = threats.filter(
    (t) => MEDIA_THREAT_TYPES.includes(t.type) && !t.resolved
  );

  const totalStolen = mediaThreats.reduce(
    (sum, t) => sum + (t.matchedMediaCount ?? 0),
    0
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  function severityColor(severity: string) {
    if (severity === "high") return colors.danger;
    if (severity === "medium") return colors.warning;
    return colors.success;
  }

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <GlassCard style={styles.statCard}>
            <MaterialCommunityIcons name="image-search" size={24} color="#8B5CF6" />
            <Text style={[styles.statNum, { color: mediaThreats.length > 0 ? colors.danger : colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {mediaThreats.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Matches Found
            </Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Ionicons name="camera" size={24} color={colors.primary} />
            <Text style={[styles.statNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {user.totalPhotosIndexed}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Photos Tracked
            </Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <MaterialCommunityIcons name="radar" size={24} color={colors.success} />
            <Text style={[styles.statNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {user.monitored}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Platforms
            </Text>
          </GlassCard>
        </View>

        {/* Stolen count banner */}
        {totalStolen > 0 && (
          <GlassCard style={[styles.stolenBanner, { borderColor: colors.danger + "44" }]}>
            <LinearGradient
              colors={[colors.danger + "18", "transparent"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.stolenIcon, { backgroundColor: colors.danger + "22" }]}>
              <Ionicons name="alert-circle" size={22} color={colors.danger} />
            </View>
            <View style={styles.stolenText}>
              <Text style={[styles.stolenTitle, { color: colors.danger, fontFamily: "Inter_600SemiBold" }]}>
                {totalStolen} Media Items Stolen
              </Text>
              <Text style={[styles.stolenSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Detected across {mediaThreats.length} suspicious account{mediaThreats.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </GlassCard>
        )}

        {/* How it works */}
        <GlassCard style={[styles.infoCard, { borderColor: "#8B5CF644" }]}>
          <MaterialCommunityIcons name="image-search" size={20} color="#8B5CF6" />
          <View style={styles.infoText}>
            <Text style={[styles.infoTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              How Photo Monitoring Works
            </Text>
            <Text style={[styles.infoDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              ShieldID creates a visual fingerprint of your {user.totalPhotosIndexed} photos across {user.monitored} platforms and scans for accounts using them without permission.
            </Text>
          </View>
        </GlassCard>

        {/* Fingerprint stats */}
        <GlassCard style={styles.fingerprintRow}>
          <View style={styles.fpStat}>
            <Text style={[styles.fpNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {user.totalPhotosIndexed}
            </Text>
            <Text style={[styles.fpLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Photos
            </Text>
          </View>
          <View style={[styles.fpDivider, { backgroundColor: colors.border }]} />
          <View style={styles.fpStat}>
            <Text style={[styles.fpNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {user.totalCaptionsIndexed}
            </Text>
            <Text style={[styles.fpLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Captions
            </Text>
          </View>
          <View style={[styles.fpDivider, { backgroundColor: colors.border }]} />
          <View style={styles.fpStat}>
            <Text style={[styles.fpNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {user.reelsIndexed}
            </Text>
            <Text style={[styles.fpLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Reels
            </Text>
          </View>
          <View style={[styles.fpDivider, { backgroundColor: colors.border }]} />
          <View style={styles.fpStat}>
            <Text style={[styles.fpNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {user.monitored}
            </Text>
            <Text style={[styles.fpLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Platforms
            </Text>
          </View>
        </GlassCard>

        {/* Threat matches */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          {mediaThreats.length > 0
            ? `Suspected Matches (${mediaThreats.length})`
            : "No Matches Detected"}
        </Text>

        {mediaThreats.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.success + "22" }]}>
              <Ionicons name="shield-checkmark" size={36} color={colors.success} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Your photos are safe
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              No accounts found using your photos without permission. Run a scan to check again.
            </Text>
          </GlassCard>
        ) : (
          mediaThreats.map((threat) => {
            const sc = severityColor(threat.severity);
            return (
              <TouchableOpacity
                key={threat.id}
                activeOpacity={0.85}
                onPress={() => router.push(`/threat/${threat.id}` as any)}
              >
                <GlassCard style={styles.matchCard}>
                  <View style={styles.matchHeader}>
                    {threat.platform ? (
                      <PlatformIcon platform={threat.platform} size={40} />
                    ) : (
                      <View style={[styles.genericIcon, { backgroundColor: colors.secondary }]}>
                        <MaterialCommunityIcons name="image-search" size={20} color={colors.mutedForeground} />
                      </View>
                    )}
                    <View style={styles.matchInfo}>
                      <Text style={[styles.matchUsername, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
                        {threat.suspiciousUsername || threat.title}
                      </Text>
                      <Text style={[styles.matchMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {threat.matchedMediaCount} items stolen · {threat.time}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: sc + "22" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: sc, fontFamily: "Inter_600SemiBold" },
                        ]}
                      >
                        {threat.severity.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Threat score bar */}
                  <View style={styles.similarityRow}>
                    <Text style={[styles.similarityLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      Threat score
                    </Text>
                    <Text
                      style={[
                        styles.similarityPct,
                        {
                          color: threat.threatScore >= 80 ? colors.danger : colors.warning,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      {threat.threatScore}/100
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${threat.threatScore}%`,
                          backgroundColor:
                            threat.threatScore >= 80 ? colors.danger : colors.warning,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.matchFooter}>
                    <Text style={[styles.matchDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>
                      {threat.description}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                  </View>
                </GlassCard>
              </TouchableOpacity>
            );
          })
        )}
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

  stolenBanner: { flexDirection: "row", alignItems: "center", gap: 12, overflow: "hidden" },
  stolenIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  stolenText: { flex: 1, gap: 2 },
  stolenTitle: { fontSize: 14 },
  stolenSub: { fontSize: 12 },

  infoCard: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  infoText: { flex: 1, gap: 6 },
  infoTitle: { fontSize: 14 },
  infoDesc: { fontSize: 13, lineHeight: 20 },

  fingerprintRow: { flexDirection: "row", alignItems: "center" },
  fpStat: { flex: 1, alignItems: "center", gap: 2 },
  fpNum: { fontSize: 18 },
  fpLabel: { fontSize: 11 },
  fpDivider: { width: 1, height: 28 },

  sectionTitle: { fontSize: 16 },

  emptyCard: { alignItems: "center", gap: 12, paddingVertical: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 17 },
  emptyDesc: { fontSize: 13, textAlign: "center", lineHeight: 19 },

  matchCard: { gap: 12 },
  matchHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  matchInfo: { flex: 1 },
  matchUsername: { fontSize: 15 },
  matchMeta: { fontSize: 12 },
  genericIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11 },
  similarityRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  similarityLabel: { fontSize: 13 },
  similarityPct: { fontSize: 14 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  matchFooter: { flexDirection: "row", alignItems: "center", gap: 8 },
  matchDesc: { flex: 1, fontSize: 13, lineHeight: 18 },
});
