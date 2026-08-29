/**
 * RevenueCat subscription context for Rook.
 *
 * The current offering contains monthly and annual Rook Premium packages.
 * The legacy "pro" entitlement is accepted only to preserve access for an
 * existing subscriber during migration; it maps to Premium everywhere.
 */

import React, { createContext, useContext } from "react";
import { useUser } from "@clerk/expo";
import { Platform } from "react-native";
import Purchases, {
  type PurchasesPackage,
  type CustomerInfo,
  type PurchasesOfferings,
} from "react-native-purchases";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { syncSubscriptionTier } from "@/lib/api";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const ENTITLEMENT_PRO = "pro";
export const ENTITLEMENT_PREMIUM = "premium";

export type RCTier = "free" | "premium";

/** True only after a successful Purchases.configure() call. Guarded by _layout.tsx try/catch. */
export let isRevenueCatConfigured = false;
let identifiedAppUserId: string | null = null;
let identityRequest: Promise<void> | null = null;

function getRevenueCatApiKey(): string | null {
  // Dev, Expo Go (storeClient), or web → use test store key
  if (__DEV__ || Platform.OS === "web" || Constants.executionEnvironment === "storeClient") {
    return REVENUECAT_TEST_API_KEY ?? null;
  }
  if (Platform.OS === "ios") return REVENUECAT_IOS_API_KEY ?? null;
  if (Platform.OS === "android") return REVENUECAT_ANDROID_API_KEY ?? null;
  return REVENUECAT_TEST_API_KEY ?? null;
}

export function initializeRevenueCat(): void {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    throw new Error("RevenueCat API key not configured for this build target.");
  }
  if (__DEV__) {
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  }
  Purchases.configure({ apiKey });
  isRevenueCatConfigured = true;
}

/**
 * RevenueCat must know the Clerk ID before a purchase/restore is initiated so
 * its signed webhook can map the entitlement back to Rook's server account.
 */
export async function identifyRevenueCatUser(clerkUserId: string): Promise<void> {
  if (!isRevenueCatConfigured || identifiedAppUserId === clerkUserId) return;
  const request = Purchases.logIn(clerkUserId).then(() => {
    identifiedAppUserId = clerkUserId;
  });
  identityRequest = request;
  try {
    await request;
  } finally {
    if (identityRequest === request) identityRequest = null;
  }
}

/** Derive tier from RevenueCat customer info entitlements */
export function getTierFromCustomerInfo(info: CustomerInfo | null | undefined): RCTier {
  if (!info) return "free";
  if (info.entitlements.active[ENTITLEMENT_PREMIUM]) return "premium";
  if (info.entitlements.active[ENTITLEMENT_PRO]) return "premium";
  return "free";
}

// ─── Context ──────────────────────────────────────────────────────────────────

export interface SubscriptionContextValue {
  customerInfo: CustomerInfo | undefined;
  offerings: PurchasesOfferings | undefined;
  tier: RCTier;
  isSubscribed: boolean;
  isLoading: boolean;
  purchase: (pkg: PurchasesPackage) => Promise<CustomerInfo>;
  restore: () => Promise<CustomerInfo>;
  isPurchasing: boolean;
  isRestoring: boolean;
  refetch: () => void;
}

function useSubscriptionContext(): SubscriptionContextValue {
  const qc = useQueryClient();
  const { user } = useUser();

  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: () => Purchases.getCustomerInfo(),
    staleTime: 60_000,
    enabled: isRevenueCatConfigured,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: () => Purchases.getOfferings(),
    staleTime: 300_000,
    enabled: isRevenueCatConfigured,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      if (!user?.id) throw new Error("Please sign in before purchasing.");
      await identifyRevenueCatUser(user.id);
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return customerInfo;
    },
    onSuccess: (info) => {
      qc.setQueryData(["revenuecat", "customer-info"], info);
      const newTier = getTierFromCustomerInfo(info);
      syncSubscriptionTier(newTier).catch(() => {});
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Please sign in before restoring purchases.");
      await identifyRevenueCatUser(user.id);
      const info = await Purchases.restorePurchases();
      return info;
    },
    onSuccess: (info) => {
      qc.setQueryData(["revenuecat", "customer-info"], info);
      const newTier = getTierFromCustomerInfo(info);
      syncSubscriptionTier(newTier).catch(() => {});
    },
  });

  const tier = getTierFromCustomerInfo(customerInfoQuery.data);
  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    tier,
    isSubscribed: tier !== "free",
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    refetch: () => {
      void customerInfoQuery.refetch();
      void offeringsQuery.refetch();
    },
  };
}

const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSubscription must be used within a SubscriptionProvider");
  return ctx;
}
