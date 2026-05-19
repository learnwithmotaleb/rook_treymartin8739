import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { Platform } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const PLATFORM_CONFIG: Record<
  NonNullable<Platform>,
  { icon: string; color: string; bg: string; lib: "fa5" | "mci" }
> = {
  instagram: {
    icon: "instagram",
    color: "#FFFFFF",
    bg: "#E1306C",
    lib: "fa5",
  },
  x: { icon: "twitter", color: "#FFFFFF", bg: "#14171A", lib: "fa5" },
  tiktok: { icon: "tiktok", color: "#FFFFFF", bg: "#FE2C55", lib: "fa5" },
  linkedin: { icon: "linkedin", color: "#FFFFFF", bg: "#0A66C2", lib: "fa5" },
  youtube: { icon: "youtube", color: "#FFFFFF", bg: "#FF0000", lib: "fa5" },
  facebook: { icon: "facebook", color: "#FFFFFF", bg: "#1877F2", lib: "fa5" },
  snapchat: { icon: "snapchat-ghost", color: "#000000", bg: "#FFFC00", lib: "fa5" },
};

interface PlatformIconProps {
  platform: NonNullable<Platform>;
  size?: number;
  showLabel?: boolean;
  onPress?: () => void;
}

export function PlatformIcon({
  platform,
  size = 44,
  showLabel = false,
  onPress,
}: PlatformIconProps) {
  const colors = useColors();
  const config = PLATFORM_CONFIG[platform];
  const iconSize = size * 0.46;

  const content = (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: config.bg,
            borderColor: colors.border,
          },
        ]}
      >
        {config.lib === "fa5" ? (
          <FontAwesome5 name={config.icon as any} size={iconSize} color={config.color} />
        ) : (
          <MaterialCommunityIcons name={config.icon as any} size={iconSize} color={config.color} />
        )}
      </View>
      {showLabel && (
        <Text
          style={[
            styles.label,
            { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
          ]}
        >
          {platform.charAt(0).toUpperCase() + platform.slice(1)}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.75} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: 6,
  },
  circle: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  label: {
    fontSize: 11,
  },
});
