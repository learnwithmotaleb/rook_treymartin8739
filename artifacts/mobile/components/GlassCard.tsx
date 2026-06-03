import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle, TouchableOpacity } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  noPadding?: boolean;
  accent?: boolean;
  pressable?: boolean;
  onPress?: () => void;
}

function PressableCard({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress?: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={() => (scale.value = withSpring(0.98))}
      onPressOut={() => (scale.value = withSpring(1))}
      onPress={onPress}
    >
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </TouchableOpacity>
  );
}

export function GlassCard({ children, style, noPadding, accent, pressable, onPress }: GlassCardProps) {
  const colors = useColors();

  const cardStyle = [
    styles.card,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: colors.radius,
      padding: noPadding ? 0 : 16,
    },
    accent && { borderLeftWidth: 3, borderLeftColor: colors.primary },
    style,
  ];

  const content = <View style={cardStyle}>{children}</View>;

  if (pressable || onPress) {
    return <PressableCard onPress={onPress}>{content}</PressableCard>;
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
});
