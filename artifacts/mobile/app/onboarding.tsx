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
import { saveOnboardingAnswers, addAccount, listThreats, getOAuthState, getXOAuthInit, getOAuthRedirectUris, getAccounts, getAccountMedia, type AccountMediaItem } from "@/lib/api";
import * as WebBrowser from "expo-web-browser";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Platform as SocialPlatform } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { PlatformIcon } from "@/components/PlatformIcon";
import { analytics } from "@/lib/analytics";

const { width } = Dimensions.get("window");
const TOTAL_STEPS = 16;

export interface OnboardingAnswers {
  primaryConcern: string | null;
  userType: string | null;
  followerRange: string | null;
  activePlatforms: string[];
  attribution: string | null;
  perceivedRisk: number | null;
  identityInput: string | null;
  platformHandles: Record<string, string>;
}

// ─── Segmented Progress Bar ──────────────────────────────────────────────────
function ProgressBar({ step, colors }: { step: number; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[pb.bar]}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[pb.seg, {
            flex: 1,
            marginRight: i < TOTAL_STEPS - 1 ? 2 : 0,
            backgroundColor: i <= step ? colors.primary : colors.border,
            opacity: i > step ? 0.35 : 1,
          }]}
        />
      ))}
    </View>
  );
}
const pb = StyleSheet.create({
  bar: { flexDirection: "row", height: 3, borderRadius: 2 },
  seg: { height: 3, borderRadius: 1 },
});

