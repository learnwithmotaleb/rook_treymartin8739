# ShieldID — Submission Checklist

Quick-reference for the first production release. Full details in
`artifacts/mobile/metadata/SUBMISSIONS.md`.

---

## 1 — Prerequisites

- [ ] Apple Developer Program ($99/yr) — enroll at developer.apple.com
- [ ] EAS CLI installed: `npm install -g eas-cli` → `eas login`
- [ ] RevenueCat account with iOS + Android apps created

## 2 — RevenueCat products (must exist before build)

| Product ID | Tier | Price |
|---|---|---|
| `shieldid_pro_monthly` | Pro | $4.99/month |
| `shieldid_pro_yearly` | Pro | $39.99/year |
| `shieldid_premium_monthly` | Premium | $9.99/month |
| `shieldid_premium_yearly` | Premium | $79.99/year |

Add 7-day free trial to all four. Copy IDs into RevenueCat dashboard.

## 3 — EAS credentials (fill in eas.json `submit` section)

```json
"ios": {
  "appleId": "your@apple.id",
  "ascAppId": "1234567890",
  "appleTeamId": "ABCDE12345"
}
```

## 4 — EAS secrets (set once via `eas secret:create`)

- `REVENUECAT_IOS_API_KEY` — from RevenueCat iOS app settings
- `REVENUECAT_ANDROID_API_KEY` — from RevenueCat Android app settings
- `SESSION_SECRET` — already set in Replit secrets

## 5 — Regenerate app icons (if needed)

```bash
pnpm --filter @workspace/scripts run generate:icon
```

Outputs: `artifacts/mobile/assets/images/{icon,adaptive-icon,splash}.png`

## 6 — Build

```bash
cd artifacts/mobile

# iOS — TestFlight internal test
eas build --platform ios --profile preview

# iOS — App Store submission
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

## 7 — App Store Connect

1. Create app record at appstoreconnect.apple.com (bundle ID: `com.shieldid.app`)
2. Fill in listing from `artifacts/mobile/metadata/ios/en-US/` text files
3. Set age rating to **4+** (answer all violence/content questions as "None",
   "Unrestricted Web Access" → Yes)
4. Attach build from step 6, submit for review

## 8 — Google Play Console

1. Create app at play.google.com/console
2. Fill in listing from `artifacts/mobile/metadata/android/en-US/` text files
3. Upload `.aab` from step 6

## 9 — Privacy & legal URLs (already live)

- Privacy Policy: `https://shieldid.replit.app/privacy`
- Terms of Service: `https://shieldid.replit.app/terms`
- Support: `https://shieldid.replit.app/support`

---

See `artifacts/mobile/metadata/SUBMISSIONS.md` for the full step-by-step guide.
