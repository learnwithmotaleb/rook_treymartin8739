import React, { useEffect } from "react";
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

const MARK_SIZE = Math.min(width * 0.52, 230);
const MARK_TOP = height * 0.26;
const MARK_LEFT = (width - MARK_SIZE) / 2;
const MARK_CX = width / 2;
const MARK_CY = MARK_TOP + MARK_SIZE / 2;

const LOGO_MARK = require("../assets/images/logo-mark.png");

// ─── FloatingPixel ──────────────────────────────────────────────────────────
// Extracted as named component so useAnimatedStyle is never called inside .map()
interface PixelProps {
  size: number;
  delay: number;
  left: number;
  top: number;
  driftX: number;
  driftY: number;
  color: string;
}
function FloatingPixel({ size, delay, left, top, driftX, driftY, color }: PixelProps) {
  const opacity = useSharedValue(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(0.7, { duration: 500 }));
    tx.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(driftX, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0,      { duration: 2600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
    ty.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(driftY, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0,      { duration: 2200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left,
          top,
          width: size,
          height: size,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

// ─── ScanLine ────────────────────────────────────────────────────────────────
function ScanLine({ startY, endY, delay }: { startY: number; endY: number; delay: number }) {
  const opacity = useSharedValue(0);
  const posY = useSharedValue(startY);

  useEffect(() => {
    // Fade in → hold → fade out as a single sequence so assignments don't race
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 80 }),
        withDelay(860, withTiming(0, { duration: 300 }))
      )
    );
    posY.value = withDelay(
      delay,
      withTiming(endY, { duration: 1000, easing: Easing.inOut(Easing.ease) })
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    top: posY.value,
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.scanLine, style]} />;
}

// ─── AnimatedLetter ──────────────────────────────────────────────────────────
function AnimatedLetter({ letter, delay }: { letter: string; delay: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(18);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) })
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: 340, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.Text style={[styles.letterText, style]}>{letter}</Animated.Text>;
}

// ─── TaglineText ──────────────────────────────────────────────────────────────
function TaglineText({ delay }: { delay: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.Text style={[styles.taglineText, style]}>
      · PROTECT YOUR IDENTITY ·
    </Animated.Text>
  );
}

// ─── Pixel positions (blue palette only, no purple) ──────────────────────────
const PIXELS: PixelProps[] = [
  { size: 8,  delay: 120, left: MARK_CX - MARK_SIZE * 0.52, top: MARK_CY - MARK_SIZE * 0.38, driftX: -14, driftY: -10, color: "#3B82F6" },
  { size: 5,  delay: 200, left: MARK_CX - MARK_SIZE * 0.64, top: MARK_CY - MARK_SIZE * 0.22, driftX: -10, driftY: -16, color: "#60A5FA" },
  { size: 6,  delay: 80,  left: MARK_CX - MARK_SIZE * 0.68, top: MARK_CY - MARK_SIZE * 0.08, driftX: -18, driftY:   6, color: "#3B82F6" },
  { size: 4,  delay: 300, left: MARK_CX - MARK_SIZE * 0.44, top: MARK_CY - MARK_SIZE * 0.50, driftX:  -8, driftY: -12, color: "#93C5FD" },
  { size: 7,  delay: 60,  left: MARK_CX - MARK_SIZE * 0.74, top: MARK_CY - MARK_SIZE * 0.30, driftX: -20, driftY:  -4, color: "#3B82F6" },
  { size: 4,  delay: 380, left: MARK_CX - MARK_SIZE * 0.58, top: MARK_CY + MARK_SIZE * 0.08, driftX: -12, driftY:  10, color: "#60A5FA" },
  { size: 5,  delay: 240, left: MARK_CX - MARK_SIZE * 0.36, top: MARK_CY - MARK_SIZE * 0.56, driftX:  -6, driftY: -18, color: "#93C5FD" },
  { size: 3,  delay: 440, left: MARK_CX - MARK_SIZE * 0.78, top: MARK_CY - MARK_SIZE * 0.16, driftX: -22, driftY:   0, color: "#60A5FA" },
  { size: 6,  delay: 160, left: MARK_CX - MARK_SIZE * 0.66, top: MARK_CY - MARK_SIZE * 0.44, driftX: -16, driftY:  -8, color: "#3B82F6" },
];

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  isReady: boolean;
  onHidden: () => void;
}

