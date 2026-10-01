export type RevenueCatRuntimeCheck =
  | { available: true }
  | { available: false; reason: string };

/**
 * Check runtime support before loading or inspecting the native Purchases
 * module. Expo Go and web are intentionally treated as unavailable here.
 */
export function checkRevenueCatRuntime(
  platform: string,
  executionEnvironment: string | null | undefined,
  getPurchasesModule: () => unknown,
): RevenueCatRuntimeCheck {
  if (platform === "web") {
    return { available: false, reason: "RevenueCat store purchases are unavailable on web." };
  }
  if (executionEnvironment === "storeClient") {
    return { available: false, reason: "RevenueCat native purchases are unavailable in Expo Go." };
  }
  if (platform !== "ios" && platform !== "android") {
    return { available: false, reason: `RevenueCat purchases are unsupported on ${platform}.` };
  }

  const purchasesModule = getPurchasesModule();
  if (
    purchasesModule === null ||
    (typeof purchasesModule !== "object" && typeof purchasesModule !== "function") ||
    typeof (purchasesModule as { configure?: unknown }).configure !== "function"
  ) {
    return { available: false, reason: "The native RevenueCat Purchases module is unavailable." };
  }

  return { available: true };
}