# Rook — App Store Submission Guide

Step-by-step checklist for submitting to the Apple App Store and Google Play.

---

## Prerequisites (both stores)

- [ ] Apple Developer account ($99/year) enrolled and in good standing
- [ ] Google Play Console account ($25 one-time fee)
- [ ] EAS CLI installed: `npm install -g eas-cli`
- [ ] Logged in to EAS: `eas login`
- [ ] RevenueCat production products created and verified in both store dashboards
- [ ] Privacy Policy live at: `https://tryrook.app/api/legal/privacy`
- [ ] Support page live at: `https://tryrook.app/support`

---

## Part 1 — Build Production Binaries

### 1a. Configure `eas.json`

Fill in your credentials in `eas.json`:
```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your@apple.id",
      "ascAppId": "1234567890",      ← from App Store Connect URL
      "appleTeamId": "ABCDE12345"    ← 10-char team ID
    }
  }
}
```

### 1b. Build iOS

```bash
cd artifacts/mobile
eas build --platform ios --profile production
```

This creates an `.ipa` signed with your distribution certificate. EAS handles
codesigning automatically if you allow it to manage credentials.

### 1c. Build Android

```bash
eas build --platform android --profile production
```

This creates a signed `.aab` (Android App Bundle) for the Play Store.

---

## Part 2 — Apple App Store Connect

### 2a. Create the App (first submission only)

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. **My Apps → +  → New App**
3. Platform: **iOS**
4. Name: `Rook — Identity Protection` (matches `metadata/ios/en-US/name.txt`)
5. Primary language: **English (U.S.)**
6. Bundle ID: `com.getrook.app`
7. SKU: `rook-ios-001`

### 2b. App Information

| Field | Value |
|---|---|
| Name | Rook — Identity Protection |
| Subtitle | AI-Powered Impersonator Shield |
| Privacy Policy URL | https://tryrook.app/api/legal/privacy |
| Category (Primary) | Utilities |
| Category (Secondary) | Productivity |

### 2c. Age Rating

In **App Information → Age Rating**, answer the questionnaire:

| Question | Answer |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Sexual Content or Nudity | None |
| Profanity or Crude Humor | None |
| Alcohol, Tobacco, or Drug Use | None |
| Simulated Gambling | None |
| Horror or Fear Themes | None |
| Medical / Treatment Information | None |
| Unrestricted Web Access | **Yes** (app scans the open web) |

Expected result: **4+ (All Ages)**

### 2d. App Store Listing (Version Information)

Copy from the `metadata/ios/en-US/` files:

- **Description**: `description.txt`
- **Keywords**: `keywords.txt` (≤ 100 chars, comma-separated)
- **Promotional Text**: `promotional_text.txt` (updateable without re-review)
- **What's New**: `release_notes.txt`
- **Support URL**: https://tryrook.app/support
- **Marketing URL**: https://tryrook.app

### 2e. Screenshots

Required sizes (capture from Simulator or device):
- **iPhone 6.9"** (iPhone 15 Pro Max): 1320×2868 — **required**
- **iPhone 6.5"** (iPhone 14 Plus): 1242×2688 — **required**
- **iPad Pro 13"**: 2064×2752 — if `supportsTablet: true`

Take at least 3 screenshots showing:
1. Dashboard — Security Score ring, shield status
2. Alerts — threat feed with severity badges
3. Scan — radar animation in progress
4. Tools — AI Scam Analyzer / Photo Monitor

### 2f. In-App Purchases / Subscriptions

1. **Features → Subscriptions → + New Subscription Group** → name: "Rook Protection"
2. Create three products:

| Product ID | Display Name | Price |
|---|---|---|
| `rook_pro_monthly` | Rook Pro (Monthly) | $7.99/month |
| `rook_pro_yearly` | Rook Pro (Annual) | $59.99/year |
| `rook_premium_monthly` | Rook Premium (Monthly) | $14.99/month |
| `rook_premium_yearly` | Rook Premium (Annual) | $99.99/year |

3. Add 7-day free trial to all paid tiers
4. Copy Product IDs into RevenueCat dashboard

### 2g. Submit Build

```bash
eas submit --platform ios --profile production
```

Or manually upload the `.ipa` via **Transporter** app and attach it in App Store Connect → Version → Build.

---

## Part 3 — Google Play Console

### 3a. Create the App

1. Go to [play.google.com/console](https://play.google.com/console)
2. **Create app** → App name: `Rook — Identity Guard`
3. Default language: **English (United States)**
4. App or game: **App**
5. Free or paid: **Free** (with in-app purchases)

### 3b. Store Listing

Copy from `metadata/android/en-US/`:

- **App name**: `title.txt`
- **Short description**: `short_description.txt` (≤ 80 chars)
- **Full description**: `full_description.txt`

### 3c. Content Rating

In **Policy → App Content → Ratings**:

| Question | Answer |
|---|---|
| Violence | None |
| Sexual content | None |
| Real-money gambling | No |
| News/current events app | No |
| User-generated content | No |
| Data sharing | Yes (see privacy policy) |

Expected result: **Everyone (ESRB)** / **PEGI 3**

### 3d. Screenshots & Graphics

Required:
- **Feature graphic**: 1024×500 PNG (displayed at top of listing)
- **Phone screenshots**: at least 2, 1080×1920 (portrait)
- **Icon**: 512×512 PNG (use `assets/images/icon.png` resized — no transparency)

### 3e. In-App Products / Subscriptions

In **Monetize → Products → Subscriptions**, create:

| Product ID | Name | Price |
|---|---|---|
| `rook_pro_monthly` | Rook Pro Monthly | $7.99 |
| `rook_pro_yearly` | Rook Pro Annual | $59.99 |
| `rook_premium_monthly` | Rook Premium Monthly | $14.99 |
| `rook_premium_yearly` | Rook Premium Annual | $99.99 |

Add 7-day free trial to all tiers.

### 3f. Submit Build

```bash
eas submit --platform android --profile production
```

Or upload the `.aab` manually via **Production → Releases → Create new release**.

---

## Part 4 — RevenueCat Setup

1. In [RevenueCat dashboard](https://app.revenuecat.com):
   - Connect Apple App Store app (via App Store Connect API key)
   - Connect Google Play app (via service account JSON)
2. Create **Entitlements**: `pro`, `premium`
3. Create **Products**: add all 8 subscription product IDs from both stores
4. Create **Offerings**: map products to entitlements
5. Verify the `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`, and `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` are set in EAS secrets (via `eas secret:create`)

---

## Part 5 — Pre-Submission Checklist

- [ ] App opens without crash on clean install (no cached data)
- [ ] Sign in / sign out flow works end to end
- [ ] Free scan completes and surfaces results (or shows "no threats found" cleanly)
- [ ] Paywall appears when scan limit is hit on Free plan
- [ ] RevenueCat purchase flow completes on Sandbox
- [ ] Push notifications arrive for new threats
- [ ] Privacy Policy and Terms URLs load correctly
- [ ] All deep links (oauth callbacks) redirect back to the app
- [ ] No placeholder text visible in the UI ("TODO", "MOCK", "COMING SOON")
- [ ] App name and bundle ID match between `app.json` and store listing

---

## Part 6 — Post-Approval

- Update `metadata/ios/en-US/privacy_url.txt` and `support_url.txt` with final production domain
- Tag the release in git: `git tag v1.0.0`
- Monitor crash reports via EAS Insights or Sentry
- Set up push notification certificates (APNs) in EAS if not already done
