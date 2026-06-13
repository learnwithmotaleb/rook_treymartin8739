import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Linking,
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
import { Skeleton } from "@/components/Skeleton";
import { severityColor } from "@/lib/severity";
import { getThreat, resolveThreat as apiResolveThreat, type ThreatDetail } from "@/lib/api";

const PROFILE_URL_TEMPLATES: Record<string, (u: string) => string> = {
  instagram: (u) => `https://www.instagram.com/${u}/`,
  facebook: (u) => `https://www.facebook.com/${u}`,
  x: (u) => `https://x.com/${u}`,
  tiktok: (u) => `https://www.tiktok.com/@${u}`,
  youtube: (u) => `https://www.youtube.com/@${u}`,
  linkedin: (u) => `https://www.linkedin.com/in/${u}`,
  snapchat: (u) => `https://www.snapchat.com/add/${u}`,
};

const REPORT_GUIDE_URLS: Record<string, string> = {
  instagram: "https://help.instagram.com/519522125107875",
  facebook: "https://www.facebook.com/help/174210519303259",
  x: "https://help.twitter.com/en/safety-and-security/report-a-fake-account",
  tiktok: "https://support.tiktok.com/en/safety-hc/report-a-problem",
  youtube: "https://support.google.com/youtube/answer/2802268",
  linkedin: "https://www.linkedin.com/help/linkedin/answer/a1340567",
  snapchat: "https://support.snapchat.com/en-US/i-need-help",
};

function generateAiExplanation(
  type: string,
  platform: string | null,
  suspiciousUsername: string,
  threatScore: number,
  matchedMediaCount: number
): string {
  const p = platform ?? "social media";
  const u = suspiciousUsername || "an unverified account";
  const riskLevel = threatScore >= 80 ? "critical" : threatScore >= 60 ? "significant" : "moderate";

  if (type === "impersonator" || type === "fake_account") {
    return (
      `Our AI detected ${u} on ${p} exhibiting strong impersonation signals against your identity. ` +
      `With a threat score of ${threatScore}/100, this account shows ${riskLevel} similarity to your verified profile.` +
      (matchedMediaCount > 0
        ? ` ${matchedMediaCount} piece${matchedMediaCount !== 1 ? "s" : ""} of your media content were identified in this account's posts.`
        : "") +
      ` We recommend reporting and blocking this account immediately through ${p}'s official reporting tools.`
    );
  }
  if (type === "stolen_photo") {
    return (
      (matchedMediaCount > 0
        ? `${matchedMediaCount} of your photos have been`
        : "Your photo content has been") +
      ` detected on ${u}'s ${p} profile without your authorization. Our AI cross-referenced your indexed media fingerprints against this account's content library. This constitutes unauthorized use of your identity and likeness.`
    );
  }
  if (type === "leaked_password") {
    return "Our AI has detected credential exposure linked to your identity. Your login information may have appeared in a data breach. We recommend immediately changing your password for any affected accounts and enabling two-factor authentication to secure your profiles.";
  }
  if (type === "suspicious_login") {
    return `Our AI flagged a suspicious login attempt on ${p} that doesn't match your usual access patterns. This could indicate an unauthorized attempt to access your account. Review your active sessions and change your password if you don't recognize the activity.`;
  }
  return `Our AI flagged suspicious activity related to your identity on ${p}. Threat score: ${threatScore}/100. Review this alert and take action to protect your digital identity.`;
}

