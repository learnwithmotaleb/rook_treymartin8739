import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Platform as SocialPlatform } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { PlatformIcon } from "@/components/PlatformIcon";

const { width } = Dimensions.get("window");
const TOTAL_STEPS = 9;

export interface OnboardingAnswers {
  primaryConcern: string | null;
  userType: string | null;
  followerRange: string | null;
  activePlatforms: string[];
  attribution: string | null;
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────
function WelcomeScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View style={styles.screenPad}>
      <LinearGradient colors={["#3B82F622", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.welcomeCenter}>
        <View style={styles.shieldWrap}>
          {[1.6, 1.3, 1.0].map((scale, i) => (
            <Animated.View key={i} style={[styles.shieldRing, {
              width: 120 * scale, height: 120 * scale, borderRadius: 60 * scale,
              borderColor: colors.primary + (i === 0 ? "18" : i === 1 ? "30" : "00"),
              backgroundColor: i === 2 ? colors.primary + "22" : "transparent",
              transform: i === 2 ? [{ scale: pulseAnim }] : [],
            }]} />
          ))}
          <Ionicons name="shield-checkmark" size={52} color={colors.primary} />
        </View>

        <Text style={[styles.welcomeTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Protect Your Identity{"\n"}Across Social Media
        </Text>
        <Text style={[styles.welcomeSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          AI continuously monitors social platforms for fake accounts, stolen photos, and impersonators pretending to be you.
        </Text>

        <View style={styles.platformRow}>
          {(["instagram", "facebook", "x", "tiktok", "youtube"] as NonNullable<SocialPlatform>[]).map((p) => (
            <View key={p} style={[styles.platformPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <PlatformIcon platform={p} size={20} />
            </View>
          ))}
        </View>

        <View style={[styles.trustPill, { backgroundColor: colors.success + "18", borderColor: colors.success + "33" }]}>
          <Ionicons name="lock-closed" size={12} color={colors.success} />
          <Text style={[styles.trustText, { color: colors.success, fontFamily: "Inter_500Medium" }]}>
            Privacy-first · No posting · Read-only
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Step 2: What Brings You Here ────────────────────────────────────────────
const CONCERNS = [
  { id: "impersonated", icon: "alert-circle" as const, label: "Someone is impersonating me", sub: "I've found fake accounts using my name or photos", color: "#EF4444" },
  { id: "creator", icon: "videocam" as const, label: "Protecting my creator brand", sub: "My content gets stolen or reused without permission", color: "#8B5CF6" },
  { id: "proactive", icon: "shield-checkmark" as const, label: "Staying ahead of threats", sub: "I want to prevent identity theft proactively", color: "#3B82F6" },
  { id: "business", icon: "business" as const, label: "Business & brand protection", sub: "My company's social presence needs monitoring", color: "#10B981" },
  { id: "curious", icon: "search" as const, label: "Checking my exposure", sub: "I'm curious to see if I'm already at risk", color: "#F59E0B" },
];

function ConcernScreen({
  colors,
  selected,
  onSelect,
}: {
  colors: ReturnType<typeof useColors>;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const cardAnims = useRef(CONCERNS.map(() => new Animated.Value(0))).current;
  const scaleAnims = useRef(CONCERNS.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    Animated.stagger(
      70,
      cardAnims.map((anim) =>
        Animated.spring(anim, { toValue: 1, tension: 120, friction: 9, useNativeDriver: true })
      )
    ).start();
  }, [cardAnims]);

  const handlePress = (id: string, idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scaleAnims[idx]!, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnims[idx]!, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
    onSelect(id);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenPad} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#3B82F611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={[styles.eduIconWrap, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
        <Ionicons name="help-circle" size={36} color={colors.primary} />
      </View>

      <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        What brings you to ShieldID?
      </Text>
      <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        This helps us tailor your protection profile to what matters most to you.
      </Text>

      <View style={styles.optionList}>
        {CONCERNS.map((c, idx) => {
          const isSelected = selected === c.id;
          return (
            <Animated.View
              key={c.id}
              style={{
                opacity: cardAnims[idx],
                transform: [
                  { translateY: cardAnims[idx]!.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
                  { scale: scaleAnims[idx]! },
                ],
              }}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handlePress(c.id, idx)}
                style={[styles.optionCard, {
                  backgroundColor: isSelected ? c.color + "12" : colors.card,
                  borderColor: isSelected ? c.color + "80" : colors.border,
                  borderWidth: isSelected ? 1.5 : 1,
                }]}
              >
                <View style={[styles.optionIconWrap, { backgroundColor: c.color + "20" }]}>
                  <Ionicons name={c.icon} size={22} color={c.color} />
                </View>
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {c.label}
                  </Text>
                  <Text style={[styles.optionSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {c.sub}
                  </Text>
                </View>
                <View style={[styles.optionCheck, {
                  backgroundColor: isSelected ? c.color : "transparent",
                  borderColor: isSelected ? c.color : colors.border,
                }]}>
                  {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── Step 3: Education ────────────────────────────────────────────────────────
const STATS = [
  { icon: "person-add", value: "500K+", label: "Fake profiles created daily", color: "#EF4444" },
  { icon: "warning", value: "1 in 4", label: "People have been impersonated online", color: "#F59E0B" },
  { icon: "card", value: "$10B+", label: "Lost to social media fraud yearly", color: "#8B5CF6" },
];

const CONCERN_HEADLINES: Record<string, string> = {
  impersonated: "You're Not Alone — Impersonation Is Exploding",
  creator: "Content Theft Is the #1 Threat Facing Creators",
  proactive: "Smart Move — Most Victims Don't Act Until It's Too Late",
  business: "Brand Impersonation Costs Businesses Millions Each Year",
  curious: "You'd Be Surprised What's Already Out There",
};

function EducationScreen({ colors, concern }: { colors: ReturnType<typeof useColors>; concern: string | null }) {
  const headline = (concern && CONCERN_HEADLINES[concern]) ?? "Fake Accounts Are More Common Than You Think";
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenPad} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#EF444411", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.eduIconWrap, { backgroundColor: "#EF444422", borderColor: "#EF444444" }]}>
        <Ionicons name="trending-up" size={36} color="#EF4444" />
      </View>
      <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{headline}</Text>
      <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        Identity theft on social media is the fastest-growing form of online fraud — and most victims don't know until it's too late.
      </Text>
      <View style={styles.statsCol}>
        {STATS.map((s) => (
          <GlassCard key={s.value} style={[styles.statCard, { borderLeftColor: s.color, borderLeftWidth: 3 }]}>
            <View style={[styles.statIcon, { backgroundColor: s.color + "22" }]}>
              <Ionicons name={s.icon as any} size={20} color={s.color} />
            </View>
            <View style={styles.statText}>
              <Text style={[styles.statValue, { color: s.color, fontFamily: "Inter_700Bold" }]}>{s.value}</Text>
              <Text style={[styles.statLabel2, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{s.label}</Text>
            </View>
          </GlassCard>
        ))}
      </View>
      <GlassCard style={[styles.warnCard, { borderColor: "#EF444433" }]}>
        <Ionicons name="information-circle" size={16} color="#EF4444" />
        <Text style={[styles.warnText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Impersonators steal photos, reuse bios, and contact your followers with scams — all while pretending to be you.
        </Text>
      </GlassCard>
    </ScrollView>
  );
}

// ─── Step 4: About You ────────────────────────────────────────────────────────
const USER_TYPES = [
  { id: "public_figure", icon: "star" as const, label: "Public Figure", color: "#F59E0B" },
  { id: "creator", icon: "videocam" as const, label: "Content Creator", color: "#8B5CF6" },
  { id: "business", icon: "business" as const, label: "Business / Brand", color: "#10B981" },
  { id: "professional", icon: "briefcase" as const, label: "Professional", color: "#3B82F6" },
  { id: "student", icon: "school" as const, label: "Student", color: "#06B6D4" },
  { id: "personal", icon: "person" as const, label: "Personal", color: "#6B7280" },
];

const FOLLOWER_RANGES = [
  { id: "small", label: "1–2 accounts" },
  { id: "medium", label: "3–5 accounts" },
  { id: "large", label: "6+ accounts" },
];

function AboutYouScreen({
  colors,
  selectedType,
  selectedRange,
  onSelectType,
  onSelectRange,
}: {
  colors: ReturnType<typeof useColors>;
  selectedType: string | null;
  selectedRange: string | null;
  onSelectType: (id: string) => void;
  onSelectRange: (id: string) => void;
}) {
  const gridAnims = useRef(USER_TYPES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      55,
      gridAnims.map((a) =>
        Animated.spring(a, { toValue: 1, tension: 120, friction: 9, useNativeDriver: true })
      )
    ).start();
  }, [gridAnims]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenPad} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#8B5CF611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.eduIconWrap, { backgroundColor: "#8B5CF622", borderColor: "#8B5CF644" }]}>
        <Ionicons name="person-circle" size={36} color="#8B5CF6" />
      </View>
      <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        Tell us about yourself
      </Text>
      <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        We'll personalize your monitoring to match your online presence and risk profile.
      </Text>

      <Text style={[styles.sectionLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>I am a…</Text>
      <View style={styles.typeGrid}>
        {USER_TYPES.map((t, idx) => {
          const isSelected = selectedType === t.id;
          return (
            <Animated.View key={t.id} style={{
              opacity: gridAnims[idx],
              transform: [{ translateY: gridAnims[idx]!.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
              width: (width - 60) / 3,
            }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelectType(t.id); }}
                style={[styles.typeCard, {
                  backgroundColor: isSelected ? t.color + "18" : colors.card,
                  borderColor: isSelected ? t.color + "80" : colors.border,
                  borderWidth: isSelected ? 1.5 : 1,
                }]}
              >
                <View style={[styles.typeIcon, { backgroundColor: t.color + "20" }]}>
                  <Ionicons name={t.icon} size={20} color={t.color} />
                </View>
                <Text style={[styles.typeLabel, {
                  color: isSelected ? t.color : colors.foreground,
                  fontFamily: isSelected ? "Inter_600SemiBold" : "Inter_400Regular",
                }]}>{t.label}</Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold", marginTop: 4 }]}>
        How many social accounts do you have?
      </Text>
      <View style={styles.rangeRow}>
        {FOLLOWER_RANGES.map((r) => {
          const isSelected = selectedRange === r.id;
          return (
            <TouchableOpacity
              key={r.id}
              activeOpacity={0.8}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelectRange(r.id); }}
              style={[styles.rangeBtn, {
                backgroundColor: isSelected ? colors.primary + "18" : colors.card,
                borderColor: isSelected ? colors.primary + "80" : colors.border,
                borderWidth: isSelected ? 1.5 : 1,
                flex: 1,
              }]}
            >
              <Text style={[styles.rangeBtnText, {
                color: isSelected ? colors.primary : colors.foreground,
                fontFamily: isSelected ? "Inter_600SemiBold" : "Inter_400Regular",
              }]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.insightCard, { backgroundColor: colors.primary + "0C", borderColor: colors.primary + "22" }]}>
        <Ionicons name="analytics" size={14} color={colors.primary} />
        <Text style={[styles.insightText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          This calibrates your risk score and helps us prioritize what to scan first.
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Step 5: Platforms ────────────────────────────────────────────────────────
const ALL_PLATFORMS: Array<{ id: string; label: string; color: string }> = [
  { id: "instagram", label: "Instagram", color: "#E1306C" },
  { id: "tiktok", label: "TikTok", color: "#010101" },
  { id: "x", label: "X / Twitter", color: "#000000" },
  { id: "facebook", label: "Facebook", color: "#1877F2" },
  { id: "youtube", label: "YouTube", color: "#FF0000" },
  { id: "snapchat", label: "Snapchat", color: "#FFFC00" },
  { id: "linkedin", label: "LinkedIn", color: "#0077B5" },
  { id: "pinterest", label: "Pinterest", color: "#E60023" },
];

function PlatformsScreen({
  colors,
  selected,
  onToggle,
}: {
  colors: ReturnType<typeof useColors>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const cardAnims = useRef(ALL_PLATFORMS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      50,
      cardAnims.map((a) =>
        Animated.spring(a, { toValue: 1, tension: 110, friction: 9, useNativeDriver: true })
      )
    ).start();
  }, [cardAnims]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenPad} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#F59E0B11", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.eduIconWrap, { backgroundColor: "#F59E0B22", borderColor: "#F59E0B44" }]}>
        <Ionicons name="apps" size={36} color="#F59E0B" />
      </View>
      <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        Which platforms are you on?
      </Text>
      <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        Select all that apply — we'll focus monitoring where you're most active and at risk.
      </Text>

      <View style={styles.platformGrid}>
        {ALL_PLATFORMS.map((p, idx) => {
          const isSelected = selected.includes(p.id);
          return (
            <Animated.View key={p.id} style={{
              opacity: cardAnims[idx],
              transform: [{ translateY: cardAnims[idx]!.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
              width: (width - 60) / 2,
            }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggle(p.id); }}
                style={[styles.platCard, {
                  backgroundColor: isSelected ? p.color + "14" : colors.card,
                  borderColor: isSelected ? p.color + "70" : colors.border,
                  borderWidth: isSelected ? 1.5 : 1,
                }]}
              >
                <View style={styles.platCardRow}>
                  <PlatformIcon platform={p.id as NonNullable<SocialPlatform>} size={26} />
                  <View style={[styles.platCheckbox, {
                    backgroundColor: isSelected ? p.color : "transparent",
                    borderColor: isSelected ? p.color : colors.border,
                  }]}>
                    {isSelected && <Ionicons name="checkmark" size={10} color="#fff" />}
                  </View>
                </View>
                <Text style={[styles.platLabel, {
                  color: isSelected ? colors.foreground : colors.mutedForeground,
                  fontFamily: isSelected ? "Inter_600SemiBold" : "Inter_400Regular",
                }]}>{p.label}</Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {selected.length > 0 && (
        <View style={[styles.selectionPill, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "33" }]}>
          <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
          <Text style={[styles.selectionPillText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
            Monitoring {selected.length} platform{selected.length !== 1 ? "s" : ""} for you
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Step 6: Connect Accounts ─────────────────────────────────────────────────
const CONNECTABLE: Array<{ id: NonNullable<SocialPlatform>; label: string; color: string }> = [
  { id: "instagram", label: "Instagram", color: "#E1306C" },
  { id: "facebook", label: "Facebook", color: "#1877F2" },
  { id: "x", label: "X (Twitter)", color: "#000000" },
  { id: "tiktok", label: "TikTok", color: "#010101" },
];

function ConnectScreen({
  colors,
  activePlatforms,
  onSkip,
  onConnect,
}: {
  colors: ReturnType<typeof useColors>;
  activePlatforms: string[];
  onSkip: () => void;
  onConnect: () => void;
}) {
  const prioritized = activePlatforms.length > 0
    ? CONNECTABLE.filter((p) => activePlatforms.includes(p.id))
    : CONNECTABLE;
  const displayPlatforms = prioritized.length > 0 ? prioritized : CONNECTABLE;

  const [selected, setSelected] = useState<Set<string>>(
    new Set(displayPlatforms.map((p) => p.id))
  );

  const toggle = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenPad} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#3B82F611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.eduIconWrap, { backgroundColor: "#3B82F622", borderColor: "#3B82F644" }]}>
        <Ionicons name="link" size={36} color="#3B82F6" />
      </View>
      <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        Connect Your Social Profiles
      </Text>
      <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {activePlatforms.length > 0
          ? `We'll connect the platforms you told us about to build a more accurate identity fingerprint.`
          : `Connecting your accounts allows AI to build a more accurate identity fingerprint and catch threats faster.`}
      </Text>

      <View style={styles.platformList}>
        {displayPlatforms.map((p) => {
          const isSelected = selected.has(p.id);
          return (
            <TouchableOpacity key={p.id} activeOpacity={0.75} onPress={() => toggle(p.id)}
              style={[styles.platformRow2, {
                backgroundColor: isSelected ? colors.primary + "14" : colors.card,
                borderColor: isSelected ? colors.primary + "66" : colors.border,
              }]}
            >
              <PlatformIcon platform={p.id} size={28} />
              <Text style={[styles.platformLabel2, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                {p.label}
              </Text>
              <View style={[styles.checkbox, {
                backgroundColor: isSelected ? colors.primary : "transparent",
                borderColor: isSelected ? colors.primary : colors.border,
              }]}>
                {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <GlassCard style={[styles.privacyCard, { borderColor: colors.success + "33" }]}>
        <Ionicons name="lock-closed" size={14} color={colors.success} />
        <Text style={[styles.privacyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          ShieldID only requests read-only access. We never post, follow, or access your DMs.
        </Text>
      </GlassCard>

      <View style={styles.connectActions}>
        <TouchableOpacity style={[styles.connectBtn, { backgroundColor: colors.primary }]} activeOpacity={0.85} onPress={onConnect}>
          <Ionicons name="link" size={18} color="#fff" />
          <Text style={[styles.connectBtnText, { fontFamily: "Inter_600SemiBold" }]}>Connect Accounts</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkip}>
          <Text style={[styles.skipLink, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Step 7: Features ─────────────────────────────────────────────────────────
const FEATURES = [
  { icon: "person-remove", label: "Impersonator Detection", desc: "Find accounts pretending to be you across all platforms.", color: "#EF4444" },
  { icon: "images", label: "Photo Monitoring", desc: "Detect stolen photos and visual identity theft in real time.", color: "#3B82F6" },
  { icon: "warning", label: "Breach Detection", desc: "Get alerted when your credentials appear in data breaches.", color: "#F59E0B" },
  { icon: "notifications", label: "Real-Time Alerts", desc: "Instant notifications the moment a new threat is detected.", color: "#10B981" },
];

function FeaturesScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenPad} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#10B98111", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.eduIconWrap, { backgroundColor: "#10B98122", borderColor: "#10B98144" }]}>
        <Ionicons name="shield-half" size={36} color="#10B981" />
      </View>
      <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        Everything You Need to Stay Protected
      </Text>
      <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        ShieldID combines AI scanning, photo recognition, and deep-web monitoring into one app.
      </Text>
      <View style={styles.featureGrid}>
        {FEATURES.map((f) => (
          <GlassCard key={f.label} style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: f.color + "22" }]}>
              <Ionicons name={f.icon as any} size={22} color={f.color} />
            </View>
            <Text style={[styles.featureTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{f.label}</Text>
            <Text style={[styles.featureDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{f.desc}</Text>
          </GlassCard>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Step 8: Scan Setup + Attribution ─────────────────────────────────────────
const SETUP_STEPS = [
  "Building visual fingerprint",
  "Analyzing media patterns",
  "Creating protection profile",
  "Preparing threat monitoring",
];

const ATTRIBUTION_OPTIONS = [
  { id: "instagram_tiktok", icon: "logo-instagram" as const, label: "Instagram / TikTok" },
  { id: "app_store", icon: "phone-portrait" as const, label: "App Store" },
  { id: "friend", icon: "people" as const, label: "Friend or family" },
  { id: "influencer", icon: "megaphone" as const, label: "Influencer / Creator" },
  { id: "news", icon: "newspaper" as const, label: "News / Blog" },
  { id: "other", icon: "ellipsis-horizontal" as const, label: "Other" },
];

function ScanSetupScreen({
  colors,
  attribution,
  onAttributionSelect,
  onDone,
}: {
  colors: ReturnType<typeof useColors>;
  attribution: string | null;
  onAttributionSelect: (id: string) => void;
  onDone: () => void;
}) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [showAttribution, setShowAttribution] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const attributionAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true })
    ).start();

    const delays = [700, 1500, 2400, 3200];
    const timers: ReturnType<typeof setTimeout>[] = [];

    delays.forEach((delay, i) => {
      timers.push(setTimeout(() => {
        setCompletedSteps((prev) => [...prev, i]);
        setActiveStep(i + 1);
        Animated.timing(progressAnim, { toValue: (i + 1) / SETUP_STEPS.length, duration: 400, useNativeDriver: false }).start();
      }, delay));
    });

    // Show attribution question after a short delay
    timers.push(setTimeout(() => {
      setShowAttribution(true);
      Animated.timing(attributionAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 900));

    timers.push(setTimeout(onDone, 4200));
    return () => timers.forEach(clearTimeout);
  }, [onDone, progressAnim, spinAnim, attributionAnim]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.screenPad, { alignItems: "center" }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#3B82F622", "#8B5CF611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={styles.scanRings}>
        {[200, 150, 100].map((size, i) => (
          <View key={size} style={[styles.scanRing, {
            width: size, height: size, borderRadius: size / 2,
            borderColor: colors.primary + (i === 0 ? "18" : i === 1 ? "28" : "38"),
          }]} />
        ))}
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <View style={[styles.scanSpinner, { borderColor: colors.primary + "44", borderTopColor: colors.primary }]} />
        </Animated.View>
        <Ionicons name="shield-checkmark" size={36} color={colors.primary} style={styles.scanShield} />
      </View>

      <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: "center" }]}>
        Preparing Your Identity Scan
      </Text>
      <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
        Our AI is building your unique digital fingerprint
      </Text>

      <View style={[styles.progressTrack, { backgroundColor: colors.border, width: "100%" }]}>
        <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: colors.primary }]} />
      </View>

      <View style={[styles.scanStepList, { width: "100%" }]}>
        {SETUP_STEPS.map((step, i) => {
          const done = completedSteps.includes(i);
          const active = activeStep === i;
          return (
            <View key={step} style={styles.scanStepRow}>
              <View style={[styles.scanStepDot, {
                backgroundColor: done ? colors.success : active ? colors.primary : colors.secondary,
                borderColor: done ? colors.success : active ? colors.primary : colors.border,
              }]}>
                {done ? <Ionicons name="checkmark" size={10} color="#fff" /> : active ? <View style={[styles.activeDotPulse, { backgroundColor: colors.primary }]} /> : null}
              </View>
              <Text style={[styles.scanStepText, {
                color: done || active ? colors.foreground : colors.mutedForeground,
                fontFamily: done || active ? "Inter_500Medium" : "Inter_400Regular",
              }]}>{step}</Text>
            </View>
          );
        })}
      </View>

      {/* Attribution question — appears during scan */}
      {showAttribution && (
        <Animated.View style={[styles.attributionCard, { opacity: attributionAnim, transform: [{ translateY: attributionAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
          <GlassCard style={[styles.attributionInner, { borderColor: colors.border }]}>
            <Text style={[styles.attributionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              One quick question while we set up…
            </Text>
            <Text style={[styles.attributionSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              How did you find ShieldID?
            </Text>
            <View style={styles.attributionGrid}>
              {ATTRIBUTION_OPTIONS.map((a) => {
                const isSelected = attribution === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    activeOpacity={0.8}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onAttributionSelect(a.id); }}
                    style={[styles.attributionChip, {
                      backgroundColor: isSelected ? colors.primary + "18" : colors.secondary,
                      borderColor: isSelected ? colors.primary + "66" : colors.border,
                    }]}
                  >
                    <Ionicons name={a.icon} size={14} color={isSelected ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.attributionChipText, {
                      color: isSelected ? colors.primary : colors.foreground,
                      fontFamily: isSelected ? "Inter_600SemiBold" : "Inter_400Regular",
                    }]}>{a.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </GlassCard>
        </Animated.View>
      )}
    </ScrollView>
  );
}

// ─── Step 9: Value Reveal ─────────────────────────────────────────────────────
const CONCERN_MESSAGES: Record<string, { headline: string; detail: string }> = {
  impersonated: {
    headline: "Priority scan enabled",
    detail: "We've set your risk profile to high-priority. Impersonator detection will run every 24 hours.",
  },
  creator: {
    headline: "Creator protection mode on",
    detail: "Photo and video monitoring is activated. We'll alert you the moment your content is found elsewhere.",
  },
  proactive: {
    headline: "Proactive shield activated",
    detail: "You're ahead of 76% of users. Continuous background scanning is now running.",
  },
  business: {
    headline: "Brand monitoring active",
    detail: "Business impersonation alerts are enabled. We'll watch for fake pages and cloned profiles.",
  },
  curious: {
    headline: "Risk assessment ready",
    detail: "Your exposure report is being generated. Most users are surprised by what we find.",
  },
};

function RevealScreen({
  colors,
  answers,
}: {
  colors: ReturnType<typeof useColors>;
  answers: OnboardingAnswers;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const concern = answers.primaryConcern;
  const personalization = (concern !== null ? CONCERN_MESSAGES[concern] : undefined) ?? {
    headline: "Protection profile ready",
    detail: "Continuous monitoring is now active across all your connected platforms.",
  };

  const userTypeLabel = USER_TYPES.find((t) => t.id === answers.userType)?.label ?? null;
  const platformCount = answers.activePlatforms.length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenPad} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#10B98122", "#3B82F611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={[styles.revealBadge, { backgroundColor: colors.success + "18", borderColor: colors.success + "33" }]}>
        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
        <Text style={[styles.revealBadgeText, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>Setup Complete</Text>
      </View>

      <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        {userTypeLabel ? `Your ${userTypeLabel} Protection\nProfile Is Ready` : `Your Identity Is Ready\nTo Be Protected`}
      </Text>
      <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        Here's a preview of what your ShieldID dashboard will look like once monitoring begins.
      </Text>

      <Animated.View style={{ opacity: fadeAnim }}>
        {/* Personalized concern callout */}
        <GlassCard style={[styles.personalizationCard, { borderColor: colors.primary + "33" }]}>
          <View style={[styles.personalizationIcon, { backgroundColor: colors.primary + "18" }]}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.personalizationTitle, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
              {personalization.headline}
            </Text>
            <Text style={[styles.personalizationDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {personalization.detail}
            </Text>
          </View>
        </GlassCard>

        <GlassCard style={styles.dashPreview}>
          <View style={styles.dashRow}>
            <View style={styles.dashScoreWrap}>
              <View style={[styles.dashScoreRing, { borderColor: colors.primary }]}>
                <Text style={[styles.dashScore, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>72</Text>
                <Text style={[styles.dashScoreSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Shield Score</Text>
              </View>
            </View>
            <View style={styles.dashStats}>
              {[
                { label: "Monitoring", value: "Active", color: colors.success },
                { label: "Platforms", value: platformCount > 0 ? String(platformCount) : "4", color: colors.primary },
                { label: "Threats Found", value: "0", color: colors.mutedForeground },
                { label: "Last Scan", value: "Just now", color: colors.mutedForeground },
              ].map((s) => (
                <View key={s.label} style={styles.dashStat}>
                  <Text style={[styles.dashStatVal, { color: s.color, fontFamily: "Inter_600SemiBold" }]}>{s.value}</Text>
                  <Text style={[styles.dashStatLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={[styles.dashDivider, { backgroundColor: colors.border }]} />
          <View style={styles.dashProtRow}>
            <View style={[styles.dashProtDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.dashProtText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              Identity Shield Active
            </Text>
          </View>
        </GlassCard>

        <View style={styles.revealHighlights}>
          {[
            { icon: "notifications", text: "Real-time alerts when threats are detected" },
            { icon: "eye", text: "Continuous monitoring across all connected platforms" },
            { icon: "analytics", text: "AI threat analysis with detailed evidence" },
          ].map((h) => (
            <View key={h.icon} style={styles.highlightRow}>
              <View style={[styles.highlightIcon, { backgroundColor: colors.primary + "18" }]}>
                <Ionicons name={h.icon as any} size={16} color={colors.primary} />
              </View>
              <Text style={[styles.highlightText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{h.text}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </ScrollView>
  );
}

// ─── Main Onboarding Component ────────────────────────────────────────────────
export default function Onboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useApp();
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [answers, setAnswers] = useState<OnboardingAnswers>({
    primaryConcern: null,
    userType: null,
    followerRange: null,
    activePlatforms: [],
    attribution: null,
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const animateToStep = useCallback((nextStep: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  }, [fadeAnim]);

  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) animateToStep(step + 1);
    else router.replace("/subscription" as any);
  }, [step, animateToStep]);

  const handleSkip = useCallback(() => {
    completeOnboarding();
    AsyncStorage.setItem("onboardingAnswers", JSON.stringify(answers)).catch(() => {});
    router.replace("/(tabs)" as any);
  }, [completeOnboarding, answers]);

  const handleFinish = useCallback(() => {
    completeOnboarding();
    AsyncStorage.setItem("onboardingAnswers", JSON.stringify(answers)).catch(() => {});
    router.replace("/subscription" as any);
  }, [completeOnboarding, answers]);

  const handleMaybeLater = useCallback(() => {
    completeOnboarding();
    AsyncStorage.setItem("onboardingAnswers", JSON.stringify(answers)).catch(() => {});
    router.replace("/(tabs)" as any);
  }, [completeOnboarding, answers]);

  const renderStep = () => {
    switch (step) {
      case 0: return <WelcomeScreen colors={colors} />;
      case 1: return (
        <ConcernScreen
          colors={colors}
          selected={answers.primaryConcern}
          onSelect={(id) => setAnswers((a) => ({ ...a, primaryConcern: id }))}
        />
      );
      case 2: return <EducationScreen colors={colors} concern={answers.primaryConcern} />;
      case 3: return (
        <AboutYouScreen
          colors={colors}
          selectedType={answers.userType}
          selectedRange={answers.followerRange}
          onSelectType={(id) => setAnswers((a) => ({ ...a, userType: id }))}
          onSelectRange={(id) => setAnswers((a) => ({ ...a, followerRange: id }))}
        />
      );
      case 4: return <FeaturesScreen colors={colors} />;
      case 5: return (
        <PlatformsScreen
          colors={colors}
          selected={answers.activePlatforms}
          onToggle={(id) => setAnswers((a) => ({
            ...a,
            activePlatforms: a.activePlatforms.includes(id)
              ? a.activePlatforms.filter((p) => p !== id)
              : [...a.activePlatforms, id],
          }))}
        />
      );
      case 6: return (
        <ConnectScreen
          colors={colors}
          activePlatforms={answers.activePlatforms}
          onSkip={() => animateToStep(7)}
          onConnect={() => animateToStep(7)}
        />
      );
      case 7: return (
        <ScanSetupScreen
          colors={colors}
          attribution={answers.attribution}
          onAttributionSelect={(id) => setAnswers((a) => ({ ...a, attribution: id }))}
          onDone={() => animateToStep(8)}
        />
      );
      case 8: return <RevealScreen colors={colors} answers={answers} />;
      default: return null;
    }
  };

  const showFooter = step !== 7; // scan screen auto-advances
  const isLastStep = step === 8;
  const isConnectStep = step === 6;

  // Some steps require a selection before continuing
  const canContinue = () => {
    if (step === 1) return answers.primaryConcern !== null;
    if (step === 3) return answers.userType !== null;
    if (step === 5) return answers.activePlatforms.length > 0;
    return true;
  };

  const getCtaLabel = () => {
    if (isLastStep) return "View Protection Options";
    if (step === 0) return "Get Started";
    if (step === 1) return "Continue";
    if (step === 3) return "Continue";
    if (step === 5) return `Monitor ${answers.activePlatforms.length > 0 ? answers.activePlatforms.length : ""} Platform${answers.activePlatforms.length !== 1 ? "s" : ""}`;
    return "Continue";
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.dotsRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} style={[styles.dot, {
              backgroundColor: i <= step ? colors.primary : colors.border,
              width: i === step ? 20 : 6,
              opacity: i > step ? 0.5 : 1,
            }]} />
          ))}
        </View>
        {step < TOTAL_STEPS - 2 && step !== 7 && (
          <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.headerSkip, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Screen */}
      <Animated.View style={[styles.screenWrap, { opacity: fadeAnim }]}>
        {renderStep()}
      </Animated.View>

      {/* Footer */}
      {showFooter && !isConnectStep && (
        <View style={[styles.footer, { paddingBottom: bottomPad + 16 }]}>
          {isLastStep ? (
            <>
              <TouchableOpacity
                style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.85}
                onPress={handleFinish}
              >
                <Ionicons name="shield-checkmark" size={18} color="#fff" />
                <Text style={[styles.ctaBtnText, { fontFamily: "Inter_600SemiBold" }]}>View Protection Options</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleMaybeLater} style={styles.maybeLater}>
                <Text style={[styles.maybeLaterText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Maybe later — continue with free plan
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.ctaBtn, {
                backgroundColor: canContinue() ? colors.primary : colors.secondary,
                opacity: canContinue() ? 1 : 0.7,
              }]}
              activeOpacity={0.85}
              onPress={canContinue() ? handleNext : undefined}
            >
              <Text style={[styles.ctaBtnText, {
                color: canContinue() ? "#fff" : colors.mutedForeground,
                fontFamily: "Inter_600SemiBold",
              }]}>{getCtaLabel()}</Text>
              {canContinue() && <Ionicons name="arrow-forward" size={18} color="#fff" />}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingBottom: 8 },
  dotsRow: { flexDirection: "row", gap: 5, alignItems: "center" },
  dot: { height: 6, borderRadius: 3 },
  headerSkip: { fontSize: 14 },
  screenWrap: { flex: 1 },
  screen: { flex: 1 },
  screenPad: { padding: 24, gap: 20 },
  footer: { paddingHorizontal: 24, gap: 12 },

  // Welcome
  welcomeCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24, paddingVertical: 20 },
  shieldWrap: { width: 192, height: 192, alignItems: "center", justifyContent: "center" },
  shieldRing: { position: "absolute", borderWidth: 1 },
  welcomeTitle: { fontSize: 28, textAlign: "center", lineHeight: 36 },
  welcomeSub: { fontSize: 15, textAlign: "center", lineHeight: 23, maxWidth: 320 },
  platformRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", justifyContent: "center" },
  platformPill: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  trustPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  trustText: { fontSize: 12 },

  // Shared step
  eduIconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  stepTitle: { fontSize: 24, lineHeight: 32 },
  stepSub: { fontSize: 14, lineHeight: 22 },

  // Concern
  optionList: { gap: 10 },
  optionCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 16, borderWidth: 1 },
  optionIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  optionText: { flex: 1, gap: 3 },
  optionLabel: { fontSize: 14, lineHeight: 19 },
  optionSub: { fontSize: 12, lineHeight: 17 },
  optionCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },

  // Education
  statsCol: { gap: 12 },
  statCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statText: { flex: 1, gap: 2 },
  statValue: { fontSize: 22 },
  statLabel2: { fontSize: 13, lineHeight: 18 },
  warnCard: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  warnText: { flex: 1, fontSize: 13, lineHeight: 20 },

  // About You
  sectionLabel: { fontSize: 14, marginBottom: -8 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeCard: { padding: 14, borderRadius: 14, borderWidth: 1, alignItems: "center", gap: 8 },
  typeIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  typeLabel: { fontSize: 11, textAlign: "center" },
  rangeRow: { flexDirection: "row", gap: 10 },
  rangeBtn: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  rangeBtnText: { fontSize: 12, textAlign: "center" },
  insightCard: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: 12, borderWidth: 1 },
  insightText: { flex: 1, fontSize: 12, lineHeight: 18 },

  // Platforms
  platformGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  platCard: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 8 },
  platCardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  platCheckbox: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  platLabel: { fontSize: 12 },
  selectionPill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  selectionPillText: { fontSize: 13 },

  // Connect
  platformList: { gap: 10 },
  platformRow2: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, borderWidth: 1 },
  platformLabel2: { flex: 1, fontSize: 15 },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  privacyCard: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  privacyText: { flex: 1, fontSize: 12, lineHeight: 18 },
  connectActions: { gap: 12, alignItems: "center" },
  connectBtn: { width: "100%", height: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  connectBtnText: { color: "#fff", fontSize: 16 },
  skipLink: { fontSize: 14 },

  // Features
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  featureCard: { width: (width - 60) / 2, gap: 10 },
  featureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  featureTitle: { fontSize: 13, lineHeight: 18 },
  featureDesc: { fontSize: 12, lineHeight: 17 },

  // Scan Setup
  scanRings: { width: 200, height: 200, alignItems: "center", justifyContent: "center" },
  scanRing: { position: "absolute", borderWidth: 1 },
  scanSpinner: { width: 76, height: 76, borderRadius: 38, borderWidth: 3 },
  scanShield: { position: "absolute" },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  scanStepList: { gap: 14 },
  scanStepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  scanStepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  activeDotPulse: { width: 8, height: 8, borderRadius: 4 },
  scanStepText: { fontSize: 14, flex: 1 },
  attributionCard: { width: "100%", marginTop: 4 },
  attributionInner: { gap: 12 },
  attributionTitle: { fontSize: 14 },
  attributionSub: { fontSize: 12, marginTop: -6 },
  attributionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  attributionChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  attributionChipText: { fontSize: 12 },

  // Reveal
  revealBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  revealBadgeText: { fontSize: 13 },
  personalizationCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 4 },
  personalizationIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  personalizationTitle: { fontSize: 13 },
  personalizationDetail: { fontSize: 12, lineHeight: 18 },
  dashPreview: { gap: 14 },
  dashRow: { flexDirection: "row", gap: 16, alignItems: "center" },
  dashScoreWrap: { alignItems: "center" },
  dashScoreRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, alignItems: "center", justifyContent: "center", gap: 2 },
  dashScore: { fontSize: 22, lineHeight: 26 },
  dashScoreSub: { fontSize: 10, textAlign: "center" },
  dashStats: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  dashStat: { width: "45%", gap: 2 },
  dashStatVal: { fontSize: 14 },
  dashStatLabel: { fontSize: 11 },
  dashDivider: { height: 1 },
  dashProtRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dashProtDot: { width: 8, height: 8, borderRadius: 4 },
  dashProtText: { fontSize: 13 },
  revealHighlights: { gap: 12, marginTop: 4 },
  highlightRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  highlightIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  highlightText: { flex: 1, fontSize: 13, lineHeight: 19, paddingTop: 6 },

  // CTA
  ctaBtn: { height: 54, borderRadius: 27, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  ctaBtnText: { fontSize: 16 },
  maybeLater: { alignItems: "center" },
  maybeLaterText: { fontSize: 13 },
});
