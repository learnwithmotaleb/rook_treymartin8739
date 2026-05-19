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
import {
  makeRedirectUri,
  useAuthRequest,
  type AuthRequestConfig,
  type DiscoveryDocument,
} from "expo-auth-session";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { GlassCard } from "@/components/GlassCard";
import { PlatformIcon } from "@/components/PlatformIcon";

WebBrowser.maybeCompleteAuthSession();

interface PlatformConfig {
  label: string;
  color: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnvKey: string;
  usernameHint: string;
  usernamePrefix?: string;
}

const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  instagram: {
    label: "Instagram",
    color: "#E1306C",
    authUrl: "https://api.instagram.com/oauth/authorize",
    tokenUrl: "https://api.instagram.com/oauth/access_token",
    scopes: ["user_profile", "user_media"],
    clientIdEnvKey: "EXPO_PUBLIC_INSTAGRAM_CLIENT_ID",
    usernameHint: "yourhandle",
    usernamePrefix: "@",
  },
  x: {
    label: "X (Twitter)",
    color: "#000000",
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    scopes: ["tweet.read", "users.read", "offline.access"],
    clientIdEnvKey: "EXPO_PUBLIC_TWITTER_CLIENT_ID",
    usernameHint: "yourhandle",
    usernamePrefix: "@",
  },
  tiktok: {
    label: "TikTok",
    color: "#010101",
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["user.info.basic"],
    clientIdEnvKey: "EXPO_PUBLIC_TIKTOK_CLIENT_ID",
    usernameHint: "yourhandle",
    usernamePrefix: "@",
  },
  youtube: {
    label: "YouTube",
    color: "#FF0000",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "profile",
      "email",
    ],
    clientIdEnvKey: "EXPO_PUBLIC_GOOGLE_CLIENT_ID",
    usernameHint: "channel name or @handle",
  },
  facebook: {
    label: "Facebook",
    color: "#1877F2",
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
    scopes: ["public_profile"],
    clientIdEnvKey: "EXPO_PUBLIC_FACEBOOK_CLIENT_ID",
    usernameHint: "your.profile.name",
  },
  linkedin: {
    label: "LinkedIn",
    color: "#0A66C2",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["r_liteprofile", "r_emailaddress"],
    clientIdEnvKey: "EXPO_PUBLIC_LINKEDIN_CLIENT_ID",
    usernameHint: "your-name",
  },
  snapchat: {
    label: "Snapchat",
    color: "#FFFC00",
    authUrl: "https://accounts.snapchat.com/login/oauth2/authorize",
    tokenUrl: "https://accounts.snapchat.com/login/oauth2/access_token",
    scopes: ["https://auth.snapchat.com/oauth2/api/user.display_name"],
    clientIdEnvKey: "EXPO_PUBLIC_SNAPCHAT_CLIENT_ID",
    usernameHint: "yourhandle",
    usernamePrefix: "@",
  },
};

const ALL_PLATFORMS = Object.keys(PLATFORM_CONFIGS);

function getClientId(platform: string): string | undefined {
  const key = PLATFORM_CONFIGS[platform]?.clientIdEnvKey;
  if (!key) return undefined;
  return (process.env as Record<string, string | undefined>)[key];
}

