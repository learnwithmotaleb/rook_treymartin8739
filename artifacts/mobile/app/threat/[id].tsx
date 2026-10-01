import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Clipboard,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
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
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useColors } from "@/hooks/useColors";
import { useApp, Severity, type MatchedEvidence, type ThreatScoreBreakdown } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { PlatformIcon } from "@/components/PlatformIcon";
import { Skeleton } from "@/components/Skeleton";
import { ReviewerDemoBanner } from "@/components/ReviewerDemoBanner";
import { severityColor } from "@/lib/severity";
import { getThreat, type ThreatDetail } from "@/lib/api";
import { ShareCard } from "@/components/ShareCard";
import { useShareCard } from "@/hooks/useShareCard";

const PROFILE_URL_TEMPLATES: Record<string, (u: string) => string> = {
  instagram: (u) => `https://www.instagram.com/${u}/`,
  facebook: (u) => `https://www.facebook.com/${u}`,
  x: (u) => `https://x.com/${u}`,
  tiktok: (u) => `https://www.tiktok.com/@${u}`,
  youtube: (u) => `https://www.youtube.com/@${u}`,
  linkedin: (u) => `https://www.linkedin.com/in/${u}`,
  snapchat: (u) => `https://www.snapchat.com/add/${u}`,
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X (Twitter)",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  snapchat: "Snapchat",
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

/** Format follower counts as "12K", "1.2M", etc. */
function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Format account age in human-readable terms. */
function formatAccountAge(days: number): string {
  if (days >= 365 * 2) return `${Math.floor(days / 365)} yrs old`;
  if (days >= 365) return `1 yr old`;
  if (days >= 30) return `${Math.floor(days / 30)} mo old`;
  return `${days}d old`;
}

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
      ` detected on ${u}'s ${p} profile without your authorization. Our AI confirmed this is your content. This constitutes unauthorized use of your identity and likeness.`
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
    signals.push("Visual media similarity confirmed");
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
    signals.push("AI photo match confirmed");
  if (type === "impersonator" || type === "fake_account")
    signals.push("Account creation post-dates your verified profile");
  return signals;
}

