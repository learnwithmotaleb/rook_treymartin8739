import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const C = {
  bg: "#070B12",
  card: "#0D1420",
  border: "#1A2740",
  primary: "#3B82F6",
  primaryDark: "#1D4ED8",
  premium: "#7C3AED",
  danger: "#EF4444",
  success: "#10B981",
  warning: "#F59E0B",
  foreground: "#F0F4FF",
  muted: "#6B8EAE",
  secondary: "#131C2B",
} as const;

export interface ShareCardProps {
  userDisplayName: string;
  userInitials: string;
  userAvatarUrl?: string | null;
  platform: string;
  suspiciousUsername: string;
  threatScore: number;
  reportUrl: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X (Twitter)",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  snapchat: "Snapchat",
};

function Avatar({ initials, avatarUrl }: { initials: string; avatarUrl?: string | null }) {
  const [imgFailed, setImgFailed] = React.useState(false);
  const showImage = !!avatarUrl && !imgFailed;
  return (
    <View style={s.avatarRing}>
      <LinearGradient
        colors={[C.primary + "55", C.premium + "55"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.avatarInner}>
        {showImage ? (
          <Image
            source={{ uri: avatarUrl! }}
            style={s.avatarImg}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <Text style={s.avatarInitials}>{initials}</Text>
        )}
      </View>
    </View>
  );
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <View style={s.checkRow}>
      <View style={[s.checkDot, { backgroundColor: done ? C.success : C.warning }]}>
        <Text style={s.checkIcon}>{done ? "✓" : "⏳"}</Text>
      </View>
      <Text style={[s.checkLabel, { color: done ? C.foreground : C.muted }]}>{label}</Text>
    </View>
  );
}

export function ShareCard({
  userDisplayName,
  userInitials,
  userAvatarUrl,
  platform,
  suspiciousUsername,
  threatScore,
  reportUrl,
}: ShareCardProps) {
  const platformLabel = PLATFORM_LABELS[platform] ?? platform;
  const handle = suspiciousUsername.startsWith("@") ? suspiciousUsername : `@${suspiciousUsername}`;

  return (
    <View style={s.card} collapsable={false}>
      <LinearGradient
        colors={["#0A1020", C.bg]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Top: Rook wordmark */}
      <View style={s.top}>
        <View style={s.wordmarkRow}>
          <View style={s.shieldIcon}>
            <Text style={s.shieldEmoji}>🛡️</Text>
          </View>
          <Text style={s.wordmark}>ROOK</Text>
        </View>
        <View style={s.alertBadge}>
          <Text style={s.alertBadgeText}>⚠️ Identity Alert</Text>
        </View>
      </View>

      {/* Avatar + name */}
      <View style={s.avatarSection}>
        <Avatar initials={userInitials} avatarUrl={userAvatarUrl} />
        <Text style={s.displayName}>{userDisplayName}</Text>
        <Text style={s.verifiedLabel}>VERIFIED ACCOUNT</Text>
      </View>

      {/* Headline */}
      <View style={s.headlineSection}>
        <Text style={s.headline}>Someone is impersonating{"\n"}me online.</Text>
        <Text style={s.subtext}>
          {handle} on {platformLabel} is pretending to be me.{"\n"}
          I need your help reporting it.
        </Text>
      </View>

      {/* Checklist */}
      <View style={s.checklist}>
        <CheckItem done label="Fake account detected" />
        <CheckItem done label="Report submitted by me" />
        <CheckItem done={false} label="Community help requested" />
      </View>

      {/* CTA buttons */}
      <View style={s.buttons}>
        <LinearGradient
          colors={[C.primary, C.premium]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.primaryBtn}
        >
          <Text style={s.primaryBtnText}>🛡️  Help Report</Text>
        </LinearGradient>

        <View style={s.secondaryBtn}>
          <Text style={s.secondaryBtnText}>🔍  Check if you're being impersonated</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.footerText}>Tap this story to help and protect yourself.</Text>
        <Text style={s.footerUrl} numberOfLines={1} ellipsizeMode="tail">
          {reportUrl}
        </Text>
        <View style={s.scorePill}>
          <Text style={s.scorePillText}>{threatScore}% match confirmed</Text>
        </View>
      </View>
    </View>
  );
}

const CARD_W = 390;
const CARD_H = 693;

const s = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: C.bg,
    borderRadius: 24,
    overflow: "hidden",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    gap: 18,
  },

  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wordmarkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  shieldIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: C.primary + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  shieldEmoji: { fontSize: 14 },
  wordmark: {
    fontSize: 16,
    fontWeight: "900",
    color: C.foreground,
    letterSpacing: 3,
  },
  alertBadge: {
    backgroundColor: C.danger + "22",
    borderWidth: 1,
    borderColor: C.danger + "55",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  alertBadgeText: {
    fontSize: 11,
    color: C.danger,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  avatarSection: {
    alignItems: "center",
    gap: 8,
  },
  avatarRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    padding: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: C.secondary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: "700",
    color: C.primary,
  },
  displayName: {
    fontSize: 16,
    fontWeight: "700",
    color: C.foreground,
    letterSpacing: 0.2,
  },
  verifiedLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: C.muted,
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  headlineSection: {
    alignItems: "center",
    gap: 8,
  },
  headline: {
    fontSize: 22,
    fontWeight: "800",
    color: C.foreground,
    textAlign: "center",
    lineHeight: 30,
  },
  subtext: {
    fontSize: 13,
    color: C.muted,
    textAlign: "center",
    lineHeight: 19,
  },

  checklist: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  checkIcon: { fontSize: 11 },
  checkLabel: {
    fontSize: 13,
    fontWeight: "500",
  },

  buttons: {
    gap: 10,
  },
  primaryBtn: {
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.secondary,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.muted,
  },

  footer: {
    alignItems: "center",
    gap: 4,
  },
  footerText: {
    fontSize: 11,
    color: C.muted,
    textAlign: "center",
  },
  footerUrl: {
    fontSize: 11,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: 0.2,
    maxWidth: 340,
    textAlign: "center",
  },

  scorePill: {
    backgroundColor: C.danger + "22",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 2,
  },
  scorePillText: {
    fontSize: 10,
    color: C.danger,
    fontWeight: "600",
  },
});