function OAuthButton({
  platform,
  clientId,
  onSuccess,
  disabled,
}: {
  platform: string;
  clientId: string;
  onSuccess: (token: string) => void;
  disabled: boolean;
}) {
  const colors = useColors();
  const config = PLATFORM_CONFIGS[platform]!;

  const redirectUri = makeRedirectUri({ scheme: "mobile" });

  const discovery: DiscoveryDocument = {
    authorizationEndpoint: config.authUrl,
    tokenEndpoint: config.tokenUrl,
  };

  const authConfig: AuthRequestConfig = {
    clientId,
    scopes: config.scopes,
    redirectUri,
    usePKCE: true,
  };

  const [request, response, promptAsync] = useAuthRequest(authConfig, discovery);

  useEffect(() => {
    if (response?.type === "success") {
      const token = response.params.access_token ?? response.params.code ?? "";
      onSuccess(token);
    } else if (response?.type === "error") {
      Alert.alert(
        "Authentication Failed",
        response.error?.message ?? "The login was cancelled or failed. You can still add the account by entering your username manually.",
        [{ text: "OK" }]
      );
    }
  }, [response, onSuccess]);

  return (
    <TouchableOpacity
      style={[
        styles.oauthBtn,
        { backgroundColor: config.color, opacity: disabled || !request ? 0.6 : 1 },
      ]}
      disabled={disabled || !request}
      activeOpacity={0.8}
      onPress={() => promptAsync()}
    >
      <PlatformIcon platform={platform} size={20} />
      <Text style={[styles.oauthBtnText, { fontFamily: "Inter_600SemiBold" }]}>
        Sign in with {config.label}
      </Text>
    </TouchableOpacity>
  );
}

export default function ConnectAccount() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ platform?: string; existingId?: string }>();
  const { addAccount, updateAccount, user } = useApp();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const connectedPlatforms = new Set(
    user.connectedAccounts.map((a) => a.platform).filter(Boolean)
  );

  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(
    params.platform ?? null
  );
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthToken, setOauthToken] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "connect">(
    params.platform ? "connect" : "pick"
  );

  const config = selectedPlatform ? PLATFORM_CONFIGS[selectedPlatform] : null;
  const clientId = selectedPlatform ? getClientId(selectedPlatform) : undefined;
  const isExistingAccount = !!params.existingId;

  const handleOAuthSuccess = useCallback((token: string) => {
    setOauthToken(token);
    Alert.alert(
      "Authentication Successful",
      "Enter your username below to complete connecting this account.",
      [{ text: "OK" }]
    );
  }, []);

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
        await updateAccount(params.existingId, {
          accessToken: oauthToken ?? undefined,
        });
        Alert.alert(
          "Account Updated",
          oauthToken
            ? "Your account is now verified with OAuth authentication."
            : "Account updated.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      } else {
        await addAccount(selectedPlatform, trimmed, oauthToken ?? undefined);
        Alert.alert(
          "Account Connected",
          oauthToken
            ? `${config?.label} account @${trimmed} connected and verified.`
            : `${config?.label} account @${trimmed} added. Authenticate to verify ownership.`,
          [{ text: "Done", onPress: () => router.back() }]
        );
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to connect account.");
    } finally {
      setSubmitting(false);
    }
  }, [selectedPlatform, username, oauthToken, isExistingAccount, params.existingId, addAccount, updateAccount, config]);

  const selectPlatform = (platform: string) => {
    setSelectedPlatform(platform);
    setStep("connect");
    setUsername("");
    setOauthToken(null);
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

                {oauthToken ? (
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
                    onSuccess={handleOAuthSuccess}
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
                    {oauthToken
                      ? "Confirm your username to complete connection"
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
                      opacity: submitting || (!username.trim() && !oauthToken) ? 0.5 : 1,
                    },
                  ]}
                  disabled={submitting || (!username.trim() && !oauthToken)}
                  activeOpacity={0.8}
                  onPress={handleSubmit}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons
                        name={oauthToken ? "shield-checkmark" : "person-add"}
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={[styles.submitBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                        {oauthToken ? "Connect Verified Account" : "Add Account"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Verify CTA for existing accounts */}
              {isExistingAccount && !oauthToken && (
                <Text style={[styles.skipHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Sign in above to verify ownership of this account.
                </Text>
              )}
              {isExistingAccount && oauthToken && (
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.success, opacity: submitting ? 0.5 : 1 }]}
                  disabled={submitting}
                  activeOpacity={0.8}
                  onPress={handleSubmit}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                      <Text style={[styles.submitBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                        Save Verified Account
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
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
