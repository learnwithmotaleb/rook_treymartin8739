---
name: RevenueCat tier sync pattern
description: How RevenueCat on-device purchases are synced to the server-side subscription DB for quota checks, including Expo Go guards.
---

## The rule

RevenueCat is the authoritative source of truth for subscription state on-device. The server's `subscriptions` DB table is a cache used only for scan-quota enforcement. Sync happens client-driven, not via webhooks.

## How to apply

Three sync points are wired:

1. **After purchase** — `revenuecat.tsx` `purchaseMutation.onSuccess` calls `syncSubscriptionTier(newTier)`.
2. **After restore** — `revenuecat.tsx` `restoreMutation.onSuccess` calls `syncSubscriptionTier(newTier)`.
3. **On app launch** — `(tabs)/_layout.tsx` `useEffect` on `tier` (from `useSubscription()`) calls `syncSubscriptionTier(tier)` once auth is ready — **but only with both guards applied (see below)**.

The server endpoint is `POST /api/billing/revenuecat-sync` (authenticated, body: `{ tier: "free"|"pro"|"premium" }`). It does an upsert on `subscriptions.userId` (unique constraint) and updates `users.isPremium`.

## Expo Go guard (critical)

In Expo Go, RC runs in **Preview API Mode** — all APIs return no active entitlements, so `tier` is always `"free"` even though `customerInfo` is defined (not null/undefined). Without guards, the tab mount effect fires on every app load and **resets the DB tier to "free"**, completely breaking dev-mode tier upgrades.

Two guards are required in the tab mount sync effect:
```ts
if (!customerInfo) return;  // RC not configured at all (no API keys)
if (Constants.executionEnvironment === "storeClient") return;  // Expo Go preview mode
```

## Dev bypass for testing premium

In `__DEV__` with no real RC packages available (`getPackage()` returns null), `handleUpgrade` in `subscription.tsx` calls `handleDevUpgrade(tier)` → `syncSubscriptionTier(tier)` directly → updates DB tier. The tab-mount sync guards do NOT affect this path — dev upgrades still work.

## User identification

`Purchases.logIn(clerkUser.id)` is called in `(tabs)/_layout.tsx` after sign-in so RevenueCat ties purchases to the Clerk user ID. This is essential for cross-device restore to work.

**Why:** RC doesn't webhook into the DB automatically; the mobile app drives sync on all purchase/restore events. Without the Expo Go guard, Preview API Mode's "always free" customerInfo resets any manually-set premium tier on every app launch.
