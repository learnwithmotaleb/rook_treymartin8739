import assert from "node:assert/strict";
import test from "node:test";
import { checkRevenueCatRuntime } from "./revenuecatRuntime.ts";

test("web reports RevenueCat unavailable without accessing the native module", () => {
  let moduleAccessed = false;
  const result = checkRevenueCatRuntime("web", "bare", () => {
    moduleAccessed = true;
    throw new Error("native Purchases must not be touched on web");
  });

  assert.deepEqual(result, {
    available: false,
    reason: "RevenueCat store purchases are unavailable on web.",
  });
  assert.equal(moduleAccessed, false);
});

test("Expo Go reports RevenueCat unavailable without accessing the native module", () => {
  let moduleAccessed = false;
  const result = checkRevenueCatRuntime("ios", "storeClient", () => {
    moduleAccessed = true;
    throw new Error("native Purchases must not be touched in Expo Go");
  });

  assert.deepEqual(result, {
    available: false,
    reason: "RevenueCat native purchases are unavailable in Expo Go.",
  });
  assert.equal(moduleAccessed, false);
});

test("standalone iOS and Android initialize only when configure capability exists", () => {
  const configure = () => {};
  const PurchasesClass = Object.assign(function Purchases() {}, { configure });

  assert.deepEqual(
    checkRevenueCatRuntime("ios", "standalone", () => ({ configure })),
    { available: true },
  );
  assert.deepEqual(
    checkRevenueCatRuntime("ios", "standalone", () => PurchasesClass),
    { available: true },
  );
  assert.deepEqual(
    checkRevenueCatRuntime("android", "bare", () => ({ configure })),
    { available: true },
  );
  assert.deepEqual(
    checkRevenueCatRuntime("ios", "standalone", () => undefined),
    {
      available: false,
      reason: "The native RevenueCat Purchases module is unavailable.",
    },
  );
});