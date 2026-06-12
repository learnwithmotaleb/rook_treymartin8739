import React, { useState, useCallback, useEffect } from "react";
import {
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
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as AppleAuthentication from "expo-apple-authentication";
import { useSignIn, useSignUp, useSSO, useAuth } from "@clerk/expo";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";

WebBrowser.maybeCompleteAuthSession();

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

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const loading = signInStatus === "fetching" || signUpStatus === "fetching" || ssoLoading;

  // v3: derive verify step from signUp status instead of local state
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
      const { error: signInError } = await signIn!.password({
        emailAddress: email.trim(),
        password,
      });
      if (signInError) {
        setError(signInError.longMessage ?? signInError.message ?? "Sign in failed");
        return;
      }
      if (signIn!.status === "complete") {
        await signIn!.finalize({
          navigate: () => {
            router.replace("/(tabs)/" as any);
          },
        });
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
        emailAddress: email.trim(),
        password,
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(" ") || undefined,
      } as any);
      if (signUpError) {
        setError(signUpError.longMessage ?? signUpError.message ?? "Sign up failed");
        return;
      }
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
        await signUp!.finalize({
          navigate: () => {
            router.replace("/(tabs)/" as any);
          },
        });
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (e: any) {
      const clerkErr = e?.errors?.[0];
      setError(clerkErr?.longMessage ?? clerkErr?.message ?? e?.message ?? "Verification failed");
    }
  }, [signUp, code]);

  const handleGoogleSSO = useCallback(async () => {
    setError("");
    setSsoLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: () => {
            router.replace("/(tabs)/" as any);
          },
        } as any);
      }
    } catch (e: any) {
      const clerkErr = e?.errors?.[0];
      setError(clerkErr?.longMessage ?? clerkErr?.message ?? e?.message ?? "Google sign in failed");
    } finally {
      setSsoLoading(false);
    }
  }, [startSSOFlow]);

  const handleAppleSSO = useCallback(async () => {
    setError("");
    setSsoLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_apple",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: () => {
            router.replace("/(tabs)/" as any);
          },
        } as any);
      }
    } catch (e: any) {
      if ((e as any).code === "ERR_REQUEST_CANCELED") return;
      const clerkErr = e?.errors?.[0];
      setError(clerkErr?.longMessage ?? clerkErr?.message ?? e?.message ?? "Apple sign in failed");
    } finally {
      setSsoLoading(false);
    }
  }, [startSSOFlow]);

  const handleSubmit = () => {
    if (mode === "login") handleSignIn();
    else handleSignUp();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={["#3B82F622", "transparent"]} style={[styles.topGradient, { height: 280 }]} />

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingTop: topPad + 40, paddingBottom: bottomPad + 24 }]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoRow}>
          <View style={[styles.logoIcon, { backgroundColor: colors.primary + "22", borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.logoText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>ShieldID</Text>
        </View>

        {showVerify ? (
          <>
            <Text style={[styles.headline, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Verify your email</Text>
            <Text style={[styles.subheadline, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>We sent a code to {email}</Text>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Verification Code</Text>
              <View style={[styles.input, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Ionicons name="key-outline" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.textInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                  placeholder="6-digit code"
                  placeholderTextColor={colors.mutedForeground}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {error !== "" && (
              <Text style={[styles.error, { color: colors.danger, fontFamily: "Inter_400Regular" }]}>{error}</Text>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
              activeOpacity={0.8}
              onPress={handleVerify}
              disabled={loading}
            >
              <Text style={[styles.submitText, { fontFamily: "Inter_600SemiBold" }]}>
                {loading ? "Verifying…" : "Verify Email"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => signUp!.verifications.sendEmailCode()}
              style={styles.switchRow}
            >
              <Text style={[styles.switchLink, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Didn't receive it?{" "}
              </Text>
              <Text style={[styles.switchLink, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>Resend</Text>
            </TouchableOpacity>
            <View nativeID="clerk-captcha" />
          </>
        ) : (
          <>
            <Text style={[styles.headline, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {mode === "login" ? "Welcome back" : "Create account"}
            </Text>
            <Text style={[styles.subheadline, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {mode === "login" ? "Sign in to your identity shield" : "Start protecting your digital identity"}
            </Text>

            <TouchableOpacity
              style={[styles.googleBtn, { backgroundColor: colors.secondary, borderColor: colors.border, opacity: loading ? 0.7 : 1 }]}
              activeOpacity={0.8}
              onPress={handleGoogleSSO}
              disabled={loading}
            >
              <Ionicons name="logo-google" size={18} color={colors.foreground} />
              <Text style={[styles.googleText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>Continue with Google</Text>
            </TouchableOpacity>

            {Platform.OS === "ios" && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={[styles.appleBtn, { opacity: loading ? 0.7 : 1 }]}
                onPress={handleAppleSSO}
              />
            )}

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {mode === "register" && (
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Full Name</Text>
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
              <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Email</Text>
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
              <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Password</Text>
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
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>

            {error !== "" && (
              <Text style={[styles.error, { color: colors.danger, fontFamily: "Inter_400Regular" }]}>{error}</Text>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 }]}
              activeOpacity={0.8}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={[styles.submitText, { fontFamily: "Inter_600SemiBold" }]}>
                {loading
                  ? (mode === "login" ? "Signing in…" : "Creating account…")
                  : (mode === "login" ? "Sign In" : "Create Account")}
              </Text>
            </TouchableOpacity>

            {mode === "register" && (
              <Text style={[styles.consentText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                By creating an account, you agree to our{" "}
                <Text
                  style={{ color: colors.primary }}
                  onPress={() => router.push("/legal" as any)}
                >
                  Terms of Service
                </Text>
                {" "}and{" "}
                <Text
                  style={{ color: colors.primary }}
                  onPress={() => router.push("/legal" as any)}
                >
                  Privacy Policy
                </Text>
                .
              </Text>
            )}

            <View style={styles.switchRow}>
              <Text style={[styles.switchText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {mode === "login" ? "Don't have an account?" : "Already have an account?"}
              </Text>
              <TouchableOpacity onPress={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
                <Text style={[styles.switchLink, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                  {mode === "login" ? "Sign Up" : "Sign In"}
                </Text>
              </TouchableOpacity>
            </View>
            <View nativeID="clerk-captcha" />
          </>
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0 },
  content: { paddingHorizontal: 24, gap: 16 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  logoIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  logoText: { fontSize: 22 },
  headline: { fontSize: 28, lineHeight: 34 },
  subheadline: { fontSize: 15, lineHeight: 22, marginTop: -8 },
  field: { gap: 8 },
  label: { fontSize: 13 },
  input: { flexDirection: "row", alignItems: "center", gap: 10, height: 52, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  textInput: { flex: 1, fontSize: 15, height: "100%" },
  error: { fontSize: 13, lineHeight: 18 },
  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 52, borderRadius: 12, borderWidth: 1 },
  googleText: { fontSize: 15 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },
  submitBtn: { height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", marginTop: 8 },
  submitText: { color: "#FFFFFF", fontSize: 16 },
  appleBtn: { height: 52, borderRadius: 12 },
  consentText: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  switchRow: { flexDirection: "row", gap: 6, justifyContent: "center" },
  switchText: { fontSize: 14 },
  switchLink: { fontSize: 14 },
});
