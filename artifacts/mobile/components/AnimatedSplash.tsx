import React, { useEffect } from "react";
import { Dimensions, Image, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");
const LOGO_SIZE = Math.min(width * 0.52, 240);

const LOGO = require("../assets/images/logo.png");

interface Props {
  isReady: boolean;
  onHidden: () => void;
}

export function AnimatedSplash({ isReady, onHidden }: Props) {
  // ── Shared values ─────────────────────────────────────────────────────────
  const containerOpacity = useSharedValue(1);
  const logoScale        = useSharedValue(0.75);
  const logoRotation     = useSharedValue(0);
  const glowScale        = useSharedValue(1);
  const glowOpacity      = useSharedValue(0.35);
  const ringRotation     = useSharedValue(0);
  const textOpacity      = useSharedValue(0);
  const textTranslateY   = useSharedValue(14);

  // ── Entry + looping animations ────────────────────────────────────────────
  useEffect(() => {
    // Logo entrance
    logoScale.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });

    // Text entrance — slightly delayed
    textOpacity.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
    textTranslateY.value = withTiming(0, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });

    // Continuous logo spin — one full rotation every 7 s (feels premium, not frantic)
    logoRotation.value = withRepeat(
      withTiming(360, { duration: 7000, easing: Easing.linear }),
      -1,
      false
    );

    // Outer scanner ring spins opposite direction, faster
    ringRotation.value = withRepeat(
      withTiming(-360, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );

    // Pulsing glow halo
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.25, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0,  { duration: 1400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.75, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.25, { duration: 1400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  // ── Fade-out when app is ready ────────────────────────────────────────────
  useEffect(() => {
    if (!isReady) return;
    containerOpacity.value = withTiming(0, { duration: 480, easing: Easing.in(Easing.ease) }, (done) => {
      if (done) runOnJS(onHidden)();
    });
  }, [isReady]);

  // ── Animated styles ───────────────────────────────────────────────────────
  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotation.value}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: glowOpacity.value,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringRotation.value}deg` }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle, { pointerEvents: "none" }]}>
      {/* Outer ambient glow */}
      <Animated.View style={[styles.glowHalo, glowStyle]} />

      {/* Scanner ring */}
      <Animated.View style={[styles.scannerRing, ringStyle]}>
        <View style={styles.ringDot} />
        <View style={[styles.ringDot, styles.ringDotBottom]} />
      </Animated.View>

      {/* Second static ring */}
      <View style={styles.staticRing} />

      {/* Spinning logo */}
      <Animated.View style={[styles.logoWrapper, logoStyle]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      </Animated.View>

      {/* App name + tagline */}
      <Animated.View style={[styles.textBlock, textStyle]}>
        <Text style={styles.title}>ShieldID</Text>
        <Text style={styles.subtitle}>Identity Protection</Text>
      </Animated.View>
    </Animated.View>
  );
}

const RING_SIZE = LOGO_SIZE + 64;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#070B12",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },

  // Soft neon glow behind the logo
  glowHalo: {
    position: "absolute",
    width: LOGO_SIZE + 40,
    height: LOGO_SIZE + 40,
    borderRadius: (LOGO_SIZE + 40) / 2,
    backgroundColor: "#1E40AF30",
  },

  // Rotating outer arc ring
  scannerRing: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: "#3B82F680",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },

  ringDot: {
    position: "absolute",
    top: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#60A5FA",
  },

  ringDotBottom: {
    top: "auto",
    bottom: -3,
  },

  // Subtle inner static ring
  staticRing: {
    position: "absolute",
    width: RING_SIZE + 36,
    height: RING_SIZE + 36,
    borderRadius: (RING_SIZE + 36) / 2,
    borderWidth: 1,
    borderColor: "#1E40AF40",
  },

  logoWrapper: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },

  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },

  textBlock: {
    position: "absolute",
    bottom: "22%",
    alignItems: "center",
    gap: 4,
  },

  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 2,
  },

  subtitle: {
    fontSize: 14,
    fontWeight: "400",
    color: "#60A5FA",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
});
