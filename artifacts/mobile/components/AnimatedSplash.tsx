import React, { useEffect, useState } from "react";
import { Dimensions, Image, StyleSheet } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

const MARK_SIZE = Math.min(width * 0.50, 210);
const MARK_TOP  = height * 0.26;
const MARK_LEFT = (width - MARK_SIZE) / 2;
const MARK_CX   = width / 2;
const MARK_CY   = MARK_TOP + MARK_SIZE / 2;

const LOGO_MARK = require("../assets/images/logo-mark.png");
const DECODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ@#$%01";

// ── GlowAura ──────────────────────────────────────────────────────────────────
// Soft radial bloom behind the mark that breathes once it appears
function GlowAura({ delay }: { delay: number }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 500 }),
        withRepeat(
          withSequence(
            withTiming(0.45, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
            withTiming(1,    { duration: 1400, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          false
        )
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.glowAura, style]} />;
}

// ── ScanBeam ──────────────────────────────────────────────────────────────────
// 2 px horizontal line that sweeps top → bottom of the logo area
function ScanBeam({ delay }: { delay: number }) {
  const posY    = useSharedValue(MARK_TOP - 12);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1,   { duration: 60 }),
        withDelay(520, withTiming(0, { duration: 220 }))
      )
    );
    posY.value = withDelay(
      delay,
      withTiming(MARK_TOP + MARK_SIZE + 12, {
        duration: 680,
        easing: Easing.inOut(Easing.ease),
      })
    );
  }, []);

  const style = useAnimatedStyle(() => ({ top: posY.value, opacity: opacity.value }));
  return <Animated.View style={[styles.scanBeam, style]} />;
}

// ── PulseRing ─────────────────────────────────────────────────────────────────
// Expanding ring pulse centred on the mark
function PulseRing({ delay, size }: { delay: number; size: number }) {
  const scale   = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withTiming(1.8, { duration: 1000, easing: Easing.out(Easing.ease) })
    );
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(0.7, { duration: 80 }),
        withTiming(0,   { duration: 920, easing: Easing.out(Easing.ease) })
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        {
          width: size, height: size,
          borderRadius: size / 2,
          left: MARK_CX - size / 2,
          top:  MARK_CY - size / 2,
        },
        style,
      ]}
    />
  );
}

// ── CornerBracket ─────────────────────────────────────────────────────────────
// L-shaped targeting corner around the logo
type Corner = "tl" | "tr" | "bl" | "br";
function CornerBracket({ corner, delay }: { corner: Corner; delay: number }) {
  const opacity = useSharedValue(0);
  const scale   = useSharedValue(0.6);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(0.75, { duration: 280 }));
    scale.value   = withDelay(delay, withTiming(1,    { duration: 280, easing: Easing.out(Easing.cubic) }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const PAD = 10;
  const ARM = 20;
  const TH  = 1.5;
  const C   = "#3B82F6";

  const isLeft = corner[1] === "l";
  const isTop  = corner[0] === "t";

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: isLeft ? MARK_LEFT - PAD : MARK_LEFT + MARK_SIZE + PAD - ARM,
          top:  isTop  ? MARK_TOP  - PAD : MARK_TOP  + MARK_SIZE + PAD - ARM,
          width: ARM, height: ARM,
          borderTopWidth:    isTop  ? TH : 0,
          borderBottomWidth: !isTop ? TH : 0,
          borderLeftWidth:   isLeft ? TH : 0,
          borderRightWidth:  !isLeft ? TH : 0,
          borderColor: C,
        },
        style,
      ]}
    />
  );
}

// ── DecodeChar ────────────────────────────────────────────────────────────────
// Individual letter that cycles random chars then locks on real letter
function DecodeChar({ letter, delay }: { letter: string; delay: number }) {
  const [display, setDisplay] = useState(" ");
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    opacity.value    = withDelay(delay, withTiming(1, { duration: 160 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) }));

    const outer = setTimeout(() => {
      let n = 0;
      const total = 9;
      setDisplay(DECODE_CHARS[Math.floor(Math.random() * DECODE_CHARS.length)]);
      const iv = setInterval(() => {
        n++;
        if (n < total) {
          setDisplay(DECODE_CHARS[Math.floor(Math.random() * DECODE_CHARS.length)]);
        } else {
          setDisplay(letter);
          clearInterval(iv);
        }
      }, 42);
      return () => clearInterval(iv);
    }, delay);

    return () => clearTimeout(outer);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.Text style={[styles.letterText, style]}>{display}</Animated.Text>;
}

// ── DividerLine ───────────────────────────────────────────────────────────────
// Short horizontal rule that expands under "ROOK"
function DividerLine({ delay, top }: { delay: number; top: number }) {
  const scaleX  = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1,   { duration: 240 }));
    scaleX.value  = withDelay(delay, withTiming(1,   { duration: 420, easing: Easing.out(Easing.cubic) }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scaleX: scaleX.value }],
  }));

  return <Animated.View style={[styles.dividerLine, { top }, style]} />;
}

// ── TaglineText ───────────────────────────────────────────────────────────────
function TaglineText({ delay }: { delay: number }) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value    = withDelay(delay, withTiming(1, { duration: 600 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.Text style={[styles.taglineText, style]}>
      · IDENTITY PROTECTION ·
    </Animated.Text>
  );
}

// ── StatusIndicator ───────────────────────────────────────────────────────────
// Small "SCANNING…" → "SECURE" status chip at the bottom
function StatusIndicator({ delay, top }: { delay: number; top: number }) {
  const opacity = useSharedValue(0);
  const [label, setLabel] = useState("SCANNING…");

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
    const t = setTimeout(() => setLabel("SECURE"), delay + 900);
    return () => clearTimeout(t);
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.statusChip, { top }, style]}>
      <Animated.View style={styles.statusDot} />
      <Animated.Text style={styles.statusText}>{label}</Animated.Text>
    </Animated.View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
