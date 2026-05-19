import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
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
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

export default function Auth() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSubmit = () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    if (mode === "register" && !name) {
      setError("Please enter your name");
      return;
    }
    setError("");
    setLoading(true);
    setTimeout(() => {
      login(name || "Alex Johnson", email);
      setLoading(false);
      router.replace("/setup");
    }, 1200);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#3B82F622", "transparent"]}
        style={[styles.topGradient, { height: 280 }]}
      />

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 40, paddingBottom: bottomPad + 24 },
        ]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoRow}>
          <View style={[styles.logoIcon, { backgroundColor: colors.primary + "22", borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.logoText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            ShieldID
          </Text>
        </View>

        <Text style={[styles.headline, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {mode === "login" ? "Welcome back" : "Create account"}
        </Text>
        <Text style={[styles.subheadline, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {mode === "login"
            ? "Sign in to your identity shield"
            : "Start protecting your digital identity"}
        </Text>

        {mode === "register" && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              Full Name
            </Text>
            <View style={[styles.input, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Ionicons name="person-outline" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.textInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                placeholder="Your full name"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          </View>
        )}

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            Email
          </Text>
          <View style={[styles.input, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Ionicons name="mail-outline" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.textInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholder="your@email.com"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            Password
          </Text>
          <View style={[styles.input, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.textInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
              placeholder="••••••••"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>
        </View>

        {error !== "" && (
          <Text style={[styles.error, { color: colors.danger, fontFamily: "Inter_400Regular" }]}>
            {error}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.submitText, { fontFamily: "Inter_600SemiBold" }]}>
              {mode === "login" ? "Sign In" : "Create Account"}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.switchRow}>
          <Text style={[styles.switchText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}
          </Text>
          <TouchableOpacity onPress={() => setMode(mode === "login" ? "register" : "login")}>
            <Text style={[styles.switchLink, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
              {mode === "login" ? "Sign Up" : "Sign In"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0 },
  content: { paddingHorizontal: 24, gap: 16 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  logoIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  logoText: { fontSize: 22 },
  headline: { fontSize: 28, lineHeight: 34 },
  subheadline: { fontSize: 15, lineHeight: 22, marginTop: -8 },
  field: { gap: 8 },
  label: { fontSize: 13 },
  input: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  textInput: { flex: 1, fontSize: 15, height: "100%" },
  error: { fontSize: 13 },
  submitBtn: {
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitText: { color: "#FFFFFF", fontSize: 16 },
  switchRow: { flexDirection: "row", gap: 6, justifyContent: "center" },
  switchText: { fontSize: 14 },
  switchLink: { fontSize: 14 },
});
