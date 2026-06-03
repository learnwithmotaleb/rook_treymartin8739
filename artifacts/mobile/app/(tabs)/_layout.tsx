import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Redirect, Tabs } from "expo-router";
import { Icon, Label, NativeTabs, Badge } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { setApiAuthToken } from "@/lib/api";

function NativeTabLayout() {
  const { activeThreats } = useApp();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "shield", selected: "shield.fill" }} />
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
              <SymbolView name="shield.fill" tintColor={color} size={24} />
            ) : (
              <Ionicons name="shield" size={22} color={color} />
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
  const { login, logout, hasSeenOnboarding, isInitializing } = useApp();

  // Keep a stable ref to getToken so the effect below doesn't need it as a
  // dependency. Clerk sometimes returns a new function reference on every
  // render, which would cause the effect to re-fire and spam refreshData().
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; });

  useEffect(() => {
    // Wait for both Clerk AND AsyncStorage to finish loading before doing anything.
    // If we act before isLoaded/isInitializing resolve, isSignedIn and
    // hasSeenOnboarding are wrong defaults and we'd set a null token.
    if (!isLoaded || isInitializing) return;
    if (!isSignedIn) {
      logout();
      return;
    }
    if (hasSeenOnboarding) {
      // setApiAuthToken must be called BEFORE login() so that the getter is
      // ready when refreshData() fires inside login().
      setApiAuthToken(() => getTokenRef.current());
      login("", "");
    }
  // getToken intentionally omitted — accessed via ref to keep this effect stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isInitializing, isSignedIn, hasSeenOnboarding, login, logout]);

  // Show nothing while Clerk or AsyncStorage are still loading.
  // This prevents flash-redirects to /auth or /onboarding for returning users
  // whose stored state hasn't been read from AsyncStorage yet.
  if (!isLoaded || isInitializing) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/auth" />;
  }

  if (!hasSeenOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
