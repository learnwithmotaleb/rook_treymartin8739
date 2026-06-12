import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { Threat, ThreatType, Severity } from "@/context/AppContext";
import { GlassCard } from "./GlassCard";
import { severityColor } from "@/lib/severity";

function threatIcon(type: ThreatType): { name: string; lib: "ionicons" | "mci" } {
  switch (type) {
    case "impersonator": return { name: "person-remove", lib: "ionicons" };
    case "fake_account": return { name: "account-multiple-remove", lib: "mci" };
    case "leaked_password": return { name: "lock-open", lib: "ionicons" };
    case "suspicious_login": return { name: "warning", lib: "ionicons" };
    case "stolen_photo": return { name: "image-remove", lib: "mci" };
    case "scam": return { name: "shield-remove", lib: "mci" };
  }
}

interface ThreatCardProps {
  threat: Threat;
  compact?: boolean;
}

export function ThreatCard({ threat, compact }: ThreatCardProps) {
  const colors = useColors();
  const sc = severityColor(threat.severity, colors);
  const icon = threatIcon(threat.type);

  const scoreColor =
    threat.threatScore >= 80
      ? colors.danger
      : threat.threatScore >= 55
      ? colors.warning
      : colors.success;

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
            <View style={[styles.scoreChip, { backgroundColor: scoreColor + "22" }]}>
              <Text style={[styles.scoreText, { color: scoreColor, fontFamily: "Inter_700Bold" }]}>
                {threat.threatScore}
              </Text>
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
