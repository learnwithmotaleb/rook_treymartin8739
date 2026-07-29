import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { Threat, ThreatType } from "@/context/AppContext";
import { GlassCard } from "./GlassCard";
import { severityColor } from "@/lib/severity";

function threatIcon(type: ThreatType | string): { name: string; lib: "ionicons" | "mci" } {
  switch (type) {
    case "impersonator": return { name: "person-remove", lib: "ionicons" };
    case "fake_account": return { name: "account-multiple-remove", lib: "mci" };
    case "leaked_password": return { name: "lock-open", lib: "ionicons" };
    case "suspicious_login": return { name: "warning", lib: "ionicons" };
    case "stolen_photo": return { name: "image-remove", lib: "mci" };
    case "scam": return { name: "shield-remove", lib: "mci" };
    default: return { name: "alert-circle-outline", lib: "ionicons" };
  }
}

interface ThreatCardProps {
  threat: Threat;
  compact?: boolean;
  isLocked?: boolean;
}

export function ThreatCard({ threat, compact, isLocked }: ThreatCardProps) {
  const colors = useColors();
  const sc = severityColor(threat.severity, colors);
  const icon = threatIcon(threat.type);

  const scoreColor =
    threat.threatScore >= 80
      ? colors.danger
      : threat.threatScore >= 55
      ? colors.warning
      : colors.success;

  const severityLabel =
    threat.severity === "high" ? "HIGH" : threat.severity === "medium" ? "MED" : "LOW";

  if (isLocked) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push("/subscription" as any)}
      >
        <View style={[lockedStyles.wrapper, { backgroundColor: colors.card, borderColor: sc + "30" }]}>
          <View style={[lockedStyles.accentBar, { backgroundColor: sc }]} />
          <View style={lockedStyles.body}>
            <View style={lockedStyles.topRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[lockedStyles.severityPill, { backgroundColor: sc + "20", borderColor: sc + "50" }]}>
                  <View style={[lockedStyles.severityDot, { backgroundColor: sc }]} />
                  <Text style={[lockedStyles.severityText, { color: sc, fontFamily: "Inter_700Bold" }]}>
                    {severityLabel}
                  </Text>
                </View>
                {threat.platform ? (
                  <Text style={[lockedStyles.platformLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {threat.platform.charAt(0).toUpperCase() + threat.platform.slice(1)}
                  </Text>
                ) : null}
              </View>
              <View style={[lockedStyles.lockBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Ionicons name="lock-closed" size={11} color={colors.mutedForeground} />
              </View>
            </View>
            <View style={lockedStyles.skeletonGroup}>
              <Text style={[lockedStyles.threatHint, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                {threat.type === "impersonator" || threat.type === "fake_account"
                  ? "Impersonation detected"
                  : threat.type === "stolen_photo"
                  ? "Photo theft found"
                  : "Identity threat detected"}
              </Text>
              <View style={[lockedStyles.skeletonLine, { backgroundColor: colors.border, width: "45%", opacity: 0.4 }]} />
            </View>
            <View style={lockedStyles.ctaRow}>
              <Text style={[lockedStyles.ctaText, { color: colors.premium, fontFamily: "Inter_600SemiBold" }]}>
                Unlock with Premium
              </Text>
              <Ionicons name="arrow-forward" size={12} color={colors.premium} />
            </View>
          </View>
          <LinearGradient
            colors={["transparent", colors.card + "E0"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            pointerEvents="none"
          />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => router.push(`/threat/${threat.id}` as any)}
    >
      <GlassCard style={styles.card}>
        <View style={[styles.severityBar, { backgroundColor: sc }]} />
        <View style={[styles.iconBox, { backgroundColor: sc + "22" }]}>
          {icon.lib === "ionicons" ? (
            <Ionicons name={icon.name as any} size={20} color={sc} />
          ) : (
            <MaterialCommunityIcons name={icon.name as any} size={20} color={sc} />
          )}
        </View>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text
              style={[styles.title, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
              numberOfLines={1}
            >
              {threat.title}
            </Text>
            <View style={styles.headerRight}>
              {threat.highConfidence && (
                <View style={[styles.verifiedBadge, { backgroundColor: colors.success + "22" }]}>
                  <MaterialCommunityIcons name="shield-check" size={10} color={colors.success} />
                  <Text style={[styles.verifiedText, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>
                    Verified
                  </Text>
                </View>
              )}
              <View style={[styles.scoreChip, { backgroundColor: scoreColor + "22" }]}>
                <Text style={[styles.scoreText, { color: scoreColor, fontFamily: "Inter_700Bold" }]}>
                  {threat.threatScore}
                </Text>
              </View>
            </View>
          </View>
          <Text
            style={[styles.desc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
            numberOfLines={compact ? 1 : 2}
          >
            {threat.description}
          </Text>
          <View style={styles.footer}>
            <Text style={[styles.time, { color: colors.mutedForeground + "99", fontFamily: "Inter_400Regular" }]}>
              {threat.time}
            </Text>
            {threat.matchedMediaCount > 0 && (
              <View style={[styles.mediaBadge, { backgroundColor: colors.secondary }]}>
                <MaterialCommunityIcons name="image-multiple" size={11} color={colors.mutedForeground} />
                <Text style={[styles.mediaBadgeText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {threat.matchedMediaCount} media matched
                </Text>
              </View>
            )}
          </View>
          <View style={[styles.aiDisclaimer, { backgroundColor: colors.secondary }]}>
            <MaterialCommunityIcons name="robot-outline" size={9} color={colors.mutedForeground + "88"} />
            <Text style={[styles.aiDisclaimerText, { color: colors.mutedForeground + "88", fontFamily: "Inter_400Regular" }]}>
              AI · May contain errors
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    paddingLeft: 0,
    overflow: "hidden",
  },
  severityBar: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 2,
    marginRight: 4,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  content: { flex: 1, gap: 4 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 20,
  },
  verifiedText: { fontSize: 9 },
  title: { fontSize: 14, flex: 1 },
  scoreChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  scoreText: { fontSize: 12 },
  desc: { fontSize: 13, lineHeight: 18 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  time: { fontSize: 12 },
  mediaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
  },
  mediaBadgeText: { fontSize: 10 },
  aiDisclaimer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  aiDisclaimerText: { fontSize: 9 },
});

const lockedStyles = StyleSheet.create({
  wrapper: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
    marginBottom: 10,
    minHeight: 90,
  },
  accentBar: {
    width: 4,
    alignSelf: "stretch",
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    justifyContent: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  severityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  severityText: { fontSize: 11, letterSpacing: 0.6 },
  lockBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  platformLabel: { fontSize: 11 },
  skeletonGroup: { gap: 6 },
  skeletonLine: { height: 9, borderRadius: 5 },
  threatHint: { fontSize: 13, opacity: 0.55 },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  ctaText: { fontSize: 12 },
});
