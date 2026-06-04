import React, { useCallback, useState } from "react";
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
import { getAccounts, getOAuthRedirectUris, getOAuthState } from "@/lib/api";

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
}

// Custom URL scheme registered in app.json ("scheme": "mobile").
// Instagram/Facebook redirect to mobile://oauth — iOS intercepts this
// immediately, closes the browser, and returns result.url to the app.
// The app then POSTs the code to the server callback for token exchange.
const OAUTH_SCHEME = "mobile://oauth";

const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  instagram: {
    label: "Instagram",
    color: "#E1306C",
    authUrl: "https://www.instagram.com/oauth/authorize",
    scopes: ["instagram_business_basic"],
    clientIdEnvKey: "EXPO_PUBLIC_INSTAGRAM_CLIENT_ID",
    callbackPath: "/api/oauth/instagram/callback",
    usernameHint: "yourhandle",
    usernamePrefix: "@",
    businessAccountNote:
      "Instagram's API requires a Business or Creator account to sign in. Go to Instagram Settings → Account → Switch to Professional Account to enable this. It's free and reversible.",
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
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    scopes: ["public_profile"],
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

function getClientId(platform: string): string | undefined {
  const key = PLATFORM_CONFIGS[platform]?.clientIdEnvKey;
  if (!key) return undefined;
  return (process.env as Record<string, string | undefined>)[key];
}

function buildAuthUrl(
  platform: string,
  clientId: string,
  state: string,
  redirectUri: string
): string {
  const config = PLATFORM_CONFIGS[platform]!;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: config.scopes.join(","),
    response_type: "code",
    state,
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

  const handlePress = useCallback(async () => {
    setLoading(true);
    try {
      // Snapshot accounts before so we can detect a change after the flow
      const accountsBefore = await getAccounts().catch(() => [] as Awaited<ReturnType<typeof getAccounts>>);
      const existingAccount = accountsBefore.find((a) => a.platform === platform);
      const prevLastSynced = existingAccount?.lastSynced ?? null;

      // HMAC-signed state token — survives longer than a 60s Clerk JWT
      const state = await getOAuthState();

      // Use the custom URL scheme as redirect_uri so iOS intercepts it
      // immediately (ASWebAuthenticationSession matches on scheme, not host).
      // The server callback also accepts this scheme for token exchange.
      const redirectUrl = OAUTH_SCHEME;
      const authUrl = buildAuthUrl(platform, clientId, state, redirectUrl);

      console.log(`[OAuth:${platform}] opening browser`, { authUrl, redirectUrl });
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      console.log(`[OAuth:${platform}] result.type=${result.type}`, "url" in result ? result.url : "(no url)");

      const resultUrl = "url" in result ? result.url ?? "" : "";
      const resultParams = resultUrl.includes("?")
        ? new URLSearchParams(resultUrl.split("?")[1])
        : null;
      const urlError = resultParams?.get("error") ?? resultParams?.get("error_reason");
      const urlCode  = resultParams?.get("code");
      const urlState = resultParams?.get("state") ?? state;

      if (urlCode) {
        // iOS intercepted the redirect — the server callback was never hit.
        // Forward the code to the server using the HTTPS callback endpoint.
        // The server token exchange uses the same redirect_uri we sent to Instagram.
        console.log(`[OAuth:${platform}] forwarding code to server callback`);
        const redirectUris = await getOAuthRedirectUris().catch(() => ({} as Record<string, string>));
        const serverCallbackUrl = redirectUris[platform] ?? `https://${process.env.EXPO_PUBLIC_DOMAIN ?? ""}${config.callbackPath}`;

        await fetch(
          `${serverCallbackUrl}?code=${encodeURIComponent(urlCode)}&state=${encodeURIComponent(urlState)}&redirect_uri=${encodeURIComponent(redirectUrl)}`,
          { method: "GET" }
        ).catch((e) => console.warn(`[OAuth:${platform}] server forward failed:`, e));

        await new Promise((r) => setTimeout(r, 1000));
      } else {
        await new Promise((r) => setTimeout(r, 600));
      }

      const accountsAfter = await getAccounts({ bustCache: true }).catch(() => null);
      if (accountsAfter) {
        const updated = accountsAfter.find((a) => a.platform === platform);
        const isNewlyConnected = updated && (
          !existingAccount ||
          (updated.lastSynced !== null && updated.lastSynced !== prevLastSynced)
        );
        if (isNewlyConnected) {
          onSuccess();
          return;
        }
      }

      if (urlError) {
        console.log(`[OAuth:${platform}] provider error: ${urlError}`);
        const friendlyMsg =
          urlError === "access_denied"
            ? "You declined the permission request. Please try again and tap Allow."
            : urlError === "invalid_request" && platform === "instagram"
            ? "Instagram rejected the request. Make sure your account is a Business or Creator account connected to a Facebook Page."
            : `Authentication failed: ${urlError}`;
        Alert.alert("Authentication Failed", friendlyMsg, [{ text: "OK" }]);
      } else if (urlCode) {
        Alert.alert("Almost there", "We received the sign-in but couldn't confirm the account. Please try again.", [{ text: "OK" }]);
      } else if (result.type === "cancel" || result.type === "dismiss") {
        const isInstagram = platform === "instagram";
        const isFacebook  = platform === "facebook";
        const hint = isInstagram
          ? "Instagram requires a Business or Creator account connected to a Facebook Page. If your account is personal, go to Instagram Settings → Account → Switch to Professional Account (free and reversible)."
          : isFacebook
          ? "Make sure you approved all permissions on the Facebook login screen."
          : "You can still add the account by entering your username manually below.";
        Alert.alert("Authentication Closed", hint, [{ text: "OK" }]);
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
      onPress={handlePress}
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

  const [selectedPlatform, setSelectedPlatform] = useState<NonNullable<AppPlatform> | null>(
    (params.platform as NonNullable<AppPlatform>) ?? null
  );
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthDone, setOauthDone] = useState(false);
  const [step, setStep] = useState<"pick" | "connect">(
    params.platform ? "connect" : "pick"
  );

  const config = selectedPlatform ? PLATFORM_CONFIGS[selectedPlatform] : null;
  const clientId = selectedPlatform ? getClientId(selectedPlatform) : undefined;
  const isExistingAccount = !!params.existingId;

  const handleOAuthDone = useCallback(async () => {
    setOauthDone(true);
    await refreshData();
    Alert.alert(
      "Connected!",
      "Your account was verified via OAuth. Return to the app to see it listed as connected.",
      [{ text: "Done", onPress: () => router.back() }]
    );
  }, [refreshData]);

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
        await addAccount(selectedPlatform, trimmed, undefined);
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
                ShieldID will monitor this account for impersonators and threats.
              </Text>

              <View style={styles.platformGrid}>
                {ALL_PLATFORMS.map((p) => {
                  const isConnected = connectedPlatforms.has(p as any);
                  const cfg = PLATFORM_CONFIGS[p]!;
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

              {/* OAuth section */}
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
                      Verified accounts get real-time sync and full monitoring
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
                ) : clientId ? (
                  <OAuthButton
                    platform={selectedPlatform}
                    clientId={clientId}
                    onSuccess={handleOAuthDone}
                    disabled={submitting}
                  />
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

              {/* Divider */}
              {!isExistingAccount && (
                <View style={styles.dividerRow}>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.dividerLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    or add manually
                  </Text>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                </View>
              )}

              {/* Username input */}
              {!isExistingAccount && (
                <GlassCard style={styles.usernameSection}>
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
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                    />
                    {username.length > 0 && (
                      <TouchableOpacity onPress={() => setUsername("")}>
                        <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[styles.usernameSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {config.businessAccountNote
                      ? "Works with any account type — no switch to Business or Creator needed"
                      : "Manual accounts are monitored but not ownership-verified"}
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
                  ShieldID never posts on your behalf or accesses DMs. Read-only access only.
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