// ─── S0: Brand Hook ───────────────────────────────────────────────────────────
function BrandHookScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  const particles = useRef(
    Array.from({ length: 22 }, (_, i) => ({
      anim: new Animated.Value(0),
      x: Math.cos((i / 22) * Math.PI * 2) * (50 + (i % 3) * 24),
      y: Math.sin((i / 22) * Math.PI * 2) * (50 + (i % 3) * 24),
      delay: i * 70,
      size: i % 4 === 0 ? 5 : i % 4 === 1 ? 3 : 2,
    }))
  ).current;
  const glow = useRef(new Animated.Value(0)).current;
  const shield = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 2600, useNativeDriver: true }),
    ])).start();
    Animated.spring(shield, { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }).start();
    particles.forEach((p) => {
      const run = () => {
        p.anim.setValue(0);
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.anim, { toValue: 1, duration: 2400 + p.delay * 3, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(p.anim, { toValue: 0.25, duration: 1800, useNativeDriver: true }),
        ]).start(run);
      };
      run();
    });
  }, []);

  const glowOp = glow.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.32] });
  const shieldScale = shield.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <View style={[s.screenPad, { flex: 1, justifyContent: "center" }]}>
      <LinearGradient colors={["#1E3A5F44", "#3B82F611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={{ alignItems: "center", gap: 44 }}>
        <View style={hook.orb}>
          {particles.map((p, i) => (
            <Animated.View key={i} style={{ position: "absolute", width: p.size, height: p.size, borderRadius: p.size / 2, backgroundColor: colors.primary, opacity: p.anim, transform: [{ translateX: p.x }, { translateY: p.y }] }} />
          ))}
          <Animated.View style={[hook.glowRing, { borderColor: colors.primary, opacity: glowOp }]} />
          <Animated.View style={[hook.glowRingInner, { borderColor: colors.primary + "55", opacity: glowOp }]} />
          <Animated.View style={{ transform: [{ scale: shieldScale }] }}>
            <View style={[hook.shieldBg, { backgroundColor: colors.primary + "1A" }]}>
              <Ionicons name="shield-checkmark" size={56} color={colors.primary} />
            </View>
          </Animated.View>
        </View>
        <View style={{ gap: 14, alignItems: "center" }}>
          <Text style={[hook.headline, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Your name and face{"\n"}already exist online.
          </Text>
          <Text style={[hook.sub, { color: colors.foreground + "CC", fontFamily: "Inter_400Regular" }]}>
            The question is{" "}
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>who's using them.</Text>
          </Text>
          <Text style={[hook.body, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Rook is an AI identity monitor that finds impersonators, stolen photos, and fake accounts using your identity — usually before you'd ever notice on your own.
          </Text>
        </View>
      </View>
    </View>
  );
}
const hook = StyleSheet.create({
  orb: { width: 220, height: 220, alignItems: "center", justifyContent: "center" },
  glowRing: { position: "absolute", width: 170, height: 170, borderRadius: 85, borderWidth: 1 },
  glowRingInner: { position: "absolute", width: 125, height: 125, borderRadius: 63, borderWidth: 1 },
  shieldBg: { width: 96, height: 96, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  headline: { fontSize: 32, textAlign: "center", lineHeight: 40 },
  sub: { fontSize: 17, textAlign: "center" },
  body: { fontSize: 14, textAlign: "center", lineHeight: 22, maxWidth: 320 },
});

// ─── S1: Credible Stat ────────────────────────────────────────────────────────
function CredibleStatScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { gap: 24 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#EF444410", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={{ gap: 10 }}>
        <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Impersonation is one of the fastest-growing forms of online fraud.
        </Text>
        <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Fake accounts don't just borrow a name — they steal photos, copy bios, and message your real followers pretending to be you. Most people find out from someone else, days or weeks later.
        </Text>
      </View>
      <GlassCard style={[stat.card, { borderLeftColor: "#EF4444", borderLeftWidth: 3 }]}>
        <Text style={[stat.number, { color: "#EF4444", fontFamily: "Inter_700Bold" }]}>1 in 4</Text>
        <Text style={[stat.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Americans have experienced online identity fraud</Text>
        <Text style={[stat.src, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Source: FTC Consumer Sentinel Network Report</Text>
      </GlassCard>
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
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);
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
  const anims = useRef(USER_TYPES.map(() => new Animated.Value(0))).current;
  useEffect(() => { Animated.stagger(55, anims.map((a) => Animated.spring(a, { toValue: 1, tension: 120, friction: 9, useNativeDriver: true }))).start(); }, []);
  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { gap: 20 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#8B5CF611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Which of these sounds like you?</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {USER_TYPES.map((t, idx) => {
          const isSelected = selected === t.id;
          return (
            <Animated.View key={t.id} style={{ opacity: anims[idx], transform: [{ translateY: anims[idx]!.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }], width: (width - 60) / 2 }}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(t.id); }}
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
  const anims = useRef(ACCOUNT_RANGES.map(() => new Animated.Value(0))).current;
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
            <Animated.View key={r.id} style={{ opacity: anims[idx], transform: [{ translateY: anims[idx]!.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSelect(r.id); }}
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

// ─── S6: Identity + Platform Select + Photo Upload (combined) ─────────────────
const ALL_PLATFORMS: Array<{ id: NonNullable<SocialPlatform>; label: string }> = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "x", label: "X / Twitter" },
  { id: "facebook", label: "Facebook" },
  { id: "youtube", label: "YouTube" },
  { id: "snapchat", label: "Snapchat" },
  { id: "linkedin", label: "LinkedIn" },
];

function IdentityInputScreen({
  colors,
  nameValue,
  onNameChange,
  selectedPlatforms,
  onTogglePlatform,
  photoUri,
  onPhotoSelect,
}: {
  colors: ReturnType<typeof useColors>;
  nameValue: string;
  onNameChange: (v: string) => void;
  selectedPlatforms: string[];
  onTogglePlatform: (id: string) => void;
  photoUri: string | null;
  onPhotoSelect: (uri: string, base64?: string) => void;
}) {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(shimmer, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(shimmer, { toValue: 0, duration: 1800, useNativeDriver: true }),
    ])).start();
  }, []);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access so Rook can search for stolen images of you.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onPhotoSelect(asset.uri, asset.base64 ?? undefined);
    }
  };

  const shimOp = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0, 0.06] });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
      <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { gap: 24 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={["#3B82F622", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={{ gap: 8 }}>
          <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Now let's find out{"\n"}what's out there about you.</Text>
          <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Enter your name or @handle, select your platforms, and optionally add a photo for stolen image detection.</Text>
        </View>

        {/* Name / handle */}
        <View style={inp.wrap}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary, opacity: shimOp, borderRadius: 14 }]} pointerEvents="none" />
          <View style={[inp.row, { backgroundColor: colors.card, borderColor: nameValue.length > 0 ? colors.primary + "66" : colors.border, borderWidth: nameValue.length > 0 ? 1.5 : 1 }]}>
            <Ionicons name="person-circle-outline" size={22} color={nameValue.length > 0 ? colors.primary : colors.mutedForeground} />
            <TextInput style={[inp.input, { color: colors.foreground, fontFamily: "Inter_500Medium" }]} placeholder="Your name or @handle" placeholderTextColor={colors.mutedForeground} value={nameValue} onChangeText={onNameChange} autoCapitalize="none" autoCorrect={false} returnKeyType="done" />
            {nameValue.length > 0 && <TouchableOpacity onPress={() => onNameChange("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close-circle" size={18} color={colors.mutedForeground} /></TouchableOpacity>}
          </View>
        </View>

        {/* Photo upload */}
        <View style={{ gap: 10 }}>
          <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>Profile photo{" "}<Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>(optional — detects stolen images)</Text></Text>
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8}>
            {photoUri ? (
              <View style={[inp.photoFilled, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "55" }]}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={[{ color: colors.success, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 }]}>Photo added — we'll search for copies</Text>
                <TouchableOpacity onPress={() => onPhotoSelect("", undefined)}>
                  <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[inp.photoPicker, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="image-outline" size={22} color={colors.mutedForeground} />
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14 }]}>Add a photo from your library</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Platform selection */}
        <View style={{ gap: 10 }}>
          <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>Which platforms should we monitor?</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {ALL_PLATFORMS.map((p) => {
              const isSel = selectedPlatforms.includes(p.id);
              return (
                <TouchableOpacity key={p.id} activeOpacity={0.8} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onTogglePlatform(p.id); }}
                  style={[inp.platChip, { backgroundColor: isSel ? colors.primary + "18" : colors.card, borderColor: isSel ? colors.primary + "70" : colors.border, borderWidth: isSel ? 1.5 : 1 }]}>
                  <PlatformIcon platform={p.id} size={18} />
                  <Text style={[{ color: isSel ? colors.primary : colors.mutedForeground, fontFamily: isSel ? "Inter_600SemiBold" : "Inter_400Regular", fontSize: 12 }]}>{p.label}</Text>
                  {isSel && <Ionicons name="checkmark" size={12} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <GlassCard style={[inp.privNote, { borderColor: colors.success + "33" }]}>
          <Ionicons name="lock-closed" size={13} color={colors.success} />
          <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, flex: 1, lineHeight: 18 }]}>
            We only use this to search for impersonators. Read-only, never posted, never shared.
          </Text>
        </GlassCard>
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
  platChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 24, borderWidth: 1 },
  privNote: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
});

