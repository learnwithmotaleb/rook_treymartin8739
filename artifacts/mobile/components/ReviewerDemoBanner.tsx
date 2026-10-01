import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import {
  isReviewerDemoActive,
  subscribeReviewerDemo,
} from "@/lib/reviewerDemo";

export function ReviewerDemoBanner({
  message = "Fictional sample data · Changes stay in this preview only.",
}: {
  message?: string;
}) {
  const colors = useColors();
  const [isActive, setIsActive] = useState(isReviewerDemoActive);

  useEffect(() => {
    const syncActiveState = () => setIsActive(isReviewerDemoActive());
    const unsubscribe = subscribeReviewerDemo(syncActiveState);
    syncActiveState();
    return unsubscribe;
  }, []);

  if (!isActive) return null;

  return (
    <View
      accessibilityRole="text"
      style={[
        styles.container,
        { backgroundColor: colors.secondary, borderColor: colors.warning },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: colors.warning }]} />
      <Text style={[styles.text, { color: colors.foreground }]} numberOfLines={2}>
        Reviewer preview · {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  dot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  text: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
});