import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from "react-native";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    icon: "shield-checkmark",
    iconLib: "ionicons" as const,
    title: "AI-Powered Identity Protection",
    subtitle:
      "ShieldID continuously monitors the internet for impersonation, stolen photos, and identity threats — 24 hours a day.",
    accent: "#3B82F6",
  },
  {
    id: "2",
    icon: "radar",
    iconLib: "mci" as const,
    title: "Real-Time Threat Detection",
    subtitle:
      "Get instantly notified when someone creates a fake account, steals your photos, or tries to scam your followers.",
    accent: "#10B981",
  },
  {
    id: "3",
    icon: "brain",
    iconLib: "mci" as const,
    title: "AI Scam Analysis",
    subtitle:
      "Paste any suspicious message or link. Our AI will analyze it instantly and explain the threat in plain English.",
    accent: "#8B5CF6",
  },
  {
    id: "4",
    icon: "lock-closed",
    iconLib: "ionicons" as const,
    title: "Your Identity, Secured",
    subtitle:
      "Join thousands of creators, professionals, and businesses protecting their digital identity with ShieldID.",
    accent: "#F59E0B",
  },
];

export default function Onboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useApp();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
    } else {
      completeOnboarding();
      router.replace("/auth");
    }
  };

  const handleSkip = () => {
    completeOnboarding();
    router.replace("/auth");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <LinearGradient
              colors={[item.accent + "22", "transparent"]}
              style={styles.gradient}
            />
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: item.accent + "22", borderColor: item.accent + "44" },
              ]}
            >
              {item.iconLib === "ionicons" ? (
                <Ionicons name={item.icon as any} size={56} color={item.accent} />
              ) : (
                <MaterialCommunityIcons name={item.icon as any} size={56} color={item.accent} />
              )}
            </View>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {item.title}
            </Text>
            <Text
              style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
            >
              {item.subtitle}
            </Text>
          </View>
        )}
      />

      <View
        style={[
          styles.footer,
          { paddingBottom: bottomPad + 24, paddingTop: 16 },
        ]}
      >
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === activeIndex ? colors.primary : colors.border,
                  width: i === activeIndex ? 20 : 6,
                },
              ]}
            />
          ))}
        </View>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
          onPress={handleNext}
        >
          <Text style={[styles.buttonText, { fontFamily: "Inter_600SemiBold" }]}>
            {activeIndex === SLIDES.length - 1 ? "Get Started" : "Next"}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
        {activeIndex < SLIDES.length - 1 && (
          <TouchableOpacity onPress={handleSkip}>
            <Text
              style={[styles.skip, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
            >
              Skip
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    gap: 24,
  },
  gradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: {
    fontSize: 26,
    textAlign: "center",
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    gap: 16,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 27,
    paddingHorizontal: 32,
    width: "100%",
  },
  buttonText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  skip: {
    fontSize: 15,
  },
});
