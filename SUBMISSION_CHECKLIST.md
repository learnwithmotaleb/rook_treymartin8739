# ShieldID — Submission Checklist

Quick-reference for the first production release. Full details in
`artifacts/mobile/metadata/SUBMISSIONS.md`.

---

## 1 — Prerequisites

- [ ] Apple Developer Program ($99/yr) — enroll at developer.apple.com
- [ ] Google Play Console account ($25 one-time) — play.google.com/console
- [ ] EAS CLI installed: `npm install -g eas-cli` → `eas login`
- [ ] RevenueCat account with iOS + Android apps created

## 2 — RevenueCat products (create before building)

| Product ID | Tier | Price |
|---|---|---|
| `com.shieldid.pro.monthly` | Pro | $4.99/month |
| `com.shieldid.pro.yearly` | Pro | $39.99/year |
| `com.shieldid.premium.monthly` | Premium | $9.99/month |
| `com.shieldid.premium.yearly` | Premium | $79.99/year |

Add 7-day free trial to all four. Copy IDs into RevenueCat dashboard entitlements.

## 3 — EAS credentials (fill in `eas.json` `submit` section)

```json
"ios": {
  "appleId": "your@apple.id",
  "ascAppId": "1234567890",
  "appleTeamId": "ABCDE12345"
}
```

## 4 — EAS secrets (set via `eas secret:create`)

- `REVENUECAT_IOS_API_KEY` — from RevenueCat iOS app settings
- `REVENUECAT_ANDROID_API_KEY` — from RevenueCat Android app settings

## 5 — Regenerate app icons (if logo changes)

```bash
pnpm --filter @workspace/scripts run generate:icon
```

Outputs: `artifacts/mobile/assets/images/{icon,adaptive-icon,splash}.png`

## 6 — Build

```bash
cd artifacts/mobile

# Run locally with Expo Go (no build needed)
# Scan QR from Replit URL bar with the Expo Go app

# iOS — TestFlight internal distribution
eas build --platform ios --profile preview

# iOS — App Store submission
eas build --platform ios --profile production

# Android — Google Play
eas build --platform android --profile production
```

## 7 — Submit to stores

```bash
# After build completes — submit iOS to App Store Connect
eas submit --platform ios --profile production

# Submit Android to Google Play
eas submit --platform android --profile production
```

## 8 — App Store Connect

1. Create app record at appstoreconnect.apple.com
   - Bundle ID: `com.shieldid.app`, SKU: `shieldid-ios-001`
2. Fill listing from `artifacts/mobile/metadata/ios/en-US/` text files
3. Set age rating to **4+** (all violence/content questions → "None";
   "Unrestricted Web Access" → Yes)
4. Add subscriptions in **Features → Subscriptions** (see step 2 IDs above)
5. Attach build from step 6 and submit for review

## 9 — Google Play Console

1. Create app at play.google.com/console
2. Fill listing from `artifacts/mobile/metadata/android/en-US/` text files
3. Upload `.aab` from step 6 under **Production → Releases**
4. Add in-app subscriptions with the same product IDs as step 2

## 10 — Legal URLs (already live)

- Privacy Policy: `https://shieldid.replit.app/privacy`
- Terms of Service: `https://shieldid.replit.app/terms`
- Support: `https://shieldid.replit.app/support`

---

See `artifacts/mobile/metadata/SUBMISSIONS.md` for the full step-by-step guide.