interface Props {
  isReady: boolean;
  onHidden: () => void;
}

export function AnimatedSplash({ isReady, onHidden }: Props) {
  const containerOpacity = useSharedValue(1);
  const markOpacity      = useSharedValue(0);
  const markScale        = useSharedValue(0.86);

  // Glitch-in sequence: flicker → lock
  useEffect(() => {
    markOpacity.value = withSequence(
      withDelay(120, withTiming(0.3,  { duration: 55  })),
      withTiming(0,                   { duration: 40  }),
      withTiming(0.8,                 { duration: 70  }),
      withTiming(0.05,                { duration: 35  }),
      withTiming(1,  { duration: 300, easing: Easing.out(Easing.cubic) })
    );
    markScale.value = withSequence(
      withDelay(120, withTiming(0.90, { duration: 55  })),
      withTiming(0.90,                { duration: 145 }),
      withTiming(1,  { duration: 300, easing: Easing.out(Easing.back(1.05)) })
    );
  }, []);

  // Fade out when app is ready
  useEffect(() => {
    if (!isReady) return;
    containerOpacity.value = withTiming(
      0,
      { duration: 540, easing: Easing.in(Easing.ease) },
      (done) => { if (done) runOnJS(onHidden)(); }
    );
  }, [isReady]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: containerOpacity.value }));
  const markStyle      = useAnimatedStyle(() => ({
    opacity:   markOpacity.value,
    transform: [{ scale: markScale.value }],
  }));

  const WORD_TOP = MARK_TOP + MARK_SIZE + 30;
  const DIV_TOP  = WORD_TOP + 62;

  return (
    <Animated.View style={[styles.container, containerStyle, { pointerEvents: "none" }]}>

      {/* ① Radial glow bloom behind the mark */}
      <GlowAura delay={950} />

      {/* ② Logo mark — glitch entrance */}
      <Animated.View
        style={[
          { position: "absolute", top: MARK_TOP, left: MARK_LEFT,
            width: MARK_SIZE, height: MARK_SIZE },
          markStyle,
        ]}
      >
        <Image
          source={LOGO_MARK}
          style={{ width: MARK_SIZE, height: MARK_SIZE }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ③ Scan beam sweeps through logo */}
      <ScanBeam delay={680} />

      {/* ④ Targeting brackets snap into place */}
      <CornerBracket corner="tl" delay={880} />
      <CornerBracket corner="tr" delay={920} />
      <CornerBracket corner="bl" delay={960} />
      <CornerBracket corner="br" delay={1000} />

      {/* ⑤ Concentric pulse rings radiate outward */}
      <PulseRing delay={980}  size={MARK_SIZE * 0.85} />
      <PulseRing delay={1140} size={MARK_SIZE * 1.10} />
      <PulseRing delay={1300} size={MARK_SIZE * 1.38} />

      {/* ⑥ ROOK — character decode */}
      <Animated.View style={[styles.wordmarkRow, { top: WORD_TOP }]}>
        <DecodeChar letter="R" delay={1380} />
        <DecodeChar letter="O" delay={1510} />
        <DecodeChar letter="O" delay={1640} />
        <DecodeChar letter="K" delay={1770} />
      </Animated.View>

      {/* ⑦ Divider line expands below ROOK */}
      <DividerLine delay={2100} top={DIV_TOP} />

      {/* ⑧ Status chip (SCANNING… → SECURE) */}
      <StatusIndicator delay={2200} top={DIV_TOP + 20} />

      {/* ⑨ Tagline */}
      <TaglineText delay={2450} />

    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#070B12",
    alignItems: "center",
    zIndex: 9999,
    overflow: "hidden",
  },

  // Glow behind mark
  glowAura: {
    position: "absolute",
    left: MARK_CX - MARK_SIZE * 0.75,
    top:  MARK_CY - MARK_SIZE * 0.75,
    width:  MARK_SIZE * 1.5,
    height: MARK_SIZE * 1.5,
    borderRadius: MARK_SIZE * 0.75,
    backgroundColor: "#1D4ED8",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 80,
    shadowOpacity: 1,
  },

  // Scan beam
  scanBeam: {
    position: "absolute",
    left: MARK_LEFT - 8,
    width: MARK_SIZE + 16,
    height: 2,
    backgroundColor: "#60A5FA",
    shadowColor: "#60A5FA",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 18,
    shadowOpacity: 1,
    elevation: 10,
  },

  // Pulse ring
  pulseRing: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "#3B82F6",
    backgroundColor: "transparent",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
    shadowOpacity: 1,
  },

  // Wordmark
  wordmarkRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 0,
  },
  letterText: {
    fontSize: 50,
    fontFamily: "Inter_700Bold",
    color: "#F0F4FF",
    letterSpacing: 10,
    includeFontPadding: false,
  },

  // Divider
  dividerLine: {
    position: "absolute",
    width: 56,
    height: 1.5,
    backgroundColor: "#3B82F6",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    shadowOpacity: 1,
  },

  // Status chip
  statusChip: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#22C55E",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
    shadowOpacity: 1,
  },
  statusText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 3,
    color: "#60A5FA",
  },

  // Tagline
  taglineText: {
    position: "absolute",
    bottom: height * 0.13,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 4,
    color: "#3B82F6",
  },
});
