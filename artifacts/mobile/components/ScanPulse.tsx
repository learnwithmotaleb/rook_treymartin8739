import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

interface PulseRingProps {
  delay: number;
  size: number;
  color: string;
}

function PulseRing({ delay, size, color }: PulseRingProps) {
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(0.7);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(withTiming(1.8, { duration: 2400 }), -1, false)
    );
    opacity.value = withDelay(
      delay,
      withRepeat(withTiming(0, { duration: 2400 }), -1, false)
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

interface ScanPulseProps {
  size?: number;
  active?: boolean;
}

export function ScanPulse({ size = 200, active = true }: ScanPulseProps) {
  const colors = useColors();
  const color = active ? colors.primary : colors.success;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {active && (
        <>
          <PulseRing delay={0} size={size} color={color} />
          <PulseRing delay={800} size={size} color={color} />
          <PulseRing delay={1600} size={size} color={color} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
