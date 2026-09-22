import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkLoaded, ClerkProvider, useAuth, useUser } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { reloadAppAsync } from "expo";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AnimatedSplash } from "@/components/AnimatedSplash";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider, useApp } from "@/context/AppContext";
import { identifyRevenueCatUser, initializeRevenueCat, isRevenueCatConfigured, resetRevenueCatIdentity, SubscriptionProvider } from "@/lib/revenuecat";
import { setApiAuthToken } from "@/lib/api";

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
const clerkProxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

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
      <Stack.Screen name="privacy-settings" options={{ headerShown: false, animation: "slide_from_right" }} />
    </Stack>
  );
}

function ClerkReadyMarker({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);

  return null;
}

function RevenueCatIdentityBridge() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const previousUserId = React.useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isRevenueCatConfigured) return;
    const nextUserId = isSignedIn ? user?.id ?? null : null;
    if (nextUserId) {
      identifyRevenueCatUser(nextUserId).catch(() => {});
    } else if (previousUserId.current) {
      resetRevenueCatIdentity().catch(() => {});
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] === "revenuecat" });
    }
    previousUserId.current = nextUserId;
  }, [isLoaded, isSignedIn, user?.id]);

  return null;
}

function ApiAuthBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    // Install the Clerk token getter at the root so cold starts and deep links
    // to onboarding, subscription, privacy, or threat detail authenticate API
    // calls even when the tabs layout has never mounted.
    setApiAuthToken(() => getToken());
  }, [getToken, isLoaded, isSignedIn, user?.id]);

  return null;
}

function ClerkStartupFallback() {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setTimedOut(true), 12_000);
    return () => clearTimeout(timeout);
  }, []);

  const tryAgain = () => {
    reloadAppAsync().catch(() => setTimedOut(false));
  };

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        paddingHorizontal: 32,
        backgroundColor: "#070B12",
      }}
    >
      {timedOut ? (
        <>
          <Text
            style={{
              color: "#9CA3AF",
              fontFamily: "Inter_400Regular",
              fontSize: 15,
              lineHeight: 22,
              textAlign: "center",
            }}
          >
            Rook is taking longer than expected to start. Check your connection, then try again.
          </Text>
          <Pressable
            onPress={tryAgain}
            style={({ pressed }) => ({
              paddingHorizontal: 26,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: "#3B82F6",
              opacity: pressed ? 0.82 : 1,
            })}
          >
            <Text style={{ color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
              Try Again
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text style={{ color: "#9CA3AF", fontFamily: "Inter_400Regular", fontSize: 15 }}>
            Getting Rook ready…
          </Text>
        </>
      )}
    </View>
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
  const [isClerkReady, setIsClerkReady] = useState(false);

  // Minimum duration covers the full animation sequence:
  // logo entrance (700ms) + scan line (1800ms) + wordmark reveal (2300ms) + tagline + hold ≈ 3600ms
  const [minTimeReached, setMinTimeReached] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinTimeReached(true), 3800);
    return () => clearTimeout(t);
  }, []);

  // Signal fade-out only when BOTH fonts are ready AND minimum time has passed
  const isReady = (fontsLoaded || !!fontError) && minTimeReached;
  const finishSplash = useCallback(() => setSplashDone(true), []);
  const markClerkReady = useCallback(() => setIsClerkReady(true), []);

  // Do not hide the native splash until fonts are ready. Hiding it before the
  // first React Native frame can produce a white handoff on release builds.
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // Reanimated completion callbacks can be skipped by a native release build
  // after an interrupted animation. Never allow that to strand users on the
  // animated splash: the app shell must appear even if the callback is missed.
  useEffect(() => {
    const timeout = setTimeout(finishSplash, 6_000);
    return () => clearTimeout(timeout);
  }, [finishSplash]);

  // ── Phase 1: show ONLY the animated splash while fonts load ──────────────
  // Once fonts are ready AND the fade-out animation completes, splashDone
  // flips to true and the full app renders.
  if (!splashDone) {
    return (
      <AnimatedSplash
        isReady={isReady}
        onHidden={finishSplash}
      />
    );
  }

  // ── Phase 2: full app ────────────────────────────────────────────────────
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        {!isClerkReady ? <ClerkStartupFallback /> : null}
        <ClerkProvider
          publishableKey={publishableKey}
          tokenCache={tokenCache}
          proxyUrl={clerkProxyUrl}
        >
          <ClerkLoaded>
            <ClerkReadyMarker onReady={markClerkReady} />
            <ApiAuthBridge />
            <RevenueCatIdentityBridge />
            <QueryClientProvider client={queryClient}>
              <SubscriptionProvider>
                <AppProvider>
                  <NotificationDeepLinkBridge />
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
          </ClerkLoaded>
        </ClerkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

