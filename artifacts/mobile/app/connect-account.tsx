import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { useColors } from "@/hooks/useColors";
import { useApp, type Platform as AppPlatform } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { PlatformIcon } from "@/components/PlatformIcon";
import { getAccounts, getOAuthRedirectUris, getOAuthState, getXOAuthInit } from "@/lib/api";
import { INSTAGRAM_APP_ID, FACEBOOK_APP_ID, OAUTH_APP_SCHEME } from "@/constants/oauthConfig";

interface PlatformConfig {
  label: string;
  color: string;
  authUrl: string;
  scopes: string[];
  clientIdEnvKey: string;
  callbackPath: string;
  usernameHint: string;
  usernamePrefix?: string;
  businessAccountNote?: string;
  /** When true, hides the OAuth button and promotes the manual username path. */
  oauthDisabled?: boolean;
  /** Shown instead of the OAuth button when oauthDisabled is true. */
  oauthDisabledReason?: string;
}


const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  instagram: {
    label: "Instagram",
    color: "#E1306C",
    authUrl: "https://www.instagram.com/oauth/authorize",
    // instagram_business_basic is the only scope needed for identity monitoring.
    // Manage_messages / manage_comments / content_publish / manage_insights are
    // action permissions Rook does not use — requesting them would bloat the
    // App Review submission and alarm users on the consent screen.
    scopes: ["instagram_business_basic"],
    clientIdEnvKey: "EXPO_PUBLIC_INSTAGRAM_CLIENT_ID",
    callbackPath: "/api/oauth/instagram/callback",
    usernameHint: "yourhandle",
    usernamePrefix: "@",
  },
  x: {
    label: "X (Twitter)",
    color: "#000000",
    authUrl: "https://twitter.com/i/oauth2/authorize",
    scopes: ["tweet.read", "users.read", "offline.access"],
    clientIdEnvKey: "EXPO_PUBLIC_TWITTER_CLIENT_ID",
    callbackPath: "/api/oauth/x/callback",
    usernameHint: "yourhandle",
    usernamePrefix: "@",
  },
  tiktok: {
    label: "TikTok",
    color: "#010101",
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    scopes: ["user.info.basic"],
    clientIdEnvKey: "EXPO_PUBLIC_TIKTOK_CLIENT_ID",
    callbackPath: "/api/oauth/tiktok/callback",
    usernameHint: "yourhandle",
    usernamePrefix: "@",
  },
  youtube: {
    label: "YouTube",
    color: "#FF0000",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scopes: ["https://www.googleapis.com/auth/youtube.readonly", "profile", "email"],
    clientIdEnvKey: "EXPO_PUBLIC_GOOGLE_CLIENT_ID",
    callbackPath: "/api/oauth/youtube/callback",
    usernameHint: "channel name or @handle",
  },
  facebook: {
    label: "Facebook",
    color: "#1877F2",
    authUrl: "https://www.facebook.com/v22.0/dialog/oauth",
    // user_photos requires Meta App Review — request only after approval.
    // Until then, public_profile (no review needed) is sufficient to connect the account.
    scopes: ["public_profile", "user_photos"],
    clientIdEnvKey: "EXPO_PUBLIC_FACEBOOK_CLIENT_ID",
    callbackPath: "/api/oauth/facebook/callback",
    usernameHint: "your.profile.name",
  },
  linkedin: {
    label: "LinkedIn",
    color: "#0A66C2",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    scopes: ["r_liteprofile", "r_emailaddress"],
    clientIdEnvKey: "EXPO_PUBLIC_LINKEDIN_CLIENT_ID",
    callbackPath: "/api/oauth/linkedin/callback",
    usernameHint: "your-name",
  },
  snapchat: {
    label: "Snapchat",
    color: "#FFFC00",
    authUrl: "https://accounts.snapchat.com/login/oauth2/authorize",
    scopes: ["https://auth.snapchat.com/oauth2/api/user.display_name"],
    clientIdEnvKey: "EXPO_PUBLIC_SNAPCHAT_CLIENT_ID",
    callbackPath: "/api/oauth/snapchat/callback",
    usernameHint: "yourhandle",
    usernamePrefix: "@",
  },
};

const ALL_PLATFORMS = Object.keys(PLATFORM_CONFIGS) as NonNullable<AppPlatform>[];

