import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkProvider, ClerkLoaded } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AnimatedSplash } from "@/components/AnimatedSplash";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { initializeRevenueCat, SubscriptionProvider } from "@/lib/revenuecat";

try {
  initializeRevenueCat();
} catch (err: any) {
  // RC keys not set in this environment — purchases unavailable, app still works.
  // Dev-mode tier upgrades go directly through the server bypass instead.
  console.warn("[RevenueCat] Not configured:", err?.message);
}

// Keep the native splash screen up until our animated one takes over
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="auth" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="setup" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="threat/[id]" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="subscription" options={{ headerShown: false, animation: "slide_from_bottom", presentation: "modal" }} />
      <Stack.Screen name="legal" options={{ headerShown: false, animation: "slide_from_right" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Controls whether the AnimatedSplash is still mounted
  const [splashDone, setSplashDone] = useState(false);

  // Enforce a minimum visible splash duration of 4400 ms so the logo
  // always completes exactly 2 full spins (each spin = 2200 ms) before fading out.
  const [minTimeReached, setMinTimeReached] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinTimeReached(true), 4400);
    return () => clearTimeout(t);
  }, []);

  // Signal fade-out only when BOTH fonts are ready AND minimum time has passed
  const isReady = (fontsLoaded || !!fontError) && minTimeReached;

  // Hide the native Expo splash immediately so our animated one takes over
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // Notification deep-link handling (unchanged)
  useEffect(() => {
    if (Platform.OS === "web") return;

    function handleNotificationData(data: Record<string, unknown>) {
      const screen = data?.screen as string | undefined;
      if (screen === "threat" && data?.threatId) {
        router.push(`/threat/${data.threatId}` as any);
      } else if (screen === "alerts") {
        router.push("/(tabs)/alerts" as any);
      } else if (screen === "scan") {
        router.push("/(tabs)/scan" as any);
      } else if (screen === "dashboard" || screen === "home") {
        router.push("/(tabs)" as any);
      }
    }

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data as Record<string, unknown>;
        handleNotificationData(data);
      }
    });

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      handleNotificationData(data);
    });
    return () => sub.remove();
  }, []);

  // ── Phase 1: show ONLY the animated splash while fonts load ──────────────
  // Once fonts are ready AND the fade-out animation completes, splashDone
  // flips to true and the full app renders.
  if (!splashDone) {
    return (
      <AnimatedSplash
        isReady={isReady}
        onHidden={() => setSplashDone(true)}
      />
    );
  }

  // ── Phase 2: full app ────────────────────────────────────────────────────
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <SubscriptionProvider>
                <AppProvider>
                  <GestureHandlerRootView
                    style={
                      Platform.OS === "web"
                        ? { flex: 1, maxWidth: 430, width: "100%", alignSelf: "center" as const, overflow: "hidden" }
                        : { flex: 1 }
                    }
                  >
                    <KeyboardProvider>
                      <RootLayoutNav />
                    </KeyboardProvider>
                  </GestureHandlerRootView>
                </AppProvider>
              </SubscriptionProvider>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