/**
 * Notification responses can arrive before Clerk has restored a session (most
 * commonly from a terminated-state launch). Never route a signed-out user
 * directly to private threat data; wait for Clerk and discard the response
 * when no authenticated session exists.
 */
function NotificationDeepLinkBridge() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isOnboardingReady, hasSeenOnboarding } = useApp();
  const pendingResponse = React.useRef<Notifications.NotificationResponse | null>(null);
  const consumed = React.useRef(false);
  const authState = React.useRef({ isSignedIn: !!isSignedIn, isOnboardingReady, hasSeenOnboarding });
  authState.current = { isSignedIn: !!isSignedIn, isOnboardingReady, hasSeenOnboarding };

  useEffect(() => {
    if (Platform.OS === "web" || !isLoaded || consumed.current) return;

    const route = (data: Record<string, unknown>) => {
      const screen = typeof data.screen === "string" ? data.screen : undefined;
      const threatId = typeof data.threatId === "string" ? data.threatId : undefined;
      if (screen === "threat" && threatId) {
        router.push(`/threat/${encodeURIComponent(threatId)}` as any);
      } else if (screen === "alerts") {
        router.push("/(tabs)/alerts" as any);
      } else if (screen === "scan") {
        router.push("/(tabs)/scan" as any);
      } else if (screen === "dashboard" || screen === "home") {
        router.push("/(tabs)" as any);
      }
    };

    let active = true;
    consumed.current = true;
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        // Consume immediately. A response left in native storage can
        // otherwise be replayed after a different Clerk account signs in.
        Notifications.clearLastNotificationResponseAsync().catch(() => {});
        if (!active || !response || !authState.current.isSignedIn) return;
        if (authState.current.isOnboardingReady && authState.current.hasSeenOnboarding) {
          route(response.notification.request.content.data as Record<string, unknown>);
        } else {
          pendingResponse.current = response;
        }
      })
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (!active || !authState.current.isSignedIn) return;
      if (authState.current.isOnboardingReady && authState.current.hasSeenOnboarding) {
        route(response.notification.request.content.data as Record<string, unknown>);
      } else {
        pendingResponse.current = response;
      }
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [isLoaded]);

  useEffect(() => {
    if (!isSignedIn || !isOnboardingReady || !hasSeenOnboarding) {
      pendingResponse.current = null;
      return;
    }
    const response = pendingResponse.current;
    if (response) {
      pendingResponse.current = null;
      const data = response.notification.request.content.data as Record<string, unknown>;
      const screen = typeof data.screen === "string" ? data.screen : undefined;
      const id = typeof data.threatId === "string" ? data.threatId : undefined;
      if (screen === "threat" && id) router.push(`/threat/${encodeURIComponent(id)}` as any);
      else if (screen === "alerts") router.push("/(tabs)/alerts" as any);
      else if (screen === "scan") router.push("/(tabs)/scan" as any);
      else if (screen === "dashboard" || screen === "home") router.push("/(tabs)" as any);
    }
  }, [isSignedIn, isOnboardingReady, hasSeenOnboarding]);

  return null;
}
