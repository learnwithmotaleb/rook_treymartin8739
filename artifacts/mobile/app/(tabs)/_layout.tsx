import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Redirect, Tabs } from "expo-router";
import { Icon, Label, NativeTabs, Badge } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/expo";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { deleteMyAccount, getMe, syncSubscriptionTier } from "@/lib/api";
import { CancellationSurveyModal } from "@/components/CancellationSurveyModal";
import { TermsUpdateModal } from "@/components/TermsUpdateModal";
import { useNotifications } from "@/hooks/useNotifications";
import { CURRENT_AGE_VERSION, CURRENT_TERMS_VERSION } from "@/lib/api";
import { useSubscription, ENTITLEMENT_PREMIUM } from "@/lib/revenuecat";
import Constants from "expo-constants";

function NativeTabLayout() {
  const { activeThreats } = useApp();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "crown", selected: "crown.fill" }} />
        <Label>Dashboard</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="alerts">
        <Icon sf={{ default: "bell", selected: "bell.fill" }} />
        <Label>Alerts</Label>
        {activeThreats > 0 && <Badge>{String(activeThreats)}</Badge>}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scan">
        <Icon sf={{ default: "dot.radiowaves.left.and.right", selected: "dot.radiowaves.left.and.right" }} />
        <Label>Scan</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const { activeThreats } = useApp();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          paddingBottom: isWeb ? 0 : insets.bottom,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.card },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="crown.fill" tintColor={color} size={24} />
            ) : (
              <MaterialCommunityIcons name="chess-rook" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarBadge: activeThreats > 0 ? activeThreats : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, color: "#FFFFFF", fontSize: 10 },
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="bell.fill" tintColor={color} size={24} />
            ) : (
              <Ionicons name="notifications" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="dot.radiowaves.left.and.right" tintColor={color} size={24} />
            ) : (
              <MaterialCommunityIcons name="radar" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.fill" tintColor={color} size={24} />
            ) : (
              <Ionicons name="person" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const { login, logout, hasSeenOnboarding, isInitializing, isOnboardingReady, isLoggedIn, showCancellationSurvey, dismissCancellationSurvey } = useApp();
  const colors = useColors();
  const { tier, customerInfo } = useSubscription();
  useNotifications(isLoggedIn, clerkUser?.id);

  // Safety valve: if initialization takes more than 12 seconds, stop waiting
  // and show a recoverable error rather than a permanent blank screen.
  const [initTimedOut, setInitTimedOut] = useState(false);
  const [complianceState, setComplianceState] = useState<
    | { status: "checking" }
    | { status: "error"; userId: string; message: string }
    | { status: "clear"; userId: string }
    | { status: "required"; userId: string; requiresTermsAcceptance: boolean; requiresAgeConfirmation: boolean }
  >({ status: "checking" });
  const [complianceRetry, setComplianceRetry] = useState(0);
  const isStartupPending =
    !isLoaded || isInitializing ||
    (isSignedIn && complianceState.status === "clear" && !isOnboardingReady);
  useEffect(() => {
    if (!isStartupPending) { setInitTimedOut(false); return; }
    const t = setTimeout(() => setInitTimedOut(true), 12_000);
    return () => clearTimeout(t);
  }, [isStartupPending]);

  useEffect(() => {
    // Wait for both Clerk AND AsyncStorage to finish loading before doing anything.
    if (!isLoaded || isInitializing) return;
    if (!isSignedIn) {
      logout();
      return;
    }
    // The server denies normal API calls until the acknowledgements are
    // recorded. Avoid firing profile updates, account loads and token refresh
    // while the recovery screen is still in progress.
    if (complianceState.status !== "clear" || complianceState.userId !== clerkUser?.id) return;
    // Load data for any signed-in user regardless of onboarding state.
    // The root layout owns the API token bridge so non-tab routes and deep
    // links authenticate before this layout mounts.
    const name = clerkUser?.fullName ?? clerkUser?.firstName ?? "";
    const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    login(name, email, clerkUser?.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isInitializing, isSignedIn, login, logout, clerkUser, complianceState.status]);

  useEffect(() => {
    if (!clerkUser?.id) {
      setComplianceState({ status: "checking" });
    }
  }, [clerkUser?.id]);

  // The server is authoritative. A local cache must never bypass the age or
  // Terms check (including after another device, account deletion, or logout).
  useEffect(() => {
    if (!isLoaded || isInitializing || !isSignedIn || complianceState.status !== "clear") return;
    const uid = clerkUser?.id;
    if (!uid) return;
    let cancelled = false;
    setComplianceState({ status: "checking" });
    getMe().then((profile) => {
      if (cancelled) return;
      const requiresTermsAcceptance =
        profile.termsVersion !== CURRENT_TERMS_VERSION || !profile.termsAcceptedAt;
      const requiresAgeConfirmation =
        profile.minimumAgeVersion !== CURRENT_AGE_VERSION || !profile.ageConfirmedAt;
      setComplianceState(
        requiresTermsAcceptance || requiresAgeConfirmation
          ? { status: "required", userId: uid, requiresTermsAcceptance, requiresAgeConfirmation }
          : { status: "clear", userId: uid },
      );
    }).catch((error: unknown) => {
      if (cancelled) return;
      setComplianceState({
        status: "error",
        userId: uid,
        message: error instanceof Error ? error.message : "Could not verify your acknowledgements.",
      });
    });
    return () => { cancelled = true; };
  }, [isLoaded, isInitializing, isSignedIn, clerkUser?.id, complianceRetry]);

  // Sync the RevenueCat tier to the server whenever it changes so the server-
  // side scan-quota system reflects the user's actual subscription.
  // Guards:
  //   1. Skip if RC has no customer data (RC not configured at all).
  //   2. Skip if running in Expo Go (storeClient) — RC runs in Preview API
  //      Mode there and always reports "free" regardless of real purchases.
  //      In Expo Go, use the paywall's dev-mode bypass to test tier changes.
  useEffect(() => {
    if (!isLoaded || isInitializing || !isSignedIn) return;
    if (!customerInfo) return;
    if (Constants.executionEnvironment === "storeClient") return;
    // Detect if the user is currently in a free-trial period from RC.
    const activeEntitlement = customerInfo.entitlements.active[ENTITLEMENT_PREMIUM];
    const isInTrial = activeEntitlement?.periodType === "TRIAL";
    const trialEndsAt = isInTrial ? (activeEntitlement?.expirationDate ?? undefined) : undefined;

    syncSubscriptionTier(
      tier,
      isInTrial ? { status: "trialing", trialEndsAt } : undefined
    ).catch(() => {
      Alert.alert(
        "Subscription Sync Failed",
        "Your subscription is active on this device but could not be confirmed with the server. Scan limits may not reflect your plan. Please check your connection and try again.",
        [{ text: "OK" }]
      );
    });
  }, [tier, isLoaded, isInitializing, isSignedIn, customerInfo, complianceState.status]);

  // Render a blank screen (not null) while loading — returning null from a
  // layout component breaks expo-router's component tree on web and causes
  // "Invalid hook call" errors in child screens.
  if (isStartupPending) {
    if (initTimedOut) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 16 }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center", paddingHorizontal: 40 }}>
            Rook is taking longer than expected to start. Check your connection, then try again.
          </Text>
          <TouchableOpacity
            onPress={() => setInitTimedOut(false)}
            style={{ backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 }}
            activeOpacity={0.8}
          >
            <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 14 }}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 15 }}>
          Getting Rook ready…
        </Text>
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/auth" />;
  }

  if (
    complianceState.status === "checking" ||
    complianceState.userId !== clerkUser?.id
  ) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 14 }}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 15 }}>
          Verifying your required acknowledgements…
        </Text>
      </View>
    );
  }

  if (complianceState.status === "error") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 }}>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center" }}>
          We couldn’t verify your Terms and age confirmation. Rook remains locked until the server can confirm them.
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" }}>
          {complianceState.message}
        </Text>
        <TouchableOpacity
          onPress={() => setComplianceRetry((attempt) => attempt + 1)}
          style={{ backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 }}
          activeOpacity={0.8}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Retry verification</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (complianceState.status === "required") {
    const confirmDeleteAccount = () => {
      Alert.alert(
        "Delete your account?",
        "Your Rook account and associated server data will be deleted.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete account",
            style: "destructive",
            onPress: () => {
              void (async () => {
                try {
                  await deleteMyAccount();
                  await logout();
                  await signOut();
                } catch (error) {
                  Alert.alert(
                    "Could not delete account",
                    error instanceof Error ? error.message : "Please check your connection and try again.",
                  );
                }
              })();
            },
          },
        ],
      );
    };
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <TermsUpdateModal
          visible
          requiresTermsAcceptance={complianceState.requiresTermsAcceptance}
          requiresAgeConfirmation={complianceState.requiresAgeConfirmation}
          onAccepted={async () => {
            const profile = await getMe();
            const requiresTermsAcceptance =
              profile.termsVersion !== CURRENT_TERMS_VERSION || !profile.termsAcceptedAt;
            const requiresAgeConfirmation =
              profile.minimumAgeVersion !== CURRENT_AGE_VERSION || !profile.ageConfirmedAt;
            if (requiresTermsAcceptance || requiresAgeConfirmation) {
              setComplianceState({
                status: "required",
                userId: clerkUser?.id ?? "",
                requiresTermsAcceptance,
                requiresAgeConfirmation,
              });
              throw new Error("The server has not confirmed all required acknowledgements.");
            }
            setComplianceState({ status: "clear", userId: clerkUser?.id ?? "" });
          }}
          onDeleteAccount={confirmDeleteAccount}
        />
      </View>
    );
  }

  // hasSeenOnboarding is backed by the server's onboardingCompleted flag
  // (onboardingAnswers persisted in the DB), synced in refreshData(), with the
  // per-user cache. Compliance is checked before allowing access to onboarding
  // or the tabs, so new SSO accounts can recover before any protected API use.
  if (!hasSeenOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <>
      {isLiquidGlassAvailable() ? <NativeTabLayout /> : <ClassicTabLayout />}
      <CancellationSurveyModal
        visible={showCancellationSurvey}
        onDismiss={dismissCancellationSurvey}
      />
    </>
  );
}
