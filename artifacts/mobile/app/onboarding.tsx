import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image as RNImage,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveOnboardingAnswers, addAccount, listThreats, getOAuthState, getXOAuthInit, getOAuthRedirectUris, getAccounts, getAccountMedia, uploadAvatar, getPhotoConsent, type AccountMediaItem } from "@/lib/api";
import { INSTAGRAM_APP_ID, FACEBOOK_APP_ID, OAUTH_APP_SCHEME } from "@/constants/oauthConfig";
import * as WebBrowser from "expo-web-browser";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Platform as SocialPlatform } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { PlatformIcon } from "@/components/PlatformIcon";
import { PhotoConsentModal } from "@/components/PhotoConsentModal";
import { ScanPulse } from "@/components/ScanPulse";
import { analytics } from "@/lib/analytics";
import { useReduceMotion } from "@/hooks/useReduceMotion";

// ─── ScaleButton: TouchableOpacity with spring press-in/out feedback ──────────
function ScaleButton({ onPress, style, disabled, activeOpacity = 0.85, children }: {
  onPress?: () => void;
  style?: object | object[];
  disabled?: boolean;
  activeOpacity?: number;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const rm = useReduceMotion();
  const pressIn  = () => !rm && Animated.spring(scale, { toValue: 0.97, tension: 300, friction: 10, useNativeDriver: true }).start();
  const pressOut = () => !rm && Animated.spring(scale, { toValue: 1,    tension: 300, friction: 10, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity onPress={onPress} style={style} disabled={disabled} activeOpacity={activeOpacity} onPressIn={pressIn} onPressOut={pressOut}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

const { width } = Dimensions.get("window");
const TOTAL_STEPS = 13;

// ─── Shared motion constants ───────────────────────────────────────────────────
const MOTION = {
  spring:        { tension: 120, friction: 14 } as const,
  spring_soft:   { tension: 80,  friction: 9  } as const,
  spring_bouncy: { tension: 55,  friction: 6  } as const,
  stagger_tight: 80,
  stagger_mid:   120,
  fade_fast:     200,
  fade_mid:      350,
};

export interface OnboardingAnswers {
  primaryConcern: string | null;
  goalFollowUp: string | null;
  userType: string | null;
  typeFollowUp: string | null;
  followerRange: string | null;
  activePlatforms: string[];
  attribution: string | null;
  perceivedRisk: number | null;
  identityInput: string | null;
  platformHandles: Record<string, string>;
}

// ─── Animated Progress Bar (spring fill) ─────────────────────────────────────
function ProgressBar({ step, colors }: { step: number; colors: ReturnType<typeof useColors> }) {
  const fillAnim = useRef(new Animated.Value((step + 1) / TOTAL_STEPS)).current;
  const prevStep = useRef(step);
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0.4, duration: 1500, useNativeDriver: false }),
    ])).start();
  }, []);

  useEffect(() => {
    if (prevStep.current !== step) {
      prevStep.current = step;
      Animated.spring(fillAnim, { toValue: (step + 1) / TOTAL_STEPS, tension: 100, friction: 14, useNativeDriver: false }).start();
    }
  }, [step]);

  const glowWidth = fillAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  return (
    <View style={[pb.bar, { backgroundColor: colors.border }]}>
      <Animated.View style={[pb.fill, { width: glowWidth, backgroundColor: colors.primary, opacity: glowOpacity }]} />
    </View>
  );
}
const pb = StyleSheet.create({
  bar: { height: 3, borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2 },
});

// Hero image for the welcome screen — person surrounded by social media profile
// cards with a blue neon glow, visually communicating "your identity is everywhere online"
const WELCOME_HERO = require("../assets/images/onboarding/welcome-hero.png");