function generateDetectedSignals(breakdown: ThreatScoreBreakdown, type: string): string[] {
  const signals: string[] = [];
  if (breakdown.mediaSimilarity >= 20)
    signals.push(`Visual media similarity confirmed (${breakdown.mediaSimilarity}/40 match score)`);
  else if (breakdown.mediaSimilarity >= 10)
    signals.push("Partial media overlap detected across profiles");
  if (breakdown.contentReuse >= 10)
    signals.push("Post content reuse identified across accounts");
  if (breakdown.profileSimilarity >= 8)
    signals.push("Profile information closely mirrors your verified account");
  if (breakdown.bioSimilarity >= 5)
    signals.push("Bio text shows high similarity to your profile");
  if (breakdown.usernameSimilarity >= 5)
    signals.push("Username follows impersonation variation pattern");
  if (breakdown.behavioral >= 3)
    signals.push("Behavioral patterns consistent with impersonator accounts");
  if (type === "stolen_photo")
    signals.push("Reverse image search confirmed photo match");
  if (type === "impersonator" || type === "fake_account")
    signals.push("Account creation post-dates your verified profile");
  return signals;
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
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}>
          <View style={styles.topRow}>
            <View style={[styles.topRowLeft, { gap: 10 }]}>
              <Skeleton height={22} width="50%" borderRadius={20} />
              <Skeleton height={28} width="90%" borderRadius={8} />
              <Skeleton height={14} width="55%" borderRadius={6} />
            </View>
            <Skeleton width={100} height={100} borderRadius={50} />
          </View>
          <Skeleton height={170} borderRadius={14} />
          <Skeleton height={190} borderRadius={14} />
          <Skeleton height={130} borderRadius={14} />
        </ScrollView>
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

  const evidence: MatchedEvidence[] = (detail?.evidence ?? summary?.evidence ?? []).map((e) => ({
    id: e.id,
    type: e.type as MatchedEvidence["type"],
    similarity: e.similarity,
    label: e.label,
    yourCaption: "yourCaption" in e ? (e as any).yourCaption : undefined,
    stolenCaption: "stolenCaption" in e ? (e as any).stolenCaption : undefined,
    yourPhotoUrl: "yourPhotoUrl" in e ? (e as any).yourPhotoUrl : undefined,
    stolenPhotoUrl: "stolenPhotoUrl" in e ? (e as any).stolenPhotoUrl : undefined,
  }));

  const suspiciousUsername =
    detail?.suspiciousUsername ??
    ("suspiciousUsername" in threat
      ? (threat as { suspiciousUsername?: string | null }).suspiciousUsername
      : "") ??
    "";

  const detectedSignals =
    detail?.detectedSignals && detail.detectedSignals.length > 0
      ? detail.detectedSignals
      : generateDetectedSignals(breakdown, String(threat.type));
  const aiExplanation =
    detail?.aiExplanation ||
    generateAiExplanation(
      String(threat.type),
      threat.platform as string | null,
      suspiciousUsername,
      threat.threatScore,
      threat.matchedMediaCount
    );

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
    const platform = threat.platform as string | null;
    const handle = (suspiciousUsername || "").replace(/^@/, "");
    const profileUrl = platform && handle ? PROFILE_URL_TEMPLATES[platform]?.(handle) : null;
    const guideUrl = platform ? REPORT_GUIDE_URLS[platform] : null;

    const openProfile = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (profileUrl) {
        Linking.openURL(profileUrl).catch(() => {
          Alert.alert("Could not open browser", "Please find and report the account manually through the platform's app.");
        });
      } else if (guideUrl) {
        Linking.openURL(guideUrl).catch(() => {});
      }
    };

    const buttons: Parameters<typeof Alert.alert>[2] = [
      { text: "Cancel", style: "cancel" },
    ];

    if (profileUrl) {
      buttons.push({
        text: "Go to Profile & Report",
        style: "destructive",
        onPress: openProfile,
      });
    } else {
      buttons.push({
        text: "Report",
        style: "destructive",
        onPress: openProfile,
      });
    }

    Alert.alert(
      `Report @${handle || "this account"}`,
      profileUrl
        ? `We'll open @${handle}'s profile directly so you can tap "Report" from within the platform's app.`
        : guideUrl
        ? "We'll open the platform's official reporting guide."
        : "Your report will be recorded in ShieldID.",
      buttons
    );
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
        {/* AI Disclaimer Banner */}
        <View style={[styles.aiDisclaimerBanner, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="robot-outline" size={14} color={colors.mutedForeground} />
          <Text style={[styles.aiDisclaimerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Generated by AI · Results are probabilistic estimates and may contain errors. Verify before taking action.
          </Text>
        </View>

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
                  {threat.matchedMediaCount} matched
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

  aiDisclaimerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  aiDisclaimerText: { flex: 1, fontSize: 12, lineHeight: 17 },

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
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  gaugeScore: { fontSize: 26 },
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