export function AnimatedSplash({ isReady, onHidden }: Props) {
  const containerOpacity = useSharedValue(1);
  const markOpacity = useSharedValue(0);
  const markScale = useSharedValue(0.80);

  useEffect(() => {
    markOpacity.value = withTiming(1, { duration: 680, easing: Easing.out(Easing.cubic) });
    markScale.value = withTiming(1, { duration: 780, easing: Easing.out(Easing.back(1.06)) });
  }, []);

  // Exit fade-out — only fires once isReady is true (minTime ≥ 3800ms so full animation plays)
  useEffect(() => {
    if (!isReady) return;
    containerOpacity.value = withTiming(
      0,
      { duration: 540, easing: Easing.in(Easing.ease) },
      (done) => { if (done) runOnJS(onHidden)(); }
    );
  }, [isReady]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: containerOpacity.value }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: markScale.value }],
  }));

  const WORDMARK_TOP = MARK_TOP + MARK_SIZE + 28;

  return (
    <Animated.View style={[styles.container, containerStyle, { pointerEvents: "none" }]}>

      {/* Floating pixel fragments */}
      <FloatingPixel {...PIXELS[0]} />
      <FloatingPixel {...PIXELS[1]} />
      <FloatingPixel {...PIXELS[2]} />
      <FloatingPixel {...PIXELS[3]} />
      <FloatingPixel {...PIXELS[4]} />
      <FloatingPixel {...PIXELS[5]} />
      <FloatingPixel {...PIXELS[6]} />
      <FloatingPixel {...PIXELS[7]} />
      <FloatingPixel {...PIXELS[8]} />

      {/* R lettermark — transparent background so #070B12 shows through */}
      <Animated.View
        style={[
          { position: "absolute", top: MARK_TOP, left: MARK_LEFT, width: MARK_SIZE, height: MARK_SIZE },
          markStyle,
        ]}
      >
        <Image
          source={LOGO_MARK}
          style={{ width: MARK_SIZE, height: MARK_SIZE }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Scan line sweeping through the mark */}
      <ScanLine
        startY={MARK_TOP + MARK_SIZE * 0.06}
        endY={MARK_TOP + MARK_SIZE * 0.92}
        delay={800}
      />

      {/* ROOK — letter-by-letter reveal */}
      <Animated.View style={[styles.wordmarkRow, { top: WORDMARK_TOP }]}>
        <AnimatedLetter letter="R" delay={1500} />
        <AnimatedLetter letter="O" delay={1630} />
        <AnimatedLetter letter="O" delay={1760} />
        <AnimatedLetter letter="K" delay={1890} />
      </Animated.View>

      {/* Tagline */}
      <TaglineText delay={2350} />

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#070B12",
    alignItems: "center",
    zIndex: 9999,
    overflow: "hidden",
  },
  scanLine: {
    position: "absolute",
    left: (width - MARK_SIZE * 0.84) / 2,
    width: MARK_SIZE * 0.84,
    height: 2,
    backgroundColor: "#3B82F6",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
    shadowOpacity: 1,
    elevation: 8,
  },
  wordmarkRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
    overflow: "hidden",
  },
  letterText: {
    fontSize: 52,
    fontWeight: "800",
    color: "#F0F4FF",
    letterSpacing: 8,
    includeFontPadding: false,
  },
  taglineText: {
    position: "absolute",
    bottom: height * 0.15,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 3.5,
    color: "#3B82F6",
  },
});