// ─── S7: Proof Visual ─────────────────────────────────────────────────────────
function ProofVisualScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  const detected = useRef(new Animated.Value(0)).current;
  useEffect(() => { setTimeout(() => Animated.timing(detected, { toValue: 1, duration: 500, useNativeDriver: true }).start(), 700); }, []);
  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { gap: 24 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#3B82F611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Here's what Rook catches.</Text>
      <GlassCard style={[pv.card, { borderColor: "#EF444433" }]}>
        <View style={pv.header}>
          <View style={[pv.dot, { backgroundColor: "#EF444420" }]}><Ionicons name="alert-circle" size={14} color="#EF4444" /></View>
          <Text style={[{ color: "#EF4444", fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 1 }]}>Impersonator Detected</Text>
          <Animated.View style={[pv.badge, { backgroundColor: "#EF4444", opacity: detected, transform: [{ scale: detected }] }]}><Text style={[{ color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 }]}>FLAGGED</Text></Animated.View>
        </View>
        <View style={pv.profiles}>
          <View style={pv.profileCol}>
            <View style={[pv.avatar, { backgroundColor: colors.primary + "25" }]}><Ionicons name="person" size={18} color={colors.primary} /></View>
            <Text style={[{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }]}>@alexjones</Text>
            <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10 }]}>Your account</Text>
            <View style={[pv.tag, { backgroundColor: colors.success + "20" }]}><Text style={[{ color: colors.success, fontSize: 10, fontFamily: "Inter_600SemiBold" }]}>Genuine</Text></View>
          </View>
          <View style={[{ width: 1, height: 70, backgroundColor: colors.border }]} />
          <View style={pv.profileCol}>
            <View style={[pv.avatar, { backgroundColor: "#EF444422" }]}><Ionicons name="person" size={18} color="#EF4444" /></View>
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
    </ScrollView>
  );
}
const pv = StyleSheet.create({
  card: { gap: 16 },
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
    { icon: "notifications", label: "Alert you instantly", color: "#F59E0B" },
    { icon: "shield-checkmark", label: "Help you report & remove them", color: colors.success },
  ];
  const anims = useRef(STEPS.map(() => new Animated.Value(0))).current;
  useEffect(() => { Animated.stagger(200, anims.map((a) => Animated.spring(a, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }))).start(); }, []);
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
                {i < STEPS.length - 1 && <View style={[hrp.line, { backgroundColor: step.color + "30" }]} />}
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

