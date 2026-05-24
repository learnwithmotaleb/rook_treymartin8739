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
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Platform as SocialPlatform } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { PlatformIcon } from "@/components/PlatformIcon";

const { width } = Dimensions.get("window");
const TOTAL_STEPS = 7;

// ─── Step 1: Welcome ─────────────────────────────────────────────────────────
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
            <Animated.View
              key={i}
              style={[
                styles.shieldRing,
                {
                  width: 120 * scale,
                  height: 120 * scale,
                  borderRadius: 60 * scale,
                  borderColor: colors.primary + (i === 0 ? "18" : i === 1 ? "30" : "00"),
                  backgroundColor: i === 2 ? colors.primary + "22" : "transparent",
                  transform: i === 2 ? [{ scale: pulseAnim }] : [],
                },
              ]}
            />
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

// ─── Step 2: Education ────────────────────────────────────────────────────────
const STATS = [
  { icon: "person-add", value: "500K+", label: "Fake profiles created daily", color: "#EF4444" },
  { icon: "warning", value: "1 in 4", label: "People have been impersonated online", color: "#F59E0B" },
  { icon: "card", value: "$10B+", label: "Lost to social media fraud yearly", color: "#8B5CF6" },
];

function EducationScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenPad} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#EF444411", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.eduIconWrap, { backgroundColor: "#EF444422", borderColor: "#EF444444" }]}>
        <Ionicons name="warning" size={36} color="#EF4444" />
      </View>
      <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        Fake Accounts Are More Common Than You Think
      </Text>
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
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{s.label}</Text>
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

// ─── Step 3: How It Works ─────────────────────────────────────────────────────
const HOW_STEPS = [
  { icon: "images", label: "Your Photos", color: "#3B82F6" },
  { icon: "hardware-chip", label: "AI Analysis", color: "#8B5CF6" },
  { icon: "finger-print", label: "Your Fingerprint", color: "#10B981" },
  { icon: "search", label: "Threat Detection", color: "#F59E0B" },
  { icon: "notifications", label: "Real-Time Alerts", color: "#EF4444" },
];

function HowItWorksScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenPad} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#8B5CF611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.eduIconWrap, { backgroundColor: "#8B5CF622", borderColor: "#8B5CF644" }]}>
        <Ionicons name="finger-print" size={36} color="#8B5CF6" />
      </View>
      <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        Our AI Creates Your Digital Identity Fingerprint
      </Text>
      <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        The AI analyzes visual patterns from your social media content and continuously searches for unauthorized use of your identity.
      </Text>

      <View style={styles.flowWrap}>
        {HOW_STEPS.map((s, i) => (
          <React.Fragment key={s.label}>
            <View style={styles.flowItem}>
              <View style={[styles.flowIcon, { backgroundColor: s.color + "22", borderColor: s.color + "44" }]}>
                <Ionicons name={s.icon as any} size={24} color={s.color} />
              </View>
              <Text style={[styles.flowLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{s.label}</Text>
            </View>
            {i < HOW_STEPS.length - 1 && (
              <View style={styles.flowArrowWrap}>
                <View style={[styles.flowLine, { backgroundColor: colors.border }]} />
                <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
              </View>
            )}
          </React.Fragment>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Step 4: Features ─────────────────────────────────────────────────────────
const FEATURES = [
  { icon: "person-remove", label: "Impersonator Detection", desc: "Find accounts pretending to be you across all platforms.", color: "#EF4444" },
  { icon: "images", label: "Photo Monitoring", desc: "Detect stolen photos and visual identity theft in real time.", color: "#3B82F6" },
  { icon: "film", label: "Video Monitoring", desc: "Identify reused video content across social platforms.", color: "#8B5CF6" },
  { icon: "notifications", label: "Real-Time Alerts", desc: "Get notified the moment a new threat is detected.", color: "#10B981" },
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

// ─── Step 5: Connect Accounts ─────────────────────────────────────────────────
const CONNECT_PLATFORMS: Array<{ id: NonNullable<SocialPlatform>; label: string; color: string }> = [
  { id: "instagram", label: "Instagram", color: "#E1306C" },
  { id: "facebook", label: "Facebook", color: "#1877F2" },
  { id: "x", label: "X (Twitter)", color: "#000000" },
  { id: "tiktok", label: "TikTok", color: "#010101" },
];

function ConnectScreen({ colors, onSkip, onConnect }: {
  colors: ReturnType<typeof useColors>;
  onSkip: () => void;
  onConnect: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(["instagram"]));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
        Connecting your accounts allows AI to build a more accurate identity fingerprint and catch threats faster.
      </Text>

      <View style={styles.platformList}>
        {CONNECT_PLATFORMS.map((p) => {
          const isSelected = selected.has(p.id);
          return (
            <TouchableOpacity
              key={p.id}
              activeOpacity={0.75}
              onPress={() => toggle(p.id)}
              style={[
                styles.platformRow2,
                {
                  backgroundColor: isSelected ? colors.primary + "14" : colors.card,
                  borderColor: isSelected ? colors.primary + "66" : colors.border,
                },
              ]}
            >
              <PlatformIcon platform={p.id} size={28} />
              <Text style={[styles.platformLabel2, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                {p.label}
              </Text>
              <View style={[
                styles.checkbox,
                { backgroundColor: isSelected ? colors.primary : "transparent", borderColor: isSelected ? colors.primary : colors.border },
              ]}>
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
        <TouchableOpacity
          style={[styles.connectBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
          onPress={onConnect}
        >
          <Ionicons name="link" size={18} color="#fff" />
          <Text style={[styles.connectBtnText, { fontFamily: "Inter_600SemiBold" }]}>Connect Accounts</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkip}>
          <Text style={[styles.skipLink, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Skip for now
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Step 6: Scan Setup ───────────────────────────────────────────────────────
const SCAN_STEPS = [
  "Building visual fingerprint",
  "Analyzing media patterns",
  "Creating protection profile",
  "Preparing threat monitoring",
];

function ScanScreen({ colors, onDone }: { colors: ReturnType<typeof useColors>; onDone: () => void }) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true })
    ).start();

    const delays = [800, 1600, 2600, 3400];
    const timers: ReturnType<typeof setTimeout>[] = [];

    delays.forEach((delay, i) => {
      timers.push(setTimeout(() => {
        setCompletedSteps((prev) => [...prev, i]);
        setActiveStep(i + 1);
        Animated.timing(progressAnim, {
          toValue: (i + 1) / SCAN_STEPS.length,
          duration: 400,
          useNativeDriver: false,
        }).start();
      }, delay));
    });

    timers.push(setTimeout(onDone, 4400));
    return () => timers.forEach(clearTimeout);
  }, [onDone, progressAnim, spinAnim]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={[styles.screenPad, styles.scanCenter]}>
      <LinearGradient colors={["#3B82F622", "#8B5CF611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={styles.scanRings}>
        {[200, 150, 100].map((size, i) => (
          <View
            key={size}
            style={[styles.scanRing, {
              width: size, height: size, borderRadius: size / 2,
              borderColor: colors.primary + (i === 0 ? "18" : i === 1 ? "28" : "38"),
            }]}
          />
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

      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: colors.primary }]} />
      </View>

      <View style={styles.scanStepList}>
        {SCAN_STEPS.map((step, i) => {
          const done = completedSteps.includes(i);
          const active = activeStep === i;
          return (
            <View key={step} style={styles.scanStepRow}>
              <View style={[
                styles.scanStepDot,
                { backgroundColor: done ? colors.success : active ? colors.primary : colors.secondary,
                  borderColor: done ? colors.success : active ? colors.primary : colors.border },
              ]}>
                {done
                  ? <Ionicons name="checkmark" size={10} color="#fff" />
                  : active
                  ? <Animated.View style={[styles.activeDotPulse, { backgroundColor: colors.primary }]} />
                  : null}
              </View>
              <Text style={[
                styles.scanStepText,
                { color: done ? colors.foreground : active ? colors.foreground : colors.mutedForeground,
                  fontFamily: done || active ? "Inter_500Medium" : "Inter_400Regular" },
              ]}>
                {step}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Step 7: Value Reveal ─────────────────────────────────────────────────────
function RevealScreen({ colors }: { colors: ReturnType<typeof useColors> }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [fadeAnim]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenPad} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#10B98122", "#3B82F611", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={[styles.revealBadge, { backgroundColor: colors.success + "18", borderColor: colors.success + "33" }]}>
        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
        <Text style={[styles.revealBadgeText, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>Setup Complete</Text>
      </View>

      <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        Your Identity Is Ready{"\n"}To Be Protected
      </Text>
      <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        Here's a preview of what your ShieldID dashboard will look like once monitoring begins.
      </Text>

      <Animated.View style={{ opacity: fadeAnim }}>
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
                { label: "Platforms", value: "4", color: colors.primary },
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
    else {
      router.replace("/subscription" as any);
    }
  }, [step, animateToStep]);

  const handleSkip = useCallback(() => {
    completeOnboarding();
    router.replace("/(tabs)" as any);
  }, [completeOnboarding]);

  const handleConnectAccounts = useCallback(() => {
    animateToStep(step + 1);
  }, [step, animateToStep]);

  const handleScanDone = useCallback(() => {
    animateToStep(step + 1);
  }, [step, animateToStep]);

  const handleViewProtection = useCallback(() => {
    router.replace("/subscription" as any);
  }, []);

  const handleMaybeLater = useCallback(() => {
    completeOnboarding();
    router.replace("/(tabs)" as any);
  }, [completeOnboarding]);

  const renderStep = () => {
    switch (step) {
      case 0: return <WelcomeScreen colors={colors} />;
      case 1: return <EducationScreen colors={colors} />;
      case 2: return <HowItWorksScreen colors={colors} />;
      case 3: return <FeaturesScreen colors={colors} />;
      case 4: return <ConnectScreen colors={colors} onSkip={() => animateToStep(5)} onConnect={handleConnectAccounts} />;
      case 5: return <ScanScreen colors={colors} onDone={handleScanDone} />;
      case 6: return <RevealScreen colors={colors} />;
      default: return null;
    }
  };

  const showFooter = step !== 5; // scan screen auto-advances, no footer needed
  const isLastStep = step === 6;
  const isConnectStep = step === 4;

  const getCtaLabel = () => {
    if (isLastStep) return "View Protection Options";
    if (step === 0) return "Get Started";
    return "Continue";
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.dotsRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i <= step ? colors.primary : colors.border,
                  width: i === step ? 20 : 6,
                  opacity: i > step ? 0.5 : 1,
                },
              ]}
            />
          ))}
        </View>
        {step < TOTAL_STEPS - 2 && step !== 5 && (
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
                onPress={handleViewProtection}
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
              style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
              onPress={handleNext}
            >
              <Text style={[styles.ctaBtnText, { fontFamily: "Inter_600SemiBold" }]}>{getCtaLabel()}</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
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

  // Education
  statsCol: { gap: 12 },
  statCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statText: { flex: 1, gap: 2 },
  statValue: { fontSize: 22 },
  statLabel: { fontSize: 13, lineHeight: 18 },
  warnCard: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  warnText: { flex: 1, fontSize: 13, lineHeight: 20 },

  // How It Works
  flowWrap: { gap: 0, alignItems: "center" },
  flowItem: { alignItems: "center", gap: 8 },
  flowIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  flowLabel: { fontSize: 14, textAlign: "center" },
  flowArrowWrap: { alignItems: "center", gap: 2, paddingVertical: 4 },
  flowLine: { width: 1, height: 12 },

  // Features
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  featureCard: { width: (width - 60) / 2, gap: 10 },
  featureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  featureTitle: { fontSize: 13, lineHeight: 18 },
  featureDesc: { fontSize: 12, lineHeight: 17 },

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

  // Scan
  scanCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24 },
  scanRings: { width: 200, height: 200, alignItems: "center", justifyContent: "center" },
  scanRing: { position: "absolute", borderWidth: 1 },
  scanSpinner: { width: 76, height: 76, borderRadius: 38, borderWidth: 3 },
  scanShield: { position: "absolute" },
  progressTrack: { width: "100%", height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  scanStepList: { width: "100%", gap: 14 },
  scanStepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  scanStepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  activeDotPulse: { width: 8, height: 8, borderRadius: 4 },
  scanStepText: { fontSize: 14, flex: 1 },

  // Reveal
  revealBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  revealBadgeText: { fontSize: 13 },
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
  ctaBtnText: { color: "#fff", fontSize: 16 },
  maybeLater: { alignItems: "center" },
  maybeLaterText: { fontSize: 13 },
});
