import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { PlatformIcon } from "@/components/PlatformIcon";
import { Platform as PlatformType } from "@/context/AppContext";

const PLATFORMS: NonNullable<PlatformType>[] = [
  "instagram",
  "x",
  "tiktok",
  "linkedin",
  "youtube",
  "facebook",
];

export default function Setup() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<
    NonNullable<PlatformType>[]
  >(["instagram", "x", "tiktok"]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const togglePlatform = (p: NonNullable<PlatformType>) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleContinue = () => {
    router.replace("/(tabs)");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#3B82F622", "transparent"]}
        style={styles.topGradient}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 24, paddingBottom: bottomPad + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text
            style={[
              styles.step,
              { color: colors.primary, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            Identity Setup
          </Text>
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            Build your identity fingerprint
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
              },
            ]}
          >
            We'll use this to monitor for impersonators across all platforms
          </Text>
        </View>

        <View style={styles.section}>
          <Text
            style={[
              styles.label,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            Full Name
          </Text>
          <View
            style={[
              styles.input,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Ionicons
              name="person-outline"
              size={18}
              color={colors.mutedForeground}
            />
            <TextInput
              style={[
                styles.textInput,
                {
                  color: colors.foreground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
              placeholder="Your full name"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text
            style={[
              styles.label,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            Primary Username
          </Text>
          <View
            style={[
              styles.input,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Text
              style={[styles.atSign, { color: colors.mutedForeground }]}
            >
              @
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  color: colors.foreground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
              placeholder="yourusername"
              placeholderTextColor={colors.mutedForeground}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text
            style={[
              styles.label,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            Platforms to Monitor
          </Text>
          <View style={styles.platformGrid}>
            {PLATFORMS.map((p) => {
              const selected = selectedPlatforms.includes(p);
              return (
                <TouchableOpacity
                  key={p}
                  activeOpacity={0.75}
                  onPress={() => togglePlatform(p)}
                  style={[
                    styles.platformItem,
                    {
                      backgroundColor: selected
                        ? colors.primary + "22"
                        : colors.secondary,
                      borderColor: selected
                        ? colors.primary
                        : colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <PlatformIcon platform={p} size={36} showLabel />
                  {selected && (
                    <View
                      style={[
                        styles.checkmark,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.primary + "11", borderColor: colors.primary + "33" },
          ]}
        >
          <Ionicons name="information-circle" size={18} color={colors.primary} />
          <Text
            style={[
              styles.infoText,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            ShieldID will scan these platforms every 24 hours and alert you to
            suspicious activity.
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.continueBtn,
            { backgroundColor: colors.primary, borderRadius: 27 },
          ]}
          activeOpacity={0.8}
          onPress={handleContinue}
        >
          <Text
            style={[styles.continueText, { fontFamily: "Inter_600SemiBold" }]}
          >
            Start Monitoring
          </Text>
          <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 250 },
  content: { paddingHorizontal: 24, gap: 24 },
  header: { gap: 8 },
  step: { fontSize: 13, letterSpacing: 0.5, textTransform: "uppercase" },
  title: { fontSize: 26, lineHeight: 34 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  section: { gap: 10 },
  label: { fontSize: 13 },
  input: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  atSign: { fontSize: 17, fontWeight: "600" },
  textInput: { flex: 1, fontSize: 15, height: "100%" },
  platformGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  platformItem: {
    width: "30%",
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  checkmark: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCard: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  infoText: { fontSize: 13, lineHeight: 20, flex: 1 },
  continueBtn: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  continueText: { color: "#FFFFFF", fontSize: 16 },
});