// ─── S10: Social Proof ────────────────────────────────────────────────────────
const REVIEWS = [
  { name: "@sarahcreates", meta: "Content Creator", review: "Found a fake account using my photos on the first scan. Essential for any creator." },
  { name: "@mkdesign", meta: "Graphic Designer", review: "An impersonator was messaging my followers. Rook caught it before I even noticed." },
  { name: "@brandpro", meta: "Business Owner", review: "Five minutes to set up. Three accounts using our logo — gone." },
];
function SocialProofScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  const anims = useRef(REVIEWS.map(() => new Animated.Value(0))).current;
  useEffect(() => { Animated.stagger(120, anims.map((a) => Animated.spring(a, { toValue: 1, tension: 90, friction: 9, useNativeDriver: true }))).start(); }, []);
  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { gap: 24 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#F59E0B11", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={{ gap: 10 }}>
        <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Trusted by creators and professionals who can't afford to be impersonated.</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 2 }}>
            {[0,1,2,3,4].map((i) => <Ionicons key={i} name="star" size={16} color="#F59E0B" />)}
          </View>
          <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>4.8</Text>
          <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }]}>· 50,000+ identities protected</Text>
        </View>
      </View>
      <View style={{ gap: 12 }}>
        {REVIEWS.map((r, idx) => (
          <Animated.View key={r.name} style={{ opacity: anims[idx], transform: [{ translateY: anims[idx]!.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
            <GlassCard style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 2 }}>{[0,1,2,3,4].map((i) => <Ionicons key={i} name="star" size={12} color="#F59E0B" />)}</View>
              <Text style={[{ color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, fontStyle: "italic" }]}>"{r.review}"</Text>
              <View>
                <Text style={[{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }]}>{r.name}</Text>
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }]}>{r.meta}</Text>
              </View>
            </GlassCard>
          </Animated.View>
        ))}
      </View>
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
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start(); }, []);
  const steps = [
    { label: "Scan profile set", done: true },
    { label: "Enter your account handles", done: false, current: true },
    { label: "AI scans across your platforms", done: false },
    { label: "View your results", done: false },
  ];
  return (
    <View style={[s.screenPad, { flex: 1, justifyContent: "center", gap: 32 }]}>
      <LinearGradient colors={["#10B98111", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Animated.View style={{ opacity: fade, gap: 24 }}>
        <View style={{ gap: 10 }}>
          <View style={[ps.badge, { backgroundColor: colors.success + "14", borderColor: colors.success + "33" }]}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={[{ color: colors.success, fontFamily: "Inter_600SemiBold", fontSize: 13 }]}>Your profile is saved</Text>
          </View>
          <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>You're 3 steps{"\n"}from your first results.</Text>
        </View>
        {(identityInput || selectedPlatforms.length > 0 || hasPhoto) && (
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
        )}
        <View style={{ gap: 0 }}>
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
        </View>
      </Animated.View>
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
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [photosConfirmed, setPhotosConfirmed] = useState(false);

  const handleOAuth = useCallback(async () => {
    const cfg = ONBOARDING_OAUTH[platform];
    if (!cfg) return;
    const clientId = (process.env as Record<string,string|undefined>)[cfg.clientIdEnvKey];

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
      const APP_SCHEME = "com.getrook.app://oauth";
      const result = await WebBrowser.openAuthSessionAsync(authUrl, APP_SCHEME);

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
            } catch { /* graceful — photo picker simply won't show */ }
            finally { setMediaLoading(false); }
            return true;
          }
        }
        return false;
      };

      // Try to detect the connection regardless of result type
      if (result.type !== "cancel") {
        const found = await connectDetected();
        if (found) return;
      }

      // Handle errors / cancellations
      if (urlError) {
        Alert.alert("Authentication Failed", `Could not sign in: ${urlError}`, [{ text: "OK" }]);
        setShowManual(true);
      } else if (result.type === "cancel" || result.type === "dismiss") {
        setShowManual(true);
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
    if (onPhotosPicked && urls.length > 0) onPhotosPicked(platform, urls);
    setPhotosConfirmed(true);
  }, [selectedUrls, platform, onPhotosPicked]);

  const cfg = ONBOARDING_OAUTH[platform];
  const platformColor = cfg?.color ?? "#3B82F6";
  const snapchatText = platform === "snapchat" ? "#000" : "#fff";

  // ── Connected state ──────────────────────────────────────────────────────
  if (isConnected) {
    return (
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

        {/* Photo picker (only when we have media + not yet confirmed) */}
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
    );
  }

  // ── Not yet connected ────────────────────────────────────────────────────
  return (
    <View style={[ph.outerCard, { backgroundColor: colors.card, borderColor: (handle || showManual) ? colors.primary + "55" : colors.border }]}>
      <View style={ph.platformHeader}>
        <View style={[ph.platIcon, { backgroundColor: platformColor + "20" }]}>
          <PlatformIcon platform={platform as NonNullable<SocialPlatform>} size={22} />
        </View>
        <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 }]}>{label}</Text>
      </View>
      <TouchableOpacity
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
      </TouchableOpacity>
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
  );
}

