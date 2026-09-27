import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as AppleAuthentication from "expo-apple-authentication";
import { useSignIn, useSignUp, useSSO, useAuth, useClerk } from "@clerk/expo";
import { useSignInWithApple } from "@clerk/expo/apple";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";
import {
  CURRENT_TERMS_VERSION,
  recordAgeConfirmation,
  recordTermsAcceptance,
  requestAppReviewTicket,
  updateMe,
} from "@/lib/api";

WebBrowser.maybeCompleteAuthSession();

// --- Feature pills shown below headline ---
const FEATURES = [
  { icon: "shield-checkmark", label: "Impersonator Scan" },
  { icon: "image", label: "Photo Monitor" },
  { icon: "notifications", label: "Live Alerts" },
] as const;

// Not a valid email address, so this cannot intercept a regular user's login.
// App Review Information uses review:<reviewer email> as its protected username.
const REVIEW_USERNAME_PREFIX = "review:";

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

/** Maps Clerk error codes/messages to user-friendly copy. */
function friendlyClerkError(err: { code?: string; longMessage?: string; message?: string }): string {
  const code = err.code ?? "";
  if (code === "form_password_pwned" || (err.longMessage ?? "").toLowerCase().includes("data breach") || (err.message ?? "").toLowerCase().includes("data breach")) {
    return "This password has appeared in a known data breach. Please choose a different, unique password.";
  }
  if (code === "form_password_not_strong_enough" || code === "form_password_too_short") {
    return "Password is too weak. Use at least 8 characters with a mix of letters, numbers, and symbols.";
  }
  if (code === "form_identifier_exists" || code === "form_identifier_not_found") {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (code === "form_password_incorrect") {
    return "Incorrect password. Please try again.";
  }
  if (code === "form_code_incorrect") {
    return "That code is incorrect or expired. Please try again.";
  }
  return err.longMessage ?? err.message ?? "Something went wrong. Please try again.";
}

export default function Auth() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  // clerk.client.signUp is the live SignUpResource class instance with all methods.
  // The useSignUp() hook returns a reactive snapshot (plain data object) after
  // re-renders — it has status/fields for rendering but is missing class methods
  // like prepareEmailAddressVerification. Always use clerk.client.signUp for actions.
  const clerk = useClerk();
  // In Clerk React v6, useSignIn/useSignUp return reactive signal snapshots (plain data
  // objects). They expose status/fields for rendering but are missing all class methods.
  // Always use clerk.client.signIn / clerk.client.signUp for any action call, and
  // clerk.setActive() to activate a session.
  const liveSignUp = () => (clerk as any).client?.signUp;
  const liveSignIn = () => (clerk as any).client?.signIn;

  const { signIn, fetchStatus: signInStatus } = useSignIn();
  const { signUp, fetchStatus: signUpStatus } = useSignUp() as any;
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [ssoLoading, setSsoLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [needsSigninCode, setNeedsSigninCode] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [pendingSocialSignIn, setPendingSocialSignIn] = useState<{
    sessionId: string;
    activate: (options: { session: string }) => Promise<unknown>;
    newUserId: string;
  } | null>(null);
  // Explicit loading flag for Clerk calls that go through clerk.client directly
  // (not via the hook signals) — those calls don't update signInStatus/signUpStatus.
  const [authLoading, setAuthLoading] = useState(false);

  // Whether we've already sent the verification email for this sign-up attempt.
  // Prevents the useEffect below from re-sending on every re-render.
  const verificationSentRef = useRef(false);
  // Stores the return value of signUp.create() — which is `this` on the actual
  // SignUpResource class instance, guaranteed to have prepareEmailAddressVerification.
  const createdSignUpRef = useRef<any>(null);
  // setActive updates Clerk synchronously enough to trigger the signed-in
  // redirect effect. Keep that redirect from racing the required compliance
  // writes; the success path navigates explicitly after they complete.
  const recordingComplianceRef = useRef(false);

  // When true the user has tapped "Start over" and we show the sign-up form
  // even if Clerk still has a pending sign-up in its store.
  const [verifyAbandoned, setVerifyAbandoned] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const loading = authLoading || signInStatus === "fetching" || signUpStatus === "fetching" || ssoLoading;

  // showVerify: true once Clerk has the sign-up created and needs email confirmation.
  // verifyAbandoned lets the user escape back to the form without having to enter a code.
  const showVerify =
    !verifyAbandoned &&
    signUp?.status === "missing_requirements" &&
    (signUp?.unverifiedFields ?? []).includes("email_address");

  // Redirect already-signed-in users away from this screen.
  useEffect(() => {
    if (isSignedIn && !recordingComplianceRef.current) router.replace("/(tabs)/" as any);
  }, [isSignedIn]);

  // ── Send email verification code ──────────────────────────────────────────
  useEffect(() => {
    if (!showVerify) return;
    if (verificationSentRef.current) return;
    verificationSentRef.current = true;

    // useSignUp() returns a computed plain-object signal — it has data fields
    // and `create` but not `prepareEmailAddressVerification`. Try three sources
    // in order: clerk.client.signUp → return value of create() → give up.
    const live = liveSignUp();  // clerk.client.signUp
    const fallback = createdSignUpRef.current; // return value of create() = `this` on ri
    const candidate = live ?? fallback;

    console.log("[SignUp] useEffect fired. live:", typeof live,
      "fallback:", typeof fallback,
      "hasPrepare:", typeof candidate?.prepareEmailAddressVerification,
      "hasPrepareVerification:", typeof candidate?.prepareVerification);

    // Pick whichever prepare method exists on the candidate instance.
    const prepFn: ((opts: { strategy: string }) => Promise<any>) | undefined =
      candidate?.prepareEmailAddressVerification?.bind(candidate) ??
      (candidate?.prepareVerification ? (opts: any) => candidate.prepareVerification(opts) : undefined);

    if (!prepFn) {
      console.log("[SignUp] No prepare method found on any candidate.");
      setError("Could not send verification email — please tap 'Resend code' to try again.");
      verificationSentRef.current = false;
      return;
    }

    prepFn({ strategy: "email_code" })
      .then(() => { console.log("[SignUp] prepareEmailAddressVerification resolved — email sent"); })
      .catch((e: any) => {
        console.log("[SignUp] prepareEmailAddressVerification rejected:", e?.message, e?.errors);
        const clerkErr = e?.errors?.[0];
        setError(clerkErr ? friendlyClerkError(clerkErr) : (e?.message || "Could not send verification email."));
        verificationSentRef.current = false;
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showVerify]);

  const handleSignIn = useCallback(async () => {
    if (!email || !password) { setError("Please fill in all fields"); return; }
    setError("");
    setAuthLoading(true);
    try {
      // Use the live SignIn resource — useSignIn() signal has no class methods.
      const live = liveSignIn();
      const result = await live.create({ identifier: email.trim(), password });
      console.log("[SignIn] create result.status:", result?.status, "createdSessionId:", result?.createdSessionId);
      if (result.status === "complete") {
        await clerk.setActive({ session: result.createdSessionId });
        router.replace("/(tabs)/" as any);
      } else if (result.status === "needs_second_factor") {
        // New-device / MFA verification — prepare an email OTP then show code UI.
        await live.prepareSecondFactor({ strategy: "email_code" });
        setCode("");
        setNeedsSigninCode(true);
      } else {
        setError("Sign in requires additional steps. Please contact support.");
      }
    } catch (e: any) {
      const clerkErr = e?.errors?.[0];
      setError(clerkErr ? friendlyClerkError(clerkErr) : (e?.message ?? "Sign in failed"));
    } finally {
      setAuthLoading(false);
    }
  }, [clerk, email, password]);

  const handleVerifySignInCode = useCallback(async () => {
    if (!code) { setError("Enter the verification code"); return; }
    setError("");
    setAuthLoading(true);
    try {
      const live = liveSignIn();
      const result = await live.attemptSecondFactor({ strategy: "email_code", code });
      console.log("[SignIn 2FA] attemptSecondFactor result.status:", result?.status);
      if (result.status === "complete") {
        await clerk.setActive({ session: result.createdSessionId });
        router.replace("/(tabs)/" as any);
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (e: any) {
      const clerkErr = e?.errors?.[0];
      setError(clerkErr?.longMessage ?? clerkErr?.message ?? e?.message ?? "Verification failed");
    } finally {
      setAuthLoading(false);
    }
  }, [clerk, code]);

  const completeReviewAccess = useCallback(async (reviewerEmail: string, accessCode: string) => {
    if (!reviewerEmail.trim() || !accessCode) {
      setError("Enter the reviewer username and access code");
      return;
    }
    setError("");
    setAuthLoading(true);
    try {
      const { ticket } = await requestAppReviewTicket(reviewerEmail.trim(), accessCode);
      const live = liveSignIn();
      const result = await live.create({ strategy: "ticket", ticket });
      if (result.status === "complete") {
        await clerk.setActive({ session: result.createdSessionId });
        router.replace("/(tabs)/" as any);
      } else {
        setError("App Review access could not be completed. Please try again.");
      }
    } catch (e: any) {
      setError(e?.message ?? "App Review access failed");
    } finally {
      setAuthLoading(false);
    }
  }, [clerk]);

  // Step 1 of sign-up: create the Clerk account only.
  // prepareEmailAddressVerification is triggered by the useEffect above once
  // Clerk re-renders this component with signUp.status = "missing_requirements".
  const handleSignUp = useCallback(async () => {
    if (!firstName.trim() || !lastName.trim() || !email || !password) {
      setError("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setAuthLoading(true);
    setVerifyAbandoned(false);           // un-abandon so the verify screen can show
    verificationSentRef.current = false; // reset so the effect can send the code
    try {
      // firstName is required by this Clerk instance config.
      // lastName is disabled — the full display name is stored in our own DB
      // via updateMe() after email verification completes.
      // create() returns `this` — the actual SignUpResource class instance —
      // which always has prepareEmailAddressVerification. Store it as a fallback
      // for the useEffect in case clerk.client.signUp isn't reachable.
      const created = await signUp!.create({
        firstName: firstName.trim(),
        emailAddress: email.trim(),
        password,
      });
      createdSignUpRef.current = created;
      console.log("[SignUp] create() succeeded — status:", signUp?.status,
        "created type:", typeof created,
        "hasPrepare:", typeof (created as any)?.prepareEmailAddressVerification,
        "hasPrepareVerification:", typeof (created as any)?.prepareVerification);
    } catch (e: any) {
      const clerkErr = e?.errors?.[0];
      // Use || not ?? so that empty-string Clerk messages (e.g. captcha_unavailable)
      // also fall through to the default instead of silently showing nothing.
      const msg = clerkErr ? friendlyClerkError(clerkErr) : (e?.message || "Sign up failed");
      console.log("[SignUp] create() error — code:", clerkErr?.code, "msg:", msg, "raw:", e?.message);
      setError(msg || "Sign up failed");
    } finally {
      setAuthLoading(false);
    }
  }, [signUp, email, password, confirmPassword, firstName, lastName]);

  // Step 3 of sign-up: user enters the emailed code.
  // Must use liveSignUp() (clerk.client.signUp) — the hook's signUp snapshot
  // loses class methods after re-renders.
  const handleVerify = useCallback(async () => {
    if (!code) { setError("Enter the verification code"); return; }
    setError("");
    setAuthLoading(true);
    try {
      const live = liveSignUp() ?? createdSignUpRef.current;
      console.log("[Verify] live type:", typeof live, "hasAttempt:", typeof live?.attemptEmailAddressVerification);
      const result = await live.attemptEmailAddressVerification({ code });
      console.log("[Verify] result.status:", result?.status, "missing:", result?.missingFields, "unverified:", result?.unverifiedFields, "createdSessionId:", result?.createdSessionId);

      // This Clerk instance requires password to be set as a separate step
      // *after* email verification (not during create()). When we see
      // missing_requirements with ["password"], submit it now via update().
      let final = result;
      if (result.status === "missing_requirements" && result.missingFields?.includes("password")) {
        console.log("[Verify] Clerk needs password as post-verification step — calling update()");
        final = await live.update({ password });
        console.log("[Verify] update() result.status:", final?.status, "createdSessionId:", final?.createdSessionId);
      }

      if (final.status === "complete") {
        recordingComplianceRef.current = true;
        await clerk.setActive({ session: final.createdSessionId! });
        // Compliance records are a prerequisite for entering the app. Do not
        // seed the local terms cache until the server has durably recorded both.
        const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
        await Promise.all([
          recordTermsAcceptance(),
          recordAgeConfirmation(),
          fullName ? updateMe({ name: fullName }) : Promise.resolve(),
        ]);
        const clerkUserId: string | undefined = (final as any).createdUserId ?? undefined;
        if (clerkUserId) await AsyncStorage.setItem(`termsVersion:${clerkUserId}`, CURRENT_TERMS_VERSION);
        recordingComplianceRef.current = false;
        router.replace("/(tabs)/" as any);
      } else {
        setError(`Verification incomplete (status: ${final.status}). Please try again.`);
      }
    } catch (e: any) {
      const clerkErr = e?.errors?.[0];
      setError(clerkErr ? friendlyClerkError(clerkErr) : (e?.message ?? "Verification failed"));
    } finally {
      setAuthLoading(false);
    }
  }, [clerk, signUp, code, firstName, lastName, password]);

  const finishSocialSignIn = useCallback(async (
    sessionId: string,
    activate: (options: { session: string }) => Promise<unknown>,
    newUserId?: string,
  ) => {
    recordingComplianceRef.current = Boolean(newUserId);
    try {
      await activate({ session: sessionId });
      if (newUserId) {
        await Promise.all([recordTermsAcceptance(), recordAgeConfirmation()]);
        await AsyncStorage.setItem(`termsVersion:${newUserId}`, CURRENT_TERMS_VERSION);
      }
      recordingComplianceRef.current = false;
      setPendingSocialSignIn(null);
      router.replace("/(tabs)/" as any);
    } catch (e: any) {
      if (newUserId) {
        try {
          await clerk.signOut();
          recordingComplianceRef.current = false;
        } catch {
          // Do not allow this screen's signed-in redirect if sign-out fails.
          setError("We couldn't finish account setup. Please close and reopen Rook before trying again.");
          return;
        }
      }
      setError(e?.message ?? "Account setup could not be completed. Please try again.");
    }
  }, [clerk]);

  const handleGoogleSSO = useCallback(async () => {
    if (mode === "register" && (!termsAccepted || !ageConfirmed)) {
      setError("Please accept the Terms of Service and Privacy Policy and confirm you are 17 or older to continue.");
      return;
    }
    setError(""); setSsoLoading(true);
    try {
      const { createdSessionId, setActive, createdUserId } = await startSSOFlow({ strategy: "oauth_google", redirectUrl: AuthSession.makeRedirectUri() }) as any;
      if (createdSessionId && setActive) {
        if (createdUserId && (!termsAccepted || !ageConfirmed)) {
          setPendingSocialSignIn({ sessionId: createdSessionId, activate: setActive, newUserId: createdUserId });
          return;
        }
        await finishSocialSignIn(createdSessionId, setActive, createdUserId ?? undefined);
      } else {
        setError("Google sign in could not be completed. Please try again.");
      }
    } catch (e: any) {
      const clerkErr = e?.errors?.[0];
      setError(clerkErr?.longMessage ?? clerkErr?.message ?? e?.message ?? "Google sign in failed");
    } finally { setSsoLoading(false); }
  }, [startSSOFlow, mode, termsAccepted, ageConfirmed, finishSocialSignIn]);

  const handleAppleSSO = useCallback(async () => {
    if (mode === "register" && (!termsAccepted || !ageConfirmed)) {
      setError("Please accept the Terms of Service and Privacy Policy and confirm you are 17 or older to continue.");
      return;
    }
    setError(""); setSsoLoading(true);
    try {
      const result = await startAppleAuthenticationFlow();
      const { createdSessionId, setActive } = result;
      if (createdSessionId && setActive) {
        const createdUserId = result.signUp?.createdUserId;
        if (createdUserId && (!termsAccepted || !ageConfirmed)) {
          setPendingSocialSignIn({ sessionId: createdSessionId, activate: setActive, newUserId: createdUserId });
          return;
        }
        await finishSocialSignIn(createdSessionId, setActive, createdUserId ?? undefined);
      } else {
        setError("Apple sign in could not be completed. Please try again.");
      }
    } catch (e: any) {
      if ((e as any).code === "ERR_REQUEST_CANCELED") return;
      const clerkErr = e?.errors?.[0];
      setError(clerkErr?.longMessage ?? clerkErr?.message ?? e?.message ?? "Apple sign in failed");
    } finally {
      setSsoLoading(false);
    }
  }, [startAppleAuthenticationFlow, mode, termsAccepted, ageConfirmed, finishSocialSignIn]);

  const handleSubmit = () => {
    if (mode === "login") {
      const identifier = email.trim();
      if (identifier.toLowerCase().startsWith(REVIEW_USERNAME_PREFIX)) {
        void completeReviewAccess(identifier.slice(REVIEW_USERNAME_PREFIX.length), password);
      } else {
        void handleSignIn();
      }
      return;
    }
    if (!termsAccepted) { setError("Please accept the Terms of Service and Privacy Policy to continue"); return; }
    if (!ageConfirmed) { setError("Please confirm you are 17 or older to continue"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    handleSignUp();
  };

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

          {needsSigninCode ? (
            /* ── Sign-in Second Factor (new device verification) ── */
            <>
              <View style={styles.cardHeader}>
                <Text style={styles.headline}>Verify it's you</Text>
                <Text style={styles.subheadline}>
                  We sent a 6-digit code to{"\n"}<Text style={styles.emailHighlight}>{email}</Text>
                </Text>
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

              <GradientButton
                label={loading ? "Verifying…" : "Verify"}
                onPress={handleVerifySignInCode}
                disabled={loading}
              />

              <TouchableOpacity onPress={() => liveSignIn()?.prepareSecondFactor({ strategy: "email_code" })} style={styles.switchRow}>
                <Text style={styles.switchText}>Didn't get it? </Text>
                <Text style={styles.switchLink}>Resend code</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setNeedsSigninCode(false); setCode(""); setError(""); }}
                style={styles.switchRow}>
                <Text style={styles.switchLink}>Start over</Text>
              </TouchableOpacity>
            </>

          ) : showVerify ? (
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

              <TouchableOpacity
                onPress={() => {
                  verificationSentRef.current = false;
                  const live = liveSignUp();
                  (live?.prepareEmailAddressVerification ?? live?.prepareVerification?.bind(live, { strategy: "email_code" }))?.({ strategy: "email_code" });
                }}
                style={styles.switchRow}
              >
                <Text style={styles.switchText}>Didn't get it? </Text>
                <Text style={styles.switchLink}>Resend code</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setVerifyAbandoned(true);
                  setCode("");
                  setError("");
                  verificationSentRef.current = false;
                  setMode("register");
                }}
                style={styles.switchRow}
              >
                <Text style={styles.switchText}>Wrong email or want to start over? </Text>
                <Text style={styles.switchLink}>Go back</Text>
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

              {/* ── Mode toggle ── */}
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[styles.segment, mode === "login" && styles.segmentActive]}
                  onPress={() => { setMode("login"); setError(""); setConfirmPassword(""); setFirstName(""); setLastName(""); }}
                >
                  <Text style={[styles.segmentLabel, mode === "login" && styles.segmentLabelActive]}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segment, mode === "register" && styles.segmentActive]}
                  onPress={() => { setMode("register"); setError(""); setPassword(""); setConfirmPassword(""); }}
                >
                  <Text style={[styles.segmentLabel, mode === "register" && styles.segmentLabelActive]}>Create Account</Text>
                </TouchableOpacity>
              </View>

              {/* ── Fields ── */}
              {mode === "register" && (
                <View style={styles.nameRow}>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>First Name</Text>
                    <View style={[styles.inputRow, { borderColor: inputBorder("firstName") }]}>
                      <TextInput
                        style={styles.textInput}
                        placeholder="First"
                        placeholderTextColor="#3B4C6B"
                        value={firstName}
                        onChangeText={setFirstName}
                        autoCapitalize="words"
                        returnKeyType="next"
                        onFocus={() => setFocusedField("firstName")}
                        onBlur={() => setFocusedField(null)}
                      />
                    </View>
                  </View>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Last Name</Text>
                    <View style={[styles.inputRow, { borderColor: inputBorder("lastName") }]}>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Last"
                        placeholderTextColor="#3B4C6B"
                        value={lastName}
                        onChangeText={setLastName}
                        autoCapitalize="words"
                        returnKeyType="next"
                        onFocus={() => setFocusedField("lastName")}
                        onBlur={() => setFocusedField(null)}
                      />
                    </View>
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
                    returnKeyType={mode === "register" ? "next" : "go"}
                    onSubmitEditing={mode === "register" ? undefined : handleSubmit}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#6B8EAE" />
                  </TouchableOpacity>
                </View>
              </View>

              {mode === "register" && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Confirm Password</Text>
                  <View style={[styles.inputRow, { borderColor: confirmPassword && password !== confirmPassword ? "#EF4444" : inputBorder("confirmPassword") }]}>
                    <Ionicons name="lock-closed-outline" size={18} color={focusedField === "confirmPassword" ? "#3B82F6" : "#6B8EAE"} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="••••••••"
                      placeholderTextColor="#3B4C6B"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      returnKeyType="go"
                      onSubmitEditing={handleSubmit}
                      onFocus={() => setFocusedField("confirmPassword")}
                      onBlur={() => setFocusedField(null)}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={8}>
                      <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#6B8EAE" />
                    </TouchableOpacity>
                  </View>
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <Text style={styles.fieldHintError}>Passwords do not match</Text>
                  )}
                </View>
              )}

              {error !== "" && <ErrorBanner message={error} />}

              {/* Keep the account-creation acknowledgements beside the action,
                  rather than above the form. They also gate first-time SSO. */}
              {mode === "register" && (
                <View style={styles.ssoConsent}>
                  <TermsCheckbox accepted={termsAccepted} onToggle={() => setTermsAccepted((v) => !v)} />
                  <AgeCheckbox confirmed={ageConfirmed} onToggle={() => setAgeConfirmed((v) => !v)} />
                </View>
              )}

              <GradientButton
                label={loading
                  ? (mode === "login" ? "Signing in…" : "Creating account…")
                  : mode === "login"
                    ? "Sign In"
                    : "Create Account"}
                onPress={handleSubmit}
                disabled={loading || (mode === "register" && (!termsAccepted || !ageConfirmed))}
              />

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>
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

              <View nativeID="clerk-captcha" />
            </>
          )}
        </View>

        {/* ── Bottom badge ── */}
        <View style={styles.bottomBadge}>
          <Ionicons name="lock-closed" size={12} color="#3B4C6B" />
          <Text style={styles.bottomBadgeText}>Secured with industry-standard encryption</Text>
        </View>

      </KeyboardAwareScrollViewCompat>
      <Modal
        visible={pendingSocialSignIn !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPendingSocialSignIn(null);
          setTermsAccepted(false);
          setAgeConfirmed(false);
        }}
      >
        <View style={{ flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#081120DD" }}>
          <View style={{ backgroundColor: "#101C34", borderRadius: 20, padding: 22, gap: 14 }}>
            <Text style={styles.headline}>Before creating your account</Text>
            <Text style={styles.subheadline}>
              Review and accept these requirements to finish signing up with Apple or Google.
            </Text>
            <TermsCheckbox accepted={termsAccepted} onToggle={() => setTermsAccepted((v) => !v)} />
            <AgeCheckbox confirmed={ageConfirmed} onToggle={() => setAgeConfirmed((v) => !v)} />
            {error !== "" && <ErrorBanner message={error} />}
            <GradientButton
              label={ssoLoading ? "Finishing…" : "Agree and Create Account"}
              disabled={ssoLoading || !termsAccepted || !ageConfirmed}
              onPress={() => {
                if (!pendingSocialSignIn) return;
                setSsoLoading(true);
                void finishSocialSignIn(
                  pendingSocialSignIn.sessionId,
                  pendingSocialSignIn.activate,
                  pendingSocialSignIn.newUserId,
                ).finally(() => setSsoLoading(false));
              }}
            />
            <TouchableOpacity
              onPress={() => {
                setPendingSocialSignIn(null);
                setTermsAccepted(false);
                setAgeConfirmed(false);
              }}
              style={styles.switchRow}
            >
              <Text style={styles.switchLink}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TermsCheckbox({ accepted, onToggle }: { accepted: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={styles.termsRow}>
      <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
        {accepted && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
      </View>
      <Text style={styles.consentText}>
        I agree to the{" "}
        <Text style={styles.consentLink} onPress={() => router.push("/legal" as any)}>Terms of Service</Text>
        {" "}and{" "}
        <Text style={styles.consentLink} onPress={() => router.push("/legal" as any)}>Privacy Policy</Text>,
        {" "}including the{" "}
        <Text style={styles.consentLink} onPress={() => router.push("/legal" as any)}>biometric data notice</Text>.
      </Text>
    </TouchableOpacity>
  );
}

function AgeCheckbox({ confirmed, onToggle }: { confirmed: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={styles.termsRow}>
      <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
        {confirmed && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
      </View>
      <Text style={styles.consentText}>
        I confirm I am{" "}
        <Text style={{ color: "#CBD5E1", fontWeight: "600" }}>17 years of age or older</Text>
        {" "}and meet Rook's minimum age requirement.
      </Text>
    </TouchableOpacity>
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
    width: 120, height: 120,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#3B82F6", shadowOpacity: 0.35, shadowRadius: 32, shadowOffset: { width: 0, height: 0 },
  },
  logoImage: { width: 110, height: 110 },
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
  ssoConsent: { gap: 10, marginBottom: 16 },
  ssoBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#131C2B", borderWidth: 1, borderColor: "#1A2740",
    borderRadius: 14, paddingHorizontal: 16, height: 54,
  },
  ssoBtnInner: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  ssoLabel: { fontFamily: "Inter_500Medium", fontSize: 15, color: "#F0F4FF" },
  appleBtn: { height: 54, borderRadius: 14 },
  ssoLegalNotice: {
    marginTop: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 16,
    color: "#64748B",
    textAlign: "center",
  },

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
  nameRow: { flexDirection: "row", gap: 10 },
  field: { gap: 7 },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: "#6B8EAE", letterSpacing: 0.3 },
  fieldHintError: { fontFamily: "Inter_400Regular", fontSize: 11, color: "#EF4444", marginTop: 2 },
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

  // Terms checkbox
  termsRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: "#3B4C6B",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: "#3B82F6", borderColor: "#3B82F6" },

  // Consent
  consentText: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#3B4C6B", flex: 1, lineHeight: 18 },
  consentLink: { color: "#3B82F6" },

  // Resend row (verify screen)
  switchRow: { flexDirection: "row", gap: 4, justifyContent: "center", paddingTop: 2 },
  switchText: { fontFamily: "Inter_400Regular", fontSize: 14, color: "#3B4C6B" },
  switchLink: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#3B82F6" },

  // Bottom badge
  bottomBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingBottom: 4 },
  bottomBadgeText: { fontFamily: "Inter_400Regular", fontSize: 11, color: "#2A3A52" },
});
