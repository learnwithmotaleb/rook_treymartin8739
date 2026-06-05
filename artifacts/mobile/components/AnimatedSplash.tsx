import React, { useEffect } from "react";
import { Dimensions, Image, StyleSheet } from "react-native";
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
  // ── Shared values ──────────────────────────────────────────────────────────
  const containerOpacity = useSharedValue(1);
  const logoScale        = useSharedValue(0.8);
  const logoRotationX    = useSharedValue(0);   // Y-axis spin (globe style)
  const glowScale        = useSharedValue(1);
  const glowOpacity      = useSharedValue(0.4);

  // ── Animations ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // Entrance: scale up
    logoScale.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });

    // Continuous X-axis spin (coin-flip / card-flip)
    logoRotationX.value = withRepeat(
      withTiming(360, { duration: 2200, easing: Easing.linear }),
      -1,
      false
    );

    // Pulsing glow halo — scale breathes in sync with the spin feel
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1100, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.2, { duration: 1100, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  // ── Fade-out when app is ready ─────────────────────────────────────────────
  useEffect(() => {
    if (!isReady) return;
    containerOpacity.value = withTiming(
      0,
      { duration: 480, easing: Easing.in(Easing.ease) },
      (done) => { if (done) runOnJS(onHidden)(); }
    );
  }, [isReady]);

  // ── Animated styles ────────────────────────────────────────────────────────
  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  // X-axis rotation needs a perspective value to look 3D
  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { scale: logoScale.value },
      { rotateY: `${logoRotationX.value}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: glowOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle, { pointerEvents: "none" }]}>

      {/* Pulsing neon glow behind the logo */}
      <Animated.View style={[styles.glowHalo, glowStyle]} />

      {/* X-axis spinning logo */}
      <Animated.View style={[styles.logoWrapper, logoStyle]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      </Animated.View>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#070B12",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },

  glowHalo: {
    position: "absolute",
    width: LOGO_SIZE + 60,
    height: LOGO_SIZE + 60,
    borderRadius: (LOGO_SIZE + 60) / 2,
    backgroundColor: "#1A56DB28",
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
});
