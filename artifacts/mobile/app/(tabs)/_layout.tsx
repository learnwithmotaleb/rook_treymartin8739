import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Redirect, Tabs } from "expo-router";
import { Icon, Label, NativeTabs, Badge } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/expo";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { setApiAuthToken, syncSubscriptionTier } from "@/lib/api";
import { CancellationSurveyModal } from "@/components/CancellationSurveyModal";
import { useNotifications } from "@/hooks/useNotifications";
import { useSubscription, ENTITLEMENT_PREMIUM, ENTITLEMENT_PRO } from "@/lib/revenuecat";
import Purchases from "react-native-purchases";
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
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const { login, logout, hasSeenOnboarding, isInitializing, isOnboardingReady, isLoggedIn, showCancellationSurvey, dismissCancellationSurvey } = useApp();
  const colors = useColors();
  const { tier, customerInfo } = useSubscription();
  useNotifications(isLoggedIn);

  // Safety valve: if initialization takes more than 12 seconds, stop waiting
  // and show a recoverable error rather than a permanent blank screen.
  const [initTimedOut, setInitTimedOut] = useState(false);
  useEffect(() => {
    if (!isInitializing && (isOnboardingReady || !isSignedIn)) { setInitTimedOut(false); return; }
    const t = setTimeout(() => setInitTimedOut(true), 12_000);
    return () => clearTimeout(t);
  }, [isInitializing, isOnboardingReady, isSignedIn]);

  // Keep a stable ref to getToken so the effect below doesn't need it as a
  // dependency. Clerk sometimes returns a new function reference on every
  // render, which would cause the effect to re-fire and spam refreshData().
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; });

  useEffect(() => {
    // Wait for both Clerk AND AsyncStorage to finish loading before doing anything.
    if (!isLoaded || isInitializing) return;
    if (!isSignedIn) {
      logout();
      return;
    }
    // Always wire auth token and load data for any signed-in user —
    // regardless of onboarding state. Returning users (reinstall, re-login)
    // should never be blocked from reaching the app by the onboarding flag.
    setApiAuthToken(() => getTokenRef.current());
    const name = clerkUser?.fullName ?? clerkUser?.firstName ?? "";
    const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    login(name, email, clerkUser?.id);
    // Identify the user to RevenueCat so purchases are tied to their account
    // across devices and are recoverable after reinstall.
    if (clerkUser?.id) {
      Purchases.logIn(clerkUser.id).catch(() => {
        // Non-fatal: if RevenueCat identification fails the app still works.
      });
    }
  // getToken intentionally omitted — accessed via ref to keep this effect stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isInitializing, isSignedIn, login, logout, clerkUser]);

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
    const activeEntitlement =
      customerInfo.entitlements.active[ENTITLEMENT_PREMIUM] ??
      customerInfo.entitlements.active[ENTITLEMENT_PRO];
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
  }, [tier, isLoaded, isInitializing, isSignedIn, customerInfo]);

  // Render a blank screen (not null) while loading — returning null from a
  // layout component breaks expo-router's component tree on web and causes
  // "Invalid hook call" errors in child screens.
  if (!isLoaded || isInitializing || (isSignedIn && !isOnboardingReady)) {
    if (initTimedOut) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 16 }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center", paddingHorizontal: 40 }}>
            Taking longer than expected…
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
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  if (!isSignedIn) {
    return <Redirect href="/auth" />;
  }

  // hasSeenOnboarding is backed by the server's onboardingCompleted flag
  // (onboardingAnswers persisted in the DB), synced in refreshData(), with the
  // per-user AsyncStorage value as a fast local cache to avoid flicker. This
  // is durable across reinstalls and account deletion/recreation, so we no
  // longer need a Clerk-account-age heuristic (which incorrectly skipped
  // onboarding for users who abandoned it mid-flow and returned >10 min later).
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
