import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { Threat, ThreatType, Severity } from "@/context/AppContext";
import { GlassCard } from "./GlassCard";

function severityColor(severity: Severity, colors: ReturnType<typeof useColors>) {
  switch (severity) {
    case "high": return colors.danger;
    case "medium": return colors.warning;
    case "low": return colors.success;
  }
}

function threatIcon(type: ThreatType): { name: string; lib: "ionicons" | "mci" } {
  switch (type) {
    case "impersonator": return { name: "person-remove", lib: "ionicons" };
    case "fake_account": return { name: "account-multiple-remove", lib: "mci" };
    case "leaked_password": return { name: "lock-open", lib: "ionicons" };
    case "suspicious_login": return { name: "warning", lib: "ionicons" };
    case "stolen_photo": return { name: "image-remove", lib: "mci" };
    case "scam": return { name: "shield-remove", lib: "mci" };
    case "dark_web": return { name: "eye-off", lib: "ionicons" };
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
            <View style={[styles.severityBadge, { backgroundColor: sc + "22" }]}>
              <Text style={[styles.severityText, { color: sc, fontFamily: "Inter_600SemiBold" }]}>
                {threat.severity.charAt(0).toUpperCase() + threat.severity.slice(1)}
              </Text>
            </View>
          </View>
          <Text
            style={[styles.desc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
            numberOfLines={compact ? 1 : 2}
          >
            {threat.description}
          </Text>
          <Text style={[styles.time, { color: colors.mutedForeground + "99", fontFamily: "Inter_400Regular" }]}>
            {threat.time}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
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
    height: "100%",
    borderRadius: 2,
    alignSelf: "stretch",
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
  content: {
    flex: 1,
    gap: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    fontSize: 14,
    flex: 1,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  severityText: {
    fontSize: 11,
  },
  desc: {
    fontSize: 13,
    lineHeight: 18,
  },
  time: {
    fontSize: 12,
  },
});
