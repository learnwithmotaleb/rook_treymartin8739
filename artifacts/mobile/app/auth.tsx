import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
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
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as AppleAuthentication from "expo-apple-authentication";
import { useSignIn, useSignUp, useSSO, useAuth } from "@clerk/expo";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";

WebBrowser.maybeCompleteAuthSession();

// --- Feature pills shown below headline ---
const FEATURES = [
  { icon: "shield-checkmark", label: "Impersonator Scan" },
  { icon: "image", label: "Photo Monitor" },
  { icon: "notifications", label: "Live Alerts" },
] as const;

// Separate component for the animated glow so hook rules are respected
function GlowRings() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const outerOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.18] });
  const midOpacity   = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.24] });

  return (
    <View style={glowStyles.container} pointerEvents="none">
      <Animated.View style={[glowStyles.ring, glowStyles.outer, { opacity: outerOpacity }]} />
      <Animated.View style={[glowStyles.ring, glowStyles.mid,   { opacity: midOpacity }]} />
      <View style={[glowStyles.ring, glowStyles.inner]} />
    </View>
  );
}

const glowStyles = StyleSheet.create({
  container: { position: "absolute", alignItems: "center", justifyContent: "center", width: 220, height: 220 },
  ring: { position: "absolute", borderRadius: 999, borderWidth: 1, borderColor: "#3B82F6" },
  outer: { width: 210, height: 210 },
  mid:   { width: 154, height: 154 },
  inner: { width: 104, height: 104, opacity: 0.18 },
});