function PlatformHandlesScreen({ colors, selectedPlatforms, handles, onHandleChange, isAddingAccounts, connectedPlatforms, onOAuthConnected, onPhotosPicked }: {
  colors: ReturnType<typeof useColors>;
  selectedPlatforms: string[];
  handles: Record<string, string>;
  onHandleChange: (platformId: string, value: string) => void;
  isAddingAccounts: boolean;
  connectedPlatforms: Set<string>;
  onOAuthConnected: (platform: string, accountId: string) => void;
  onPhotosPicked?: (platform: string, urls: string[]) => void;
}) {
  const displayPlatforms = ALL_PLATFORMS.filter((p) => selectedPlatforms.includes(p.id));

  if (displayPlatforms.length === 0) {
    return (
      <View style={[s.screenPad, { flex: 1, justifyContent: "center", gap: 20 }]}>
        <LinearGradient colors={["#3B82F611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Connect your accounts</Text>
        <GlassCard>
          <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" }]}>No platforms were selected — tap Continue to run your scan based on the name you entered.</Text>
        </GlassCard>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
      <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { gap: 24 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={["#3B82F611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={{ gap: 8 }}>
          <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Which platforms should we monitor?</Text>
          <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Connect via OAuth for the richest scan — or enter your @handle manually. Read-only access only.</Text>
        </View>
        <View style={{ gap: 12 }}>
          {displayPlatforms.map((p) => (
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
        </View>
        {isAddingAccounts && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center" }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }]}>Connecting accounts…</Text>
          </View>
        )}
        <GlassCard style={{ borderColor: colors.success + "22", flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
          <Ionicons name="lock-closed" size={14} color={colors.success} />
          <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, flex: 1, lineHeight: 18 }]}>
            Read-only access only — Rook never posts, messages, or follows anyone on your behalf.
          </Text>
        </GlassCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
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
const SCAN_STEPS = ["Building visual fingerprint", "Analyzing media patterns", "Creating protection profile", "Scanning platforms"];
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
      Promise.resolve(startScan()).catch(() => {});
    }
    // Fallback A: scan never started within 14s (API error / quota)
    const fallback = setTimeout(() => { if (!wasScanning.current) onDoneRef.current(0); }, 14000);
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
        {[200, 150, 100].map((size, i) => (
          <View key={size} style={[sc.ring, { width: size, height: size, borderRadius: size / 2, borderColor: colors.primary + (i === 0 ? "18" : i === 1 ? "28" : "38") }]} />
        ))}
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
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
function UrgencyRevealScreen({ colors, threatCount }: { colors: ReturnType<typeof useColors>; threatCount: number }) {
  const fade = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.stagger(150, cardAnims.map((a) => Animated.spring(a, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }))).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.02, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
    ])).start();
  }, []);
  const hasThreats = threatCount > 0;
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
              We found{" "}<Text style={{ color: "#EF4444" }}>{threatCount} potential match{threatCount !== 1 ? "es" : ""}</Text>.
            </Text>
            <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Unlock your full identity report to see exactly where — and what to do about it.
            </Text>
          </>
        ) : (
          <>
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
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start(); }, []);
  const userTypeLabel = USER_TYPES.find((t) => t.id === userType)?.label ?? null;
  const LOCKED_FEATURES = ["Continuous daily monitoring", "Takedown request assistance", "30-day threat history", "Real-time push alerts"];
  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { gap: 24 }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#3B82F618", "#8B5CF610", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Animated.View style={{ opacity: fade, gap: 24 }}>
        <View style={{ gap: 10 }}>
          <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Your Identity Protection{"\n"}Report is ready.</Text>
          <Text style={[s.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Free accounts get a one-time scan. Rook Premium monitors continuously — every platform, every day.</Text>
        </View>
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
        <GlassCard style={{ gap: 12, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="lock-closed" size={14} color={colors.mutedForeground} />
            <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }]}>Premium features — unlock with trial</Text>
          </View>
          {LOCKED_FEATURES.map((f) => (
            <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 10, opacity: 0.5 }}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={[{ color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14 }]}>{f}</Text>
              <Ionicons name="lock-closed" size={12} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
            </View>
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
  const { completeOnboarding, addIndexedPhotos } = useApp();
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [answers, setAnswers] = useState<OnboardingAnswers>({
    primaryConcern: null,
    userType: null,
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
    Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 240, useNativeDriver: true }).start();
    });
  }, [fadeAnim]);

  const handleAutoAdvance = useCallback((next: number) => {
    setTimeout(() => animateToStep(next), 280);
  }, [animateToStep]);

  const handlePhotoSelect = useCallback((uri: string, b64?: string) => {
    if (!uri) { setPhotoUri(null); setPhotoBase64(undefined); return; }
    setPhotoUri(uri);
    setPhotoBase64(b64);
    if (b64) addIndexedPhotos([{ uri, base64: b64 }]);
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

  const buildFinalAnswers = useCallback((): OnboardingAnswers => ({
    ...answers,
    identityInput: identityInput || null,
    activePlatforms: selectedPlatforms,
    platformHandles,
  }), [answers, identityInput, selectedPlatforms, platformHandles]);

  const handleNext = useCallback(async () => {
    if (step === 12) {
      await addAccountsForHandles();
      animateToStep(13);
      return;
    }
    if (step < TOTAL_STEPS - 1) {
      animateToStep(step + 1);
    } else {
      const finalAnswers = buildFinalAnswers();
      saveAndFinish(finalAnswers);
      router.replace({ pathname: "/subscription", params: { fromOnboarding: "1", threatCount: String(scanThreatCount) } } as any);
    }
  }, [step, addAccountsForHandles, animateToStep, buildFinalAnswers, saveAndFinish, scanThreatCount]);

  const handleSkip = useCallback(() => {
    const finalAnswers = buildFinalAnswers();
    saveAndFinish(finalAnswers);
    analytics.onboardingSkipped({ at_step: step });
    router.replace("/(tabs)" as any);
  }, [buildFinalAnswers, step, saveAndFinish]);

  const handleMaybeLater = useCallback(() => {
    const finalAnswers = buildFinalAnswers();
    saveAndFinish(finalAnswers);
    router.replace("/(tabs)" as any);
  }, [buildFinalAnswers, saveAndFinish]);

  // Steps that auto-advance on selection — no footer CTA shown
  const AUTO_STEPS = new Set([3, 4, 5]);
  const NO_FOOTER_STEPS = new Set([13]); // only scan auto-advances; all other steps show footer
  const isAutoStep = AUTO_STEPS.has(step);
  const isNoFooter = NO_FOOTER_STEPS.has(step);
  const isLastStep = step === TOTAL_STEPS - 1;

  const canContinue = (): boolean => {
    if (step === 6) return identityInput.trim().length > 0 || selectedPlatforms.length > 0;
    if (step === 9) return true; // social proof — always can continue
    return true;
  };

  const getCtaLabel = (): string => {
    if (step === 0) return "Find Out If I'm Exposed";
    if (step === 2) return "Start My Assessment";
    if (step === 6) return "Scan For Me";
    if (step === 11) return "Set Up My Accounts";
    if (step === 12) return isAddingAccounts ? "Connecting…" : "Start My Scan";
    if (step === 15) return "Unlock Full Protection";
    return "Continue";
  };

  const renderStep = () => {
    switch (step) {
      case 0: return <BrandHookScreen colors={colors} />;
      case 1: return <CredibleStatScreen colors={colors} />;
      case 2: return <AssessmentIntroScreen colors={colors} />;
      case 3: return <ConcernScreen colors={colors} selected={answers.primaryConcern} onSelect={(id) => { setAnswers((a) => ({ ...a, primaryConcern: id })); handleAutoAdvance(4); }} />;
      case 4: return <IdentityTypeScreen colors={colors} selected={answers.userType} onSelect={(id) => { setAnswers((a) => ({ ...a, userType: id })); handleAutoAdvance(5); }} />;
      case 5: return <AccountCountScreen colors={colors} selected={answers.followerRange} onSelect={(id) => { setAnswers((a) => ({ ...a, followerRange: id })); handleAutoAdvance(6); }} />;
      case 6: return <IdentityInputScreen colors={colors} nameValue={identityInput} onNameChange={setIdentityInput} selectedPlatforms={selectedPlatforms} onTogglePlatform={handleTogglePlatform} photoUri={photoUri} onPhotoSelect={handlePhotoSelect} />;
      case 7: return <ProofVisualScreen colors={colors} />;
      case 8: return <HowRookProtectsScreen colors={colors} />;
      case 9: return <PrivacyScreen colors={colors} />;
      case 10: return <SocialProofScreen colors={colors} />;
      case 11: return <ProfileSavedScreen colors={colors} identityInput={identityInput} selectedPlatforms={selectedPlatforms} hasPhoto={!!photoUri} />;
      case 12: return <PlatformHandlesScreen colors={colors} selectedPlatforms={selectedPlatforms} handles={platformHandles} onHandleChange={handleHandleChange} isAddingAccounts={isAddingAccounts} connectedPlatforms={oauthConnectedPlatforms} onOAuthConnected={handleOAuthConnected} onPhotosPicked={handlePhotosPicked} />;
      case 13: return <ScanSetupScreen colors={colors} onDone={(count) => { setScanThreatCount(count); animateToStep(14); }} />;
      case 14: return <UrgencyRevealScreen colors={colors} threatCount={scanThreatCount} />;
      case 15: return <ReportBridgeScreen colors={colors} threatCount={scanThreatCount} userType={answers.userType} platformCount={selectedPlatforms.length} />;
      default: return null;
    }
  };

  const showFooter = !isAutoStep && !isNoFooter;

  return (
    <View style={[{ flex: 1 }, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 16 }]}>
        <ProgressBar step={step} colors={colors} />
        {step > 0 && step < 13 && !isAutoStep && (
          <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ alignSelf: "flex-end", marginTop: -2 }}>
            <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14 }]}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {renderStep()}
      </Animated.View>

      {showFooter && (
        <View style={[s.footer, { paddingBottom: bottomPad + 16 }]}>
          {isLastStep ? (
            <>
              <TouchableOpacity style={[s.cta, { backgroundColor: colors.primary }]} activeOpacity={0.85} onPress={handleNext}>
                <Ionicons name="lock-open" size={18} color="#fff" />
                <Text style={[s.ctaText, { fontFamily: "Inter_700Bold", color: "#fff" }]}>Unlock Full Protection</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleMaybeLater} style={{ alignItems: "center" }}>
                <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }]}>Maybe later — continue with free plan</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
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
            </TouchableOpacity>
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