// Platforms that are visible in the picker but not yet available for connection.
const LAUNCH_DISABLED_PLATFORMS = new Set<string>(["tiktok"]);

// App IDs imported from shared constants — single source of truth across
// connect-account.tsx and onboarding.tsx.
function getClientId(platform: string): string | undefined {
  if (platform === "instagram") return INSTAGRAM_APP_ID;
  if (platform === "facebook") return FACEBOOK_APP_ID;
  const key = PLATFORM_CONFIGS[platform]?.clientIdEnvKey;
  if (!key) return undefined;
  return (process.env as Record<string, string | undefined>)[key];
}

function buildAuthUrl(
  platform: string,
  clientId: string,
  state: string,
  redirectUri: string,
  extraParams?: Record<string, string>
): string {
  const config = PLATFORM_CONFIGS[platform]!;
  // Twitter requires space-separated scopes; all other platforms use commas
  const scopeSep = platform === "x" ? " " : ",";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: config.scopes.join(scopeSep),
    response_type: "code",
    state,
    ...extraParams,
  });
  return `${config.authUrl}?${params.toString()}`;
}

function OAuthButton({
  platform,
  clientId,
  onSuccess,
  disabled,
}: {
  platform: NonNullable<AppPlatform>;
  clientId: string;
  onSuccess: () => void;
  disabled: boolean;
}) {
  const colors = useColors();
  const config = PLATFORM_CONFIGS[platform]!;
  const [loading, setLoading] = useState(false);

  const handlePress = useCallback(async (forceEphemeral = false) => {
    setLoading(true);
    try {
      // Snapshot accounts before so we can detect a change after the flow
      const accountsBefore = await getAccounts().catch(() => [] as Awaited<ReturnType<typeof getAccounts>>);
      const existingAccount = accountsBefore.find((a) => a.platform === platform);
      const prevLastSynced = existingAccount?.lastSynced ?? null;

      // X/Twitter uses PKCE — the server generates the code_verifier (embedded in
      // state) and returns the code_challenge to add to the auth URL.
      // All other platforms use a plain HMAC state token.
      const redirectUriMap = await getOAuthRedirectUris().catch(() => ({} as Record<string, string>));
      const redirectUrl = redirectUriMap[platform] ?? `https://${process.env.EXPO_PUBLIC_DOMAIN ?? ""}${config.callbackPath}`;

      let state: string;
      let authUrl: string;
      if (platform === "x") {
        const { state: xState, codeChallenge, redirectUri: initRedirectUri } = await getXOAuthInit();
        state = xState;
        // Use the server-provided client ID from redirect-uris as a fallback
        // when EXPO_PUBLIC_TWITTER_CLIENT_ID isn't bundled in the Expo app.
        const xClientId = (redirectUriMap as Record<string, string>)["x_client_id"] || clientId;
        // IMPORTANT: use the redirectUri returned by init — it is embedded in the
        // PKCE state token so the callback's token exchange uses the exact same URI.
        // Falling back to redirectUriMap["x"] in case older server omits the field.
        const xRedirectUrl = initRedirectUri ?? redirectUrl;
        authUrl = buildAuthUrl(platform, xClientId, state, xRedirectUrl, {
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
        });
      } else {
        state = await getOAuthState();
        authUrl = buildAuthUrl(platform, clientId, state, redirectUrl);
      }

      // No preferEphemeralSession by default — iOS reuses the Safari session so the
      // user taps "Continue as X" without re-entering their password. On auth errors
      // we retry with preferEphemeralSession: true to force a fresh login screen that
      // clears any stale cached session.
      const result = await WebBrowser.openAuthSessionAsync(authUrl, OAUTH_APP_SCHEME,
        forceEphemeral ? { preferEphemeralSession: true } : undefined
      );

      const resultUrl = "url" in result ? result.url ?? "" : "";
      const resultParams = resultUrl.includes("?")
        ? new URLSearchParams(resultUrl.split("?")[1])
        : null;
      const urlError = resultParams?.get("error") ?? resultParams?.get("error_reason");

      // Always poll — even on cancel/dismiss.
      // In Expo Go the custom-scheme redirect (com.getrook.app://oauth) cannot be
      // intercepted, so the browser returns "cancel" or "dismiss" even when the
      // server completed the token exchange successfully. Polling catches that case.
      let connected = false;
      for (let i = 0; i < 4; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 1800));
        const accountsAfter = await getAccounts({ bustCache: true }).catch(() => null);
        if (accountsAfter) {
          const updated = accountsAfter.find((a) => a.platform === platform);
          const isNewlyConnected = updated && (
            !existingAccount ||
            (updated.lastSynced !== null && updated.lastSynced !== prevLastSynced)
          );
          if (isNewlyConnected) {
            connected = true;
            onSuccess();
            return;
          }
        }
      }

      if (connected) return;

      if (urlError) {
        // Friendly messages for both platform-returned errors (access_denied, invalid_request)
        // and server-side errors redirected back via the custom scheme (session expired, etc.)
        const isSessionError = urlError.toLowerCase().includes("session expired") || urlError.toLowerCase().includes("sign-in session");
        const friendlyMsg =
          urlError === "access_denied"
            ? "You declined the permission request. Tap Try Again and approve all requested permissions."
            : urlError === "invalid_request" && platform === "instagram"
            ? "Instagram rejected the request. Make sure your account is a Business or Creator account connected to a Facebook Page."
            : isSessionError
            ? "Your login session expired. Tap Try Again to start fresh."
            : urlError.toLowerCase().includes("too many")
            ? urlError
            : urlError.startsWith("Connection failed") || urlError.startsWith("connection failed")
            ? "Something went wrong connecting your account. Please try again."
            : `Could not connect your account: ${urlError}`;

        Alert.alert(
          "Connection Failed",
          friendlyMsg,
          [
            { text: "Cancel", style: "cancel" },
            // "Sign in Fresh" clears any cached Safari session so the user always
            // sees the platform login screen — useful when a stale/wrong-account
            // session is causing the error.
            { text: "Sign in Fresh", onPress: () => { void handlePress(true); } },
            { text: "Try Again", onPress: () => { void handlePress(); } },
          ]
        );
      } else if (result.type === "cancel" || result.type === "dismiss") {
        const isInstagram = platform === "instagram";
        const isFacebook  = platform === "facebook";
        const hint = isInstagram
          ? "Instagram requires a Business or Creator account connected to a Facebook Page. If your account is personal, go to Instagram Settings → Account → Switch to Professional Account (free and reversible)."
          : isFacebook
          ? "Make sure you approved all permissions on the Facebook login screen."
          : "You can still add the account by entering your username manually below.";
        Alert.alert(
          "Authentication Closed",
          hint,
          [
            { text: "OK", style: "cancel" },
            { text: "Try Again", onPress: () => { void handlePress(); } },
          ]
        );
      }
    } catch {
      Alert.alert("Error", "Could not open the authentication page. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [platform, clientId, config.callbackPath, onSuccess]);

  return (
    <TouchableOpacity
      style={[
        styles.oauthBtn,
        { backgroundColor: config.color, opacity: disabled || loading ? 0.6 : 1 },
      ]}
      disabled={disabled || loading}
      activeOpacity={0.8}
      onPress={() => { void handlePress(); }}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <>
          <PlatformIcon platform={platform} size={20} />
          <Text style={[styles.oauthBtnText, { fontFamily: "Inter_600SemiBold" }]}>
            Sign in with {config.label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export default function ConnectAccount() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ platform?: string; existingId?: string }>();
  const { addAccount, updateAccount, user, refreshData } = useApp();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const connectedPlatforms = new Set(
    user.connectedAccounts.map((a) => a.platform).filter(Boolean)
  );

  // If a deep-link targets a disabled platform, fall back to the pick step.
  const initialPlatform = params.platform && !LAUNCH_DISABLED_PLATFORMS.has(params.platform)
    ? (params.platform as NonNullable<AppPlatform>)
    : null;
  const [selectedPlatform, setSelectedPlatform] = useState<NonNullable<AppPlatform> | null>(initialPlatform);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthDone, setOauthDone] = useState(false);
  const [step, setStep] = useState<"pick" | "connect">(
    initialPlatform ? "connect" : "pick"
  );

  // When a deep-link arrives for a launch-disabled platform, stay on pick step
  // and show a clear "coming soon" message so the user knows why it didn't open.
  useEffect(() => {
    if (params.platform && LAUNCH_DISABLED_PLATFORMS.has(params.platform)) {
      const label = PLATFORM_CONFIGS[params.platform]?.label ?? "This platform";
      Alert.alert(
        "Coming Soon",
        `${label} connection isn't available yet. We're working on it — stay tuned!`,
        [{ text: "Got it" }]
      );
    }
  // Only run once on mount to reflect the initial deep-link params
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const config = selectedPlatform ? PLATFORM_CONFIGS[selectedPlatform] : null;
  const clientId = selectedPlatform ? getClientId(selectedPlatform) : undefined;
  const isExistingAccount = !!params.existingId;

  const handleOAuthDone = useCallback(async () => {
    setOauthDone(true);
    await refreshData();
    // Brief pause (800 ms) so the user can see the "Authenticated successfully"
    // success banner before being navigated away.
    await new Promise<void>((resolve) => setTimeout(resolve, 800));
    // Find the newly connected account so we can pass its ID to photo-monitor,
    // allowing it to pre-select and load that account's media immediately.
    let accountId = "";
    try {
      const accounts = await getAccounts();
      const matched = accounts.find((a) => a.platform === selectedPlatform);
      accountId = matched?.id ?? "";
    } catch {
      // Non-fatal: photo-monitor works fine without a pre-selected accountId
    }
    router.replace({
      pathname: "/photo-monitor",
      params: {
        justConnected: "1",
        platform: selectedPlatform ?? "",
        accountId,
      },
    } as any);
  }, [refreshData, selectedPlatform]);

  const handleSubmit = useCallback(async () => {
    if (!selectedPlatform) return;
    const trimmed = username.trim().replace(/^@/, "");
    if (!trimmed) {
      Alert.alert("Username required", "Please enter your username for this platform.");
      return;
    }

    Keyboard.dismiss();
    setSubmitting(true);

    try {
      if (isExistingAccount && params.existingId) {
        await updateAccount(params.existingId, {});
        Alert.alert("Account Updated", "Account updated.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        await addAccount(selectedPlatform, trimmed, undefined, displayName.trim() || undefined);
        Alert.alert(
          "Account Added",
          `${config?.label} account @${trimmed} added for monitoring. Tap "Sign in with ${config?.label}" to verify ownership.`,
          [{ text: "Done", onPress: () => router.back() }]
        );
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to connect account.");
    } finally {
      setSubmitting(false);
    }
  }, [selectedPlatform, username, isExistingAccount, params.existingId, addAccount, updateAccount, config]);

  const selectPlatform = (platform: NonNullable<AppPlatform>) => {
    setSelectedPlatform(platform);
    setStep("connect");
    setUsername("");
    setDisplayName("");
    setOauthDone(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={["#3B82F611", "transparent"]} style={styles.topGradient} />

        <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => {
              if (step === "connect" && !params.platform) {
                setStep("pick");
                setSelectedPlatform(null);
              } else {
                router.back();
              }
            }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {step === "pick" ? "Choose Platform" : isExistingAccount ? "Verify Account" : "Connect Account"}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          {step === "pick" && (
            <>
              <Text style={[styles.pickTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                Which platform do you want to protect?
              </Text>
              <Text style={[styles.pickSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Rook will monitor this account for impersonators and threats.
              </Text>

              <View style={styles.platformGrid}>
                {ALL_PLATFORMS.map((p) => {
                  const isConnected = connectedPlatforms.has(p as any);
                  const isDisabled = LAUNCH_DISABLED_PLATFORMS.has(p);
                  const cfg = PLATFORM_CONFIGS[p]!;
                  if (isDisabled) {
                    return (
                      <View
                        key={p}
                        style={[
                          styles.platformTile,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            borderWidth: 1.5,
                            opacity: 0.4,
                          },
                        ]}
                      >
                        <PlatformIcon platform={p} size={38} />
                        <Text style={[styles.platformTileLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                          {cfg.label}
                        </Text>
                        <View style={[styles.connectedChip, { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 }]}>
                          <Text style={[styles.connectedChipText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                            Coming Soon
                          </Text>
                        </View>
                      </View>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.platformTile,
                        {
                          backgroundColor: colors.card,
                          borderColor: isConnected ? colors.success + "44" : colors.border,
                          borderWidth: 1.5,
                          opacity: isConnected ? 0.55 : 1,
                        },
                      ]}
                      activeOpacity={isConnected ? 1 : 0.7}
                      onPress={() => !isConnected && selectPlatform(p)}
                    >
                      <PlatformIcon platform={p} size={38} />
                      <Text style={[styles.platformTileLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                        {cfg.label}
                      </Text>
                      {isConnected && (
                        <View style={[styles.connectedChip, { backgroundColor: colors.success + "22" }]}>
                          <Ionicons name="checkmark-circle" size={11} color={colors.success} />
                          <Text style={[styles.connectedChipText, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>
                            Added
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {step === "connect" && selectedPlatform && config && (
            <>
              {/* Platform hero */}
              <View style={styles.platformHero}>
                <PlatformIcon platform={selectedPlatform} size={64} />
                <Text style={[styles.platformHeroLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {isExistingAccount ? `Verify ${config.label}` : `Connect ${config.label}`}
                </Text>
                <Text style={[styles.platformHeroSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {isExistingAccount
                    ? "Authenticate to prove account ownership and unlock verified monitoring."
                    : "Sign in to verify ownership, or add your username manually for basic monitoring."}
                </Text>
              </View>

              {/* OAuth section — hidden when oauthDisabled, replaced by inline note below username */}
              {!config.oauthDisabled && (
                <GlassCard style={styles.authSection}>
                  <View style={styles.authHeader}>
                    <View style={[styles.authHeaderIcon, { backgroundColor: colors.success + "22" }]}>
                      <Ionicons name="shield-checkmark" size={16} color={colors.success} />
                    </View>
                    <View style={styles.authHeaderText}>
                      <Text style={[styles.authHeaderTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                        Sign in with {config.label}
                      </Text>
                      <Text style={[styles.authHeaderSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        Verified accounts get automated sync and full monitoring. Rook will only read your public profile and posts — we will never post, like, or message on your behalf.
                      </Text>
                    </View>
                  </View>

                  {config.businessAccountNote && (
                    <View style={[styles.businessNoteCard, { backgroundColor: "#F59E0B18", borderColor: "#F59E0B44" }]}>
                      <Ionicons name="information-circle" size={16} color="#F59E0B" style={{ marginTop: 1 }} />
                      <Text style={[styles.businessNoteText, { color: "#D97706", fontFamily: "Inter_400Regular" }]}>
                        {config.businessAccountNote}
                      </Text>
                    </View>
                  )}

                  {oauthDone ? (
                    <View style={[styles.oauthSuccess, { backgroundColor: colors.success + "18", borderColor: colors.success + "44" }]}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                      <Text style={[styles.oauthSuccessText, { color: colors.success, fontFamily: "Inter_500Medium" }]}>
                        Authenticated successfully
                      </Text>
                    </View>
                  ) : (clientId || selectedPlatform === "x") ? (
                    <OAuthButton
                      platform={selectedPlatform}
                      clientId={clientId ?? ""}
                      onSuccess={handleOAuthDone}
                      disabled={submitting}
                    />
                  ) : isExistingAccount ? (
                    <View style={{ gap: 12 }}>
                      <View style={[styles.noCredCard, { backgroundColor: colors.success + "0C", borderColor: colors.success + "33" }]}>
                        <Ionicons name="shield-checkmark" size={16} color={colors.success} />
                        <Text style={[styles.noCredText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                          This account is already being monitored. OAuth sign-in isn't configured for {config.label} yet, so ownership verification is unavailable — but basic monitoring is active.
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.oauthBtn, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}
                        activeOpacity={0.8}
                        onPress={() => router.back()}
                      >
                        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                        <Text style={[styles.oauthBtnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                          Continue with basic monitoring
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={[styles.noCredCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                      <MaterialCommunityIcons name="information" size={16} color={colors.mutedForeground} />
                      <Text style={[styles.noCredText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        OAuth not configured for {config.label}. Add your{" "}
                        <Text style={{ fontFamily: "Inter_600SemiBold" }}>{config.clientIdEnvKey}</Text>{" "}
                        environment secret to enable sign-in.
                      </Text>
                    </View>
                  )}
                </GlassCard>
              )}

              {/* Divider — only shown when OAuth is available (manual is secondary) */}
              {!isExistingAccount && !config.oauthDisabled && (
                <View style={styles.dividerRow}>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.dividerLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    or add manually
                  </Text>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                </View>
              )}

              {/* Username + display name inputs */}
              {!isExistingAccount && (
                <GlassCard style={styles.usernameSection}>
                  {config.oauthDisabledReason && (
                    <View style={[styles.businessNoteCard, { backgroundColor: colors.secondary, borderColor: colors.border, marginBottom: 14 }]}>
                      <Ionicons name="information-circle-outline" size={15} color={colors.mutedForeground} style={{ marginTop: 1 }} />
                      <Text style={[styles.businessNoteText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {config.oauthDisabledReason}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.usernameLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    Your {config.label} username
                  </Text>
                  <View style={[styles.usernameInput, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    {config.usernamePrefix && (
                      <Text style={[styles.usernamePrefix, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {config.usernamePrefix}
                      </Text>
                    )}
                    <TextInput
                      style={[styles.usernameField, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                      value={username}
                      onChangeText={setUsername}
                      placeholder={config.usernameHint}
                      placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                    {username.length > 0 && (
                      <TouchableOpacity onPress={() => setUsername("")}>
                        <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={[styles.usernameLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold", marginTop: 14 }]}>
                    Your real name <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>(optional)</Text>
                  </Text>
                  <View style={[styles.usernameInput, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.usernameField, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                      value={displayName}
                      onChangeText={setDisplayName}
                      placeholder="e.g. Sophie Rain"
                      placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                    />
                    {displayName.length > 0 && (
                      <TouchableOpacity onPress={() => setDisplayName("")}>
                        <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[styles.usernameSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    Helps find impersonators who use your real name instead of your handle
                  </Text>
                </GlassCard>
              )}

              {/* Submit */}
              {!isExistingAccount && (
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: submitting || !username.trim() ? 0.5 : 1,
                    },
                  ]}
                  disabled={submitting || !username.trim()}
                  activeOpacity={0.8}
                  onPress={handleSubmit}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="person-add" size={18} color="#FFFFFF" />
                      <Text style={[styles.submitBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                        Add Account
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Verify CTA for existing accounts */}
              {isExistingAccount && !oauthDone && (
                <Text style={[styles.skipHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Sign in above to verify ownership of this account.
                </Text>
              )}

              {/* Privacy note */}
              <View style={styles.privacyRow}>
                <Ionicons name="lock-closed" size={12} color={colors.mutedForeground} />
                <Text style={[styles.privacyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Rook never posts on your behalf or accesses DMs. Read-only access only.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 200 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, flex: 1, textAlign: "center" },
  content: { padding: 16, gap: 16 },

  pickTitle: { fontSize: 22, textAlign: "center" },
  pickSub: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  platformGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  platformTile: {
    width: "30%",
    flexGrow: 1,
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 16,
  },
  platformTileLabel: { fontSize: 12, textAlign: "center" },
  connectedChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20 },
  connectedChipText: { fontSize: 10 },

  platformHero: { alignItems: "center", gap: 10, marginTop: 8 },
  platformHeroLabel: { fontSize: 20 },
  platformHeroSub: { fontSize: 13, textAlign: "center", lineHeight: 19 },

  authSection: { gap: 14 },
  authHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  authHeaderIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  authHeaderText: { flex: 1, gap: 2 },
  authHeaderTitle: { fontSize: 15 },
  authHeaderSub: { fontSize: 12, lineHeight: 17 },

  oauthBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
  },
  oauthBtnText: { color: "#FFFFFF", fontSize: 15 },

  oauthSuccess: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  oauthSuccessText: { fontSize: 14, flex: 1 },

  noCredCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  noCredText: { flex: 1, fontSize: 12, lineHeight: 18 },

  businessNoteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  businessNoteText: { flex: 1, fontSize: 12, lineHeight: 18 },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerLabel: { fontSize: 12 },

  usernameSection: { gap: 10 },
  usernameLabel: { fontSize: 15 },
  usernameInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  usernamePrefix: { fontSize: 16 },
  usernameField: { flex: 1, fontSize: 16, padding: 0 },
  usernameSub: { fontSize: 12 },

  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  submitBtnText: { color: "#FFFFFF", fontSize: 16 },

  skipHint: { fontSize: 13, textAlign: "center", lineHeight: 19 },

  privacyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  privacyText: { flex: 1, fontSize: 11, lineHeight: 16 },
});