export default function Auth() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();

  const { signIn, fetchStatus: signInStatus } = useSignIn();
  const { signUp, fetchStatus: signUpStatus } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [ssoLoading, setSsoLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const loading = signInStatus === "fetching" || signUpStatus === "fetching" || ssoLoading;

  const showVerify =
    signUp?.status === "missing_requirements" &&
    (signUp?.unverifiedFields ?? []).includes("email_address") &&
    (signUp?.missingFields ?? []).length === 0;

  useEffect(() => {
    if (isSignedIn) router.replace("/(tabs)/" as any);
  }, [isSignedIn]);

  const handleSignIn = useCallback(async () => {
    if (!email || !password) { setError("Please fill in all fields"); return; }
    setError("");
    try {
      const { error: signInError } = await signIn!.password({ emailAddress: email.trim(), password });
      if (signInError) { setError(signInError.longMessage ?? signInError.message ?? "Sign in failed"); return; }
      if (signIn!.status === "complete") {
        await signIn!.finalize({ navigate: () => { router.replace("/(tabs)/" as any); } });
      }
    } catch (e: any) {
      const clerkErr = e?.errors?.[0];
      setError(clerkErr?.longMessage ?? clerkErr?.message ?? e?.message ?? "Sign in failed");
    }
  }, [signIn, email, password]);

  const handleSignUp = useCallback(async () => {
    if (!email || !password || !name) { setError("Please fill in all fields"); return; }
    setError("");
    try {
      const nameParts = name.trim().split(" ");
      const { error: signUpError } = await signUp!.password({
        emailAddress: email.trim(), password,
        firstName: nameParts[0], lastName: nameParts.slice(1).join(" ") || undefined,
      } as any);
      if (signUpError) { setError(signUpError.longMessage ?? signUpError.message ?? "Sign up failed"); return; }
      await signUp!.verifications.sendEmailCode();
    } catch (e: any) {
      const clerkErr = e?.errors?.[0];
      setError(clerkErr?.longMessage ?? clerkErr?.message ?? e?.message ?? "Sign up failed");
    }
  }, [signUp, email, password, name]);

  const handleVerify = useCallback(async () => {
    if (!code) { setError("Enter the verification code"); return; }
    setError("");
    try {
      await signUp!.verifications.verifyEmailCode({ code });
      if (signUp!.status === "complete") {
        await signUp!.finalize({ navigate: () => { router.replace("/(tabs)/" as any); } });
      } else { setError("Verification incomplete. Please try again."); }
    } catch (e: any) {
      const clerkErr = e?.errors?.[0];
      setError(clerkErr?.longMessage ?? clerkErr?.message ?? e?.message ?? "Verification failed");
    }
  }, [signUp, code]);

  const handleGoogleSSO = useCallback(async () => {
    setError(""); setSsoLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({ strategy: "oauth_google", redirectUrl: AuthSession.makeRedirectUri() });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId, navigate: () => { router.replace("/(tabs)/" as any); } } as any);
      }
    } catch (e: any) {
      const clerkErr = e?.errors?.[0];
      setError(clerkErr?.longMessage ?? clerkErr?.message ?? e?.message ?? "Google sign in failed");
    } finally { setSsoLoading(false); }
  }, [startSSOFlow]);

  const handleAppleSSO = useCallback(async () => {
    setError(""); setSsoLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({ strategy: "oauth_apple", redirectUrl: AuthSession.makeRedirectUri() });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId, navigate: () => { router.replace("/(tabs)/" as any); } } as any);
      }
    } catch (e: any) {
      if ((e as any).code === "ERR_REQUEST_CANCELED") return;
      const clerkErr = e?.errors?.[0];
      setError(clerkErr?.longMessage ?? clerkErr?.message ?? e?.message ?? "Apple sign in failed");
    } finally { setSsoLoading(false); }
  }, [startSSOFlow]);

  const handleSubmit = () => { if (mode === "login") handleSignIn(); else handleSignUp(); };

  const inputBorder = (field: string) => focusedField === field ? "#3B82F6" : "#1A2740";

  return (
    <View style={styles.container}>
      {/* ── Deep background ── */}
      <LinearGradient
        colors={["#0D1B38", "#070B12", "#070B12"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Top radial burst ── */}
      <View style={styles.radialBurst} pointerEvents="none">
        <LinearGradient
          colors={["#3B82F630", "#3B82F610", "transparent"]}
          style={styles.radialGradient}
        />
      </View>

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16, paddingBottom: bottomPad + 32 }]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ══ HERO ══════════════════════════════════════════════════ */}
        <View style={styles.heroSection}>
          <View style={styles.logoGlowContainer}>
            <GlowRings />
            <View style={styles.logoBadge}>
              <Image source={require("../assets/images/logo-mark.png")} style={styles.logoImage} resizeMode="contain" />
            </View>
          </View>

          <Text style={styles.brandName}>ROOK</Text>
          <View style={styles.taglineRow}>
            <Ionicons name="shield-checkmark" size={13} color="#3B82F6" />
            <Text style={styles.taglineText}>AI Identity Protection</Text>
          </View>
        </View>

        {/* ══ FORM CARD ════════════════════════════════════════════ */}
        <View style={styles.card}>

          {showVerify ? (
            /* ── Email Verification ── */
            <>
              <View style={styles.cardHeader}>
                <Text style={styles.headline}>Check your inbox</Text>
                <Text style={styles.subheadline}>We sent a 6-digit code to{"\n"}<Text style={styles.emailHighlight}>{email}</Text></Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Verification Code</Text>
                <View style={[styles.inputRow, { borderColor: inputBorder("code") }]}>
                  <Ionicons name="key-outline" size={18} color={focusedField === "code" ? "#3B82F6" : "#6B8EAE"} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="• • • • • •"
                    placeholderTextColor="#3B4C6B"
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    onFocus={() => setFocusedField("code")}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>

              {error !== "" && <ErrorBanner message={error} />}

              <GradientButton label={loading ? "Verifying…" : "Verify Email"} onPress={handleVerify} disabled={loading} />

              <TouchableOpacity onPress={() => signUp!.verifications.sendEmailCode()} style={styles.switchRow}>
                <Text style={styles.switchText}>Didn't get it? </Text>
                <Text style={styles.switchLink}>Resend code</Text>
              </TouchableOpacity>
              <View nativeID="clerk-captcha" />
            </>

          ) : (
            /* ── Login / Register ── */
            <>
              <View style={styles.cardHeader}>
                <Text style={styles.headline}>
                  {mode === "login" ? "Welcome back" : "Create account"}
                </Text>
                <Text style={styles.subheadline}>
                  {mode === "login"
                    ? "Sign in to your identity shield"
                    : "Start protecting your digital identity"}
                </Text>
              </View>

              {/* Feature pills — shown on register to reinforce value */}
              {mode === "register" && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll} contentContainerStyle={styles.pillsRow}>
                  {FEATURES.map((f) => (
                    <View key={f.label} style={styles.pill}>
                      <Ionicons name={f.icon as any} size={12} color="#3B82F6" />
                      <Text style={styles.pillText}>{f.label}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* ── SSO Buttons ── */}
              <View style={styles.ssoGroup}>
                <TouchableOpacity
                  style={[styles.ssoBtn, { opacity: loading ? 0.6 : 1 }]}
                  activeOpacity={0.75}
                  onPress={handleGoogleSSO}
                  disabled={loading}
                >
                  <View style={styles.ssoBtnInner}>
                    <Ionicons name="logo-google" size={19} color="#F0F4FF" />
                    <Text style={styles.ssoLabel}>Continue with Google</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color="#3B4C6B" />
                </TouchableOpacity>

                {Platform.OS === "ios" && (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={14}
                    style={[styles.appleBtn, { opacity: loading ? 0.6 : 1 }]}
                    onPress={handleAppleSSO}
                  />
                )}
              </View>

              {/* ── Divider ── */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with email</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* ── Mode toggle ── */}
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[styles.segment, mode === "login" && styles.segmentActive]}
                  onPress={() => { setMode("login"); setError(""); }}
                >
                  <Text style={[styles.segmentLabel, mode === "login" && styles.segmentLabelActive]}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segment, mode === "register" && styles.segmentActive]}
                  onPress={() => { setMode("register"); setError(""); }}
                >
                  <Text style={[styles.segmentLabel, mode === "register" && styles.segmentLabelActive]}>Create Account</Text>
                </TouchableOpacity>
              </View>

              {/* ── Fields ── */}
              {mode === "register" && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Full Name</Text>
                  <View style={[styles.inputRow, { borderColor: inputBorder("name") }]}>
                    <Ionicons name="person-outline" size={18} color={focusedField === "name" ? "#3B82F6" : "#6B8EAE"} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Your full name"
                      placeholderTextColor="#3B4C6B"
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                      onFocus={() => setFocusedField("name")}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Email</Text>
                <View style={[styles.inputRow, { borderColor: inputBorder("email") }]}>
                  <Ionicons name="mail-outline" size={18} color={focusedField === "email" ? "#3B82F6" : "#6B8EAE"} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="your@email.com"
                    placeholderTextColor="#3B4C6B"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={[styles.inputRow, { borderColor: inputBorder("password") }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={focusedField === "password" ? "#3B82F6" : "#6B8EAE"} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="••••••••"
                    placeholderTextColor="#3B4C6B"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    returnKeyType="go"
                    onSubmitEditing={handleSubmit}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#6B8EAE" />
                  </TouchableOpacity>
                </View>
              </View>

              {error !== "" && <ErrorBanner message={error} />}

              <GradientButton
                label={loading ? (mode === "login" ? "Signing in…" : "Creating account…") : (mode === "login" ? "Sign In" : "Create Account")}
                onPress={handleSubmit}
                disabled={loading}
              />

              {mode === "register" && (
                <Text style={styles.consentText}>
                  By creating an account you agree to our{" "}
                  <Text style={styles.consentLink} onPress={() => router.push("/legal" as any)}>Terms of Service</Text>
                  {" "}and{" "}
                  <Text style={styles.consentLink} onPress={() => router.push("/legal" as any)}>Privacy Policy</Text>.
                </Text>
              )}

              <View nativeID="clerk-captcha" />
            </>
          )}
        </View>

        {/* ── Bottom badge ── */}
        <View style={styles.bottomBadge}>
          <Ionicons name="lock-closed" size={12} color="#3B4C6B" />
          <Text style={styles.bottomBadgeText}>256-bit encrypted · SOC 2 ready</Text>
        </View>

      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function GradientButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.82} style={{ opacity: disabled ? 0.6 : 1 }}>
      <LinearGradient
        colors={["#3B82F6", "#6366F1"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientBtn}
      >
        <Text style={styles.gradientBtnText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="alert-circle-outline" size={15} color="#EF4444" />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070B12" },
  radialBurst: { position: "absolute", top: -60, left: "50%", marginLeft: -200, width: 400, height: 380 },
  radialGradient: { width: "100%", height: "100%", borderRadius: 200 },

  scroll: { paddingHorizontal: 20, gap: 20, alignItems: "stretch" },

  // Hero
  heroSection: { alignItems: "center", paddingTop: 12, paddingBottom: 4, gap: 10 },
  logoGlowContainer: { width: 220, height: 220, alignItems: "center", justifyContent: "center" },
  logoBadge: {
    width: 80, height: 80, borderRadius: 22,
    backgroundColor: "#0D1B38",
    borderWidth: 1, borderColor: "#1E3A5F",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#3B82F6", shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 0 },
  },
  logoImage: { width: 52, height: 52 },
  brandName: {
    fontFamily: "Inter_700Bold",
    fontSize: 30, letterSpacing: 8,
    color: "#F0F4FF",
    marginTop: -8,
  },
  taglineRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  taglineText: { fontFamily: "Inter_500Medium", fontSize: 12, color: "#6B8EAE", letterSpacing: 1.5 },

  // Card
  card: {
    backgroundColor: "#0D142080",
    borderWidth: 1, borderColor: "#1A2740",
    borderRadius: 24,
    padding: 22,
    gap: 16,
  },
  cardHeader: { gap: 6 },
  headline: { fontFamily: "Inter_700Bold", fontSize: 26, color: "#F0F4FF", lineHeight: 32 },
  subheadline: { fontFamily: "Inter_400Regular", fontSize: 14, color: "#6B8EAE", lineHeight: 20 },
  emailHighlight: { color: "#3B82F6", fontFamily: "Inter_600SemiBold" },

  // Feature pills
  pillsScroll: { marginHorizontal: -4 },
  pillsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 4 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#3B82F615", borderWidth: 1, borderColor: "#3B82F630",
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  pillText: { fontFamily: "Inter_500Medium", fontSize: 11, color: "#94B4D0" },

  // SSO
  ssoGroup: { gap: 10 },
  ssoBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#131C2B", borderWidth: 1, borderColor: "#1A2740",
    borderRadius: 14, paddingHorizontal: 16, height: 54,
  },
  ssoBtnInner: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  ssoLabel: { fontFamily: "Inter_500Medium", fontSize: 15, color: "#F0F4FF" },
  appleBtn: { height: 54, borderRadius: 14 },

  // Divider
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#1A2740" },
  dividerText: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#3B4C6B" },

  // Segmented control (replaces bottom switch link)
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#0A1020",
    borderRadius: 12, borderWidth: 1, borderColor: "#1A2740",
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1, height: 38, alignItems: "center", justifyContent: "center",
    borderRadius: 10,
  },
  segmentActive: { backgroundColor: "#1A2E50" },
  segmentLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: "#3B4C6B" },
  segmentLabelActive: { color: "#3B82F6", fontFamily: "Inter_600SemiBold" },

  // Fields
  field: { gap: 7 },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: "#6B8EAE", letterSpacing: 0.3 },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    height: 52, borderRadius: 13, borderWidth: 1.5,
    backgroundColor: "#0A1020", paddingHorizontal: 14,
  },
  textInput: { flex: 1, fontSize: 15, color: "#F0F4FF", fontFamily: "Inter_400Regular", height: "100%" },

  // Error
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#EF444415", borderRadius: 10, padding: 10 },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 13, color: "#EF4444", flex: 1 },

  // CTA
  gradientBtn: { height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  gradientBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#FFFFFF", letterSpacing: 0.3 },

  // Consent
  consentText: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#3B4C6B", textAlign: "center", lineHeight: 18 },
  consentLink: { color: "#3B82F6" },

  // Resend row (verify screen)
  switchRow: { flexDirection: "row", gap: 4, justifyContent: "center", paddingTop: 2 },
  switchText: { fontFamily: "Inter_400Regular", fontSize: 14, color: "#3B4C6B" },
  switchLink: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#3B82F6" },

  // Bottom badge
  bottomBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingBottom: 4 },
  bottomBadgeText: { fontFamily: "Inter_400Regular", fontSize: 11, color: "#2A3A52" },
});