/** Generates a self-contained HTML investigation report for expo-print. */
function generateReportHtml(opts: {
  caseId: string;
  generatedAt: string;
  userName: string;
  platform: string;
  platformLabel: string;
  suspiciousUsername: string;
  severity: string;
  threatScore: number;
  type: string;
  aiExplanation: string;
  signals: string[];
  breakdown: ThreatScoreBreakdown;
  evidence: MatchedEvidence[];
  postDatingDays: number | null;
  demoPreview?: boolean;
}): string {
  const {
    caseId, generatedAt, userName, platform, platformLabel,
    suspiciousUsername, severity, threatScore, type,
    aiExplanation, signals, breakdown, evidence, postDatingDays,
    demoPreview = false,
  } = opts;

  const sevColor = severity === "high" ? "#EF4444" : severity === "medium" ? "#F59E0B" : "#10B981";
  const handle = suspiciousUsername.startsWith("@") ? suspiciousUsername : `@${suspiciousUsername}`;

  const breakdownRows = [
    { label: "Media Similarity", value: breakdown.mediaSimilarity, max: 40 },
    { label: "Content Reuse", value: breakdown.contentReuse, max: 20 },
    { label: "Profile Match", value: breakdown.profileSimilarity, max: 15 },
    { label: "Bio Similarity", value: breakdown.bioSimilarity, max: 10 },
    { label: "Username Pattern", value: breakdown.usernameSimilarity, max: 10 },
    { label: "Behavioral Signals", value: breakdown.behavioral, max: 5 },
  ]
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 12px;color:#374151;font-size:13px;">${r.label}</td>
        <td style="padding:8px 12px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="flex:1;height:8px;background:#E5E7EB;border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${Math.round((r.value / r.max) * 100)}%;background:#3B82F6;border-radius:4px;"></div>
            </div>
            <span style="font-size:12px;color:#6B7280;min-width:36px;">${r.value}/${r.max}</span>
          </div>
        </td>
      </tr>`
    )
    .join("");

  const signalsHtml = signals
    .map(
      (s) =>
        `<li style="margin-bottom:6px;font-size:13px;color:#374151;">
          <span style="color:#F59E0B;margin-right:6px;">⚠</span>${s}
        </li>`
    )
    .join("");

  const evidenceHtml = evidence.length > 0
    ? `
    <div style="margin-bottom:28px;">
      <h2 style="font-size:16px;font-weight:700;color:#111827;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #E5E7EB;">
        📸 Visual Evidence (${evidence.length} item${evidence.length !== 1 ? "s" : ""})
      </h2>
      ${evidence
        .map(
          (e) => `
        <div style="margin-bottom:16px;padding:14px;border:1px solid #E5E7EB;border-radius:10px;background:#FAFAFA;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-size:13px;font-weight:600;color:#374151;">${e.label}</span>
            <span style="font-size:13px;font-weight:700;color:${e.similarity >= 85 ? "#EF4444" : "#F59E0B"};">${e.similarity}% match</span>
          </div>
          ${
            e.stolenPageUrl && !demoPreview
              ? `<p style="font-size:12px;color:#6B7280;margin:0;word-break:break-all;">Found at: <a href="${e.stolenPageUrl}" style="color:#3B82F6;">${e.stolenPageUrl}</a></p>`
              : ""
          }
        </div>`
        )
        .join("")}
    </div>`
    : "";

  const nextSteps = demoPreview
    ? [
        "This report contains fictional sample data only; it is not evidence of a real account or finding.",
        "Do not report, block, contact, or take action against any account based on this sample.",
        "The PDF is a local demonstration preview and is not submitted to a platform or public report service.",
      ]
    : [
        `Report ${handle} directly on ${platformLabel} using their official impersonation report tool.`,
        "Screenshot this report and save it to your device as documentation.",
        "If the account is used for fraud, file a report with your local cybercrime unit or the FTC (reportfraud.ftc.gov).",
        "Block the account after reporting to prevent further contact.",
        "Monitor your accounts for additional impersonators using Rook's scheduled scans.",
      ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rook Investigation Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #111827; }
  .page { max-width: 720px; margin: 0 auto; padding: 40px 36px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #111827; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-icon { width: 40px; height: 40px; background: #111827; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
  .brand-name { font-size: 22px; font-weight: 900; letter-spacing: 4px; color: #111827; }
  .brand-sub { font-size: 11px; color: #6B7280; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }
  .report-meta { text-align: right; }
  .report-type { font-size: 13px; font-weight: 700; color: #EF4444; text-transform: uppercase; letter-spacing: 1px; }
  .demo-watermark { margin: -12px 0 24px; padding: 12px 14px; border: 2px solid #D97706; border-radius: 8px; background: #FFFBEB; color: #92400E; font-size: 14px; font-weight: 900; text-align: center; letter-spacing: 0.5px; }
  .meta-line { font-size: 12px; color: #6B7280; margin-top: 4px; }
  .alert-bar { background: #FEF2F2; border: 2px solid #FECACA; border-radius: 10px; padding: 14px 18px; margin-bottom: 28px; display: flex; align-items: flex-start; gap: 12px; }
  .alert-icon { font-size: 22px; }
  .alert-text h3 { font-size: 15px; font-weight: 700; color: #991B1B; margin-bottom: 4px; }
  .alert-text p { font-size: 13px; color: #B91C1C; line-height: 1.5; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 28px; }
  .info-box { padding: 14px 16px; border: 1px solid #E5E7EB; border-radius: 10px; background: #F9FAFB; }
  .info-label { font-size: 11px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
  .info-value { font-size: 15px; font-weight: 700; color: #111827; }
  .info-value.danger { color: ${sevColor}; }
  .score-circle { display: inline-block; background: ${sevColor}18; border: 2px solid ${sevColor}44; border-radius: 50%; width: 48px; height: 48px; line-height: 44px; text-align: center; font-size: 18px; font-weight: 800; color: ${sevColor}; }
  h2 { font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 2px solid #E5E7EB; }
  .section { margin-bottom: 28px; }
  .explanation-box { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px; padding: 16px; font-size: 14px; color: #1E40AF; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th { text-align: left; font-size: 11px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.8px; padding: 8px 12px; border-bottom: 1px solid #E5E7EB; }
  ul.signals { list-style: none; padding: 0; }
  .steps-ol { padding-left: 0; list-style: none; counter-reset: steps; }
  .steps-ol li { counter-increment: steps; display: flex; gap: 12px; margin-bottom: 12px; align-items: flex-start; }
  .steps-ol li::before { content: counter(steps); display: inline-flex; min-width: 24px; height: 24px; border-radius: 50%; background: #111827; color: #fff; font-size: 12px; font-weight: 700; align-items: center; justify-content: center; flex-shrink: 0; }
  .steps-ol li span { font-size: 13px; color: #374151; line-height: 1.5; padding-top: 2px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center; }
  .footer-left { font-size: 11px; color: #9CA3AF; }
  .footer-right { font-size: 11px; color: #9CA3AF; }
  .disclaimer { margin-top: 10px; font-size: 11px; color: #9CA3AF; line-height: 1.5; }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="brand">
      <div class="brand-icon">🛡️</div>
      <div>
        <div class="brand-name">ROOK</div>
        <div class="brand-sub">Identity Protection</div>
      </div>
    </div>
    <div class="report-meta">
      <div class="report-type">${demoPreview ? "⚠ Demo Preview · Not a Real Finding" : "⚠ Investigation Report"}</div>
      <div class="meta-line">Case ID: ${caseId.slice(0, 8).toUpperCase()}</div>
      <div class="meta-line">Generated: ${generatedAt}</div>
      <div class="meta-line">Subject: ${userName}</div>
    </div>
  </div>

  ${demoPreview ? `<div class="demo-watermark">DEMO PREVIEW — NOT A REAL FINDING · DO NOT REPORT OR ACT ON THIS SAMPLE</div>` : ""}

  <!-- Alert -->
  <div class="alert-bar">
    <div class="alert-icon">🚨</div>
    <div class="alert-text">
      <h3>${demoPreview ? "Illustrative sample alert" : "Active Impersonation Detected"}</h3>
      <p>
        ${demoPreview
          ? "This is fictional reviewer-demo content, not a validated finding. No real account was detected and no action should be taken."
          : `Rook's AI detected an account on ${platformLabel} using your identity without authorization. This report documents the evidence and recommended actions.`}
      </p>
    </div>
  </div>

  <!-- Info grid -->
  <div class="info-grid">
    <div class="info-box">
      <div class="info-label">Impersonator Handle</div>
      <div class="info-value">${handle}</div>
    </div>
    <div class="info-box">
      <div class="info-label">Platform</div>
      <div class="info-value">${platformLabel}</div>
    </div>
    <div class="info-box">
      <div class="info-label">Severity</div>
      <div class="info-value danger">${severity.toUpperCase()}</div>
    </div>
    <div class="info-box">
      <div class="info-label">Threat Score</div>
      <div class="info-value"><span class="score-circle">${threatScore}</span></div>
    </div>
    ${type === "impersonator" || type === "fake_account" ? `
    <div class="info-box">
      <div class="info-label">Threat Type</div>
      <div class="info-value">Account Impersonation</div>
    </div>` : ""}
    ${postDatingDays != null ? `
    <div class="info-box">
      <div class="info-label">Account Age vs. Yours</div>
      <div class="info-value">Created ${postDatingDays}d after you</div>
    </div>` : ""}
  </div>

  <!-- AI Explanation -->
  <div class="section">
    <h2>${demoPreview ? "🤖 Illustrative Analysis" : "🤖 AI Analysis"}</h2>
    <div class="explanation-box">${aiExplanation}</div>
  </div>

  <!-- Evidence -->
  ${evidenceHtml}

  <!-- Score Breakdown -->
  <div class="section">
    <h2>📊 Detection Score Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Signal</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>${breakdownRows}</tbody>
    </table>
  </div>

  <!-- Signals -->
  ${signals.length > 0 ? `
  <div class="section">
    <h2>🔍 Detected Signals</h2>
    <ul class="signals">${signalsHtml}</ul>
  </div>` : ""}

  <!-- Next Steps -->
  <div class="section">
    <h2>✅ Recommended Next Steps</h2>
    <ol class="steps-ol">
      ${nextSteps.map((s) => `<li><span>${s}</span></li>`).join("")}
    </ol>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">Rook · getrook.app</div>
    <div class="footer-right">Case ${caseId.slice(0, 8).toUpperCase()} · ${generatedAt}</div>
  </div>
  <p class="disclaimer">
    ${demoPreview
      ? "DEMO PREVIEW — NOT A REAL FINDING. This PDF uses fictional sample data and is not a real report, validated evidence, or a submission to any platform."
      : "This report was generated by Rook AI. Results are probabilistic estimates and should be verified before legal action. Rook is not a law enforcement agency. Keep this report for your records when contacting the platform's Trust & Safety team."}
  </p>
</div>
</body>
</html>`;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ScoreGauge({ score, color }: { score: number; color: string }) {
  const colors = useColors();
  return (
    <View style={styles.gaugeContainer}>
      <View style={[styles.gaugeOuter, { borderColor: color + "55" }]}>
        <LinearGradient
          colors={[color + "30", color + "08"]}
          style={StyleSheet.absoluteFill}
        />
        <Text style={[styles.gaugeScore, { color, fontFamily: "Inter_700Bold" }]}>
          {score}
        </Text>
        <Text style={[styles.gaugeSubLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          / 100
        </Text>
      </View>
      <Text style={[styles.gaugeRisk, { color, fontFamily: "Inter_700Bold" }]}>
        {score >= 80 ? "HIGH RISK" : score >= 55 ? "MED RISK" : "LOW RISK"}
      </Text>
    </View>
  );
}

function scoreStrengthLabel(pct: number): string {
  if (pct >= 75) return "Strong";
  if (pct >= 45) return "Moderate";
  if (pct > 0) return "Weak";
  return "None";
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const colors = useColors();
  const pct = Math.round((value / max) * 100);
  return (
    <View style={styles.scoreBarRow}>
      <Text style={[styles.scoreBarLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {label}
      </Text>
      <View style={styles.scoreBarTrackWrap}>
        <View style={[styles.scoreBarTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.scoreBarFill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
        <Text style={[styles.scoreBarValue, { color, fontFamily: "Inter_700Bold" }]}>
          {scoreStrengthLabel(pct)}
        </Text>
      </View>
    </View>
  );
}

function EvidencePhotoBox({
  side, photoUrl, fallbackUrl, caption, simColor, onTap, isSample,
}: {
  side: "yours" | "stolen";
  photoUrl?: string;
  /** Tried when photoUrl fails to load — use user.avatarUrl for "yours" side */
  fallbackUrl?: string;
  caption?: string;
  simColor: string;
  onTap?: () => void;
  isSample?: boolean;
}) {
  const colors = useColors();
  // "primary" → try photoUrl; "fallback" → primary failed, try fallbackUrl; "failed" → show placeholder
  const [imgState, setImgState] = useState<"primary" | "fallback" | "failed">("primary");
  useEffect(() => {
    setImgState("primary");
  }, [photoUrl, fallbackUrl]);
  const activeUrl = imgState === "primary" ? photoUrl : imgState === "fallback" ? fallbackUrl : undefined;
  const showImage = !!activeUrl;
  const canTap = side === "stolen" && !!onTap;
  const BoxWrapper = canTap ? TouchableOpacity : View;
  const boxWrapperProps = canTap ? { activeOpacity: 0.75, onPress: onTap } : {};
  const boxColor = side === "yours" ? colors.success : simColor;

  const handleError = () => {
    if (imgState === "primary" && fallbackUrl) {
      setImgState("fallback"); // switch to fallback
    } else {
      setImgState("failed"); // both failed or no fallback — show placeholder
    }
  };

  return (
    <View style={styles.evidencePhotoCol}>
      <BoxWrapper
        {...(boxWrapperProps as object)}
        style={[styles.evidencePhotoBox, { backgroundColor: boxColor + "18", borderColor: boxColor + "44" }]}
      >
        {showImage ? (
          <Image
            source={{ uri: activeUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={handleError}
          />
        ) : (
          <LinearGradient colors={[boxColor + "28", boxColor + "08"]} style={StyleSheet.absoluteFill} />
        )}
        {!showImage && (
          side === "yours" ? (
            <Ionicons name="person-circle" size={36} color={boxColor} />
          ) : (
            <View style={styles.stolenPlaceholder}>
              <Ionicons name="eye-outline" size={26} color={simColor} />
              {canTap && (
                <Text style={[styles.tapToView, { color: simColor, fontFamily: "Inter_600SemiBold" }]}>Tap to view</Text>
              )}
            </View>
          )
        )}
        {showImage && canTap && (
          <View style={[styles.viewOverlay, { backgroundColor: simColor + "CC" }]}>
            <Ionicons name="open-outline" size={12} color="#FFFFFF" />
          </View>
        )}
        <View style={[styles.evidencePhotoBadge, { backgroundColor: side === "yours" ? colors.success : simColor }]}>
          <Ionicons name={side === "yours" ? "checkmark" : "alert"} size={9} color="#FFFFFF" />
        </View>
      </BoxWrapper>
      <Text style={[styles.evidencePhotoLabel, { color: side === "yours" ? colors.success : simColor, fontFamily: "Inter_600SemiBold" }]}>
        {side === "yours" ? "Your Photo" : isSample ? "Suspected Copy (sample)" : "Suspected Match"}
      </Text>
      {caption && (
        <Text style={[styles.evidenceCaption, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>
          "{caption}"
        </Text>
      )}
    </View>
  );
}

function EvidenceCard({ item, isSample = false }: { item: MatchedEvidence; isSample?: boolean }) {
  const colors = useColors();
  const { user } = useApp();
  const isHighSimilarity = item.similarity >= 85;
  const simColor = isHighSimilarity ? colors.danger : colors.warning;

  return (
    <View style={[styles.evidenceCard, { backgroundColor: simColor + "0C", borderColor: simColor + "33" }]}>
      <View style={styles.evidenceCardHeader}>
        <View style={[styles.evidenceTypeBadge, { backgroundColor: simColor + "22" }]}>
          <MaterialCommunityIcons
            name={item.type === "profile_photo" ? "account-circle" : item.type === "reel_thumbnail" ? "video" : "image"}
            size={12}
            color={simColor}
          />
          <Text style={[styles.evidenceTypeBadgeText, { color: simColor, fontFamily: "Inter_600SemiBold" }]}>
            {item.label}
          </Text>
        </View>
      </View>
      <View style={styles.evidenceCompare}>
        {/* fallbackUrl = user's avatar (base64, never expires) — used when the CDN
            URL stored at scan time has expired or changed */}
        <EvidencePhotoBox
          side="yours"
          photoUrl={item.yourPhotoUrl}
          fallbackUrl={isSample ? undefined : user?.avatarUrl ?? undefined}
          caption={item.yourCaption}
          simColor={simColor}
        />
        <View style={styles.evidenceArrow}>
          <View style={[styles.similarityBubble, { backgroundColor: simColor }]}>
            <Text style={[styles.similarityPct, { fontFamily: "Inter_700Bold" }]}>{item.similarity}%</Text>
          </View>
          <Text style={[styles.matchWord, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>match</Text>
        </View>
        <EvidencePhotoBox
          side="stolen"
          photoUrl={item.stolenPhotoUrl}
          caption={item.stolenCaption}
          simColor={simColor}
          isSample={isSample}
          onTap={
            isSample
              ? undefined
              : (item.stolenPageUrl ?? item.stolenPhotoUrl)
              ? () => Linking.openURL((item.stolenPageUrl ?? item.stolenPhotoUrl)!).catch(() => {})
              : undefined
          }
        />
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ThreatDetail() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { threats, resolveThreat, user, isReviewerDemo } = useApp();

  const [detail, setDetail] = useState<ThreatDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [showSignals, setShowSignals] = useState(false);
  const [demoActionPreview, setDemoActionPreview] = useState<"profile" | "report" | null>(null);
  const { cardRef, isSharing, share } = useShareCard();

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
  const isSample = detail?.isSample === true || summary?.isSample === true;
  const isPreviewFinding = isSample || isReviewerDemo;
  const canPreviewSampleActions = isReviewerDemo && isSample;
  const canUseLiveThreatActions = !isReviewerDemo && !isSample;

  // Show full-screen skeleton only when there is truly no data at all —
  // not even a summary from the threat list. When summary exists (the normal
  // navigation path from alerts), render immediately and let detail arrive
  // in the background so the screen feels instant.
  if (loading && !threat) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Investigation
          </Text>
          <View style={{ width: 30 }} />
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}>
          <Skeleton height={160} borderRadius={20} />
          <Skeleton height={140} borderRadius={16} />
          <Skeleton height={190} borderRadius={16} />
          <Skeleton height={130} borderRadius={16} />
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
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Investigation</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={48} color={colors.danger} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Threat not found
          </Text>
          <TouchableOpacity
            onPress={() => router.replace("/(tabs)" as any)}
            style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 12 }}
            activeOpacity={0.8}
          >
            <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const severity = threat.severity as Severity;
  const sc = severityColor(severity, colors);
  const platformLabel = PLATFORM_LABELS[String(threat.platform ?? "")] ?? String(threat.platform ?? "Unknown");

  const breakdown: ThreatScoreBreakdown = detail?.scoreBreakdown ?? {
    mediaSimilarity: 0, contentReuse: 0, profileSimilarity: 0,
    bioSimilarity: 0, usernameSimilarity: 0, behavioral: 0,
  };

  const evidence: MatchedEvidence[] = (detail?.evidence ?? summary?.evidence ?? []).map((e) => ({
    id: e.id,
    type: e.type as MatchedEvidence["type"],
    similarity: e.similarity,
    label: e.label,
    yourCaption: "yourCaption" in e ? (e as any).yourCaption : undefined,
    stolenCaption: "stolenCaption" in e ? (e as any).stolenCaption : undefined,
    // Use the ingested profile photo URL stored at scan time — this is the
    // actual matched/monitored photo (e.g., your Instagram profile photo the
    // impersonator copied). user.avatarUrl is passed as fallbackUrl to
    // EvidencePhotoBox so it renders if the CDN URL has since expired.
    yourPhotoUrl:
      ("yourPhotoUrl" in e && (e as any).yourPhotoUrl)
        ? (e as any).yourPhotoUrl
        : undefined,
    stolenPhotoUrl: "stolenPhotoUrl" in e ? (e as any).stolenPhotoUrl : undefined,
    stolenPageUrl: "stolenPageUrl" in e ? (e as any).stolenPageUrl : undefined,
    postContext: "postContext" in e ? (e as any).postContext : undefined,
    originalPoster: "originalPoster" in e ? (e as any).originalPoster : undefined,
  }));

  const suspiciousUsername =
    detail?.suspiciousUsername ??
    ("suspiciousUsername" in threat ? (threat as any).suspiciousUsername : "") ?? "";

  const handle = suspiciousUsername.startsWith("@") ? suspiciousUsername : suspiciousUsername ? `@${suspiciousUsername}` : "Unknown account";

  // Strip internal orchestrator signals that are machine metadata, not human-readable findings.
  // These are used for scoring/escalation logic but should not be shown to users.
  const MACHINE_SIGNAL_PREFIXES = [
    "confirmedVictims:",
    "confirmedVictimsEscalation:",
    "crossUserEscalation",
    "sharedThreatActor",
    "firstScanHighConfidence",
    "postDatingDays:",
    "relationshipContextCap:",
    "Profile URL:",
  ];
  const detectedSignals = (
    detail?.detectedSignals && detail.detectedSignals.length > 0
      ? detail.detectedSignals
      : generateDetectedSignals(breakdown, String(threat.type))
  ).filter((s) => !MACHINE_SIGNAL_PREFIXES.some((pfx) => s.startsWith(pfx)));

  const aiExplanation =
    detail?.aiExplanation ||
    generateAiExplanation(String(threat.type), threat.platform as string | null, suspiciousUsername, threat.threatScore, threat.matchedMediaCount);

  const time =
    "time" in threat
      ? (threat as any).time
      : detail?.createdAt
      ? new Date(detail.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "";

  const platform = String(threat.platform ?? "");
  const cleanHandle = suspiciousUsername.replace(/^@/, "");
  const profileUrl = platform && cleanHandle ? PROFILE_URL_TEMPLATES[platform]?.(cleanHandle) : null;
  const guideUrl = platform ? REPORT_GUIDE_URLS[platform] : null;
  const accountMeta = detail?.accountMeta ?? null;

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleReport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isReviewerDemo) {
      if (canPreviewSampleActions) setDemoActionPreview("report");
      return;
    }
    const openProfile = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const url = profileUrl ?? guideUrl;
      if (url) Linking.openURL(url).catch(() => {
        Alert.alert("Could not open browser", "Please report the account manually through the platform's app.");
      });
    };
    Alert.alert(
      `Report ${handle}`,
      profileUrl
        ? `We'll open ${handle}'s profile so you can tap "Report" inside the platform's app. Do this before they can delete evidence.`
        : guideUrl
        ? "We'll open the platform's official reporting guide."
        : "Your report will be recorded in Rook.",
      [
        { text: "Cancel", style: "cancel" },
        { text: profileUrl ? "Open Profile & Report" : "Report", style: "destructive", onPress: openProfile },
      ]
    );
  };

  const handleCopyUsername = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Clipboard.setString(handle);
    Alert.alert("Copied", `${handle} has been copied to your clipboard.`);
  };

  const handleOpenProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isReviewerDemo) {
      if (canPreviewSampleActions) setDemoActionPreview("profile");
      return;
    }
    if (profileUrl) {
      Linking.openURL(profileUrl).catch(() => {
        Alert.alert("Could not open", "Please open the platform app and search for the account manually.");
      });
    }
  };

  const handleDownloadReport = async () => {
    if (isReviewerDemo && !canPreviewSampleActions) return;
    if (isGeneratingPdf) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsGeneratingPdf(true);
    try {
      const html = generateReportHtml({
        caseId: threat.id,
        generatedAt: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        userName: canPreviewSampleActions ? "Reviewer Demo User" : user?.name ?? "Rook User",
        platform,
        platformLabel,
        suspiciousUsername,
        severity: String(severity),
        threatScore: threat.threatScore,
        type: String(threat.type),
        aiExplanation,
        signals: detectedSignals,
        breakdown,
        evidence,
        postDatingDays: detail?.postDatingDays ?? null,
        demoPreview: isReviewerDemo,
      });

      const { uri } = await Print.printToFileAsync({ html, base64: false });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: canPreviewSampleActions
            ? "DEMO PREVIEW — NOT A REAL FINDING"
            : `Rook Investigation Report — ${handle}`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert(
          canPreviewSampleActions ? "Demo PDF Saved" : "PDF Saved",
          canPreviewSampleActions
            ? `DEMO PREVIEW — NOT A REAL FINDING. A watermarked sample PDF was saved to: ${uri}`
            : `Investigation report saved to: ${uri}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes("cancel")) {
        Alert.alert("Could not generate report", "Please try again.");
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShareCard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isReviewerDemo) {
      if (!canPreviewSampleActions) return;
      share(
        undefined,
        "DEMO PREVIEW — NOT A REAL FINDING. Fictional sample data only; no live account was detected.",
      );
      return;
    }
    const reportUrl = `https://tryrook.app/report?platform=${encodeURIComponent(platform)}&username=${encodeURIComponent(cleanHandle)}`;
    share(reportUrl);
  };

  const performResolve = async (action: string) => {
    if (resolving) return;
    if (isPreviewFinding && !canPreviewSampleActions) return;
    setShowResolveModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setResolving(true);
    try {
      await resolveThreat(threat.id, action);
      router.back();
    } catch {
      Alert.alert("Resolve Failed", "Could not mark this threat as resolved. Please check your connection and try again.");
      setResolving(false);
    }
  };

  const responseSteps = canPreviewSampleActions
    ? [
        {
          n: "1",
          icon: "flag" as const,
          iconColor: colors.warning,
          title: "Preview reporting guidance",
          desc: "Shows a local walkthrough only. No profile, report form, or external guide is opened.",
          action: handleReport,
          actionLabel: "Preview",
        },
        {
          n: "2",
          icon: "document-text-outline" as const,
          iconColor: colors.primary,
          title: "Save a watermarked sample PDF",
          desc: "The exported file is labeled as a demo and is not a real finding or platform submission.",
          action: handleDownloadReport,
          actionLabel: isGeneratingPdf ? "Building…" : "Save PDF",
        },
        {
          n: "3",
          icon: "shield-checkmark-outline" as const,
          iconColor: colors.success,
          title: "Block only after verifying a real finding",
          desc: "This fictional sample cannot be blocked. Do not act on a sample alert.",
          action: undefined,
          actionLabel: undefined,
        },
      ]
    : [
        { n: "1", icon: "flag" as const, iconColor: colors.danger, title: "Report to the platform", desc: `Tap "Report Account" below → go to their profile → select "It's pretending to be someone"`, action: handleReport, actionLabel: "Report" },
        { n: "2", icon: "document-text-outline" as const, iconColor: colors.primary, title: "Save this as evidence", desc: "Download your investigation report. Keep it if you need to escalate to lawyers or law enforcement.", action: handleDownloadReport, actionLabel: isGeneratingPdf ? "Building…" : "Download" },
        { n: "3", icon: "shield-checkmark-outline" as const, iconColor: colors.success, title: "Block after reporting", desc: "After the report is filed, block the account so they can't message or follow you while the review is pending.", action: undefined, actionLabel: undefined },
      ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Investigation
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {time}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          {platform ? <PlatformIcon platform={platform as any} size={22} /> : null}
          {(canUseLiveThreatActions || canPreviewSampleActions) && <TouchableOpacity
            onPress={handleShareCard}
            disabled={isSharing}
            hitSlop={10}
            style={{ opacity: isSharing ? 0.4 : 1 }}
          >
            <Ionicons name={isSharing ? "hourglass-outline" : "share-social-outline"} size={22} color={colors.foreground} />
          </TouchableOpacity>}
        </View>
      </View>

      {/* Resolve modal */}
      <Modal visible={showResolveModal} transparent animationType="slide" onRequestClose={() => setShowResolveModal(false)}>
        <Pressable style={resolveModalStyles.backdrop} onPress={() => setShowResolveModal(false)}>
          <Pressable onPress={() => {}} style={[resolveModalStyles.sheet, { backgroundColor: colors.card }]}>
            <View style={[resolveModalStyles.handle, { backgroundColor: colors.border }]} />
            <Text style={[resolveModalStyles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {canPreviewSampleActions ? "Preview a local response" : "How did you handle this?"}
            </Text>
            <Text style={[resolveModalStyles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {canPreviewSampleActions
                ? "Demo preview only. This changes the sample alert locally; it does not report, contact, block, or change anything on a platform."
                : "Your response helps Rook learn and improve detection accuracy."}
            </Text>

            <View style={[resolveModalStyles.section, { borderColor: colors.danger + "30" }]}>
              <View style={resolveModalStyles.sectionHeader}>
                <Ionicons name="warning" size={13} color={colors.danger} />
                <Text style={[resolveModalStyles.sectionLabel, { color: colors.danger, fontFamily: "Inter_700Bold" }]}>
                  {canPreviewSampleActions ? "Sample response · local only" : "Real Impersonator"}
                </Text>
              </View>
              <TouchableOpacity style={[resolveModalStyles.option, { borderColor: colors.border }]} onPress={() => performResolve("reported_to_platform")} activeOpacity={0.75}>
                <View style={[resolveModalStyles.optionIcon, { backgroundColor: colors.danger + "18" }]}>
                  <Ionicons name="flag" size={18} color={colors.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[resolveModalStyles.optionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {canPreviewSampleActions ? "Preview: reported to platform" : "Reported to the platform"}
                  </Text>
                  <Text style={[resolveModalStyles.optionDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {canPreviewSampleActions ? "Marks this fictional alert as previewed; no platform report is submitted." : "Flagged via Instagram, X, TikTok, or another platform's report system"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity style={[resolveModalStyles.option, { borderColor: colors.border }]} onPress={() => performResolve("resolved_manually")} activeOpacity={0.75}>
                <View style={[resolveModalStyles.optionIcon, { backgroundColor: colors.warning + "18" }]}>
                  <Ionicons name="shield-checkmark" size={18} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[resolveModalStyles.optionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {canPreviewSampleActions ? "Preview: handled manually" : "Removed or handled manually"}
                  </Text>
                  <Text style={[resolveModalStyles.optionDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {canPreviewSampleActions ? "Demonstrates a local response state; it does not remove or contact an account." : "Account was taken down, impersonator stopped, or you handled it directly"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={[resolveModalStyles.section, { borderColor: colors.border }]}>
              <View style={resolveModalStyles.sectionHeader}>
                <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                <Text style={[resolveModalStyles.sectionLabel, { color: colors.success, fontFamily: "Inter_700Bold" }]}>
                  {canPreviewSampleActions ? "Sample classification · local only" : "Not a Threat"}
                </Text>
              </View>
              <TouchableOpacity style={[resolveModalStyles.option, { borderColor: colors.border }]} onPress={() => performResolve("approved")} activeOpacity={0.75}>
                <View style={[resolveModalStyles.optionIcon, { backgroundColor: colors.primary + "18" }]}>
                  <Ionicons name="person-circle" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[resolveModalStyles.optionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {canPreviewSampleActions ? "Preview: trusted account" : "I know and trust this account"}
                  </Text>
                  <Text style={[resolveModalStyles.optionDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {canPreviewSampleActions ? "Applies only to this fictional sample alert." : "This is a fan page, a friend, or an account you've authorized"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity style={[resolveModalStyles.option, { borderColor: colors.border }]} onPress={() => performResolve("false_positive")} activeOpacity={0.75}>
                <View style={[resolveModalStyles.optionIcon, { backgroundColor: colors.mutedForeground + "18" }]}>
                  <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[resolveModalStyles.optionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {canPreviewSampleActions ? "Preview: false detection" : "False detection"}
                  </Text>
                  <Text style={[resolveModalStyles.optionDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {canPreviewSampleActions ? "Applies only to this fictional sample alert." : "Rook flagged this incorrectly — helps us reduce future false alarms"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[resolveModalStyles.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowResolveModal(false)}>
              <Text style={[resolveModalStyles.cancelText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={demoActionPreview !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDemoActionPreview(null)}
      >
        <Pressable style={demoPreviewStyles.backdrop} onPress={() => setDemoActionPreview(null)}>
          <Pressable style={[demoPreviewStyles.card, { backgroundColor: colors.card, borderColor: colors.warning + "66" }]} onPress={() => {}}>
            <View style={[demoPreviewStyles.icon, { backgroundColor: colors.warning + "20" }]}>
              <Ionicons name={demoActionPreview === "profile" ? "person-circle-outline" : "flag-outline"} size={24} color={colors.warning} />
            </View>
            <Text style={[demoPreviewStyles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {demoActionPreview === "profile" ? "Local profile preview" : "Reporting guidance preview"}
            </Text>
            <Text style={[demoPreviewStyles.notice, { color: colors.warning, fontFamily: "Inter_700Bold" }]}>
              DEMO PREVIEW · NOT A REAL FINDING
            </Text>
            <Text style={[demoPreviewStyles.body, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {demoActionPreview === "profile"
                ? `This example uses the sample handle ${handle}. No external profile was opened. In the live app, verify the account directly in the platform before taking action.`
                : `No report was submitted and no external reporting guide was opened. For a real, verified finding on ${platformLabel}, use the platform's official report flow and review its guidance before taking action.`}
            </Text>
            <TouchableOpacity
              style={[demoPreviewStyles.closeButton, { backgroundColor: colors.primary }]}
              onPress={() => setDemoActionPreview(null)}
              activeOpacity={0.8}
            >
              <Text style={[demoPreviewStyles.closeText, { fontFamily: "Inter_600SemiBold" }]}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 32 }]}>
        {isReviewerDemo && <ReviewerDemoBanner message="Sample findings and all response controls stay local to this preview." />}

        {isPreviewFinding && (
          <View
            style={[styles.sampleNotice, { backgroundColor: colors.warning + "14", borderColor: colors.warning + "55" }]}
            accessible
            accessibilityRole="summary"
            accessibilityLabel="Sample alert. This is an example, not a live detected account. Account details, scores, and source evidence are illustrative and have not been validated as live reports. Do not report or block an account based on this sample."
          >
            <Ionicons name="information-circle" size={20} color={colors.warning} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.sampleNoticeTitle, { color: colors.warning, fontFamily: "Inter_700Bold" }]}>
                Sample alert · not a live detection
              </Text>
              <Text style={[styles.sampleNoticeText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                Account details, scores, and source evidence are illustrative examples, not validated live reports. Do not report or block an account based on this sample.
              </Text>
            </View>
          </View>
        )}

        {/* ── Hero identity card ───────────────────────────────────────────── */}
        <View style={[styles.heroCard, { borderColor: sc + "44", backgroundColor: colors.card }]}>
          <LinearGradient
            colors={[sc + "18", sc + "04"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <View style={{ flex: 1, gap: 8 }}>
              <View style={[styles.severityBanner, { backgroundColor: sc + "22", borderColor: sc + "44" }]}>
                <View style={[styles.severityDot, { backgroundColor: sc }]} />
                <Text style={[styles.severityText, { color: sc, fontFamily: "Inter_700Bold" }]}>
                  {severity.toUpperCase()} SEVERITY
                </Text>
              </View>
              <Text style={[styles.impersonatorHandle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]} numberOfLines={2}>
                {handle}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {platform ? <PlatformIcon platform={platform as any} size={16} /> : null}
                <Text style={[styles.platformLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {platformLabel}
                </Text>
              </View>
              <Text style={[styles.threatTitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>
                {threat.title}
              </Text>
            </View>
            <ScoreGauge score={threat.threatScore} color={sc} />
          </View>

          {/* Account stat chips + Open Profile.
              When accountMeta is available: show follower/post/age chips + Open Profile.
              When no accountMeta: show Copy + Open Profile (existing fallback). */}
          {(canUseLiveThreatActions || canPreviewSampleActions) && <View style={[styles.quickActionsRow, { borderTopColor: sc + "22" }]}>
            {accountMeta ? (
              <>
                <View style={[styles.statChip, { backgroundColor: colors.border + "88" }]}>
                  <Ionicons name="people-outline" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.statChipLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {formatFollowers(accountMeta.followers)} followers
                  </Text>
                </View>
                {accountMeta.totalPosts != null && (
                  <View style={[styles.statChip, { backgroundColor: colors.border + "88" }]}>
                    <MaterialCommunityIcons name="image-multiple-outline" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.statChipLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {accountMeta.totalPosts} posts
                    </Text>
                  </View>
                )}
                {accountMeta.accountAgeDays != null && (
                  <View style={[styles.statChip, { backgroundColor: colors.border + "88" }]}>
                    <Ionicons name="calendar-outline" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.statChipLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {formatAccountAge(accountMeta.accountAgeDays)}
                    </Text>
                  </View>
                )}
                {/* Always keep Open Profile accessible — needed to tap Report inside the platform */}
                {profileUrl && canUseLiveThreatActions || canPreviewSampleActions ? (
                  <TouchableOpacity style={styles.quickAction} onPress={handleOpenProfile} activeOpacity={0.7}>
                    <Ionicons name="open-outline" size={16} color={colors.mutedForeground} />
                    <Text style={[styles.quickActionLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {canPreviewSampleActions ? "Preview Profile" : "Open Profile"}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.quickAction} onPress={handleCopyUsername} activeOpacity={0.7}>
                  <Ionicons name="copy-outline" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.quickActionLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Copy</Text>
                </TouchableOpacity>
                {profileUrl && canUseLiveThreatActions || canPreviewSampleActions ? (
                  <TouchableOpacity style={styles.quickAction} onPress={handleOpenProfile} activeOpacity={0.7}>
                    <Ionicons name="open-outline" size={16} color={colors.mutedForeground} />
                    <Text style={[styles.quickActionLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {canPreviewSampleActions ? "Preview Profile" : "Open Profile"}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>}
        </View>

        {/* ── Visual Evidence ──────────────────────────────────────────────── */}
        {evidence.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="image-search" size={18} color={colors.danger} />
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {isPreviewFinding ? "Example Evidence" : "Visual Evidence"}
              </Text>
              <View style={[styles.evidenceCountBadge, { backgroundColor: colors.danger + "22" }]}>
                <Text style={[styles.evidenceCountText, { color: colors.danger, fontFamily: "Inter_700Bold" }]}>
                  {isPreviewFinding ? `${threat.matchedMediaCount} examples` : `${threat.matchedMediaCount} matched`}
                </Text>
              </View>
            </View>
            <Text style={[styles.evidenceSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {isPreviewFinding
                ? "Illustrative content only. Source links are disabled because this is not a validated live report."
                : 'Tap "Suspected Match" to view the flagged post'}
            </Text>
            {evidence.map((item) => (
              <EvidenceCard key={item.id} item={item} isSample={isPreviewFinding} />
            ))}
          </View>
        )}

        {/* ── What to do now ───────────────────────────────────────────────── */}
        {(canUseLiveThreatActions || canPreviewSampleActions) ? <GlassCard style={[styles.actNowCard, { borderColor: (canPreviewSampleActions ? colors.warning : colors.danger) + "44" }]}>
          <View style={styles.actNowHeader}>
            <View style={[styles.actNowIconBg, { backgroundColor: colors.danger + "22" }]}>
              <Ionicons name="flash" size={18} color={colors.danger} />
            </View>
            <Text style={[styles.actNowTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {canPreviewSampleActions ? "Preview available actions" : "What to do right now"}
            </Text>
          </View>
          {responseSteps.map((step, i) => (
            <View key={i} style={[styles.stepRow, i < 2 && { borderBottomWidth: 1, borderBottomColor: colors.border + "88" }]}>
              <View style={[styles.stepBubble, { backgroundColor: colors.border }]}>
                <Text style={[styles.stepNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{step.n}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{step.title}</Text>
                <Text style={[styles.stepDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{step.desc}</Text>
              </View>
              {step.action ? (
                <TouchableOpacity
                  style={[styles.stepBtn, { backgroundColor: step.iconColor + "22", borderColor: step.iconColor + "44" }]}
                  onPress={step.action}
                  activeOpacity={0.75}
                  disabled={step.actionLabel === "Building…"}
                >
                  <Text style={[styles.stepBtnLabel, { color: step.iconColor, fontFamily: "Inter_600SemiBold" }]}>
                    {step.actionLabel}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </GlassCard> : (
          <GlassCard style={[styles.actNowCard, { borderColor: colors.warning + "44" }]}>
            <View style={styles.actNowHeader}>
              <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
              <Text style={[styles.actNowTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                Example only
              </Text>
            </View>
            <Text style={[styles.sampleNoticeText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              This sample demonstrates how an alert may appear. No real account was verified; no reporting or response action is available for this example.
            </Text>
          </GlassCard>
        )}

        {/* ── Why Rook flagged this (collapsible) ──────────────────────────── */}
        {aiExplanation && canUseLiveThreatActions ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => { setShowAiAnalysis((v) => !v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <GlassCard style={[styles.aiCard, { borderColor: colors.primary + "33" }]}>
              <View style={styles.sectionHeader}>
                <View style={[styles.aiIcon, { backgroundColor: colors.primary + "22" }]}>
                  <MaterialCommunityIcons name="brain" size={18} color={colors.primary} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  Why Rook flagged this
                </Text>
                <Ionicons
                  name={showAiAnalysis ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.mutedForeground}
                />
              </View>
              {!showAiAnalysis ? (
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }]}>
                  Tap to see AI analysis
                </Text>
              ) : (
                <>
                  <Text style={[styles.aiText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                    {aiExplanation}
                  </Text>
                  <View style={[styles.aiDisclaimerInline, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="information-outline" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.aiDisclaimerInlineText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      Probabilistic estimate · Verify before legal action
                    </Text>
                  </View>
                </>
              )}
            </GlassCard>
          </TouchableOpacity>
        ) : null}

        {/* ── Evidence Details — Detected Signals (collapsible) ────────────── */}
        {detectedSignals.length > 0 && canUseLiveThreatActions && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => { setShowSignals((v) => !v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <GlassCard style={styles.signalsCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="git-merge-outline" size={18} color={colors.warning} />
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  Evidence Details
                </Text>
                <View style={[styles.evidenceCountBadge, { backgroundColor: colors.warning + "22" }]}>
                  <Text style={[styles.evidenceCountText, { color: colors.warning, fontFamily: "Inter_700Bold" }]}>
                    {detectedSignals.length} signal{detectedSignals.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                <Ionicons
                  name={showSignals ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.mutedForeground}
                />
              </View>
              {showSignals ? (
                detectedSignals.map((signal, i) => (
                  <View key={i} style={styles.signalItem}>
                    <View style={[styles.signalIconBg, { backgroundColor: colors.warning + "18" }]}>
                      <Ionicons name="checkmark" size={12} color={colors.warning} />
                    </View>
                    <Text style={[styles.signalText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                      {signal}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }]}>
                  Tap to see {detectedSignals.length} detection signal{detectedSignals.length !== 1 ? "s" : ""}
                </Text>
              )}
            </GlassCard>
          </TouchableOpacity>
        )}

        {/* ── Score Breakdown (collapsible) ────────────────────────────────── */}
        {canUseLiveThreatActions && <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => { setShowBreakdown((v) => !v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        >
          <GlassCard style={styles.scoreCard}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="chart-bar" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Detection Score Breakdown
              </Text>
              <Ionicons
                name={showBreakdown ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.mutedForeground}
              />
            </View>
            {!showBreakdown && (
              <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }]}>
                Tap to see how the {threat.threatScore}/100 score was calculated
              </Text>
            )}
            {showBreakdown && (
              <>
                <ScoreBar label="Media Similarity" value={breakdown.mediaSimilarity} max={40} color={colors.danger} />
                <ScoreBar label="Content Reuse" value={breakdown.contentReuse} max={20} color={colors.warning} />
                <ScoreBar label="Profile Match" value={breakdown.profileSimilarity} max={15} color={colors.warning} />
                <ScoreBar label="Bio Similarity" value={breakdown.bioSimilarity} max={10} color={colors.primary} />
                <ScoreBar label="Username" value={breakdown.usernameSimilarity} max={10} color={colors.primary} />
                <ScoreBar label="Behavior" value={breakdown.behavioral} max={5} color={colors.mutedForeground} />
              </>
            )}
          </GlassCard>
        </TouchableOpacity>}

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        {(canUseLiveThreatActions || canPreviewSampleActions) && <View style={styles.actionsSection}>
          {/* Primary: Report */}
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.danger }]} activeOpacity={0.82} onPress={handleReport}>
            <Ionicons name="flag" size={18} color="#FFFFFF" />
            <Text style={[styles.primaryBtnText, { fontFamily: "Inter_600SemiBold" }]}>
              {canPreviewSampleActions ? "Preview Reporting Guidance" : "Report Account"}
            </Text>
          </TouchableOpacity>

          {/* Secondary row: Download PDF + Share */}
          <View style={styles.secondaryRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40", flex: 1 }]}
              activeOpacity={0.8}
              onPress={handleDownloadReport}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? (
                <MaterialCommunityIcons name="loading" size={17} color={colors.primary} />
              ) : (
                <Ionicons name="document-text-outline" size={17} color={colors.primary} />
              )}
              <Text style={[styles.secondaryBtnText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                {isGeneratingPdf ? "Building…" : canPreviewSampleActions ? "Save Demo PDF" : "Save Report"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: colors.secondary, borderColor: colors.border, flex: 1 }]}
              activeOpacity={0.8}
              onPress={handleShareCard}
              disabled={isSharing}
            >
              <Ionicons name="share-social-outline" size={17} color={colors.foreground} />
              <Text style={[styles.secondaryBtnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {canPreviewSampleActions ? "Share Watermarked Demo" : "Share Alert"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Ghost: Resolve */}
          <TouchableOpacity
            style={[styles.ghostBtn, { borderColor: colors.border }]}
            activeOpacity={0.75}
            onPress={() => setShowResolveModal(true)}
            disabled={resolving}
          >
            <Ionicons name="checkmark-circle-outline" size={17} color={colors.mutedForeground} />
            <Text style={[styles.ghostBtnText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {resolving ? "Resolving…" : canPreviewSampleActions ? "Mark Sample Resolved" : "Mark as Resolved"}
            </Text>
          </TouchableOpacity>
        </View>}

      </ScrollView>

      {/* Off-screen ShareCard snapshot */}
      {(canUseLiveThreatActions || canPreviewSampleActions) && <View style={{ position: "absolute", top: -10000, left: 0 }} pointerEvents="none">
        <View ref={cardRef} collapsable={false}>
          {canPreviewSampleActions ? (
            <View style={demoShareStyles.card}>
              <Text style={demoShareStyles.brand}>ROOK · REVIEWER PREVIEW</Text>
              <View style={demoShareStyles.watermark}>
                <Text style={demoShareStyles.watermarkText}>DEMO PREVIEW</Text>
                <Text style={demoShareStyles.watermarkSub}>NOT A REAL FINDING</Text>
              </View>
              <Text style={demoShareStyles.heading}>Illustrative identity alert</Text>
              <Text style={demoShareStyles.handle}>{handle} · {platformLabel}</Text>
              <Text style={demoShareStyles.score}>Example score: {threat.threatScore}</Text>
              <View style={demoShareStyles.rule} />
              <Text style={demoShareStyles.disclaimer}>
                Fictional sample data only. No real account was detected. Do not report, block, contact, or take action based on this image.
              </Text>
              <Text style={demoShareStyles.footer}>No external profile or public report link is included.</Text>
            </View>
          ) : (
            <ShareCard
              userDisplayName={user?.name ?? "Rook User"}
              userInitials={user?.avatarInitials ?? "R"}
              userAvatarUrl={user?.avatarUrl}
              platform={platform}
              suspiciousUsername={suspiciousUsername || "unknown"}
              threatScore={threat.threatScore}
              reportUrl={`https://tryrook.app/report?platform=${encodeURIComponent(platform)}&username=${encodeURIComponent(cleanHandle)}`}
            />
          )}
        </View>
      </View>}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 15, marginTop: 8 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17 },
  headerSub: { fontSize: 12, marginTop: 1 },

  content: { padding: 16, gap: 12 },
  sampleNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  sampleNoticeTitle: { fontSize: 14 },
  sampleNoticeText: { fontSize: 13, lineHeight: 19 },

  // Hero
  heroCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 18,
    gap: 14,
    overflow: "hidden",
  },
  severityBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, alignSelf: "flex-start",
  },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  severityText: { fontSize: 11, letterSpacing: 0.5 },
  impersonatorHandle: { fontSize: 22, lineHeight: 28 },
  platformLabel: { fontSize: 13 },
  threatTitle: { fontSize: 13, lineHeight: 19 },

  gaugeContainer: { alignItems: "center", gap: 5 },
  gaugeOuter: {
    width: 84, height: 84, borderRadius: 42, borderWidth: 2,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  gaugeScore: { fontSize: 24 },
  gaugeSubLabel: { fontSize: 11 },
  gaugeRisk: { fontSize: 10, letterSpacing: 0.4 },

  quickActionsRow: {
    flexDirection: "row", alignItems: "center",
    borderTopWidth: 1, paddingTop: 12, gap: 6, flexWrap: "wrap",
  },
  quickAction: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 4 },
  quickActionLabel: { fontSize: 11 },

  // Account stat chips (replace quick actions when accountMeta is present)
  statChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statChipLabel: { fontSize: 12 },

  // Act now
  actNowCard: { gap: 0, padding: 0, overflow: "hidden" },
  actNowHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
  },
  actNowIconBg: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actNowTitle: { fontSize: 15 },
  stepRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  stepBubble: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
  },
  stepNum: { fontSize: 13 },
  stepTitle: { fontSize: 14, marginBottom: 2 },
  stepDesc: { fontSize: 12, lineHeight: 17 },
  stepBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, alignSelf: "flex-start", flexShrink: 0,
  },
  stepBtnLabel: { fontSize: 12 },

  // Evidence
  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 15, flex: 1 },
  evidenceSubtitle: { fontSize: 12, marginTop: -4 },
  evidenceCountBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  evidenceCountText: { fontSize: 11 },

  evidenceCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  evidenceCardHeader: { flexDirection: "row", alignItems: "center" },
  evidenceTypeBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  evidenceTypeBadgeText: { fontSize: 11 },
  evidenceCompare: { flexDirection: "row", alignItems: "center", gap: 10 },
  evidencePhotoCol: { flex: 1, alignItems: "center", gap: 6 },
  evidencePhotoBox: {
    width: "100%", aspectRatio: 1, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  evidencePhotoBadge: {
    position: "absolute", top: 4, right: 4, width: 16, height: 16,
    borderRadius: 8, alignItems: "center", justifyContent: "center",
  },
  evidencePhotoLabel: { fontSize: 11 },
  evidenceCaption: { fontSize: 11, textAlign: "center", lineHeight: 15 },
  stolenPlaceholder: { alignItems: "center", gap: 4 },
  tapToView: { fontSize: 10 },
  viewOverlay: {
    position: "absolute", bottom: 4, right: 4, width: 20, height: 20,
    borderRadius: 10, alignItems: "center", justifyContent: "center",
  },
  evidenceArrow: { alignItems: "center", gap: 4 },
  similarityBubble: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  similarityPct: { color: "#FFFFFF", fontSize: 13 },
  matchWord: { fontSize: 10 },

  // AI
  aiCard: { gap: 12 },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  aiIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  aiLabel: { fontSize: 14 },
  aiPowered: { fontSize: 11 },
  aiText: { fontSize: 14, lineHeight: 22 },
  aiDisclaimerInline: {
    flexDirection: "row", alignItems: "center", gap: 6,
    padding: 8, borderRadius: 8, borderWidth: 1,
  },
  aiDisclaimerInlineText: { fontSize: 11, flex: 1 },

  // Signals
  signalsCard: { gap: 10 },
  signalItem: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  signalIconBg: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  signalText: { fontSize: 14, flex: 1, lineHeight: 20 },

  // Score breakdown
  scoreCard: { gap: 10 },
  scoreBarRow: { gap: 6 },
  scoreBarLabel: { fontSize: 12 },
  scoreBarTrackWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  scoreBarTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  scoreBarFill: { height: "100%", borderRadius: 3 },
  scoreBarValue: { fontSize: 12, width: 56, textAlign: "right" },

  // Actions
  actionsSection: { gap: 10, marginTop: 4 },
  primaryBtn: {
    height: 54, borderRadius: 27,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 16 },
  secondaryRow: { flexDirection: "row", gap: 10 },
  secondaryBtn: {
    height: 50, borderRadius: 25,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 14 },
  ghostBtn: {
    height: 46, borderRadius: 23,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderWidth: 1,
  },
  ghostBtnText: { fontSize: 14 },
});

const resolveModalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, gap: 16 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  title: { fontSize: 18, textAlign: "center" },
  subtitle: { fontSize: 13, textAlign: "center", lineHeight: 18, marginTop: -8 },
  section: { borderRadius: 14, borderWidth: 1, overflow: "hidden", gap: 0 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: 1 },
  optionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  optionTitle: { fontSize: 14, marginBottom: 2 },
  optionDesc: { fontSize: 12, lineHeight: 16 },
  cancelBtn: { height: 50, borderRadius: 25, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 4 },
  cancelText: { fontSize: 15 },
});

const demoPreviewStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)", justifyContent: "center", padding: 24 },
  card: { borderRadius: 20, borderWidth: 1, padding: 22, gap: 12 },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  title: { fontSize: 18, textAlign: "center" },
  notice: { fontSize: 12, textAlign: "center", letterSpacing: 0.4 },
  body: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  closeButton: { height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center", marginTop: 4 },
  closeText: { color: "#fff", fontSize: 14 },
});

const demoShareStyles = StyleSheet.create({
  card: {
    width: 390,
    height: 693,
    paddingHorizontal: 28,
    paddingVertical: 36,
    backgroundColor: "#101827",
    borderColor: "#F59E0B",
    borderWidth: 3,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { color: "#93C5FD", fontSize: 13, fontWeight: "800", letterSpacing: 2 },
  watermark: { borderColor: "#F59E0B", borderWidth: 2, backgroundColor: "#422006", borderRadius: 14, paddingVertical: 18, paddingHorizontal: 24, alignItems: "center", width: "100%" },
  watermarkText: { color: "#FCD34D", fontSize: 25, fontWeight: "900", letterSpacing: 1.5 },
  watermarkSub: { color: "#FDE68A", fontSize: 14, fontWeight: "800", marginTop: 5 },
  heading: { color: "#F8FAFC", fontSize: 25, fontWeight: "800", textAlign: "center" },
  handle: { color: "#CBD5E1", fontSize: 17, textAlign: "center" },
  score: { color: "#FCD34D", fontSize: 18, fontWeight: "700" },
  rule: { height: 1, alignSelf: "stretch", backgroundColor: "#334155" },
  disclaimer: { color: "#F8FAFC", fontSize: 16, lineHeight: 25, textAlign: "center", fontWeight: "600" },
  footer: { color: "#94A3B8", fontSize: 12, lineHeight: 18, textAlign: "center" },
});
