import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveOnboardingAnswers } from "@/lib/api";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Platform as SocialPlatform } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { PlatformIcon } from "@/components/PlatformIcon";
import { analytics } from "@/lib/analytics";

const { width } = Dimensions.get("window");
const TOTAL_STEPS = 12;

export interface OnboardingAnswers {
  primaryConcern: string | null;
  userType: string | null;
  followerRange: string | null;
  activePlatforms: string[];
  attribution: string | null;
  perceivedRisk: number | null;
  identityInput: string | null;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step, colors }: { step: number; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={progressStyles.bar}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            progressStyles.segment,
            {
              backgroundColor: i <= step ? colors.primary : colors.border,
              opacity: i > step ? 0.4 : 1,
              flex: 1,
              marginRight: i < TOTAL_STEPS - 1 ? 3 : 0,
            },
          ]}
        />
      ))}
    </View>
  );
}
const progressStyles = StyleSheet.create({
  bar: { flexDirection: "row", height: 3, borderRadius: 2, overflow: "hidden" },
  segment: { height: 3, borderRadius: 2 },
});

// ─── Step 0: Brand Hook ───────────────────────────────────────────────────────
function BrandHookScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  const particles = useRef(
    Array.from({ length: 18 }, (_, i) => ({
      anim: new Animated.Value(0),
      x: Math.cos((i / 18) * Math.PI * 2) * (44 + (i % 3) * 22),
      y: Math.sin((i / 18) * Math.PI * 2) * (44 + (i % 3) * 22),
      delay: i * 80,
      size: i % 3 === 0 ? 4 : i % 3 === 1 ? 3 : 2,
    }))
  ).current;

  const glowAnim = useRef(new Animated.Value(0)).current;
  const shieldAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.spring(shieldAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();

    particles.forEach((p) => {
      const loop = () => {
        p.anim.setValue(0);
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.anim, { toValue: 1, duration: 2200 + p.delay * 4, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(p.anim, { toValue: 0.3, duration: 1800, useNativeDriver: true }),
        ]).start(loop);
      };
      loop();
    });
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] });
  const shieldScale = shieldAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const shieldOpacity = shieldAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <View style={[styles.screenPad, { flex: 1, justifyContent: "center" }]}>
      <LinearGradient
        colors={["#1E3A5F44", "#3B82F611", "transparent"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={hookStyles.center}>
        <View style={hookStyles.orb}>
          {/* Particle field */}
          {particles.map((p, i) => (
            <Animated.View
              key={i}
              style={{
                position: "absolute",
                width: p.size,
                height: p.size,
                borderRadius: p.size / 2,
                backgroundColor: colors.primary,
                opacity: p.anim,
                transform: [
                  { translateX: p.x },
                  { translateY: p.y },
                ],
              }}
            />
          ))}

          {/* Glow ring */}
          <Animated.View style={[hookStyles.glowRing, { borderColor: colors.primary, opacity: glowOpacity }]} />
          <Animated.View style={[hookStyles.glowRingInner, { borderColor: colors.primary + "66", opacity: glowOpacity }]} />

          {/* Shield */}
          <Animated.View style={{ transform: [{ scale: shieldScale }], opacity: shieldOpacity }}>
            <View style={[hookStyles.shieldBg, { backgroundColor: colors.primary + "1A" }]}>
              <Ionicons name="shield-checkmark" size={52} color={colors.primary} />
            </View>
          </Animated.View>
        </View>

        <View style={hookStyles.textBlock}>
          <Text style={[hookStyles.headline, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Your name and face{"\n"}already exist online.
          </Text>
          <Text style={[hookStyles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            The question is{" "}
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>who's using them.</Text>
          </Text>
          <Text style={[hookStyles.body, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Rook is an AI identity monitor that finds impersonators, stolen photos, and fake accounts using your identity — usually before you'd ever notice on your own.
          </Text>
        </View>
      </View>
    </View>
  );
}

const hookStyles = StyleSheet.create({
  center: { alignItems: "center", gap: 40 },
  orb: { width: 200, height: 200, alignItems: "center", justifyContent: "center" },
  glowRing: { position: "absolute", width: 160, height: 160, borderRadius: 80, borderWidth: 1 },
  glowRingInner: { position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 1 },
  shieldBg: { width: 90, height: 90, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  textBlock: { gap: 12, alignItems: "center" },
  headline: { fontSize: 30, textAlign: "center", lineHeight: 38 },
  sub: { fontSize: 17, textAlign: "center" },
  body: { fontSize: 14, textAlign: "center", lineHeight: 22, maxWidth: 310 },
});

// ─── Step 1: Credible Stat ────────────────────────────────────────────────────
function CredibleStatScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.screenPad, { gap: 28 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#EF444411", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={{ gap: 14 }}>
        <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Impersonation is one of the fastest-growing forms of online fraud.
        </Text>
        <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Fake accounts don't just borrow a name — they steal photos, copy bios, and message your real followers pretending to be you. Most people find out from someone else, days or weeks later.
        </Text>
      </View>

      <Animated.View style={{ opacity: fadeAnim, gap: 16 }}>
        {/* Primary stat */}
        <GlassCard style={[statStyles.statCard, { borderColor: "#EF444433", borderLeftColor: "#EF4444", borderLeftWidth: 3 }]}>
          <Text style={[statStyles.statNumber, { color: "#EF4444", fontFamily: "Inter_700Bold" }]}>1 in 4</Text>
          <Text style={[statStyles.statLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Americans have experienced online identity fraud
          </Text>
          <Text style={[statStyles.statSource, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Source: FTC Consumer Sentinel Network Report
          </Text>
        </GlassCard>

        {/* Profile vs clone mockup */}
        <View style={statStyles.cloneRow}>
          {/* Real profile */}
          <GlassCard style={[statStyles.profileCard, { borderColor: colors.success + "55" }]}>
            <View style={[statStyles.avatar, { backgroundColor: colors.primary + "33" }]}>
              <Ionicons name="person" size={20} color={colors.primary} />
            </View>
            <Text style={[statStyles.profileName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>@yourhandle</Text>
            <Text style={[statStyles.profileBio, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Your real profile</Text>
            <View style={[statStyles.verifiedBadge, { backgroundColor: colors.success + "20" }]}>
              <Ionicons name="checkmark-circle" size={10} color={colors.success} />
              <Text style={[statStyles.verifiedText, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>Genuine</Text>
            </View>
          </GlassCard>

          <View style={statStyles.vsArrow}>
            <Ionicons name="arrow-forward" size={18} color={colors.mutedForeground} />
          </View>

          {/* Impersonator */}
          <GlassCard style={[statStyles.profileCard, { borderColor: "#EF444455" }]}>
            <View style={[statStyles.avatar, { backgroundColor: "#EF444422" }]}>
              <Ionicons name="person" size={20} color="#EF4444" />
            </View>
            <Text style={[statStyles.profileName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>@yourhandIe</Text>
            <Text style={[statStyles.profileBio, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Stolen photo · Copied bio</Text>
            <View style={[statStyles.verifiedBadge, { backgroundColor: "#EF444420" }]}>
              <Ionicons name="alert-circle" size={10} color="#EF4444" />
              <Text style={[statStyles.verifiedText, { color: "#EF4444", fontFamily: "Inter_600SemiBold" }]}>Detected</Text>
            </View>
          </GlassCard>
        </View>

        <Text style={[statStyles.caption, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Note the subtle character swap: lowercase "l" replaced with uppercase "I" — a classic impersonator tactic invisible at a glance.
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

const statStyles = StyleSheet.create({
  statCard: { gap: 6 },
  statNumber: { fontSize: 42, lineHeight: 48 },
  statLabel: { fontSize: 15, lineHeight: 22 },
  statSource: { fontSize: 11, marginTop: 2 },
  cloneRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  profileCard: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 16 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  profileName: { fontSize: 12, textAlign: "center" },
  profileBio: { fontSize: 10, textAlign: "center", lineHeight: 14 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  verifiedText: { fontSize: 9 },
  vsArrow: { alignItems: "center" },
  caption: { fontSize: 12, lineHeight: 18, textAlign: "center", opacity: 0.8 },
});

// ─── Step 2: Assessment Intro ─────────────────────────────────────────────────
function AssessmentIntroScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[styles.screenPad, { flex: 1, justifyContent: "center", gap: 32 }]}>
      <LinearGradient colors={["#3B82F611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <Animated.View style={{ alignItems: "center", opacity: fadeAnim, transform: [{ scale: scaleAnim }], gap: 24 }}>
        {/* Progress ring hint */}
        <View style={assessStyles.ringWrap}>
          <View style={[assessStyles.outerRing, { borderColor: colors.primary + "33" }]} />
          <View style={[assessStyles.innerRing, { borderColor: colors.primary + "66" }]} />
          <View style={[assessStyles.centerDot, { backgroundColor: colors.primary + "22" }]}>
            <Ionicons name="search" size={28} color={colors.primary} />
          </View>
        </View>

        <View style={{ gap: 12, alignItems: "center" }}>
          <Text style={[assessStyles.headline, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Let's check{"\n"}your exposure.
          </Text>
          <Text style={[assessStyles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            A few quick questions, then we'll run your first scan.{"\n"}Takes about a minute.
          </Text>
        </View>

        <View style={assessStyles.chips}>
          {["~1 min", "No login needed yet", "100% private"].map((chip) => (
            <View key={chip} style={[assessStyles.chip, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "30" }]}>
              <Ionicons name="checkmark" size={11} color={colors.primary} />
              <Text style={[assessStyles.chipText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>{chip}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const assessStyles = StyleSheet.create({
  ringWrap: { width: 140, height: 140, alignItems: "center", justifyContent: "center" },
  outerRing: { position: "absolute", width: 140, height: 140, borderRadius: 70, borderWidth: 1 },
  innerRing: { position: "absolute", width: 100, height: 100, borderRadius: 50, borderWidth: 1 },
  centerDot: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center" },
  headline: { fontSize: 32, textAlign: "center", lineHeight: 40 },
  sub: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12 },
});

// ─── Step 3: Concern ─────────────────────────────────────────────────────────
const CONCERNS = [
  { id: "impersonated", icon: "alert-circle" as const, label: "Someone is impersonating me", sub: "I've found fake accounts using my name or photos" },
  { id: "creator", icon: "videocam" as const, label: "Protecting my creator brand", sub: "My content gets stolen or reused without permission" },
  { id: "proactive", icon: "shield-checkmark" as const, label: "Staying ahead of threats", sub: "I want to prevent identity theft before it happens" },
  { id: "business", icon: "business" as const, label: "Business & brand protection", sub: "My company's social presence needs monitoring" },
  { id: "curious", icon: "search" as const, label: "Checking my exposure", sub: "I'm curious to see if I'm already at risk" },
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
    Animated.stagger(60, cardAnims.map((anim) =>
      Animated.spring(anim, { toValue: 1, tension: 120, friction: 9, useNativeDriver: true })
    )).start();
  }, []);

  const handlePress = (id: string, idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scaleAnims[idx]!, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnims[idx]!, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start(() => onSelect(id));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenPad} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#3B82F611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={{ gap: 6 }}>
        <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          What brings you to Rook?
        </Text>
        <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          This tailors your protection profile to what matters most.
        </Text>
      </View>
      <View style={styles.optionList}>
        {CONCERNS.map((c, idx) => {
          const isSelected = selected === c.id;
          return (
            <Animated.View
              key={c.id}
              style={{
                opacity: cardAnims[idx],
                transform: [
                  { translateY: cardAnims[idx]!.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
                  { scale: scaleAnims[idx]! },
                ],
              }}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handlePress(c.id, idx)}
                style={[styles.optionCard, {
                  backgroundColor: isSelected ? colors.primary + "14" : colors.card,
                  borderColor: isSelected ? colors.primary + "80" : colors.border,
                  borderWidth: isSelected ? 1.5 : 1,
                }]}
              >
                <View style={[styles.optionIconWrap, { backgroundColor: colors.primary + "20" }]}>
                  <Ionicons name={c.icon} size={22} color={isSelected ? colors.primary : colors.mutedForeground} />
                </View>
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {c.label}
                  </Text>
                  <Text style={[styles.optionSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {c.sub}
                  </Text>
                </View>
                {isSelected && (
                  <View style={[styles.optionCheck, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── Step 4: Identity Type (auto-advance) ────────────────────────────────────
const USER_TYPES = [
  { id: "public_figure", icon: "star" as const, label: "Public Figure", risk: "High-visibility targets for impersonation" },
  { id: "creator", icon: "videocam" as const, label: "Content Creator", risk: "Creators are impersonated 3× more on average" },
  { id: "business", icon: "business" as const, label: "Business / Brand", risk: "Brand fraud costs businesses millions yearly" },
  { id: "professional", icon: "briefcase" as const, label: "Professional", risk: "LinkedIn scams targeting your network" },
  { id: "student", icon: "school" as const, label: "Student", risk: "Growing target of social media fraud" },
  { id: "personal", icon: "person" as const, label: "Personal Use", risk: "Everyone deserves identity protection" },
];

function IdentityTypeScreen({
  colors,
  selected,
  onSelect,
}: {
  colors: ReturnType<typeof useColors>;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const gridAnims = useRef(USER_TYPES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(55, gridAnims.map((a) =>
      Animated.spring(a, { toValue: 1, tension: 120, friction: 9, useNativeDriver: true })
    )).start();
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenPad} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#8B5CF611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={{ gap: 6 }}>
        <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Which of these sounds like you?
        </Text>
      </View>
      <View style={styles.typeGrid}>
        {USER_TYPES.map((t, idx) => {
          const isSelected = selected === t.id;
          return (
            <Animated.View
              key={t.id}
              style={{
                opacity: gridAnims[idx],
                transform: [{ translateY: gridAnims[idx]!.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
                width: (width - 60) / 2,
              }}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelect(t.id);
                }}
                style={[styles.typeCard, {
                  backgroundColor: isSelected ? colors.primary + "18" : colors.card,
                  borderColor: isSelected ? colors.primary + "80" : colors.border,
                  borderWidth: isSelected ? 1.5 : 1,
                }]}
              >
                <View style={[styles.typeIcon, { backgroundColor: isSelected ? colors.primary + "25" : colors.secondary }]}>
                  <Ionicons name={t.icon} size={22} color={isSelected ? colors.primary : colors.mutedForeground} />
                </View>
                <Text style={[styles.typeLabel, {
                  color: isSelected ? colors.primary : colors.foreground,
                  fontFamily: isSelected ? "Inter_700Bold" : "Inter_600SemiBold",
                  fontSize: 13,
                }]}>{t.label}</Text>
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 15, textAlign: "center" }]}>
                  {t.risk}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── Step 5: Account Count (auto-advance) ─────────────────────────────────────
const ACCOUNT_RANGES = [
  { id: "small", label: "1–2 accounts", sub: "Just starting out" },
  { id: "medium", label: "3–5 accounts", sub: "Active across platforms" },
  { id: "large", label: "6+ accounts", sub: "Wide digital presence" },
];

function AccountCountScreen({
  colors,
  selected,
  onSelect,
}: {
  colors: ReturnType<typeof useColors>;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const cardAnims = useRef(ACCOUNT_RANGES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(80, cardAnims.map((a) =>
      Animated.spring(a, { toValue: 1, tension: 100, friction: 9, useNativeDriver: true })
    )).start();
  }, []);

  return (
    <View style={[styles.screenPad, { flex: 1, justifyContent: "center", gap: 28 }]}>
      <LinearGradient colors={["#F59E0B11", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={{ gap: 6 }}>
        <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          How many social accounts do you have?
        </Text>
        <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          This helps us calibrate how much of your identity we need to protect.
        </Text>
      </View>
      <View style={{ gap: 12 }}>
        {ACCOUNT_RANGES.map((r, idx) => {
          const isSelected = selected === r.id;
          return (
            <Animated.View
              key={r.id}
              style={{
                opacity: cardAnims[idx],
                transform: [{ translateY: cardAnims[idx]!.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              }}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onSelect(r.id);
                }}
                style={[countStyles.rangeCard, {
                  backgroundColor: isSelected ? colors.primary + "18" : colors.card,
                  borderColor: isSelected ? colors.primary + "80" : colors.border,
                  borderWidth: isSelected ? 1.5 : 1,
                }]}
              >
                <View>
                  <Text style={[countStyles.rangeLabel, { color: isSelected ? colors.primary : colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    {r.label}
                  </Text>
                  <Text style={[countStyles.rangeSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {r.sub}
                  </Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const countStyles = StyleSheet.create({
  rangeCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, borderRadius: 16, borderWidth: 1 },
  rangeLabel: { fontSize: 17, marginBottom: 2 },
  rangeSub: { fontSize: 13 },
});

// ─── Step 6: Identity Input ───────────────────────────────────────────────────
function IdentityInputScreen({
  colors,
  value,
  onChange,
}: {
  colors: ReturnType<typeof useColors>;
  value: string;
  onChange: (v: string) => void;
}) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const shimmerOpacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenPad, { flexGrow: 1, justifyContent: "center" }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient colors={["#3B82F622", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

        <View style={{ gap: 28 }}>
          <View style={{ gap: 10 }}>
            <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Now let's find out what's out there about you.
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Enter your name or the @handle you use most. We'll search for accounts pretending to be you — nothing is posted, messaged, or shared.
            </Text>
          </View>

          <View style={inputStyles.inputWrap}>
            {/* Scanning shimmer effect */}
            <Animated.View
              style={[StyleSheet.absoluteFill, {
                backgroundColor: colors.primary,
                opacity: shimmerOpacity,
                borderRadius: 14,
              }]}
              pointerEvents="none"
            />
            <View style={[inputStyles.inputRow, {
              backgroundColor: colors.card,
              borderColor: value.length > 0 ? colors.primary + "66" : colors.border,
              borderWidth: value.length > 0 ? 1.5 : 1,
            }]}>
              <Ionicons name="person-circle-outline" size={22} color={value.length > 0 ? colors.primary : colors.mutedForeground} />
              <TextInput
                style={[inputStyles.textInput, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                placeholder="Your name or @handle"
                placeholderTextColor={colors.mutedForeground}
                value={value}
                onChangeText={onChange}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
              {value.length > 0 && (
                <TouchableOpacity onPress={() => onChange("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <GlassCard style={[inputStyles.privacyNote, { borderColor: colors.success + "33" }]}>
            <Ionicons name="lock-closed" size={14} color={colors.success} />
            <Text style={[inputStyles.privacyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              We only use this to search for impersonators. Your data stays on your device until you create an account.
            </Text>
          </GlassCard>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const inputStyles = StyleSheet.create({
  inputWrap: { borderRadius: 14, overflow: "hidden" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  textInput: { flex: 1, fontSize: 16, lineHeight: 22 },
  privacyNote: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  privacyText: { flex: 1, fontSize: 13, lineHeight: 19 },
});

// ─── Step 7: Proof Visual ─────────────────────────────────────────────────────
function ProofVisualScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  const detectedAnim = useRef(new Animated.Value(0)).current;
  const stepsAnim = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.timing(detectedAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 600);
    Animated.stagger(200, stepsAnim.map((a) =>
      Animated.spring(a, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true })
    )).start();
  }, []);

  const PROCESS_STEPS = [
    { icon: "scan-circle", label: "Scan every major platform", color: colors.primary },
    { icon: "alert-circle", label: "Detect impersonators & stolen photos", color: "#EF4444" },
    { icon: "notifications", label: "Alert you instantly", color: "#F59E0B" },
    { icon: "shield-checkmark", label: "Help you report & remove them", color: colors.success },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.screenPad, { gap: 28 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#3B82F611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={{ gap: 6 }}>
        <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Here's what Rook catches.
        </Text>
      </View>

      {/* Detection mockup */}
      <GlassCard style={[proofStyles.mockupCard, { borderColor: "#EF444433" }]}>
        <View style={proofStyles.mockupHeader}>
          <View style={[proofStyles.mockupDot, { backgroundColor: "#EF444444" }]}>
            <Ionicons name="alert-circle" size={14} color="#EF4444" />
          </View>
          <Text style={[proofStyles.mockupTitle, { color: "#EF4444", fontFamily: "Inter_600SemiBold" }]}>
            Impersonator Detected
          </Text>
          <Animated.View style={[proofStyles.detectedBadge, { backgroundColor: "#EF4444", opacity: detectedAnim, transform: [{ scale: detectedAnim }] }]}>
            <Text style={[proofStyles.detectedText, { fontFamily: "Inter_700Bold" }]}>FLAGGED</Text>
          </Animated.View>
        </View>

        <View style={proofStyles.mockupProfiles}>
          {/* Your real profile */}
          <View style={proofStyles.profileCol}>
            <View style={[proofStyles.mockAvatar, { backgroundColor: colors.primary + "25" }]}>
              <Ionicons name="person" size={18} color={colors.primary} />
            </View>
            <Text style={[proofStyles.mockHandle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>@alexjones</Text>
            <Text style={[proofStyles.mockMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Your account</Text>
            <View style={[proofStyles.mockTag, { backgroundColor: colors.success + "20" }]}>
              <Text style={[proofStyles.mockTagText, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>Genuine</Text>
            </View>
          </View>

          <View style={proofStyles.vsLine}>
            <View style={[proofStyles.vsDivider, { backgroundColor: colors.border }]} />
          </View>

          {/* Impersonator */}
          <View style={proofStyles.profileCol}>
            <View style={[proofStyles.mockAvatar, { backgroundColor: "#EF444422" }]}>
              <Ionicons name="person" size={18} color="#EF4444" />
            </View>
            <Text style={[proofStyles.mockHandle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>@alexjone5</Text>
            <Text style={[proofStyles.mockMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Stolen photo · Copied bio</Text>
            <View style={[proofStyles.mockTag, { backgroundColor: "#EF444420" }]}>
              <Text style={[proofStyles.mockTagText, { color: "#EF4444", fontFamily: "Inter_600SemiBold" }]}>Impersonator</Text>
            </View>
          </View>
        </View>

        <View style={[proofStyles.evidenceRow, { backgroundColor: "#EF444410", borderRadius: 8, padding: 10 }]}>
          {["Identical profile photo", "Copied bio text", "Altered handle"].map((tell, i) => (
            <View key={tell} style={proofStyles.evidenceItem}>
              <Ionicons name="alert-circle" size={11} color="#EF4444" />
              <Text style={[proofStyles.evidenceText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{tell}</Text>
            </View>
          ))}
        </View>
      </GlassCard>

      {/* 4-step process */}
      <View style={{ gap: 6 }}>
        <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>How Rook protects you</Text>
      </View>
      <View style={proofStyles.processRow}>
        {PROCESS_STEPS.map((s, i) => (
          <React.Fragment key={s.label}>
            <Animated.View
              style={[proofStyles.processStep, {
                opacity: stepsAnim[i],
                transform: [{ translateY: stepsAnim[i]!.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
              }]}
            >
              <View style={[proofStyles.processIcon, { backgroundColor: s.color + "20" }]}>
                <Ionicons name={s.icon as any} size={20} color={s.color} />
              </View>
              <Text style={[proofStyles.processLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {s.label}
              </Text>
            </Animated.View>
            {i < PROCESS_STEPS.length - 1 && (
              <View style={proofStyles.processArrow}>
                <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground + "66"} />
              </View>
            )}
          </React.Fragment>
        ))}
      </View>
    </ScrollView>
  );
}

const proofStyles = StyleSheet.create({
  mockupCard: { gap: 16 },
  mockupHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  mockupDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  mockupTitle: { flex: 1, fontSize: 13 },
  detectedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  detectedText: { color: "#fff", fontSize: 10, letterSpacing: 0.5 },
  mockupProfiles: { flexDirection: "row", gap: 12, alignItems: "center" },
  profileCol: { flex: 1, alignItems: "center", gap: 6 },
  mockAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  mockHandle: { fontSize: 12 },
  mockMeta: { fontSize: 10, textAlign: "center" },
  mockTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  mockTagText: { fontSize: 10 },
  vsLine: { alignItems: "center" },
  vsDivider: { width: 1, height: 60 },
  evidenceRow: { gap: 6 },
  evidenceItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  evidenceText: { fontSize: 11 },
  processRow: { flexDirection: "row", alignItems: "flex-start" },
  processStep: { flex: 1, alignItems: "center", gap: 8 },
  processIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  processLabel: { fontSize: 10, textAlign: "center", lineHeight: 14 },
  processArrow: { paddingTop: 14 },
});

// ─── Step 8: Privacy Screen ───────────────────────────────────────────────────
const PRIVACY_ITEMS = [
  { icon: "eye-off-outline" as const, title: "Read-only access only", body: "We never post, comment, follow, or message anyone on your behalf." },
  { icon: "chatbox-ellipses-outline" as const, title: "We never access your DMs", body: "Only public profile data and posts are scanned — your private messages are completely off-limits." },
  { icon: "server-outline" as const, title: "Your data is never sold", body: "We don't monetize your personal information. Ever. Our business model is your subscription, not your data." },
  { icon: "trash-outline" as const, title: "Delete anytime", body: "Request full data deletion at any time from your profile settings. We'll wipe everything within 30 days." },
];

function PrivacyScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  const itemAnims = useRef(PRIVACY_ITEMS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(100, itemAnims.map((a) =>
      Animated.spring(a, { toValue: 1, tension: 100, friction: 9, useNativeDriver: true })
    )).start();
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.screenPad, { gap: 28 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#10B98111", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={{ alignItems: "center", gap: 16 }}>
        <View style={[privStyles.shieldWrap, { backgroundColor: colors.success + "18", borderColor: colors.success + "44" }]}>
          <Ionicons name="lock-closed" size={36} color={colors.success} />
        </View>
        <View style={{ gap: 8, alignItems: "center" }}>
          <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: "center" }]}>
            Your privacy is the whole point.
          </Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
            Rook only looks at publicly available information. Here's exactly what that means.
          </Text>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        {PRIVACY_ITEMS.map((item, idx) => (
          <Animated.View
            key={item.title}
            style={{
              opacity: itemAnims[idx],
              transform: [{ translateY: itemAnims[idx]!.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            }}
          >
            <GlassCard style={[privStyles.itemCard, { borderColor: colors.success + "22" }]}>
              <View style={[privStyles.itemIcon, { backgroundColor: colors.success + "18" }]}>
                <Ionicons name={item.icon} size={20} color={colors.success} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[privStyles.itemTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {item.title}
                </Text>
                <Text style={[privStyles.itemBody, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {item.body}
                </Text>
              </View>
            </GlassCard>
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}

const privStyles = StyleSheet.create({
  shieldWrap: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  itemCard: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  itemIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  itemTitle: { fontSize: 14 },
  itemBody: { fontSize: 13, lineHeight: 19 },
});

// ─── Step 9: Platform Select ──────────────────────────────────────────────────
const ALL_PLATFORMS: Array<{ id: NonNullable<SocialPlatform>; label: string }> = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "x", label: "X / Twitter" },
  { id: "facebook", label: "Facebook" },
  { id: "youtube", label: "YouTube" },
  { id: "snapchat", label: "Snapchat" },
  { id: "linkedin", label: "LinkedIn" },
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
    Animated.stagger(45, cardAnims.map((a) =>
      Animated.spring(a, { toValue: 1, tension: 110, friction: 9, useNativeDriver: true })
    )).start();
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.screenPad, { gap: 20 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#F59E0B11", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={{ gap: 6 }}>
        <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Which platforms should we monitor?
        </Text>
        <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Select everywhere you're active.{" "}
          <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium" }}>Read-only, always.</Text>
          {" "}Rook never posts, follows, or accesses your DMs.
        </Text>
      </View>

      <View style={styles.platformGrid}>
        {ALL_PLATFORMS.map((p, idx) => {
          const isSelected = selected.includes(p.id);
          return (
            <Animated.View
              key={p.id}
              style={{
                opacity: cardAnims[idx],
                transform: [{ translateY: cardAnims[idx]!.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
                width: (width - 60) / 2,
              }}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggle(p.id); }}
                style={[styles.platCard, {
                  backgroundColor: isSelected ? colors.primary + "18" : colors.card,
                  borderColor: isSelected ? colors.primary + "70" : colors.border,
                  borderWidth: isSelected ? 1.5 : 1,
                }]}
              >
                <View style={styles.platCardRow}>
                  <PlatformIcon platform={p.id} size={26} />
                  <View style={[styles.platCheckbox, {
                    backgroundColor: isSelected ? colors.primary : "transparent",
                    borderColor: isSelected ? colors.primary : colors.border,
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
            Monitoring {selected.length} platform{selected.length !== 1 ? "s" : ""}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Step 10: Scan Setup (clean, no attribution) ──────────────────────────────
const SETUP_STEPS = [
  "Building visual fingerprint",
  "Analyzing media patterns",
  "Creating protection profile",
  "Scanning platforms",
];

function ScanSetupScreen({ colors, onDone }: { colors: ReturnType<typeof useColors>; onDone: () => void }) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const hasStartedScan = useRef(false);
  const wasScanning = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const { startScan, isScanning, scanProgress, scanQuotaError } = useApp();

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true })
    ).start();

    if (!hasStartedScan.current) {
      hasStartedScan.current = true;
      Promise.resolve(startScan()).catch(() => {});
    }

    const fallbackTimer = setTimeout(() => {
      if (!wasScanning.current) onDoneRef.current();
    }, 12000);

    return () => clearTimeout(fallbackTimer);
  }, []);

  useEffect(() => {
    if (isScanning) {
      wasScanning.current = true;
      const fraction = Math.max(0, Math.min(1, scanProgress / 100));
      const stepIndex = Math.min(SETUP_STEPS.length - 1, Math.floor(fraction * SETUP_STEPS.length));
      setActiveStep(stepIndex);
      setCompletedSteps(Array.from({ length: stepIndex }, (_, i) => i));
      Animated.timing(progressAnim, { toValue: fraction, duration: 300, useNativeDriver: false }).start();
    } else if (wasScanning.current) {
      wasScanning.current = false;
      setCompletedSteps(SETUP_STEPS.map((_, i) => i));
      setActiveStep(SETUP_STEPS.length);
      Animated.timing(progressAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start(() => {
        setTimeout(() => onDoneRef.current(), 500);
      });
    } else if (scanQuotaError) {
      onDoneRef.current();
    }
  }, [isScanning, scanProgress, progressAnim, scanQuotaError]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={[styles.screenPad, { flex: 1, alignItems: "center", justifyContent: "center", gap: 32 }]}>
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

      <View style={{ gap: 8, alignItems: "center" }}>
        <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: "center" }]}>
          Scanning for your digital fingerprint…
        </Text>
        <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
          AI is building your unique identity profile
        </Text>
      </View>

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
                {done
                  ? <Ionicons name="checkmark" size={10} color="#fff" />
                  : active ? <View style={[styles.activeDotPulse, { backgroundColor: colors.primary }]} /> : null}
              </View>
              <Text style={[styles.scanStepText, {
                color: done || active ? colors.foreground : colors.mutedForeground,
                fontFamily: done || active ? "Inter_500Medium" : "Inter_400Regular",
              }]}>{step}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Step 11: Urgency Reveal ──────────────────────────────────────────────────
function UrgencyRevealScreen({
  colors,
  matchCount,
}: {
  colors: ReturnType<typeof useColors>;
  matchCount: number;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.stagger(150, cardAnims.map((a) =>
      Animated.spring(a, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true })
    )).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const MOCK_CARDS = [
    { platform: "instagram" as NonNullable<SocialPlatform>, label: "Account flagged" },
    { platform: "facebook" as NonNullable<SocialPlatform>, label: "Potential match" },
    { platform: "x" as NonNullable<SocialPlatform>, label: "Suspicious activity" },
  ];

  const displayCount = matchCount > 0 ? matchCount : 2;
  const displayCards = MOCK_CARDS.slice(0, Math.min(3, displayCount + 1));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.screenPad, { gap: 28 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#EF444414", "#F59E0B08", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <Animated.View style={{ opacity: fadeAnim, gap: 12 }}>
        <View style={[urgStyles.scanComplete, { backgroundColor: colors.success + "14", borderColor: colors.success + "33" }]}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={[urgStyles.scanCompleteText, { color: colors.success, fontFamily: "Inter_500Medium" }]}>
            Scan complete
          </Text>
        </View>

        <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          We found{" "}
          <Text style={{ color: "#EF4444" }}>{displayCount} potential match{displayCount !== 1 ? "es" : ""}</Text>.
        </Text>
        <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Unlock your full identity report to see exactly where — and what to do about it.
        </Text>
      </Animated.View>

      {/* Blurred result cards */}
      <View style={{ gap: 10 }}>
        {displayCards.map((card, i) => (
          <Animated.View
            key={i}
            style={{
              opacity: cardAnims[i],
              transform: [
                { translateY: cardAnims[i]!.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                ...(i === 0 ? [{ scale: pulseAnim }] : []),
              ],
            }}
          >
            <GlassCard style={[urgStyles.blurCard, { borderColor: i === 0 ? "#EF444444" : colors.border }]}>
              {/* Visible: platform icon + label */}
              <View style={urgStyles.cardLeft}>
                <View style={[urgStyles.platformBadge, { backgroundColor: colors.secondary }]}>
                  <PlatformIcon platform={card.platform} size={20} />
                </View>
                <View style={{ gap: 4 }}>
                  <Text style={[urgStyles.cardLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {card.label}
                  </Text>
                  {/* Blurred "text" bars */}
                  <View style={{ gap: 3 }}>
                    <View style={[urgStyles.blurBar, { width: 120, backgroundColor: colors.mutedForeground + "30" }]} />
                    <View style={[urgStyles.blurBar, { width: 80, backgroundColor: colors.mutedForeground + "20" }]} />
                  </View>
                </View>
              </View>
              {/* Lock overlay */}
              <View style={[urgStyles.lockWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="lock-closed" size={14} color={colors.mutedForeground} />
              </View>
            </GlassCard>
          </Animated.View>
        ))}

        {/* "More locked" hint */}
        <View style={[urgStyles.moreCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.mutedForeground} />
          <Text style={[urgStyles.moreText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Full report locked — unlock to see all results
          </Text>
          <Ionicons name="lock-closed" size={14} color={colors.mutedForeground} />
        </View>
      </View>

      <GlassCard style={[urgStyles.ctaHint, { borderColor: colors.primary + "33" }]}>
        <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
        <Text style={[urgStyles.ctaHintText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>Start your 7-day free trial </Text>
          to view the full report and get continuous monitoring.
        </Text>
      </GlassCard>
    </ScrollView>
  );
}

const urgStyles = StyleSheet.create({
  scanComplete: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  scanCompleteText: { fontSize: 13 },
  blurCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  platformBadge: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardLabel: { fontSize: 14 },
  blurBar: { height: 8, borderRadius: 4 },
  lockWrap: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  moreCard: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 14, borderWidth: 1 },
  moreText: { flex: 1, fontSize: 13 },
  ctaHint: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  ctaHintText: { flex: 1, fontSize: 13, lineHeight: 19 },
});

// ─── Main Onboarding Component ────────────────────────────────────────────────
export default function Onboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { completeOnboarding, user } = useApp();
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Simulated match count (replaced by real scan results when scan completes)
  const [matchCount] = useState(() => Math.floor(Math.random() * 2) + 1);

  const [answers, setAnswers] = useState<OnboardingAnswers>({
    primaryConcern: null,
    userType: null,
    followerRange: null,
    activePlatforms: [],
    attribution: null,
    perceivedRisk: null,
    identityInput: null,
  });
  const [identityInputText, setIdentityInputText] = useState("");

  useEffect(() => {
    analytics.onboardingStarted();
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const animateToStep = useCallback((nextStep: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  }, [fadeAnim]);

  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      animateToStep(step + 1);
    } else {
      // Last step — go to paywall
      handleFinish();
    }
  }, [step, animateToStep]);

  // Auto-advance for selection screens
  const handleAutoAdvance = useCallback((nextStep: number) => {
    setTimeout(() => animateToStep(nextStep), 260);
  }, [animateToStep]);

  const saveAndFinish = useCallback((finalAnswers: OnboardingAnswers) => {
    completeOnboarding();
    AsyncStorage.setItem("onboardingAnswers", JSON.stringify(finalAnswers)).catch(() => {});
    saveOnboardingAnswers(finalAnswers as unknown as Record<string, unknown>).catch(() => {});
    analytics.onboardingCompleted({
      user_type: finalAnswers.userType ?? undefined,
      platform_count: finalAnswers.activePlatforms.length,
      attribution: finalAnswers.attribution ?? undefined,
    });
  }, [completeOnboarding]);

  const handleFinish = useCallback(() => {
    const finalAnswers = { ...answers, identityInput: identityInputText || answers.identityInput };
    saveAndFinish(finalAnswers);
    router.replace({ pathname: "/subscription", params: { fromOnboarding: "1" } } as any);
  }, [answers, identityInputText, saveAndFinish]);

  const handleSkip = useCallback(() => {
    const finalAnswers = { ...answers, identityInput: identityInputText || answers.identityInput };
    saveAndFinish(finalAnswers);
    analytics.onboardingSkipped({ at_step: step });
    router.replace("/(tabs)" as any);
  }, [answers, identityInputText, step, saveAndFinish]);

  const handleMaybeLater = useCallback(() => {
    const finalAnswers = { ...answers, identityInput: identityInputText || answers.identityInput };
    saveAndFinish(finalAnswers);
    router.replace("/(tabs)" as any);
  }, [answers, identityInputText, saveAndFinish]);

  // Steps that auto-advance (no footer CTA)
  const AUTO_ADVANCE_STEPS = new Set([3, 4, 5]);
  // Scan step auto-advances too
  const isAutoStep = AUTO_ADVANCE_STEPS.has(step);
  const isScanStep = step === 10;
  const isLastStep = step === TOTAL_STEPS - 1;

  const canContinue = (): boolean => {
    if (step === 9) return answers.activePlatforms.length > 0;
    if (step === 6) return identityInputText.trim().length > 0;
    return true;
  };

  const getCtaLabel = (): string => {
    if (step === 0) return "Find Out If I'm Exposed";
    if (step === 2) return "Start My Assessment";
    if (step === 6) return "Scan For Me";
    if (step === 9) return "Connect & Continue";
    if (isLastStep) return "See My Full Report";
    return "Continue";
  };

  const renderStep = () => {
    switch (step) {
      case 0: return <BrandHookScreen colors={colors} />;
      case 1: return <CredibleStatScreen colors={colors} />;
      case 2: return <AssessmentIntroScreen colors={colors} />;
      case 3: return (
        <ConcernScreen
          colors={colors}
          selected={answers.primaryConcern}
          onSelect={(id) => {
            setAnswers((a) => ({ ...a, primaryConcern: id }));
            handleAutoAdvance(4);
          }}
        />
      );
      case 4: return (
        <IdentityTypeScreen
          colors={colors}
          selected={answers.userType}
          onSelect={(id) => {
            setAnswers((a) => ({ ...a, userType: id }));
            handleAutoAdvance(5);
          }}
        />
      );
      case 5: return (
        <AccountCountScreen
          colors={colors}
          selected={answers.followerRange}
          onSelect={(id) => {
            setAnswers((a) => ({ ...a, followerRange: id }));
            handleAutoAdvance(6);
          }}
        />
      );
      case 6: return (
        <IdentityInputScreen
          colors={colors}
          value={identityInputText}
          onChange={setIdentityInputText}
        />
      );
      case 7: return <ProofVisualScreen colors={colors} />;
      case 8: return <PrivacyScreen colors={colors} />;
      case 9: return (
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
      case 10: return (
        <ScanSetupScreen
          colors={colors}
          onDone={() => animateToStep(11)}
        />
      );
      case 11: return <UrgencyRevealScreen colors={colors} matchCount={matchCount} />;
      default: return null;
    }
  };

  const showFooter = !isAutoStep && !isScanStep;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <ProgressBar step={step} colors={colors} />
        {step > 0 && step < TOTAL_STEPS - 2 && !isAutoStep && !isScanStep && (
          <TouchableOpacity
            onPress={handleSkip}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.skipBtn}
          >
            <Text style={[styles.headerSkip, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Screen */}
      <Animated.View style={[styles.screenWrap, { opacity: fadeAnim }]}>
        {renderStep()}
      </Animated.View>

      {/* Footer */}
      {showFooter && (
        <View style={[styles.footer, { paddingBottom: bottomPad + 16 }]}>
          {isLastStep ? (
            <>
              <TouchableOpacity
                style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.85}
                onPress={handleFinish}
              >
                <Ionicons name="lock-open" size={18} color="#fff" />
                <Text style={[styles.ctaBtnText, { fontFamily: "Inter_700Bold" }]}>See My Full Report</Text>
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
                opacity: canContinue() ? 1 : 0.65,
              }]}
              activeOpacity={0.85}
              onPress={canContinue() ? handleNext : undefined}
            >
              <Text style={[styles.ctaBtnText, {
                color: canContinue() ? "#fff" : colors.mutedForeground,
                fontFamily: "Inter_700Bold",
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
  header: { paddingHorizontal: 24, paddingBottom: 12, gap: 12 },
  skipBtn: { alignSelf: "flex-end", marginTop: -4 },
  headerSkip: { fontSize: 14 },
  screenWrap: { flex: 1 },
  screen: { flex: 1 },
  screenPad: { padding: 24, gap: 20 },
  footer: { paddingHorizontal: 24, gap: 12 },

  // Shared step
  stepTitle: { fontSize: 26, lineHeight: 34 },
  stepSub: { fontSize: 14, lineHeight: 22 },

  // Concern
  optionList: { gap: 10 },
  optionCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 16, borderWidth: 1 },
  optionIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  optionText: { flex: 1, gap: 3 },
  optionLabel: { fontSize: 14, lineHeight: 19 },
  optionSub: { fontSize: 12, lineHeight: 17 },
  optionCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },

  // Type grid
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeCard: { padding: 14, borderRadius: 14, borderWidth: 1, alignItems: "center", gap: 8 },
  typeIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  typeLabel: { fontSize: 13, textAlign: "center" },

  // Platforms
  platformGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  platCard: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 8 },
  platCardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  platCheckbox: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  platLabel: { fontSize: 12 },
  selectionPill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  selectionPillText: { fontSize: 13 },

  // Scan
  scanRings: { width: 200, height: 200, alignItems: "center", justifyContent: "center" },
  scanRing: { position: "absolute", borderWidth: 1 },
  scanSpinner: { width: 76, height: 76, borderRadius: 38, borderWidth: 3 },
  scanShield: { position: "absolute" },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden", width: "100%" },
  progressFill: { height: "100%", borderRadius: 2 },
  scanStepList: { gap: 14 },
  scanStepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  scanStepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  activeDotPulse: { width: 8, height: 8, borderRadius: 4 },
  scanStepText: { fontSize: 14, flex: 1 },

  // CTA
  ctaBtn: { height: 56, borderRadius: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  ctaBtnText: { fontSize: 16 },
  maybeLater: { alignItems: "center" },
  maybeLaterText: { fontSize: 13 },
});
