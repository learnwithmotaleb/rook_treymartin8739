import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useApp, Severity, type MatchedEvidence, type ThreatScoreBreakdown } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { PlatformIcon } from "@/components/PlatformIcon";
import { getThreat, resolveThreat as apiResolveThreat, type ThreatDetail } from "@/lib/api";

function severityColor(severity: Severity, colors: ReturnType<typeof useColors>) {
  if (severity === "high") return colors.danger;
  if (severity === "medium") return colors.warning;
  return colors.success;
}

function ScoreGauge({ score }: { score: number }) {
  const colors = useColors();
  const color =
    score >= 80 ? colors.danger : score >= 55 ? colors.warning : colors.success;
  return (
    <View style={styles.gaugeContainer}>
      <View style={[styles.gaugeOuter, { borderColor: color + "33" }]}>
        <LinearGradient
          colors={[color + "33", color + "11"]}
          style={StyleSheet.absoluteFill}
        />
        <Text style={[styles.gaugeScore, { color, fontFamily: "Inter_700Bold" }]}>
          {score}
        </Text>
        <Text style={[styles.gaugeLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          / 100
        </Text>
      </View>
      <Text style={[styles.gaugeRisk, { color, fontFamily: "Inter_600SemiBold" }]}>
        {score >= 80 ? "High Risk" : score >= 55 ? "Medium Risk" : "Low Risk"}
      </Text>
    </View>
  );
}

function ScoreBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const colors = useColors();
  const pct = Math.round((value / max) * 100);
  return (
    <View style={styles.scoreBarRow}>
      <Text style={[styles.scoreBarLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {label}
      </Text>
      <View style={styles.scoreBarTrackWrap}>
        <View style={[styles.scoreBarTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.scoreBarFill,
              { width: `${pct}%`, backgroundColor: color },
            ]}
          />
        </View>
        <Text style={[styles.scoreBarValue, { color, fontFamily: "Inter_700Bold" }]}>
          {value}/{max}
        </Text>
      </View>
    </View>
  );
}

function EvidencePhotoBox({
  side,
  photoUrl,
  caption,
  simColor,
}: {
  side: "yours" | "stolen";
  photoUrl?: string;
  caption?: string;
  simColor: string;
}) {
  const colors = useColors();
  const [imgFailed, setImgFailed] = useState(false);
  const boxColor = side === "yours" ? colors.success : simColor;
  const showImage = !!photoUrl && !imgFailed;

  return (
    <View style={styles.evidencePhotoCol}>
      <View
        style={[
          styles.evidencePhotoBox,
          { backgroundColor: boxColor + "18", borderColor: boxColor + "44" },
        ]}
      >
        {showImage ? (
          <Image
            source={{ uri: photoUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <LinearGradient
            colors={[boxColor + "28", boxColor + "08"]}
            style={StyleSheet.absoluteFill}
          />
        )}
        {!showImage && (
          side === "yours" ? (
            <Ionicons name="person-circle" size={36} color={boxColor} />
          ) : (
            <Ionicons name="warning" size={28} color={simColor} />
          )
        )}
        <View
          style={[
            styles.evidencePhotoBadge,
            { backgroundColor: side === "yours" ? colors.success : simColor },
          ]}
        >
          <Ionicons
            name={side === "yours" ? "checkmark" : "alert"}
            size={9}
            color="#FFFFFF"
          />
        </View>
      </View>
      <Text
        style={[
          styles.evidencePhotoLabel,
          {
            color: side === "yours" ? colors.success : simColor,
            fontFamily: "Inter_600SemiBold",
          },
        ]}
      >
        {side === "yours" ? "Your Photo" : "Stolen Copy"}
      </Text>
      {caption && (
        <Text
          style={[
            styles.evidenceCaption,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
          numberOfLines={2}
        >
          "{caption}"
        </Text>
      )}
    </View>
  );
}

function EvidenceCard({ item }: { item: MatchedEvidence }) {
  const colors = useColors();
  const isHighSimilarity = item.similarity >= 85;
  const simColor = isHighSimilarity ? colors.danger : colors.warning;

  return (
    <View
      style={[
        styles.evidenceCard,
        { backgroundColor: simColor + "0C", borderColor: simColor + "33" },
      ]}
    >
      <View style={styles.evidenceCardHeader}>
        <View
          style={[styles.evidenceTypeBadge, { backgroundColor: simColor + "22" }]}
        >
          <MaterialCommunityIcons
            name={
              item.type === "profile_photo"
                ? "account-circle"
                : item.type === "reel_thumbnail"
                ? "video"
                : "image"
            }
            size={12}
            color={simColor}
          />
          <Text
            style={[
              styles.evidenceTypeBadgeText,
              { color: simColor, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {item.label}
          </Text>
        </View>
      </View>

      <View style={styles.evidenceCompare}>
        <EvidencePhotoBox
          side="yours"
          photoUrl={item.yourPhotoUrl}
          caption={item.yourCaption}
          simColor={simColor}
        />

        <View style={styles.evidenceArrow}>
          <View style={[styles.similarityBubble, { backgroundColor: simColor }]}>
            <Text style={[styles.similarityPct, { fontFamily: "Inter_700Bold" }]}>
              {item.similarity}%
            </Text>
          </View>
          <Text style={[styles.matchWord, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            match
          </Text>
        </View>

        <EvidencePhotoBox
          side="stolen"
          photoUrl={item.stolenPhotoUrl}
          caption={item.stolenCaption}
          simColor={simColor}
        />
      </View>
    </View>
  );
}

export default function ThreatDetail() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { threats, resolveThreat } = useApp();

  const [detail, setDetail] = useState<ThreatDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const summary = threats.find((t) => t.id === id);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getThreat(id)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [id]);

  const threat = detail ?? summary;

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Threat Details
          </Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Loading threat details…
          </Text>
        </View>
      </View>
    );
  }

  if (!threat) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Threat Details
          </Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={48} color={colors.danger} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Threat not found
          </Text>
        </View>
      </View>
    );
  }

  const severity = threat.severity as Severity;
  const sc = severityColor(severity, colors);

  const breakdown: ThreatScoreBreakdown = detail?.scoreBreakdown ?? {
    mediaSimilarity: 0,
    contentReuse: 0,
    profileSimilarity: 0,
    bioSimilarity: 0,
    usernameSimilarity: 0,
    behavioral: 0,
  };

  const evidence: MatchedEvidence[] = (detail?.evidence ?? []).map((e) => ({
    id: e.id,
    type: e.type,
    similarity: e.similarity,
    label: e.label,
    yourCaption: e.yourCaption,
    stolenCaption: e.stolenCaption,
    yourPhotoUrl: e.yourPhotoUrl,
    stolenPhotoUrl: e.stolenPhotoUrl,
  }));

  const detectedSignals = detail?.detectedSignals ?? [];
  const aiExplanation = detail?.aiExplanation ?? "";
  const suspiciousUsername = detail?.suspiciousUsername ?? ("suspiciousUsername" in threat ? (threat as { suspiciousUsername?: string | null }).suspiciousUsername : "") ?? "";

  const time =
    "time" in threat
      ? (threat as { time: string }).time
      : detail?.createdAt
      ? new Date(detail.createdAt).toLocaleDateString()
      : "";

  const handleResolve = async () => {
    if (resolving) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setResolving(true);
    resolveThreat(threat.id);
    router.back();
  };

  const handleReport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
          style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
        >
          Threat Details
        </Text>
        {threat.platform ? (
          <PlatformIcon platform={threat.platform as Parameters<typeof PlatformIcon>[0]["platform"]} size={30} />
        ) : (
          <View style={{ width: 30 }} />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
      >
        {/* Severity + Score Row */}
        <View style={styles.topRow}>
          <View style={styles.topRowLeft}>
            <View
              style={[
                styles.severityBanner,
                { backgroundColor: sc + "22", borderColor: sc + "44" },
              ]}
            >
              <View style={[styles.severityDot, { backgroundColor: sc }]} />
              <Text
                style={[styles.severityText, { color: sc, fontFamily: "Inter_700Bold" }]}
              >
                {severity.toUpperCase()} SEVERITY
              </Text>
            </View>
            <Text
              style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
            >
              {threat.title}
            </Text>
            <Text
              style={[styles.suspiciousHandle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
            >
              {suspiciousUsername} · {time}
            </Text>
          </View>
          <ScoreGauge score={threat.threatScore} />
        </View>

        {/* Visual Evidence */}
        {evidence.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="image-search" size={18} color={colors.danger} />
              <Text
                style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
              >
                Visual Evidence
              </Text>
              <View
                style={[styles.evidenceCountBadge, { backgroundColor: colors.danger + "22" }]}
              >
                <Text
                  style={[styles.evidenceCountText, { color: colors.danger, fontFamily: "Inter_700Bold" }]}
                >
                  {threat.matchedMediaCount} stolen
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.evidenceSubtitle,
                { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}
            >
              Showing {evidence.length} of {threat.matchedMediaCount} matched media items
            </Text>
            {evidence.map((item) => (
              <EvidenceCard key={item.id} item={item} />
            ))}
          </View>
        )}

        {/* Threat Score Breakdown */}
        <GlassCard style={styles.scoreCard}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="chart-bar" size={18} color={colors.primary} />
            <Text
              style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
            >
              Threat Score Breakdown
            </Text>
          </View>
          <ScoreBar label="Media Similarity" value={breakdown.mediaSimilarity} max={40} color={colors.danger} />
          <ScoreBar label="Content Reuse" value={breakdown.contentReuse} max={20} color={colors.warning} />
          <ScoreBar label="Profile Match" value={breakdown.profileSimilarity} max={15} color={colors.warning} />
          <ScoreBar label="Bio Similarity" value={breakdown.bioSimilarity} max={10} color={colors.primary} />
          <ScoreBar label="Username" value={breakdown.usernameSimilarity} max={10} color={colors.primary} />
          <ScoreBar label="Behavior" value={breakdown.behavioral} max={5} color={colors.mutedForeground} />
        </GlassCard>

        {/* AI Explanation */}
        {aiExplanation ? (
          <GlassCard style={[styles.aiCard, { borderColor: colors.primary + "44" }]}>
            <View style={styles.aiHeader}>
              <View style={[styles.aiIcon, { backgroundColor: colors.primary + "22" }]}>
                <MaterialCommunityIcons name="brain" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.aiLabel, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                  AI Analysis
                </Text>
                <Text style={[styles.aiPowered, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  ShieldID Identity Investigator
                </Text>
              </View>
            </View>
            <Text style={[styles.aiText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
              {aiExplanation}
            </Text>
          </GlassCard>
        ) : null}

        {/* Detected Signals */}
        {detectedSignals.length > 0 && (
          <GlassCard style={styles.signalsCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="alert-circle" size={18} color={colors.warning} />
              <Text
                style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
              >
                Detected Signals
              </Text>
            </View>
            {detectedSignals.map((signal, i) => (
              <View key={i} style={styles.signalItem}>
                <View style={[styles.signalDot, { backgroundColor: colors.warning }]} />
                <Text
                  style={[styles.signalText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                >
                  {signal}
                </Text>
              </View>
            ))}
          </GlassCard>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.danger }]}
            activeOpacity={0.8}
            onPress={handleReport}
          >
            <Ionicons name="flag" size={18} color="#FFFFFF" />
            <Text style={[styles.primaryBtnText, { fontFamily: "Inter_600SemiBold" }]}>
              Report Account
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              { backgroundColor: colors.success + "22", borderColor: colors.success + "44" },
            ]}
            activeOpacity={0.8}
            onPress={handleResolve}
            disabled={resolving}
          >
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text
              style={[styles.secondaryBtnText, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}
            >
              Mark as Resolved
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 15, marginTop: 8 },
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

  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  topRowLeft: { flex: 1, gap: 8 },
  severityBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  severityText: { fontSize: 11 },
  title: { fontSize: 20, lineHeight: 26 },
  suspiciousHandle: { fontSize: 13 },

  gaugeContainer: { alignItems: "center", gap: 6 },
  gaugeOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  gaugeScore: { fontSize: 22 },
  gaugeLabel: { fontSize: 11 },
  gaugeRisk: { fontSize: 11 },

  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 15, flex: 1 },
  evidenceSubtitle: { fontSize: 12, marginTop: -4 },
  evidenceCountBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  evidenceCountText: { fontSize: 11 },

  evidenceCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  evidenceCardHeader: { flexDirection: "row", alignItems: "center" },
  evidenceTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  evidenceTypeBadgeText: { fontSize: 11 },

  evidenceCompare: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  evidencePhotoCol: { flex: 1, alignItems: "center", gap: 6 },
  evidencePhotoBox: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  evidencePhotoBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  evidencePhotoLabel: { fontSize: 11 },
  evidenceCaption: { fontSize: 11, textAlign: "center", lineHeight: 15 },

  evidenceArrow: { alignItems: "center", gap: 4 },
  similarityBubble: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  similarityPct: { color: "#FFFFFF", fontSize: 13 },
  matchWord: { fontSize: 10 },

  scoreCard: { gap: 12 },
  scoreBarRow: { gap: 6 },
  scoreBarLabel: { fontSize: 12 },
  scoreBarTrackWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  scoreBarTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  scoreBarFill: { height: "100%", borderRadius: 3 },
  scoreBarValue: { fontSize: 12, width: 32, textAlign: "right" },

  aiCard: { gap: 12 },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  aiIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  aiLabel: { fontSize: 14 },
  aiPowered: { fontSize: 11 },
  aiText: { fontSize: 14, lineHeight: 22 },

  signalsCard: { gap: 10 },
  signalItem: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  signalDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  signalText: { fontSize: 14, flex: 1, lineHeight: 20 },

  actions: { gap: 10 },
  primaryBtn: {
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 15 },
  secondaryBtn: {
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 15 },
});