// ─── S0: Brand Hook ───────────────────────────────────────────────────────────
function BrandHookScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  const particles = useRef(
    Array.from({ length: 12 }, (_, i) => ({
      anim: new Animated.Value(0),
      x: (Math.cos((i / 12) * Math.PI * 2) * (54 + (i % 3) * 22)) - 6,
      y: (Math.sin((i / 12) * Math.PI * 2) * (50 + (i % 3) * 18)) - 6,
      delay: i * 120,
      size: i % 3 === 0 ? 5 : i % 3 === 1 ? 3 : 2,
    }))
  ).current;

  const heroAnim     = useRef(new Animated.Value(0)).current;
  const headlineAnim = useRef(new Animated.Value(0)).current;
  const subAnim      = useRef(new Animated.Value(0)).current;
  const bodyAnim     = useRef(new Animated.Value(0)).current;
  const rm = useReduceMotion();

  useEffect(() => {
    Animated.timing(heroAnim, { toValue: 1, duration: rm ? 0 : 700, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();

    if (!rm) {
      Animated.stagger(160, [
        Animated.timing(headlineAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(subAnim,      { toValue: 1, duration: 450, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(bodyAnim,     { toValue: 1, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    } else {
      headlineAnim.setValue(1); subAnim.setValue(1); bodyAnim.setValue(1);
    }

    particles.forEach((p) => {
      const run = () => {
        p.anim.setValue(0);
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.anim, { toValue: 1, duration: 2800 + p.delay * 1.5, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(p.anim, { toValue: 0.1, duration: 2200, useNativeDriver: true }),
        ]).start(run);
      };
      run();
    });
  }, []);

  const headY  = headlineAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const subY   = subAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const bodyY  = bodyAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <View style={{ flex: 1 }}>
      {/* ── Hero image (top 60%) ── */}
      <Animated.View style={[hook.heroWrap, { opacity: heroAnim }]}>
        <RNImage source={WELCOME_HERO} style={hook.heroImage} resizeMode="cover" />

        {/* Bottom blend — fade starts at 30%, photo is fully dissolved by 82% so text floats over it */}
        <LinearGradient
          colors={["transparent", colors.background + "00", colors.background + "BB", colors.background]}
          locations={[0, 0.30, 0.65, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Subtle top darkening so status-bar text is legible */}
        <LinearGradient
          colors={[colors.background + "60", "transparent"]}
          locations={[0, 0.28]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Orbiting particle dots */}
        {particles.map((p, i) => (
          <Animated.View key={i} pointerEvents="none" style={{
            position: "absolute", width: p.size, height: p.size,
            borderRadius: p.size / 2, backgroundColor: colors.primary,
            opacity: p.anim, top: "50%", left: "50%",
            transform: [{ translateX: p.x }, { translateY: p.y }],
          }} />
        ))}
      </Animated.View>

      {/* ── Text block ── */}
      <View style={hook.textBlock}>
        <Animated.Text style={[hook.headline, { color: colors.foreground, fontFamily: "Inter_700Bold", opacity: headlineAnim, transform: [{ translateY: headY }] }]}>
          Your name and face{"\n"}already exist online.
        </Animated.Text>
        <Animated.Text style={[hook.sub, { fontFamily: "Inter_400Regular", opacity: subAnim, transform: [{ translateY: subY }] }]}>
          <Text style={{ color: colors.mutedForeground }}>The question is </Text>
          <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>who's using them.</Text>
        </Animated.Text>
        <Animated.Text style={[hook.body, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", opacity: bodyAnim, transform: [{ translateY: bodyY }] }]}>
          Rook uses AI to find impersonators, stolen photos, and fake accounts built on your identity — before you'd ever notice on your own.
        </Animated.Text>
      </View>
    </View>
  );
}
const hook = StyleSheet.create({
  heroWrap:  { width: "100%", height: "72%", overflow: "hidden" },
  heroImage: { width: "100%", height: "100%" },
  textBlock: { flex: 1, paddingHorizontal: 28, gap: 10, justifyContent: "flex-start", marginTop: -72, paddingTop: 0 },
  headline:  { fontSize: 30, lineHeight: 38, textAlign: "center" },
  sub:       { fontSize: 16, textAlign: "center" },
  body:      { fontSize: 13, textAlign: "center", lineHeight: 21, maxWidth: 310, alignSelf: "center" },
});

// ─── S1: Credible Stat ────────────────────────────────────────────────────────
function CredibleStatScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  const [statNum, setStatNum] = useState(1);
  const cardScale = useRef(new Animated.Value(0.93)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const rm = useReduceMotion();

  useEffect(() => {
    if (rm) { cardScale.setValue(1); cardOpacity.setValue(1); setStatNum(4); return; }
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(cardScale, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]).start();
    }, 250);
    let current = 1;
    const iv = setInterval(() => {
      current++;
      setStatNum(current);
      if (current >= 4) clearInterval(iv);
    }, 200);
    const guard = setTimeout(() => clearInterval(iv), 3000);
    return () => { clearInterval(iv); clearTimeout(guard); };
  }, []);

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { gap: 24 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#EF444410", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={{ gap: 10 }}>
        <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Online identity fraud is a growing concern.
        </Text>
        <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Fake accounts don't just borrow a name — they steal photos, copy bios, and message your real followers pretending to be you. Most people find out from someone else, days or weeks later.
        </Text>
      </View>
      <Animated.View style={{ transform: [{ scale: cardScale }], opacity: cardOpacity }}>
      <GlassCard style={[stat.card, { borderLeftColor: "#EF4444", borderLeftWidth: 3 }]}>
        <Text style={[stat.number, { color: "#EF4444", fontFamily: "Inter_700Bold" }]}>1 in {statNum}</Text>
        <Text style={[stat.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Americans have experienced online identity fraud</Text>
        <Text style={[stat.src, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Source: FTC Consumer Sentinel Network Report</Text>
      </GlassCard>
      </Animated.View>
      <View style={stat.cloneRow}>
        <GlassCard style={[stat.profile, { borderColor: colors.success + "55" }]}>
          <View style={[stat.avatar, { backgroundColor: colors.primary + "30" }]}><Ionicons name="person" size={20} color={colors.primary} /></View>
          <Text style={[stat.handle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>@yourhandle</Text>
          <Text style={[stat.meta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Your real profile</Text>
          <View style={[stat.tag, { backgroundColor: colors.success + "20" }]}><Text style={[stat.tagText, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>Genuine</Text></View>
        </GlassCard>
        <Ionicons name="arrow-forward" size={18} color={colors.mutedForeground} />
        <GlassCard style={[stat.profile, { borderColor: "#EF444455" }]}>
          <View style={[stat.avatar, { backgroundColor: "#EF444422" }]}><Ionicons name="person" size={20} color="#EF4444" /></View>
          <Text style={[stat.handle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>@yourhandIe</Text>
          <Text style={[stat.meta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Stolen photo · Copied bio</Text>
          <View style={[stat.tag, { backgroundColor: "#EF444420" }]}><Text style={[stat.tagText, { color: "#EF4444", fontFamily: "Inter_600SemiBold" }]}>Impersonator</Text></View>
        </GlassCard>
      </View>
      <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", lineHeight: 18 }]}>
        Spot the difference: lowercase "l" swapped for uppercase "I" — invisible at a glance.
      </Text>
    </ScrollView>
  );
}
const stat = StyleSheet.create({
  card: { gap: 6 },
  number: { fontSize: 44, lineHeight: 50 },
  label: { fontSize: 15, lineHeight: 22 },
  src: { fontSize: 11, marginTop: 2 },
  cloneRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  profile: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 16 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  handle: { fontSize: 12, textAlign: "center" },
  meta: { fontSize: 10, textAlign: "center" },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  tagText: { fontSize: 10 },
});

// ─── S2: Assessment Intro ─────────────────────────────────────────────────────
function AssessmentIntroScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rmS2 = useReduceMotion();
  useEffect(() => {
    if (rmS2) { scale.setValue(1); opacity.setValue(1); return; }
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [rmS2]);
  return (
    <View style={[s.screenPad, { flex: 1, justifyContent: "center" }]}>
      <LinearGradient colors={["#3B82F611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Animated.View style={{ alignItems: "center", opacity, transform: [{ scale }], gap: 32 }}>
        <View style={ai.rings}>
          <View style={[ai.ring1, { borderColor: colors.primary + "30" }]} />
          <View style={[ai.ring2, { borderColor: colors.primary + "55" }]} />
          <View style={[ai.center, { backgroundColor: colors.primary + "18" }]}><Ionicons name="search" size={30} color={colors.primary} /></View>
        </View>
        <View style={{ gap: 12, alignItems: "center" }}>
          <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: "center" }]}>Let's check{"\n"}your exposure.</Text>
          <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>A few quick questions, then we'll run your first scan.{"\n"}Takes about a minute.</Text>
        </View>
        <View style={ai.chips}>
          {["~1 min", "No card needed", "100% private"].map((chip) => (
            <View key={chip} style={[ai.chip, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "30" }]}>
              <Ionicons name="checkmark" size={11} color={colors.primary} />
              <Text style={[{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 12 }]}>{chip}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}
const ai = StyleSheet.create({
  rings: { width: 140, height: 140, alignItems: "center", justifyContent: "center" },
  ring1: { position: "absolute", width: 140, height: 140, borderRadius: 70, borderWidth: 1 },
  ring2: { position: "absolute", width: 100, height: 100, borderRadius: 50, borderWidth: 1 },
  center: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
});

// ─── S3: Concern (auto-advance) ───────────────────────────────────────────────
const CONCERNS = [
  { id: "impersonated", icon: "alert-circle" as const, label: "Someone is impersonating me", sub: "I've found fake accounts using my name or photos" },
  { id: "creator", icon: "videocam" as const, label: "Protecting my creator brand", sub: "My content gets stolen or reused without permission" },
  { id: "proactive", icon: "shield-checkmark" as const, label: "Staying ahead of threats", sub: "I want to prevent identity theft before it happens" },
  { id: "business", icon: "business" as const, label: "Business & brand protection", sub: "My company's social presence needs monitoring" },
  { id: "curious", icon: "search" as const, label: "Checking my exposure", sub: "I'm curious to see if I'm already at risk" },
];
function ConcernScreen({ colors, selected, onSelect }: { colors: ReturnType<typeof useColors>; selected: string | null; onSelect: (id: string) => void }) {
  const anims = useRef(CONCERNS.map(() => new Animated.Value(0))).current;
  const scales = useRef(CONCERNS.map(() => new Animated.Value(1))).current;
  useEffect(() => { Animated.stagger(55, anims.map((a) => Animated.spring(a, { toValue: 1, tension: 120, friction: 9, useNativeDriver: true }))).start(); }, []);
  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { gap: 20 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#3B82F611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={{ gap: 6 }}>
        <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>What brings you to Rook?</Text>
        <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>This tailors your protection profile.</Text>
      </View>
      <View style={{ gap: 10 }}>
        {CONCERNS.map((c, idx) => {
          const isSelected = selected === c.id;
          return (
            <Animated.View key={c.id} style={{ opacity: anims[idx], transform: [{ translateY: anims[idx]!.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }, { scale: scales[idx]! }] }}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Animated.sequence([Animated.timing(scales[idx]!, { toValue: 0.96, duration: 80, useNativeDriver: true }), Animated.spring(scales[idx]!, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true })]).start(() => onSelect(c.id)); }}
                style={[opt.card, { backgroundColor: isSelected ? colors.primary + "14" : colors.card, borderColor: isSelected ? colors.primary + "80" : colors.border, borderWidth: isSelected ? 1.5 : 1 }]}>
                <View style={[opt.iconWrap, { backgroundColor: colors.primary + "18" }]}><Ionicons name={c.icon} size={22} color={isSelected ? colors.primary : colors.mutedForeground} /></View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[opt.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{c.label}</Text>
                  <Text style={[opt.optSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{c.sub}</Text>
                </View>
                {isSelected && <View style={[opt.check, { backgroundColor: colors.primary }]}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}
const opt = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 16, borderWidth: 1 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14 },
  optSub: { fontSize: 12, lineHeight: 17 },
  check: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});

// ─── S4: Identity Type (auto-advance) ─────────────────────────────────────────
const USER_TYPES = [
  { id: "public_figure", icon: "star" as const, label: "Public Figure", risk: "High-visibility target for impersonation" },
  { id: "creator", icon: "videocam" as const, label: "Content Creator", risk: "Creators are impersonated 3× more on average" },
  { id: "business", icon: "business" as const, label: "Business / Brand", risk: "Brand fraud costs businesses millions yearly" },
  { id: "professional", icon: "briefcase" as const, label: "Professional", risk: "LinkedIn scams targeting your network" },
  { id: "student", icon: "school" as const, label: "Student", risk: "Growing target of social media fraud" },
  { id: "personal", icon: "person" as const, label: "Personal Use", risk: "Everyone deserves identity protection" },
];
function IdentityTypeScreen({ colors, selected, onSelect }: { colors: ReturnType<typeof useColors>; selected: string | null; onSelect: (id: string) => void }) {
  const anims  = useRef(USER_TYPES.map(() => new Animated.Value(0))).current;
  const scales = useRef(USER_TYPES.map(() => new Animated.Value(1))).current;
  useEffect(() => { Animated.stagger(55, anims.map((a) => Animated.spring(a, { toValue: 1, tension: 120, friction: 9, useNativeDriver: true }))).start(); }, []);
  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { gap: 20 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#8B5CF611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Which of these sounds like you?</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {USER_TYPES.map((t, idx) => {
          const isSelected = selected === t.id;
          return (
            <Animated.View key={t.id} style={{ opacity: anims[idx], transform: [{ translateY: anims[idx]!.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }, { scale: scales[idx]! }], width: (width - 60) / 2 }}>
              <TouchableOpacity activeOpacity={0.8}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Animated.sequence([
                    Animated.timing(scales[idx]!, { toValue: 0.95, duration: 80, useNativeDriver: true }),
                    Animated.spring(scales[idx]!, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
                  ]).start(() => onSelect(t.id));
                }}
                style={[type.card, { backgroundColor: isSelected ? colors.primary + "18" : colors.card, borderColor: isSelected ? colors.primary + "80" : colors.border, borderWidth: isSelected ? 1.5 : 1 }]}>
                <View style={[type.icon, { backgroundColor: isSelected ? colors.primary + "25" : colors.secondary }]}><Ionicons name={t.icon} size={22} color={isSelected ? colors.primary : colors.mutedForeground} /></View>
                <Text style={[{ color: isSelected ? colors.primary : colors.foreground, fontFamily: isSelected ? "Inter_700Bold" : "Inter_600SemiBold", fontSize: 13, textAlign: "center" }]}>{t.label}</Text>
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 15, textAlign: "center" }]}>{t.risk}</Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}
const type = StyleSheet.create({
  card: { padding: 14, borderRadius: 14, borderWidth: 1, alignItems: "center", gap: 8 },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
});

// ─── S5: Account Count (auto-advance) ─────────────────────────────────────────
const ACCOUNT_RANGES = [
  { id: "small", label: "1–2 accounts", sub: "Just starting out" },
  { id: "medium", label: "3–5 accounts", sub: "Active across platforms" },
  { id: "large", label: "6+ accounts", sub: "Wide digital presence" },
];
function AccountCountScreen({ colors, selected, onSelect }: { colors: ReturnType<typeof useColors>; selected: string | null; onSelect: (id: string) => void }) {
  const anims  = useRef(ACCOUNT_RANGES.map(() => new Animated.Value(0))).current;
  const scales = useRef(ACCOUNT_RANGES.map(() => new Animated.Value(1))).current;
  useEffect(() => { Animated.stagger(80, anims.map((a) => Animated.spring(a, { toValue: 1, tension: 100, friction: 9, useNativeDriver: true }))).start(); }, []);
  return (
    <View style={[s.screenPad, { flex: 1, justifyContent: "center", gap: 28 }]}>
      <LinearGradient colors={["#F59E0B11", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={{ gap: 6 }}>
        <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>How many social accounts do you have?</Text>
        <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>This helps us calibrate how much of your identity we need to protect.</Text>
      </View>
      <View style={{ gap: 12 }}>
        {ACCOUNT_RANGES.map((r, idx) => {
          const isSelected = selected === r.id;
          return (
            <Animated.View key={r.id} style={{ opacity: anims[idx], transform: [{ translateY: anims[idx]!.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }, { scale: scales[idx]! }] }}>
              <TouchableOpacity activeOpacity={0.85}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  Animated.sequence([
                    Animated.timing(scales[idx]!, { toValue: 0.96, duration: 80, useNativeDriver: true }),
                    Animated.spring(scales[idx]!, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
                  ]).start(() => onSelect(r.id));
                }}
                style={[cnt.card, { backgroundColor: isSelected ? colors.primary + "18" : colors.card, borderColor: isSelected ? colors.primary + "80" : colors.border, borderWidth: isSelected ? 1.5 : 1 }]}>
                <View>
                  <Text style={[cnt.label, { color: isSelected ? colors.primary : colors.foreground, fontFamily: "Inter_700Bold" }]}>{r.label}</Text>
                  <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }]}>{r.sub}</Text>
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
const cnt = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, borderRadius: 16, borderWidth: 1 },
  label: { fontSize: 17, marginBottom: 2 },
});

// ─── S3 (combined): Concern + Identity Type + Account Count ──────────────────
// ─── Follow-up question data ──────────────────────────────────────────────────
type FollowUpOption = { id: string; label: string };
const GOAL_FOLLOWUPS: Record<string, { question: string; options: FollowUpOption[] }> = {
  impersonated: { question: "How did you find out about it?", options: [
    { id: "found_myself",    label: "I found it myself" },
    { id: "friend_told",     label: "A friend or colleague told me" },
    { id: "suspicious_msg",  label: "Got a suspicious message about it" },
    { id: "platform_flag",   label: "A platform flagged it for me" },
    { id: "gut_feeling",     label: "Just have a gut feeling" },
  ]},
  creator: { question: "What's been used without your permission?", options: [
    { id: "photos",          label: "My photos or likeness" },
    { id: "content",         label: "My posts, videos, or clips" },
    { id: "full_persona",    label: "My whole name and persona" },
    { id: "proactive",       label: "Nothing yet — being proactive" },
    { id: "unsure",          label: "Not sure, but suspicious" },
  ]},
  proactive: { question: "How do you currently check for threats?", options: [
    { id: "dont",            label: "I don't — that's why I'm here" },
    { id: "google",          label: "Google myself occasionally" },
    { id: "manual_check",    label: "Search each platform manually" },
    { id: "other_tool",      label: "Used another tool before" },
    { id: "just_started",    label: "Just started caring about this" },
  ]},
  business: { question: "What's your biggest brand risk right now?", options: [
    { id: "fake_accounts",   label: "Fake accounts mimicking us" },
    { id: "phishing",        label: "Phishing using our brand name" },
    { id: "counterfeit",     label: "Counterfeit products or resellers" },
    { id: "employee",        label: "Employees being impersonated" },
    { id: "all",             label: "All of the above" },
  ]},
  curious: { question: "What made you curious about your exposure?", options: [
    { id: "heard",           label: "Heard about identity theft recently" },
    { id: "friend",          label: "It happened to someone I know" },
    { id: "news",            label: "Saw something in the news" },
    { id: "exploring",       label: "Just exploring my digital footprint" },
    { id: "close_call",      label: "Had a close call myself" },
  ]},
};
const TYPE_FOLLOWUPS: Record<string, { question: string; options: FollowUpOption[] }> = {
  public_figure: { question: "What best describes your public role?", options: [
    { id: "politics",        label: "Politician or activist" },
    { id: "entertainment",   label: "Athlete or entertainer" },
    { id: "thought_leader",  label: "Author, speaker, or expert" },
    { id: "media",           label: "Journalist or media personality" },
    { id: "community",       label: "Community or religious leader" },
  ]},
  creator: { question: "Where's your main creative home?", options: [
    { id: "ig_tiktok",       label: "Instagram / TikTok" },
    { id: "youtube",         label: "YouTube" },
    { id: "x_twitter",       label: "X / Twitter" },
    { id: "twitch",          label: "Twitch / Gaming" },
    { id: "multi",           label: "Across multiple platforms" },
  ]},
  business: { question: "What best describes your business?", options: [
    { id: "ecommerce",       label: "E-commerce or retail brand" },
    { id: "agency",          label: "Agency or services firm" },
    { id: "saas",            label: "SaaS or tech company" },
    { id: "hc_finance",      label: "Healthcare or finance" },
    { id: "local",           label: "Local or brick-and-mortar" },
  ]},
  professional: { question: "What's your professional field?", options: [
    { id: "finance_legal",   label: "Finance or legal" },
    { id: "healthcare",      label: "Healthcare or science" },
    { id: "tech",            label: "Tech or engineering" },
    { id: "sales_mktg",      label: "Sales or marketing" },
    { id: "education",       label: "Education or research" },
  ]},
  student: { question: "What worries you most about your online presence?", options: [
    { id: "academic",        label: "Damage to academic reputation" },
    { id: "social",          label: "Social media safety" },
    { id: "career",          label: "Future career impact" },
    { id: "id_theft",        label: "Identity theft generally" },
    { id: "exploring",       label: "Just seeing what's out there" },
  ]},
  personal: { question: "How active are you on social media?", options: [
    { id: "very_active",     label: "Very active — post most days" },
    { id: "moderate",        label: "Moderately active" },
    { id: "occasional",      label: "Occasional poster" },
    { id: "lurker",          label: "Mostly a lurker" },
    { id: "new",             label: "Just joined or rarely post" },
  ]},
};

// Animated list used for follow-up answer options
function FollowUpOptionList({ colors, options, selected, onSelect }: {
  colors: ReturnType<typeof useColors>;
  options: FollowUpOption[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const anims = useRef(options.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(45, anims.map((a) => Animated.spring(a, { toValue: 1, tension: 120, friction: 9, useNativeDriver: true }))).start();
  }, []);
  return (
    <View style={{ gap: 8 }}>
      {options.map((o, idx) => {
        const isSel = selected === o.id;
        return (
          <Animated.View key={o.id} style={{ opacity: anims[idx], transform: [{ translateY: anims[idx]!.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
            <TouchableOpacity activeOpacity={0.82}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(o.id); }}
              style={[fol.row, { backgroundColor: isSel ? colors.primary + "18" : colors.card, borderColor: isSel ? colors.primary + "80" : colors.border, borderWidth: isSel ? 1.5 : 1 }]}>
              <Text style={[fol.label, { color: colors.foreground, fontFamily: isSel ? "Inter_600SemiBold" : "Inter_400Regular" }]}>{o.label}</Text>
              {isSel && <View style={[opt.check, { backgroundColor: colors.primary }]}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}
const fol = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 14, borderWidth: 1 },
  label: { fontSize: 14, flex: 1 },
});

// ─── S3: 5-question personalised assessment ───────────────────────────────────
// Q1 (concern) → Q1b follow-up → Q2 (identity type) → Q2b follow-up →
// Q3 (account count, auto-advance on select)
function CombinedQuizScreen({
  colors, selectedConcern, selectedGoalFollowUp, selectedUserType,
  selectedTypeFollowUp, selectedFollowerRange, onSelect,
}: {
  colors: ReturnType<typeof useColors>;
  selectedConcern: string | null;
  selectedGoalFollowUp: string | null;
  selectedUserType: string | null;
  selectedTypeFollowUp: string | null;
  selectedFollowerRange: string | null;
  onSelect: (field: "primaryConcern" | "goalFollowUp" | "userType" | "typeFollowUp" | "followerRange", id: string) => void;
}) {
  const scrollRef = useRef<import("react-native").ScrollView>(null);
  const rm        = useReduceMotion();
  const q1Anims   = useRef(CONCERNS.map(() => new Animated.Value(0))).current;

  const q1bAnim  = useRef(new Animated.Value(selectedGoalFollowUp ? 1 : 0)).current;
  const q2Anim   = useRef(new Animated.Value(selectedGoalFollowUp ? 1 : 0)).current;
  const q2bAnim  = useRef(new Animated.Value(selectedTypeFollowUp ? 1 : 0)).current;
  const q3Anim   = useRef(new Animated.Value(selectedTypeFollowUp ? 1 : 0)).current;

  const prevConcern      = useRef(selectedConcern);
  const prevGoalFollowUp = useRef(selectedGoalFollowUp);
  const prevUserType     = useRef(selectedUserType);
  const prevTypeFollowUp = useRef(selectedTypeFollowUp);

  useEffect(() => {
    Animated.stagger(55, q1Anims.map((a) => Animated.spring(a, { toValue: 1, tension: 120, friction: 9, useNativeDriver: true }))).start();
  }, []);

  useEffect(() => {
    if (selectedConcern && !prevConcern.current) {
      prevConcern.current = selectedConcern;
      if (rm) { q1bAnim.setValue(1); return; }
      Animated.spring(q1bAnim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }).start();
      setTimeout(() => scrollRef.current?.scrollTo({ y: 400, animated: true }), 580);
    } else if (selectedConcern) { prevConcern.current = selectedConcern; }
  }, [selectedConcern]);

  useEffect(() => {
    if (selectedGoalFollowUp && !prevGoalFollowUp.current) {
      prevGoalFollowUp.current = selectedGoalFollowUp;
      if (rm) { q2Anim.setValue(1); return; }
      Animated.spring(q2Anim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }).start();
      setTimeout(() => scrollRef.current?.scrollTo({ y: 760, animated: true }), 600);
    } else if (selectedGoalFollowUp) { prevGoalFollowUp.current = selectedGoalFollowUp; }
  }, [selectedGoalFollowUp]);

  useEffect(() => {
    if (selectedUserType && !prevUserType.current) {
      prevUserType.current = selectedUserType;
      if (rm) { q2bAnim.setValue(1); return; }
      Animated.spring(q2bAnim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }).start();
      setTimeout(() => scrollRef.current?.scrollTo({ y: 1120, animated: true }), 600);
    } else if (selectedUserType) { prevUserType.current = selectedUserType; }
  }, [selectedUserType]);

  useEffect(() => {
    if (selectedTypeFollowUp && !prevTypeFollowUp.current) {
      prevTypeFollowUp.current = selectedTypeFollowUp;
      if (rm) { q3Anim.setValue(1); return; }
      Animated.spring(q3Anim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }).start();
      setTimeout(() => scrollRef.current?.scrollTo({ y: 1480, animated: true }), 600);
    } else if (selectedTypeFollowUp) { prevTypeFollowUp.current = selectedTypeFollowUp; }
  }, [selectedTypeFollowUp]);

  const concernFollowUp = selectedConcern ? GOAL_FOLLOWUPS[selectedConcern] : null;
  const typeFollowUp    = selectedUserType ? TYPE_FOLLOWUPS[selectedUserType] : null;

  return (
    <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={[s.screenPad, { gap: 28, paddingBottom: 48 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#3B82F611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      {/* Q1 — What brings you to Rook? */}
      <View style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>What brings you to Rook?</Text>
          <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>This tailors your protection profile.</Text>
        </View>
        <View style={{ gap: 10 }}>
          {CONCERNS.map((c, idx) => {
            const isSel = selectedConcern === c.id;
            return (
              <Animated.View key={c.id} style={{ opacity: q1Anims[idx], transform: [{ translateY: q1Anims[idx]!.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
                <TouchableOpacity activeOpacity={0.85}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect("primaryConcern", c.id); }}
                  style={[opt.card, { backgroundColor: isSel ? colors.primary + "14" : colors.card, borderColor: isSel ? colors.primary + "80" : colors.border, borderWidth: isSel ? 1.5 : 1 }]}>
                  <View style={[opt.iconWrap, { backgroundColor: colors.primary + "18" }]}><Ionicons name={c.icon} size={22} color={isSel ? colors.primary : colors.mutedForeground} /></View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[opt.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{c.label}</Text>
                    <Text style={[opt.optSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{c.sub}</Text>
                  </View>
                  {isSel && <View style={[opt.check, { backgroundColor: colors.primary }]}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </View>

      {/* Q1b — Personalised follow-up based on Q1 answer */}
      <Animated.View pointerEvents={selectedConcern ? "auto" : "none"}
        style={{ gap: 14, opacity: q1bAnim, transform: [{ translateY: q1bAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
        {concernFollowUp && (
          <>
            <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{concernFollowUp.question}</Text>
            <FollowUpOptionList colors={colors} options={concernFollowUp.options} selected={selectedGoalFollowUp} onSelect={(id) => onSelect("goalFollowUp", id)} />
          </>
        )}
      </Animated.View>

      {/* Q2 — How do you describe yourself online? */}
      <Animated.View pointerEvents={selectedGoalFollowUp ? "auto" : "none"}
        style={{ gap: 14, opacity: q2Anim, transform: [{ translateY: q2Anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
        <View style={{ gap: 6 }}>
          <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>How do you describe yourself online?</Text>
          <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Helps us understand the threats most relevant to you.</Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {USER_TYPES.map((t) => {
            const isSel = selectedUserType === t.id;
            return (
              <View key={t.id} style={{ width: (width - 60) / 2 }}>
                <TouchableOpacity activeOpacity={0.8}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect("userType", t.id); }}
                  style={[type.card, { backgroundColor: isSel ? colors.primary + "18" : colors.card, borderColor: isSel ? colors.primary + "80" : colors.border, borderWidth: isSel ? 1.5 : 1 }]}>
                  <View style={[type.icon, { backgroundColor: isSel ? colors.primary + "25" : colors.secondary }]}><Ionicons name={t.icon} size={22} color={isSel ? colors.primary : colors.mutedForeground} /></View>
                  <Text style={[{ color: isSel ? colors.primary : colors.foreground, fontFamily: isSel ? "Inter_700Bold" : "Inter_600SemiBold", fontSize: 13, textAlign: "center" }]}>{t.label}</Text>
                  <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 15, textAlign: "center" }]}>{t.risk}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </Animated.View>

      {/* Q2b — Personalised follow-up based on Q2 answer */}
      <Animated.View pointerEvents={selectedUserType ? "auto" : "none"}
        style={{ gap: 14, opacity: q2bAnim, transform: [{ translateY: q2bAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
        {typeFollowUp && (
          <>
            <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{typeFollowUp.question}</Text>
            <FollowUpOptionList colors={colors} options={typeFollowUp.options} selected={selectedTypeFollowUp} onSelect={(id) => onSelect("typeFollowUp", id)} />
          </>
        )}
      </Animated.View>

      {/* Q3 — Account count (auto-advances on select) */}
      <Animated.View pointerEvents={selectedTypeFollowUp ? "auto" : "none"}
        style={{ gap: 14, opacity: q3Anim, transform: [{ translateY: q3Anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
        <View style={{ gap: 4 }}>
          <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>How many social accounts do you have?</Text>
          <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Helps us calibrate your coverage.</Text>
        </View>
        <View style={{ gap: 12 }}>
          {ACCOUNT_RANGES.map((r) => {
            const isSel = selectedFollowerRange === r.id;
            return (
              <TouchableOpacity key={r.id} activeOpacity={0.85}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSelect("followerRange", r.id); }}
                style={[cnt.card, { backgroundColor: isSel ? colors.primary + "18" : colors.card, borderColor: isSel ? colors.primary + "80" : colors.border, borderWidth: isSel ? 1.5 : 1 }]}>
                <View>
                  <Text style={[cnt.label, { color: isSel ? colors.primary : colors.foreground, fontFamily: "Inter_700Bold" }]}>{r.label}</Text>
                  <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }]}>{r.sub}</Text>
                </View>
                {isSel && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </ScrollView>
  );
}

// ─── S4 (was S6): Identity + Platform Select + Photo Upload (combined) ─────────
const ALL_PLATFORMS: Array<{ id: NonNullable<SocialPlatform>; label: string }> = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "x", label: "X / Twitter" },
  { id: "facebook", label: "Facebook" },
  { id: "youtube", label: "YouTube" },
  { id: "snapchat", label: "Snapchat" },
  { id: "linkedin", label: "LinkedIn" },
];

// ─── S8: Full Profile + Account Setup (merged) ───────────────────────────────
// Replaces old IdentityInputScreen (step 8) + PlatformHandlesScreen (step 10).
// OAuth account connection is the primary action; camera roll is a fallback.
function FullProfileSetupScreen({
  colors,
  nameValue,
  onNameChange,
  handles,
  onHandleChange,
  isAddingAccounts,
  connectedPlatforms,
  onOAuthConnected,
  onPhotosPicked,
  photoUri,
  onPhotoSelect,
}: {
  colors: ReturnType<typeof useColors>;
  nameValue: string;
  onNameChange: (v: string) => void;
  handles: Record<string, string>;
  onHandleChange: (platformId: string, value: string) => void;
  isAddingAccounts: boolean;
  connectedPlatforms: Set<string>;
  onOAuthConnected: (platform: string, accountId: string) => void;
  onPhotosPicked?: (platform: string, urls: string[]) => void;
  photoUri: string | null;
  onPhotoSelect: (uri: string, base64?: string) => void;
}) {
  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access so Rook can search for stolen images of you.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images", allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onPhotoSelect(asset.uri, asset.base64 ?? undefined);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
      <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { gap: 22, paddingBottom: 32 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={["#3B82F622", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

        {/* Header */}
        <View style={{ gap: 8 }}>
          <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Now let's find out{"\n"}what's out there about you.
          </Text>
          <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Connect your accounts for the richest scan — 10× more signals than a name search alone.
          </Text>
        </View>

        {/* Name / handle + reference photo — "who you are" */}
        <View style={{ gap: 12 }}>
          <View style={inp.wrap}>
            <View style={[inp.row, { backgroundColor: colors.card, borderColor: nameValue.length > 0 ? colors.primary + "66" : colors.border, borderWidth: nameValue.length > 0 ? 1.5 : 1 }]}>
              <Ionicons name="person-circle-outline" size={22} color={nameValue.length > 0 ? colors.primary : colors.mutedForeground} />
              <TextInput style={[inp.input, { color: colors.foreground, fontFamily: "Inter_500Medium" }]} placeholder="Your name or @handle" placeholderTextColor={colors.mutedForeground} value={nameValue} onChangeText={onNameChange} autoCapitalize="none" autoCorrect={false} returnKeyType="done" />
              {nameValue.length > 0 && <TouchableOpacity onPress={() => onNameChange("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close-circle" size={18} color={colors.mutedForeground} /></TouchableOpacity>}
            </View>
          </View>
          {/* Reference photo — right beside name so identity info is grouped together */}
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8}>
            {photoUri ? (
              <View style={[inp.photoFilled, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "55" }]}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={[{ color: colors.success, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 }]}>Reference photo added — we'll search for copies</Text>
                <TouchableOpacity onPress={() => onPhotoSelect("", undefined)}>
                  <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[inp.photoPicker, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="image-outline" size={22} color={colors.mutedForeground} />
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14 }]}>Add a reference photo (optional)</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 2 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }]}>then connect your accounts</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        {/* Platform connection — primary action */}
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
            <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>Connect your platforms</Text>
            <View style={{ backgroundColor: colors.primary + "18", borderWidth: 1, borderColor: colors.primary + "44", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
              <Text style={[{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 11 }]}>Most accurate</Text>
            </View>
          </View>
          <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 }]}>
            OAuth connects read-only — Rook never posts, follows, or messages anyone on your behalf.
          </Text>
          {ALL_PLATFORMS.map((p) => (
            <PlatformConnectRow
              key={p.id}
              colors={colors}
              platform={p.id}
              label={p.label}
              isConnected={connectedPlatforms.has(p.id)}
              handle={handles[p.id] ?? ""}
              onHandleChange={(v) => onHandleChange(p.id, v)}
              onConnected={onOAuthConnected}
              onPhotosPicked={onPhotosPicked}
            />
          ))}
          {isAddingAccounts && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center", paddingVertical: 4 }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }]}>Connecting accounts…</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const inp = StyleSheet.create({
  wrap: { borderRadius: 14, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  input: { flex: 1, fontSize: 16, lineHeight: 22 },
  photoFilled: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1.5 },
  photoPicker: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  privNote: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
});

// ─── S7: Proof Visual ─────────────────────────────────────────────────────────
function ProofVisualScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  const headlineAnim = useRef(new Animated.Value(0)).current;
  const card1Anim    = useRef(new Animated.Value(0)).current;
  const card2Anim    = useRef(new Animated.Value(0)).current;
  const card3Anim    = useRef(new Animated.Value(0)).current;
  const detected     = useRef(new Animated.Value(0)).current;
  const rm = useReduceMotion();

  useEffect(() => {
    if (rm) {
      headlineAnim.setValue(1); card1Anim.setValue(1); card2Anim.setValue(1);
      card3Anim.setValue(1); detected.setValue(1); return;
    }
    Animated.sequence([
      Animated.timing(headlineAnim, { toValue: 1, duration: 340, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.spring(card1Anim, { toValue: 1, ...MOTION.spring_soft, useNativeDriver: true }),
      Animated.delay(220),
      Animated.timing(detected, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.delay(100),
      Animated.spring(card2Anim, { toValue: 1, ...MOTION.spring_soft, useNativeDriver: true }),
      Animated.spring(card3Anim, { toValue: 1, ...MOTION.spring_soft, useNativeDriver: true }),
    ]).start();
  }, []);

  const headY     = headlineAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const card1Y    = card1Anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const card1Scale = card1Anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  const card2Y    = card2Anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const card3Y    = card3Anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { gap: 20, paddingBottom: 32 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#3B82F611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Animated.Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold", opacity: headlineAnim, transform: [{ translateY: headY }] }]}>
        Here's what Rook catches.
      </Animated.Text>

      {/* Card 1 — Impersonator */}
      <Animated.View style={{ opacity: card1Anim, transform: [{ translateY: card1Y }, { scale: card1Scale }] }}>
        <GlassCard style={[pv.card, { borderColor: "#EF444433" }]}>
          <View style={pv.header}>
            <View style={[pv.dot, { backgroundColor: "#EF444420" }]}><Ionicons name="alert-circle" size={14} color="#EF4444" /></View>
            <Text style={[{ color: "#EF4444", fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 1 }]}>Impersonator Detected</Text>
            <Animated.View style={[pv.badge, { backgroundColor: "#EF4444", opacity: detected, transform: [{ scale: detected }] }]}>
              <Text style={[{ color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 }]}>FLAGGED</Text>
            </Animated.View>
          </View>
          <View style={pv.profiles}>
            <View style={pv.profileCol}>
              <RNImage source={require("../assets/images/onboarding/s7-impersonator.png")} style={[pv.avatar, { borderWidth: 2, borderColor: colors.success + "80" }]} resizeMode="cover" />
              <Text style={[{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }]}>@alexjones</Text>
              <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10 }]}>Your account</Text>
              <View style={[pv.tag, { backgroundColor: colors.success + "20" }]}><Text style={[{ color: colors.success, fontSize: 10, fontFamily: "Inter_600SemiBold" }]}>Genuine</Text></View>
            </View>
            <View style={[{ width: 1, height: 70, backgroundColor: colors.border }]} />
            <View style={pv.profileCol}>
              <RNImage source={require("../assets/images/onboarding/s7-impersonator.png")} style={[pv.avatar, { borderWidth: 2, borderColor: "#EF444466" }]} resizeMode="cover" />
              <Text style={[{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }]}>@alexjone5</Text>
              <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10, textAlign: "center" }]}>Stolen photo · Copied bio</Text>
              <View style={[pv.tag, { backgroundColor: "#EF444420" }]}><Text style={[{ color: "#EF4444", fontSize: 10, fontFamily: "Inter_600SemiBold" }]}>Impersonator</Text></View>
            </View>
          </View>
          <View style={[{ backgroundColor: "#EF444410", borderRadius: 8, padding: 10, gap: 5 }]}>
            {["Identical profile photo", "Copied bio text", "Altered handle (5 vs s)"].map((t) => (
              <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="alert-circle" size={11} color="#EF4444" />
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }]}>{t}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      </Animated.View>

      {/* Card 2 — Scam Account */}
      <Animated.View style={{ opacity: card2Anim, transform: [{ translateY: card2Y }] }}>
        <GlassCard style={[pv.card, { borderColor: "#F59E0B33" }]}>
          <View style={pv.header}>
            <View style={[pv.dot, { backgroundColor: "#F59E0B20" }]}><Ionicons name="warning" size={14} color="#F59E0B" /></View>
            <Text style={[{ color: "#F59E0B", fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 1 }]}>Scam Account Detected</Text>
            <View style={[pv.badge, { backgroundColor: "#F59E0B" }]}><Text style={[{ color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 }]}>FOUND</Text></View>
          </View>
          <View style={{ gap: 6 }}>
            {["Using your name to scam followers", "Fake giveaway posts targeting fans", "AI verified: high-confidence match"].map((t) => (
              <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="remove-circle" size={12} color="#F59E0B" />
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }]}>{t}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      </Animated.View>

      {/* Card 3 — Stolen Photo */}
      <Animated.View style={{ opacity: card3Anim, transform: [{ translateY: card3Y }] }}>
        <GlassCard style={[pv.card, { borderColor: "#8B5CF633" }]}>
          <View style={pv.header}>
            <View style={[pv.dot, { backgroundColor: "#8B5CF620" }]}><Ionicons name="image" size={14} color="#8B5CF6" /></View>
            <Text style={[{ color: "#8B5CF6", fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 1 }]}>Stolen Photo Detected</Text>
            <View style={[pv.badge, { backgroundColor: "#8B5CF6" }]}><Text style={[{ color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 }]}>ALERT</Text></View>
          </View>
          <View style={{ gap: 6 }}>
            {["Photo reused on 3 accounts", "Different name + bio", "Cross-platform matches found"].map((t) => (
              <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="remove-circle" size={12} color="#8B5CF6" />
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }]}>{t}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      </Animated.View>
    </ScrollView>
  );
}
const pv = StyleSheet.create({
  card: { gap: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  profiles: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  profileCol: { alignItems: "center", gap: 6 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
});

// ─── S8: How Rook Protects ────────────────────────────────────────────────────
function HowRookProtectsScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  const STEPS = [
    { icon: "scan-circle", label: "Scan every major platform", color: colors.primary },
    { icon: "alert-circle", label: "Detect impersonators & stolen photos", color: "#EF4444" },
    { icon: "notifications", label: "Alert you when matches are found", color: "#F59E0B" },
    { icon: "shield-checkmark", label: "Help you review & report results", color: colors.success },
  ];
  const anims     = useRef(STEPS.map(() => new Animated.Value(0))).current;
  const lineAnims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const rm = useReduceMotion();

  useEffect(() => {
    if (rm) { anims.forEach(a => a.setValue(1)); lineAnims.forEach(a => a.setValue(1)); return; }
    STEPS.forEach((_, i) => {
      setTimeout(() => {
        Animated.spring(anims[i]!, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }).start();
        if (i < STEPS.length - 1) {
          setTimeout(() => {
            Animated.timing(lineAnims[i]!, { toValue: 1, duration: 280, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
          }, 260);
        }
      }, i * MOTION.stagger_mid + MOTION.stagger_tight);
    });
  }, []);

  return (
    <View style={[s.screenPad, { flex: 1, justifyContent: "center", gap: 40 }]}>
      <LinearGradient colors={["#3B82F611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>How Rook protects{"\n"}you, in four steps.</Text>
      <View style={{ gap: 0 }}>
        {STEPS.map((step, i) => (
          <Animated.View key={step.label} style={{ opacity: anims[i], transform: [{ translateX: anims[i]!.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }}>
            <View style={hrp.row}>
              <View style={hrp.iconCol}>
                <View style={[hrp.icon, { backgroundColor: step.color + "20" }]}><Ionicons name={step.icon as any} size={22} color={step.color} /></View>
                {i < STEPS.length - 1 && (
                  <Animated.View style={[hrp.line, { backgroundColor: step.color + "30", opacity: lineAnims[i] }]} />
                )}
              </View>
              <View style={[hrp.textCol, { paddingBottom: i < STEPS.length - 1 ? 24 : 0 }]}>
                <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, lineHeight: 22 }]}>{step.label}</Text>
              </View>
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}
const hrp = StyleSheet.create({
  row: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  iconCol: { alignItems: "center" },
  icon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  line: { width: 2, flex: 1, marginTop: 4, minHeight: 20 },
  textCol: { flex: 1, justifyContent: "center", minHeight: 46 },
});

// ─── S9: Privacy ──────────────────────────────────────────────────────────────
const PRIVACY_ITEMS = [
  { icon: "eye-off-outline" as const, title: "Read-only access only", body: "We never post, comment, follow, or message anyone on your behalf." },
  { icon: "chatbox-ellipses-outline" as const, title: "We never access your DMs", body: "Only public profile data and posts are scanned — private messages are off-limits." },
  { icon: "server-outline" as const, title: "Your data is never sold", body: "We don't monetize your personal information. Our business model is your subscription, not your data." },
  { icon: "trash-outline" as const, title: "Delete anytime", body: "Request full data deletion from your profile settings. We'll wipe everything within 30 days." },
];
function PrivacyScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  const anims = useRef(PRIVACY_ITEMS.map(() => new Animated.Value(0))).current;
  useEffect(() => { Animated.stagger(100, anims.map((a) => Animated.spring(a, { toValue: 1, tension: 100, friction: 9, useNativeDriver: true }))).start(); }, []);
  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { gap: 24 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#10B98111", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={{ alignItems: "center", gap: 14 }}>
        <View style={[prv.shield, { backgroundColor: colors.success + "18", borderColor: colors.success + "44" }]}><Ionicons name="lock-closed" size={36} color={colors.success} /></View>
        <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: "center" }]}>Your privacy is{"\n"}the whole point.</Text>
        <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>Rook only looks at publicly available information. Here's exactly what that means.</Text>
      </View>
      <View style={{ gap: 12 }}>
        {PRIVACY_ITEMS.map((item, idx) => (
          <Animated.View key={item.title} style={{ opacity: anims[idx], transform: [{ translateY: anims[idx]!.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
            <GlassCard style={[prv.item, { borderColor: colors.success + "22" }]}>
              <View style={[prv.itemIcon, { backgroundColor: colors.success + "18" }]}><Ionicons name={item.icon} size={20} color={colors.success} /></View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>{item.title}</Text>
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 }]}>{item.body}</Text>
              </View>
            </GlassCard>
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}
const prv = StyleSheet.create({
  shield: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  itemIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
});

// ─── S10: What Rook Does ──────────────────────────────────────────────────────
const HOW_IT_WORKS = [
  {
    icon: "search" as const,
    title: "Scans publicly discoverable results",
    body: "Rook searches the web for profiles and images that visually or textually resemble your identity.",
  },
  {
    icon: "eye-off-outline" as const,
    title: "Advanced identity protection",
    body: "Your photos and account details are compared against potential matches across the web and social platforms — your data stays private.",
  },
  {
    icon: "flag-outline" as const,
    title: "You decide what's a threat",
    body: "Rook surfaces possible matches for your review. You confirm, dismiss, or report — Rook never acts on your behalf.",
  },
  {
    icon: "notifications-outline" as const,
    title: "Periodic automated monitoring",
    body: "Premium accounts are re-scanned on a schedule. Results reflect the web at time of scan, not continuous real-time surveillance.",
  },
];
function SocialProofScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  const anims = useRef(HOW_IT_WORKS.map(() => new Animated.Value(0))).current;
  useEffect(() => { Animated.stagger(100, anims.map((a) => Animated.spring(a, { toValue: 1, tension: 90, friction: 9, useNativeDriver: true }))).start(); }, []);
  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { gap: 24 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#3B82F611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={{ gap: 8 }}>
        <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Here's exactly how Rook works</Text>
        <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          No mystery. No exaggerated claims. Just AI-assisted searching so you can find potential misuse of your identity.
        </Text>
      </View>
      <View style={{ gap: 12 }}>
        {HOW_IT_WORKS.map((item, idx) => (
          <Animated.View key={item.title} style={{ opacity: anims[idx], transform: [{ translateY: anims[idx]!.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
            <GlassCard style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Ionicons name={item.icon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, lineHeight: 20 }]}>{item.title}</Text>
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 }]}>{item.body}</Text>
              </View>
            </GlassCard>
          </Animated.View>
        ))}
      </View>
      <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center", lineHeight: 17 }]}>
        Rook surfaces potential matches — results require your review before any action.
      </Text>
    </ScrollView>
  );
}

// ─── S11: Profile Saved (commitment reinforcement) ────────────────────────────
function ProfileSavedScreen({ colors, identityInput, selectedPlatforms, hasPhoto }: {
  colors: ReturnType<typeof useColors>;
  identityInput: string;
  selectedPlatforms: string[];
  hasPhoto: boolean;
}) {
  const badgeScale   = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const titleAnim    = useRef(new Animated.Value(0)).current;
  const cardAnim     = useRef(new Animated.Value(0)).current;
  const stepsAnim    = useRef(new Animated.Value(0)).current;
  const rm = useReduceMotion();

  useEffect(() => {
    if (rm) {
      badgeScale.setValue(1); badgeOpacity.setValue(1);
      titleAnim.setValue(1); cardAnim.setValue(1); stepsAnim.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.parallel([
        Animated.spring(badgeScale,   { toValue: 1, tension: 55, friction: 6, useNativeDriver: true }),
        Animated.timing(badgeOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.timing(titleAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(cardAnim,  { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(stepsAnim, { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []);

  const badgeY  = badgeScale.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const titleY  = titleAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  const cardY   = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const stepsY  = stepsAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  const steps = [
    { label: "Profile & accounts set up", done: true },
    { label: "AI scans across platforms", done: false, current: true },
    { label: "View your match count", done: false },
    { label: "Unlock your full report", done: false },
  ];
  return (
    <View style={[s.screenPad, { flex: 1, justifyContent: "center", gap: 32 }]}>
      <LinearGradient colors={["#10B98111", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={{ gap: 24 }}>
        <View style={{ gap: 10 }}>
          <Animated.View style={{ opacity: badgeOpacity, transform: [{ scale: badgeScale }, { translateY: badgeY }] }}>
            <View style={[ps.badge, { backgroundColor: colors.success + "14", borderColor: colors.success + "33" }]}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={[{ color: colors.success, fontFamily: "Inter_600SemiBold", fontSize: 13 }]}>Your profile is saved</Text>
            </View>
          </Animated.View>
          <Animated.Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold", opacity: titleAnim, transform: [{ translateY: titleY }] }]}>
            You're 3 steps{"\n"}from your first results.
          </Animated.Text>
        </View>
        {(identityInput || selectedPlatforms.length > 0 || hasPhoto) && (
          <Animated.View style={{ opacity: cardAnim, transform: [{ translateY: cardY }] }}>
            <GlassCard style={{ gap: 10, borderColor: colors.primary + "22" }}>
              {identityInput ? (
                <View style={ps.row}><Ionicons name="person-circle" size={16} color={colors.primary} /><Text style={[{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }]}>Scanning for: <Text style={{ fontFamily: "Inter_600SemiBold" }}>{identityInput}</Text></Text></View>
              ) : null}
              {selectedPlatforms.length > 0 && (
                <View style={ps.row}><Ionicons name="grid" size={16} color={colors.primary} /><Text style={[{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }]}>{selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? "s" : ""} selected</Text></View>
              )}
              {hasPhoto && (
                <View style={ps.row}><Ionicons name="image" size={16} color={colors.primary} /><Text style={[{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }]}>Photo added for reverse-image scan</Text></View>
              )}
            </GlassCard>
          </Animated.View>
        )}
        <Animated.View style={{ opacity: stepsAnim, transform: [{ translateY: stepsY }], gap: 0 }}>
          {steps.map((step, i) => (
            <View key={step.label} style={ps.stepRow}>
              <View style={ps.stepIconCol}>
                <View style={[ps.stepDot, { backgroundColor: step.done ? colors.success : step.current ? colors.primary : colors.secondary, borderColor: step.done ? colors.success : step.current ? colors.primary : colors.border }]}>
                  {step.done ? <Ionicons name="checkmark" size={11} color="#fff" /> : step.current ? <View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" }]} /> : null}
                </View>
                {i < steps.length - 1 && <View style={[ps.stepLine, { backgroundColor: step.done ? colors.success + "44" : colors.border }]} />}
              </View>
              <Text style={[ps.stepLabel, { color: step.done || step.current ? colors.foreground : colors.mutedForeground, fontFamily: step.current ? "Inter_600SemiBold" : "Inter_400Regular", paddingBottom: i < steps.length - 1 ? 20 : 0 }]}>{step.label}</Text>
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  );
}
const ps = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  stepIconCol: { alignItems: "center" },
  stepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  stepLine: { width: 2, flex: 1, minHeight: 16, marginTop: 2 },
  stepLabel: { flex: 1, fontSize: 15, lineHeight: 22 },
});

// ─── OAuth helpers (mirrors connect-account.tsx logic) ───────────────────────
const ONBOARDING_OAUTH: Record<string, {
  label: string; color: string; callbackPath: string;
  scopes: string[]; clientIdEnvKey: string; isX?: boolean;
}> = {
  instagram: { label: "Instagram", color: "#E1306C", callbackPath: "/api/oauth/instagram/callback", scopes: ["instagram_business_basic"], clientIdEnvKey: "EXPO_PUBLIC_INSTAGRAM_CLIENT_ID" },
  x:         { label: "X / Twitter", color: "#1DA1F2", callbackPath: "/api/oauth/x/callback", scopes: ["tweet.read","users.read","offline.access"], clientIdEnvKey: "EXPO_PUBLIC_TWITTER_CLIENT_ID", isX: true },
  facebook:  { label: "Facebook", color: "#1877F2", callbackPath: "/api/oauth/facebook/callback", scopes: ["public_profile"], clientIdEnvKey: "EXPO_PUBLIC_FACEBOOK_CLIENT_ID" },
  tiktok:    { label: "TikTok", color: "#010101", callbackPath: "/api/oauth/tiktok/callback", scopes: ["user.info.basic"], clientIdEnvKey: "EXPO_PUBLIC_TIKTOK_CLIENT_ID" },
  youtube:   { label: "YouTube", color: "#FF0000", callbackPath: "/api/oauth/youtube/callback", scopes: ["https://www.googleapis.com/auth/youtube.readonly","profile","email"], clientIdEnvKey: "EXPO_PUBLIC_GOOGLE_CLIENT_ID" },
  linkedin:  { label: "LinkedIn", color: "#0A66C2", callbackPath: "/api/oauth/linkedin/callback", scopes: ["r_liteprofile","r_emailaddress"], clientIdEnvKey: "EXPO_PUBLIC_LINKEDIN_CLIENT_ID" },
  snapchat:  { label: "Snapchat", color: "#FFFC00", callbackPath: "/api/oauth/snapchat/callback", scopes: ["https://auth.snapchat.com/oauth2/api/user.display_name"], clientIdEnvKey: "EXPO_PUBLIC_SNAPCHAT_CLIENT_ID" },
};

function buildOAuthUrl(platform: string, clientId: string, state: string, redirectUri: string, extra?: Record<string,string>): string {
  const cfg = ONBOARDING_OAUTH[platform]!;
  const scopeSep = platform === "x" ? " " : ",";
  const p = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: cfg.scopes.join(scopeSep), response_type: "code", state, ...extra });
  const base = platform === "x" ? "https://twitter.com/i/oauth2/authorize"
    : platform === "instagram" ? "https://www.instagram.com/oauth/authorize"
    : platform === "facebook" ? "https://www.facebook.com/v22.0/dialog/oauth"
    : platform === "youtube" ? "https://accounts.google.com/o/oauth2/v2/auth"
    : platform === "linkedin" ? "https://www.linkedin.com/oauth/v2/authorization"
    : platform === "snapchat" ? "https://accounts.snapchat.com/login/oauth2/authorize"
    : "";
  return `${base}?${p.toString()}`;
}

// ─── S12: Platform Connect — OAuth + photo picker + manual handle fallback ────
const PHOTO_CELL = (width - 48 - 16) / 3; // 3 cols, 24px side padding + 8px gaps

function PlatformConnectRow({ colors, platform, label, isConnected, handle, onHandleChange, onConnected, onPhotosPicked }: {
  colors: ReturnType<typeof useColors>;
  platform: string;
  label: string;
  isConnected: boolean;
  handle: string;
  onHandleChange: (v: string) => void;
  onConnected: (platform: string, accountId: string) => void;
  onPhotosPicked?: (platform: string, urls: string[]) => void;
}) {
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<AccountMediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaHasAccess, setMediaHasAccess] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [photosConfirmed, setPhotosConfirmed] = useState(false);
  const [consentModalVisible, setConsentModalVisible] = useState(false);
  const postConsentRef = useRef<(() => void) | null>(null);

  const showConsentIfNeeded = useCallback(async (after: () => void): Promise<void> => {
    try {
      const status = await getPhotoConsent();
      if (!status.hasConsent) {
        postConsentRef.current = after;
        setConsentModalVisible(true);
        return;
      }
    } catch {
      // Non-fatal — proceed anyway if consent check fails
    }
    after();
  }, []);

  const handleOAuth = useCallback(async (forceEphemeral = false) => {
    const cfg = ONBOARDING_OAUTH[platform];
    if (!cfg) return;
    // App IDs from shared constants — single source of truth with connect-account.tsx.
    const clientId = platform === "instagram" ? INSTAGRAM_APP_ID
      : platform === "facebook" ? FACEBOOK_APP_ID
      : (process.env as Record<string,string|undefined>)[cfg.clientIdEnvKey];

    setOauthLoading(true);
    try {
      // Snapshot existing accounts so we can detect a newly added one
      const accountsBefore = await getAccounts().catch(() => [] as Awaited<ReturnType<typeof getAccounts>>);
      const existing = accountsBefore.find((a) => a.platform === platform);
      const prevLastSynced = existing?.lastSynced ?? null;

      const redirectUriMap = await getOAuthRedirectUris().catch(() => ({} as Record<string,string>));
      const redirectUrl = redirectUriMap[platform] ?? `https://${process.env.EXPO_PUBLIC_DOMAIN ?? ""}${cfg.callbackPath}`;

      // For X, TWITTER_CLIENT_ID is server-only — use the server-supplied x_client_id
      const effectiveClientId = platform === "x"
        ? ((redirectUriMap as Record<string,string>)["x_client_id"] || clientId)
        : clientId;

      if (!effectiveClientId) {
        // No client ID available — fall back to manual entry
        setShowManual(true);
        return;
      }

      let state: string;
      let authUrl: string;

      if (platform === "x") {
        const { state: xState, codeChallenge } = await getXOAuthInit();
        state = xState;
        authUrl = buildOAuthUrl(platform, effectiveClientId, state, redirectUrl, { code_challenge: codeChallenge, code_challenge_method: "S256" });
      } else {
        state = await getOAuthState();
        authUrl = buildOAuthUrl(platform, effectiveClientId, state, redirectUrl);
      }

      // The server processes the OAuth code and then redirects to the app scheme.
      // ASWebAuthenticationSession intercepts the custom scheme and closes automatically.
      // No preferEphemeralSession by default — iOS reuses the Safari session so the user
      // just taps "Continue as X" without re-entering their password. On auth errors we
      // retry with preferEphemeralSession: true to force a fresh login screen.
      const result = await WebBrowser.openAuthSessionAsync(authUrl, OAUTH_APP_SCHEME,
        forceEphemeral ? { preferEphemeralSession: true } : undefined
      );

      const resultUrl = "url" in result ? result.url ?? "" : "";
      const resultParams = resultUrl.includes("?") ? new URLSearchParams(resultUrl.split("?")[1]!) : null;
      const urlStatus = resultParams?.get("status");
      const urlError = resultParams?.get("error") ?? (urlStatus === "error" ? "auth_failed" : null);

      // Poll with retry — server may still be finishing token exchange when browser closes
      const connectDetected = async (): Promise<boolean> => {
        for (let i = 0; i < 4; i++) {
          if (i > 0) await new Promise((r) => setTimeout(r, 1800));
          const after = await getAccounts({ bustCache: true }).catch(() => null);
          if (!after) continue;
          const updated = after.find((a) => a.platform === platform);
          const isNew = updated && (!existing || (updated.lastSynced !== null && updated.lastSynced !== prevLastSynced));
          if (isNew && updated) {
            setConnectedAccountId(updated.id);
            onConnected(platform, updated.id);
            setMediaLoading(true);
            try {
              const { items, hasAccess } = await getAccountMedia(updated.id, 15);
              if (hasAccess && items.length > 0) {
                setMediaItems(items.filter((m) => m.type === "image"));
              }
            } catch { /* graceful — camera roll fallback shown below */ }
            finally { setMediaLoading(false); }
            return true;
          }
        }
        return false;
      };

      // Always poll — even on cancel/dismiss.
      // In Expo Go the custom-scheme redirect (com.getrook.app://oauth) cannot be
      // intercepted, so the browser returns "cancel" or "dismiss" even when the
      // server completed the token exchange successfully. Polling catches that case.
      const found = await connectDetected();
      if (found) return;

      // Handle errors / cancellations (only reached if poll found nothing)
      if (urlError) {
        const isInstagramPersonalAccount = urlError === "invalid_request" && platform === "instagram";
        if (isInstagramPersonalAccount) {
          // Personal account rejected — skip the alert and go straight to a fresh
          // login screen (preferEphemeralSession:true) so the user can switch accounts
          // or sign in with their professional account immediately.
          void handleOAuth(true);
        } else {
          Alert.alert(
            "Authentication Failed",
            `Could not sign in: ${urlError}`,
            [
              { text: "Cancel", style: "cancel", onPress: () => setShowManual(true) },
              { text: "Sign in Fresh", onPress: () => { void handleOAuth(true); } },
            ]
          );
        }
      } else if (result.type === "cancel" || result.type === "dismiss") {
        if (platform === "instagram") {
          Alert.alert(
            "Authentication Closed",
            "Instagram requires a Professional or Creator account — free and reversible in Instagram Settings. Tap \"Open Instagram to Switch\" to convert your account, then come back and try again.",
            [
              { text: "OK", style: "cancel", onPress: () => setShowManual(true) },
              { text: "Open Instagram to Switch", onPress: () => { void Linking.openURL("https://www.instagram.com/accounts/convert_to_business/"); } },
              { text: "Try Again", onPress: () => { void handleOAuth(); } },
            ]
          );
        } else {
          setShowManual(true);
        }
      }
    } catch {
      setShowManual(true);
    } finally {
      setOauthLoading(false);
    }
  }, [platform, onConnected]);

  const togglePhoto = useCallback((url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  }, []);

  const confirmPhotos = useCallback(() => {
    const urls = Array.from(selectedUrls);
    if (urls.length > 0) {
      // Show consent modal before processing any photos for fingerprinting
      void showConsentIfNeeded(() => {
        if (onPhotosPicked) onPhotosPicked(platform, urls);
        setPhotosConfirmed(true);
      });
    } else {
      // No photos selected — no photo processing, skip consent gate
      setPhotosConfirmed(true);
    }
  }, [selectedUrls, platform, onPhotosPicked, showConsentIfNeeded]);

  const cfg = ONBOARDING_OAUTH[platform];
  const platformColor = cfg?.color ?? "#3B82F6";
  const snapchatText = platform === "snapchat" ? "#000" : "#fff";

  /** Shared modal dismiss handler — fires postConsentRef action then resets. */
  const dismissConsentModal = useCallback((proceed: boolean) => {
    setConsentModalVisible(false);
    const action = postConsentRef.current;
    postConsentRef.current = null;
    if (proceed && action) action();
    else if (!proceed && action) action(); // Skip also proceeds — just without consent
  }, []);

  // ── Connected state ──────────────────────────────────────────────────────
  if (isConnected) {
    return (
      <>
        <View style={[ph.outerCard, { backgroundColor: colors.card, borderColor: colors.success + "44" }]}>
          {/* Connected header */}
          <View style={[ph.connectedRow]}>
            <View style={[ph.platIcon, { backgroundColor: platformColor + "20" }]}>
              <PlatformIcon platform={platform as NonNullable<SocialPlatform>} size={22} />
            </View>
            <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 }]}>{label}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[{ color: colors.success, fontFamily: "Inter_500Medium", fontSize: 13 }]}>Connected</Text>
            </View>
          </View>

          {/* Photo picker — platform media or camera roll fallback */}
          {!photosConfirmed && mediaLoading && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }]}>Loading your photos…</Text>
            </View>
          )}
          {!photosConfirmed && !mediaLoading && mediaItems.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }]}>
                Select your reference photos for scanning:
              </Text>
              <FlatList
                data={mediaItems}
                keyExtractor={(item) => item.id}
                numColumns={3}
                scrollEnabled={false}
                columnWrapperStyle={{ gap: 8 }}
                contentContainerStyle={{ gap: 8 }}
                renderItem={({ item }) => {
                  const selected = selectedUrls.has(item.thumbnailUrl);
                  return (
                    <TouchableOpacity
                      style={[ph.photoCell, { width: PHOTO_CELL, height: PHOTO_CELL, borderColor: selected ? colors.primary : "transparent", borderWidth: selected ? 2 : 0 }]}
                      onPress={() => togglePhoto(item.thumbnailUrl)}
                      activeOpacity={0.8}
                    >
                      <RNImage source={{ uri: item.thumbnailUrl }} style={{ width: "100%", height: "100%", borderRadius: 10 }} resizeMode="cover" />
                      {selected && (
                        <View style={[ph.photoCheck, { backgroundColor: colors.primary }]}>
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
              <TouchableOpacity
                style={[ph.photoConfirmBtn, { backgroundColor: selectedUrls.size > 0 ? colors.primary : colors.secondary, borderColor: colors.border }]}
                onPress={confirmPhotos}
                activeOpacity={0.85}
              >
                <Text style={[{ color: selectedUrls.size > 0 ? "#fff" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>
                  {selectedUrls.size > 0 ? `Use ${selectedUrls.size} photo${selectedUrls.size !== 1 ? "s" : ""} for scan` : "Skip — use profile photo only"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {photosConfirmed && selectedUrls.size > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="images" size={14} color={colors.success} />
              <Text style={[{ color: colors.success, fontFamily: "Inter_400Regular", fontSize: 13 }]}>
                {selectedUrls.size} reference photo{selectedUrls.size !== 1 ? "s" : ""} added
              </Text>
            </View>
          )}
        </View>

        {/* Photo processing consent modal */}
        <PhotoConsentModal
          visible={consentModalVisible}
          onConsent={() => dismissConsentModal(true)}
          onSkip={() => dismissConsentModal(false)}
        />
      </>
    );
  }

  // ── Not yet connected ────────────────────────────────────────────────────
  return (
    <>
      <View style={[ph.outerCard, { backgroundColor: colors.card, borderColor: (handle || showManual) ? colors.primary + "55" : colors.border }]}>
        <View style={ph.platformHeader}>
          <View style={[ph.platIcon, { backgroundColor: platformColor + "20" }]}>
            <PlatformIcon platform={platform as NonNullable<SocialPlatform>} size={22} />
          </View>
          <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 }]}>{label}</Text>
        </View>
        <ScaleButton
          style={[ph.oauthBtn, { backgroundColor: platformColor, opacity: oauthLoading ? 0.7 : 1 }]}
          onPress={handleOAuth}
          disabled={oauthLoading}
          activeOpacity={0.85}
        >
          {oauthLoading ? (
            <ActivityIndicator size="small" color={platform === "snapchat" ? "#000" : "#fff"} />
          ) : (
            <>
              <Ionicons name="log-in-outline" size={16} color={snapchatText} />
              <Text style={[{ color: snapchatText, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>Connect with {label}</Text>
            </>
          )}
        </ScaleButton>
        {platform === "instagram" && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 2 }}>
            <Ionicons name="information-circle-outline" size={12} color="#6B7280" />
            <Text style={{ color: "#6B7280", fontFamily: "Inter_400Regular", fontSize: 11, flex: 1 }}>
              Requires a Professional or Creator account — free and reversible in Instagram Settings.{" "}
            </Text>
            <TouchableOpacity onPress={() => { void Linking.openURL("https://www.instagram.com/accounts/convert_to_business/"); }}>
              <Text style={{ color: "#E1306C", fontFamily: "Inter_500Medium", fontSize: 11 }}>Switch →</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity onPress={() => setShowManual((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center" }}>
          <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }]}>
            {showManual ? "Hide manual entry" : "Or enter @handle manually"}
          </Text>
          <Ionicons name={showManual ? "chevron-up" : "chevron-down"} size={12} color={colors.mutedForeground} />
        </TouchableOpacity>
        {showManual && (
          <View style={[ph.manualRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Ionicons name="at" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[{ flex: 1, color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14 }]}
              placeholder="username"
              placeholderTextColor={colors.mutedForeground + "88"}
              value={handle}
              onChangeText={onHandleChange}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />
            {handle.length > 0 && (
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            )}
          </View>
        )}
      </View>

      {/* Photo processing consent modal (shown if connect triggers without prior consent) */}
      <PhotoConsentModal
        visible={consentModalVisible}
        onConsent={() => dismissConsentModal(true)}
        onSkip={() => dismissConsentModal(false)}
      />
    </>
  );
}
// PlatformHandlesScreen merged into FullProfileSetupScreen (step 8)
const ph = StyleSheet.create({
  outerCard:       { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  connectedRow:    { flexDirection: "row", alignItems: "center", gap: 12 },
  platformCard:    { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  platformHeader:  { flexDirection: "row", alignItems: "center", gap: 12 },
  platIcon:        { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  oauthBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 44, borderRadius: 12 },
  manualRow:       { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  photoCell:       { borderRadius: 10, overflow: "hidden", position: "relative" },
  photoCheck:      { position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  photoConfirmBtn: { height: 42, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});

// ─── S13: Scan Setup (real) ───────────────────────────────────────────────────
const SCAN_STEPS = ["Setting up your profile", "Checking for threats", "Building your results", "Finalizing scan"];
function ScanSetupScreen({ colors, onDone }: { colors: ReturnType<typeof useColors>; onDone: (threatCount: number) => void }) {
  const [completed, setCompleted] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const hasStarted = useRef(false);
  const wasScanning = useRef(false);
  const scanStartedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const { startScan, isScanning, scanProgress, scanQuotaError } = useApp();

  useEffect(() => {
    Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true })).start();
    if (!hasStarted.current) {
      hasStarted.current = true;
      // Brief delay so the transition from step 10 fully settles before the scan fires.
      // This also prevents any residual OAuth-browser-dismissal state from interfering.
      const startDelay = setTimeout(() => {
        Promise.resolve(startScan()).catch(() => {});
      }, 1200);
      return () => {
        clearTimeout(startDelay);
        if (scanStartedTimer.current) clearTimeout(scanStartedTimer.current);
      };
    }
    // Fallback A: scan never started within 16s (API error / quota)
    const fallback = setTimeout(() => { if (!wasScanning.current) onDoneRef.current(0); }, 16000);
    return () => {
      clearTimeout(fallback);
      if (scanStartedTimer.current) clearTimeout(scanStartedTimer.current);
    };
  }, []);

  useEffect(() => {
    if (isScanning) {
      wasScanning.current = true;
      const frac = Math.max(0, Math.min(1, scanProgress / 100));
      const idx = Math.min(SCAN_STEPS.length - 1, Math.floor(frac * SCAN_STEPS.length));
      setActiveStep(idx);
      setCompleted(Array.from({ length: idx }, (_, i) => i));
      Animated.timing(progressAnim, { toValue: frac, duration: 300, useNativeDriver: false }).start();
      // Fallback B: scan started but never finished — 55s max wait
      if (!scanStartedTimer.current) {
        scanStartedTimer.current = setTimeout(async () => {
          let count = 0;
          try { const threats = await listThreats({ resolved: false }); count = threats.length; } catch { /* ignore */ }
          onDoneRef.current(count);
        }, 55000);
      }
    } else if (wasScanning.current) {
      if (scanStartedTimer.current) { clearTimeout(scanStartedTimer.current); scanStartedTimer.current = null; }
      wasScanning.current = false;
      setCompleted(SCAN_STEPS.map((_, i) => i));
      setActiveStep(SCAN_STEPS.length);
      Animated.timing(progressAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start(async () => {
        let count = 0;
        try { const threats = await listThreats({ resolved: false }); count = threats.length; } catch { /* ignore */ }
        setTimeout(() => onDoneRef.current(count), 400);
      });
    } else if (scanQuotaError) {
      onDoneRef.current(0);
    }
  }, [isScanning, scanProgress, progressAnim, scanQuotaError]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={[s.screenPad, { flex: 1, alignItems: "center", justifyContent: "center", gap: 32 }]}>
      <LinearGradient colors={["#3B82F622", "#8B5CF611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={sc.rings}>
        <ScanPulse size={200} active={true} />
        <Animated.View style={{ position: "absolute", transform: [{ rotate: spin }] }}>
          <View style={[sc.spinner, { borderColor: colors.primary + "44", borderTopColor: colors.primary }]} />
        </Animated.View>
        <Ionicons name="shield-checkmark" size={36} color={colors.primary} style={sc.shield} />
      </View>
      <View style={{ gap: 8, alignItems: "center" }}>
        <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: "center" }]}>Scanning for your digital fingerprint…</Text>
        <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>AI is building your unique identity profile</Text>
      </View>
      <View style={[sc.track, { backgroundColor: colors.border, width: "100%" }]}>
        <Animated.View style={[sc.fill, { width: progressWidth, backgroundColor: colors.primary }]} />
      </View>
      <View style={{ gap: 14, width: "100%" }}>
        {SCAN_STEPS.map((step, i) => {
          const done = completed.includes(i);
          const active = activeStep === i;
          return (
            <View key={step} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={[sc.dot, { backgroundColor: done ? colors.success : active ? colors.primary : colors.secondary, borderColor: done ? colors.success : active ? colors.primary : colors.border }]}>
                {done ? <Ionicons name="checkmark" size={10} color="#fff" /> : active ? <View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }]} /> : null}
              </View>
              <Text style={[{ color: done || active ? colors.foreground : colors.mutedForeground, fontFamily: done || active ? "Inter_500Medium" : "Inter_400Regular", fontSize: 14, flex: 1 }]}>{step}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
const sc = StyleSheet.create({
  rings: { width: 200, height: 200, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderWidth: 1 },
  spinner: { width: 76, height: 76, borderRadius: 38, borderWidth: 3 },
  shield: { position: "absolute" },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});

// ─── S14: Result Reveal (real threat count) ────────────────────────────────────
function UrgencyRevealScreen({ colors, threatCount, userType, followerRange }: { colors: ReturnType<typeof useColors>; threatCount: number; userType: string | null; followerRange: string | null }) {
  const [displayCount, setDisplayCount] = useState(0);
  const fade          = useRef(new Animated.Value(0)).current;
  const cardAnims     = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const pulse         = useRef(new Animated.Value(1)).current;
  const shieldEntrance = useRef(new Animated.Value(0)).current;
  const shieldPulse    = useRef(new Animated.Value(1)).current;
  const rm = useReduceMotion();

  // Declare hasThreats early so all effects below can reference it
  const hasThreats = threatCount > 0;
  const userTypeLabel = USER_TYPES.find((t) => t.id === userType)?.label ?? null;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.stagger(150, cardAnims.map((a) => Animated.spring(a, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }))).start();
    if (!rm) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.02, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])).start();
    }
    if (rm || threatCount === 0) { setDisplayCount(threatCount); return; }
    const steps = Math.min(threatCount, 8);
    const stepSize = Math.ceil(threatCount / steps);
    let current = 0;
    const iv = setInterval(() => {
      current = Math.min(current + stepSize, threatCount);
      setDisplayCount(current);
      if (current >= threatCount) clearInterval(iv);
    }, 100);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!hasThreats && !rm) {
      Animated.spring(shieldEntrance, { toValue: 1, ...MOTION.spring_bouncy, useNativeDriver: true }).start(() => {
        Animated.loop(Animated.sequence([
          Animated.timing(shieldPulse, { toValue: 1.06, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(shieldPulse, { toValue: 1,    duration: 1200, useNativeDriver: true }),
        ])).start();
      });
    } else if (!hasThreats) {
      shieldEntrance.setValue(1);
    }
  }, [hasThreats, rm]);
  const MOCK_CARDS = [
    { platform: "instagram" as NonNullable<SocialPlatform>, label: "Account flagged" },
    { platform: "facebook" as NonNullable<SocialPlatform>, label: "Potential match" },
    { platform: "x" as NonNullable<SocialPlatform>, label: "Suspicious activity" },
  ];
  const visibleCards = MOCK_CARDS.slice(0, hasThreats ? Math.min(3, threatCount + 1) : 2);
  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { gap: 24 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={[hasThreats ? "#EF444414" : "#10B98110", "#3B82F608", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Animated.View style={{ opacity: fade, gap: 12 }}>
        <View style={[ur.badge, { backgroundColor: colors.success + "14", borderColor: colors.success + "33" }]}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={[{ color: colors.success, fontFamily: "Inter_500Medium", fontSize: 13 }]}>Scan complete</Text>
        </View>
        {hasThreats ? (
          <>
            <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              We found{" "}<Text style={{ color: "#EF4444" }}>{displayCount} potential match{displayCount !== 1 ? "es" : ""}</Text>.
            </Text>
            <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {userTypeLabel
                ? `Your ${userTypeLabel} profile matched ${threatCount} account${threatCount !== 1 ? "s" : ""} in our scan. Unlock your full report to see each one.`
                : "Unlock your full identity report to see exactly where — and what to do about it."}
            </Text>
          </>
        ) : (
          <>
            <Animated.View style={{ alignItems: "center", marginBottom: 8, opacity: shieldEntrance, transform: [{ scale: shieldEntrance }, { scale: shieldPulse }] }}>
              <View style={{ width: 84, height: 84, borderRadius: 26, backgroundColor: colors.success + "18", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.success + "44" }}>
                <Ionicons name="shield-checkmark" size={46} color={colors.success} />
              </View>
            </Animated.View>
            <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Your initial scan looks clean.</Text>
            <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>No matches found yet — but impersonators don't wait. Continuous monitoring keeps you protected as new threats emerge.</Text>
          </>
        )}
      </Animated.View>
      {hasThreats && (
        <View style={{ gap: 10 }}>
          {visibleCards.map((card, i) => (
            <Animated.View key={i} style={{ opacity: cardAnims[i], transform: [{ translateY: cardAnims[i]!.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }, ...(i === 0 ? [{ scale: pulse }] : [])] }}>
              <GlassCard style={[ur.blurCard, { borderColor: i === 0 ? "#EF444444" : colors.border }]}>
                <View style={ur.cardLeft}>
                  <View style={[ur.platBadge, { backgroundColor: colors.secondary }]}><PlatformIcon platform={card.platform} size={20} /></View>
                  <View style={{ gap: 4, flex: 1 }}>
                    <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>{card.label}</Text>
                    <View style={{ gap: 3 }}>
                      <View style={[{ height: 8, width: 110, borderRadius: 4, backgroundColor: colors.mutedForeground + "30" }]} />
                      <View style={[{ height: 8, width: 70, borderRadius: 4, backgroundColor: colors.mutedForeground + "20" }]} />
                    </View>
                  </View>
                </View>
                <View style={[ur.lock, { backgroundColor: colors.secondary, borderColor: colors.border }]}><Ionicons name="lock-closed" size={14} color={colors.mutedForeground} /></View>
              </GlassCard>
            </Animated.View>
          ))}
          <View style={[ur.more, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Ionicons name="ellipsis-horizontal" size={14} color={colors.mutedForeground} />
            <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, flex: 1 }]}>Full report locked — unlock to see all results</Text>
            <Ionicons name="lock-closed" size={12} color={colors.mutedForeground} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}
const ur = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  blurCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  platBadge: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  lock: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  more: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
});

// ─── S15: Report Bridge ────────────────────────────────────────────────────────
function ReportBridgeScreen({ colors, threatCount, userType, platformCount }: {
  colors: ReturnType<typeof useColors>;
  threatCount: number;
  userType: string | null;
  platformCount: number;
}) {
  const fade       = useRef(new Animated.Value(0)).current;
  const summaryAnim = useRef(new Animated.Value(0)).current;
  const featAnims   = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  const rm = useReduceMotion();

  useEffect(() => {
    if (rm) { fade.setValue(1); summaryAnim.setValue(1); featAnims.forEach(a => a.setValue(1)); return; }
    Animated.sequence([
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(summaryAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.stagger(90, featAnims.map(a => Animated.timing(a, { toValue: 1, duration: 320, easing: Easing.out(Easing.ease), useNativeDriver: true }))),
    ]).start();
  }, []);

  const summaryY = summaryAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const userTypeLabel = USER_TYPES.find((t) => t.id === userType)?.label ?? null;
  const LOCKED_FEATURES = ["Scheduled daily scans", "Takedown request assistance", "30-day threat history", "Push alerts when matches are found"];
  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { gap: 24 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#3B82F618", "#8B5CF610", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Animated.View style={{ opacity: fade, gap: 24 }}>
        <View style={{ gap: 10 }}>
          <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Your Identity Protection{"\n"}Report is ready.</Text>
          <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Free accounts get a one-time scan. Rook Premium schedules daily scans across connected platforms.</Text>
        </View>
        <Animated.View style={{ opacity: summaryAnim, transform: [{ translateY: summaryY }] }}>
          <GlassCard style={{ gap: 14, borderColor: colors.primary + "33" }}>
            <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>Scan Summary</Text>
            <View style={{ gap: 10 }}>
              {[
                { label: "Platforms scanned", value: platformCount > 0 ? String(platformCount) : "All major platforms", icon: "grid-outline" },
                { label: "Matches found", value: threatCount > 0 ? String(threatCount) : "None detected yet", icon: "alert-circle-outline", color: threatCount > 0 ? "#EF4444" : colors.success },
                { label: "Scan type", value: "Full identity sweep", icon: "shield-checkmark-outline" },
              ].map((row) => (
                <View key={row.label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Ionicons name={row.icon as any} size={16} color={row.color ?? colors.primary} />
                  <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, flex: 1 }]}>{row.label}</Text>
                  <Text style={[{ color: row.color ?? colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }]}>{row.value}</Text>
                </View>
              ))}
            </View>
          </GlassCard>
        </Animated.View>
        <GlassCard style={{ gap: 12, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="lock-closed" size={14} color={colors.mutedForeground} />
            <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }]}>Premium features — unlock with trial</Text>
          </View>
          {LOCKED_FEATURES.map((f, i) => (
            <Animated.View key={f} style={{ opacity: featAnims[i] ?? 1, transform: [{ translateX: (featAnims[i] ?? new Animated.Value(1)).interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, opacity: 0.5 }}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={[{ color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14 }]}>{f}</Text>
                <Ionicons name="lock-closed" size={12} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
              </View>
            </Animated.View>
          ))}
        </GlassCard>
      </Animated.View>
    </ScrollView>
  );
}

// ─── Main Onboarding Component ─────────────────────────────────────────────────
export default function Onboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const rm = useReduceMotion();
  const { completeOnboarding, addIndexedPhotos } = useApp();
  const [step, setStep] = useState(0);
  const fadeAnim    = useRef(new Animated.Value(1)).current;
  const slideAnim   = useRef(new Animated.Value(0)).current;
  const ambientAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (rm) return;
    Animated.loop(Animated.sequence([
      Animated.timing(ambientAnim, { toValue: 1, duration: 5000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(ambientAnim, { toValue: 0, duration: 5000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ])).start();
  }, [rm]);

  const [answers, setAnswers] = useState<OnboardingAnswers>({
    primaryConcern: null,
    goalFollowUp: null,
    userType: null,
    typeFollowUp: null,
    followerRange: null,
    activePlatforms: [],
    attribution: null,
    perceivedRisk: null,
    identityInput: null,
    platformHandles: {},
  });
  const [identityInput, setIdentityInput] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | undefined>(undefined);
  const [platformHandles, setPlatformHandles] = useState<Record<string, string>>({});
  const [isAddingAccounts, setIsAddingAccounts] = useState(false);
  const [scanThreatCount, setScanThreatCount] = useState(0);
  const [oauthConnectedPlatforms, setOauthConnectedPlatforms] = useState<Set<string>>(new Set());

  const handleOAuthConnected = useCallback((platform: string, _accountId: string) => {
    setOauthConnectedPlatforms((prev) => new Set([...prev, platform]));
    if (!selectedPlatforms.includes(platform)) {
      setSelectedPlatforms((p) => [...p, platform]);
    }
  }, [selectedPlatforms]);

  const handlePhotosPicked = useCallback(async (platform: string, urls: string[]) => {
    if (!addIndexedPhotos) return;
    try {
      await addIndexedPhotos(urls.map((uri) => ({ uri })));
    } catch { /* silent — photos still available via platform sync */ }
  }, [addIndexedPhotos]);

  useEffect(() => { analytics.onboardingStarted(); }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const animateToStep = useCallback((next: number) => {
    if (rm) {
      // Reduce-motion: simple cross-fade only, no slide
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
        setStep(next);
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      });
      return;
    }
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0,   duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -14, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slideAnim.setValue(14);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 120, friction: 14, useNativeDriver: true }),
      ]).start();
    });
  }, [fadeAnim, slideAnim, rm]);

  const handleAutoAdvance = useCallback((next: number) => {
    setTimeout(() => animateToStep(next), 280);
  }, [animateToStep]);

  const handlePhotoSelect = useCallback(async (uri: string, b64?: string) => {
    if (!uri) { setPhotoUri(null); setPhotoBase64(undefined); return; }
    setPhotoUri(uri);
    setPhotoBase64(b64);
    if (b64) {
      addIndexedPhotos([{ uri, base64: b64 }]);
      // Also save as avatar so threat comparison can show the user's reference photo
      try { await uploadAvatar(b64); } catch { /* graceful — avatarUrl stays null */ }
    }
  }, [addIndexedPhotos]);

  const handleTogglePlatform = useCallback((id: string) => {
    setSelectedPlatforms((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }, []);

  const handleHandleChange = useCallback((platformId: string, value: string) => {
    setPlatformHandles((prev) => ({ ...prev, [platformId]: value }));
  }, []);

  const addAccountsForHandles = useCallback(async () => {
    const filled = Object.entries(platformHandles).filter(([, v]) => v.trim().length > 0);
    if (filled.length === 0) return;
    setIsAddingAccounts(true);
    await Promise.allSettled(
      filled.map(([platform, handle]) =>
        addAccount(platform, handle.replace(/^@/, "").trim())
      )
    );
    setIsAddingAccounts(false);
  }, [platformHandles]);

  const saveAndFinish = useCallback(async (finalAnswers: OnboardingAnswers): Promise<boolean> => {
    try {
      await saveOnboardingAnswers(finalAnswers as unknown as Record<string, unknown>);
      await AsyncStorage.setItem("onboardingAnswers", JSON.stringify(finalAnswers));
      completeOnboarding();
      analytics.onboardingCompleted({
        user_type: finalAnswers.userType ?? undefined,
        platform_count: finalAnswers.activePlatforms.length,
        attribution: finalAnswers.attribution ?? undefined,
      });
      return true;
    } catch {
      Alert.alert(
        "Couldn’t save your setup",
        "Please check your connection and try again. Your onboarding will stay open until it is saved.",
      );
      return false;
    }
  }, [completeOnboarding]);

  const buildFinalAnswers = useCallback((): OnboardingAnswers => ({
    ...answers,
    identityInput: identityInput || null,
    activePlatforms: selectedPlatforms,
    platformHandles,
  }), [answers, identityInput, selectedPlatforms, platformHandles]);

  const handleNext = useCallback(async () => {
    if (step === 8) {
      await addAccountsForHandles();
      animateToStep(9);
      return;
    }
    if (step < TOTAL_STEPS - 1) {
      animateToStep(step + 1);
    } else {
      const finalAnswers = buildFinalAnswers();
      if (await saveAndFinish(finalAnswers)) {
        router.replace({ pathname: "/subscription", params: { fromOnboarding: "1", threatCount: String(scanThreatCount) } } as any);
      }
    }
  }, [step, addAccountsForHandles, animateToStep, buildFinalAnswers, saveAndFinish, scanThreatCount]);

  const handleSkip = useCallback(async () => {
    const finalAnswers = buildFinalAnswers();
    if (await saveAndFinish(finalAnswers)) {
      analytics.onboardingSkipped({ at_step: step });
      // Route to paywall — skipping the questionnaire doesn't skip the subscription
      // screen. The paywall has its own close/X that drops to free tier.
      router.replace({ pathname: "/subscription", params: { fromOnboarding: "1", threatCount: "0" } } as any);
    }
  }, [buildFinalAnswers, step, saveAndFinish]);

  const handleMaybeLater = useCallback(async () => {
    const finalAnswers = buildFinalAnswers();
    if (await saveAndFinish(finalAnswers)) {
      // Same as skip — show the paywall rather than bypassing it entirely.
      router.replace({ pathname: "/subscription", params: { fromOnboarding: "1", threatCount: "0" } } as any);
    }
  }, [buildFinalAnswers, saveAndFinish]);

  // Steps that auto-advance on selection — no footer CTA shown
  const AUTO_STEPS = new Set([3]);
  const NO_FOOTER_STEPS = new Set([10]); // ScanSetupScreen auto-advances; all other steps show footer
  const isAutoStep = AUTO_STEPS.has(step);
  const isNoFooter = NO_FOOTER_STEPS.has(step);
  const isLastStep = step === TOTAL_STEPS - 1;

  const canContinue = (): boolean => {
    // Step 8 = FullProfileSetupScreen — must have a name, connected platform, handle, or photo
    if (step === 8) return (
      identityInput.trim().length > 0 ||
      oauthConnectedPlatforms.size > 0 ||
      Object.values(platformHandles).some((v) => v.trim().length > 0) ||
      !!photoUri
    );
    return true;
  };

  const getCtaLabel = (): string => {
    if (step === 0) return "Find Out If I'm Exposed";
    if (step === 2) return "Start My Assessment";
    if (step === 8) return isAddingAccounts ? "Connecting…" : "Save & Continue";
    if (step === 9) return "Start My Scan";
    if (step === 12) return "Unlock Full Protection";
    return "Continue";
  };

  const renderStep = () => {
    switch (step) {
      // ── Hook + credibility + assessment intro ──
      case 0:  return <BrandHookScreen colors={colors} />;
      case 1:  return <CredibleStatScreen colors={colors} />;
      case 2:  return <AssessmentIntroScreen colors={colors} />;
      // ── Personalisation quiz (auto-advances to step 4) ──
      case 3:  return (
        <CombinedQuizScreen
          colors={colors}
          selectedConcern={answers.primaryConcern}
          selectedGoalFollowUp={answers.goalFollowUp}
          selectedUserType={answers.userType}
          selectedTypeFollowUp={answers.typeFollowUp}
          selectedFollowerRange={answers.followerRange}
          onSelect={(field, id) => {
            setAnswers((a) => ({ ...a, [field]: id }));
            if (field === "followerRange") handleAutoAdvance(4);
          }}
        />
      );
      // ── Education block (motivate before asking for data) ──
      case 4:  return <ProofVisualScreen colors={colors} />;
      case 5:  return <HowRookProtectsScreen colors={colors} />;
      case 6:  return <PrivacyScreen colors={colors} />;
      case 7:  return <SocialProofScreen colors={colors} />;
      // ── Data collection + account setup + scan ──
      case 8:  return <FullProfileSetupScreen colors={colors} nameValue={identityInput} onNameChange={setIdentityInput} handles={platformHandles} onHandleChange={handleHandleChange} isAddingAccounts={isAddingAccounts} connectedPlatforms={oauthConnectedPlatforms} onOAuthConnected={handleOAuthConnected} onPhotosPicked={handlePhotosPicked} photoUri={photoUri} onPhotoSelect={handlePhotoSelect} />;
      case 9:  return <ProfileSavedScreen colors={colors} identityInput={identityInput} selectedPlatforms={[...new Set([...selectedPlatforms, ...Object.keys(platformHandles).filter((k) => (platformHandles[k] ?? "").trim().length > 0)])]} hasPhoto={!!photoUri} />;
      // ── Scan + results + paywall bridge ──
      case 10: return <ScanSetupScreen colors={colors} onDone={(count) => { setScanThreatCount(count); animateToStep(11); }} />;
      case 11: return <UrgencyRevealScreen colors={colors} threatCount={scanThreatCount} userType={answers.userType} followerRange={answers.followerRange} />;
      case 12: return <ReportBridgeScreen colors={colors} threatCount={scanThreatCount} userType={answers.userType} platformCount={selectedPlatforms.length} />;
      default: return null;
    }
  };

  const showFooter = !isAutoStep && !isNoFooter;

  const ambientOpacity = ambientAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.032] });

  return (
    <View style={[{ flex: 1 }, { backgroundColor: colors.background }]}>
      {/* Slow-breathing ambient glow — subtle blue warmth cycling in background */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary, opacity: ambientOpacity }]} pointerEvents="none" />
      <View style={[s.header, { paddingTop: topPad + 16 }]}>
        {/* Back + Skip row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {step > 0 ? (
            <TouchableOpacity onPress={() => animateToStep(step - 1)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="chevron-back" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : <View style={{ width: 22 }} />}
          {step > 0 && step < 8 && !isAutoStep ? (
            <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14 }]}>Skip</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 22 }} />}
        </View>
        <ProgressBar step={step} colors={colors} />
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
        {renderStep()}
      </Animated.View>

      {showFooter && (
        <View style={[s.footer, { paddingBottom: bottomPad + 16 }]}>
          {isLastStep ? (
            <>
              <ScaleButton style={[s.cta, { backgroundColor: colors.primary }]} activeOpacity={0.85} onPress={handleNext}>
                <Ionicons name="lock-open" size={18} color="#fff" />
                <Text style={[s.ctaText, { fontFamily: "Inter_700Bold", color: "#fff" }]}>Unlock Full Protection</Text>
              </ScaleButton>
              <TouchableOpacity onPress={handleMaybeLater} style={{ alignItems: "center" }}>
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }]}>Maybe later — continue with free plan</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ScaleButton
              style={[s.cta, { backgroundColor: canContinue() && !isAddingAccounts ? colors.primary : colors.secondary, opacity: canContinue() && !isAddingAccounts ? 1 : 0.6 }]}
              activeOpacity={0.85}
              onPress={canContinue() && !isAddingAccounts ? handleNext : undefined}
              disabled={isAddingAccounts}
            >
              {isAddingAccounts
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <>
                    <Text style={[s.ctaText, { color: canContinue() ? "#fff" : colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{getCtaLabel()}</Text>
                    {canContinue() && <Ionicons name="arrow-forward" size={18} color="#fff" />}
                  </>}
            </ScaleButton>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Shared Styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1 },
  screenPad: { padding: 24, gap: 20 },
  header: { paddingHorizontal: 24, paddingBottom: 12, gap: 10 },
  footer: { paddingHorizontal: 24, gap: 12 },
  title: { fontSize: 26, lineHeight: 34 },
  sub: { fontSize: 14, lineHeight: 22 },
  cta: { height: 56, borderRadius: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  ctaText: { fontSize: 16 },
});
