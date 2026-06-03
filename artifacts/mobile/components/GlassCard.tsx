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

export function GlassCard({ children, style, noPadding, accent, pressable, onPress }: GlassCardProps) {
  const colors = useColors();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

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

  const content = (
    <View style={cardStyle}>
      {children}
    </View>
  );

  if (pressable || onPress) {
    return (
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => (scale.value = withSpring(0.98))}
        onPressOut={() => (scale.value = withSpring(1))}
        onPress={onPress}
      >
        <Animated.View style={animatedStyle}>
          {content}
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
});
