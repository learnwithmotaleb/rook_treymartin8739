# ShieldID — App Store Submission Guide

This document covers every manual step required to ship ShieldID to the Apple App Store and Google Play Store. Steps that cannot be automated via EAS or app.json are marked **[Console]** — they must be done through App Store Connect or Google Play Console.

---

## Table of Contents

1. [Build & Upload](#1-build--upload)
2. [Age Rating Configuration](#2-age-rating-configuration) ← **cannot be set in app.json**
3. [App Store Connect (iOS)](#3-app-store-connect-ios)
4. [Google Play Console (Android)](#4-google-play-console-android)
5. [Screenshots](#5-screenshots)
6. [Privacy & Legal](#6-privacy--legal)
7. [Export Compliance](#7-export-compliance)
8. [TestFlight / Internal Testing](#8-testflight--internal-testing)
9. [Pricing & Availability](#9-pricing--availability)
10. [Review Notes](#10-review-notes)

---

## 1. Build & Upload

### iOS (EAS Build → App Store Connect)

```bash
# Production build
eas build --platform ios --profile production

# Submit to App Store Connect (requires EXPO_APPLE_ID and EXPO_APPLE_APP_SPECIFIC_PASSWORD)
eas submit --platform ios --latest
```

### Android (EAS Build → Google Play)

```bash
eas build --platform android --profile production
eas submit --platform android --latest
```

Both platforms are configured in `eas.json`. The `production` profile uses the `release` channel and targets the App Store / Play Store respectively.

---

## 2. Age Rating Configuration

> **Why this is not in app.json:** iOS and Android age rating / content rating is set entirely through the store consoles (App Store Connect and Google Play Console). There is no `app.json` or `Info.plist` key that controls the published age rating. Expo / EAS does not expose this setting. The metadata directory in this repo documents what the answers should be, but the console steps below must be completed manually for each submission.

### 2a. iOS — App Store Connect Age Rating [Console]

1. Sign in to [App Store Connect](https://appstoreconnect.apple.com)
2. Select **ShieldID → App Store → [Version] → App Information**
3. Scroll to **Content Rights** and confirm: "Does this app contain, display, or access third-party content?" → **No**
4. Under **Age Rating**, click **Edit** and complete the questionnaire:

| Category | Setting |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Sexual Content or Nudity | None |
| Profanity or Crude Humor | None |
| Alcohol, Tobacco or Drug Use or References | None |
| Simulated Gambling | None |
| Horror/Fear Themes | None |
| Prolonged Graphic or Sadistic Realistic Violence | None |
| Mature/Suggestive Themes | None |
| Graphic Sexual Content and Nudity | None |
| Unrestricted Web Access | **Yes** (browser auth flows for social OAuth) |
| Gambling and Contests | None |
| Made for Kids | **No** |

**Expected resulting rating: 4+ (All Ages)**

5. Click **Done**, then save.

### 2b. Android — Google Play Content Rating [Console]

1. Sign in to [Google Play Console](https://play.google.com/console)
2. Select **ShieldID → Policy → App content**
3. Under **Target audience and content**, set:
   - Target age group: **18 and over** (ShieldID handles personal identity and financial-adjacent data)
   - Does the app appeal primarily to children? **No**
4. Under **Content rating**, click **Start questionnaire**:
   - App category: **Utility**
   - Answer all violence/sexual content/profanity questions: **No** to all
   - Contains user-generated content (UGC): **No** (users connect their own existing accounts; they do not generate content within the app)
   - Expected rating: **ESRB: Everyone**, **PEGI: 3**, **USK: 0** (or equivalent "Everyone" in all regions)
5. Click **Save** and confirm the rating is applied.

### 2c. Minimum Age Justification

ShieldID does not target children. It handles sensitive personal identity data (social media accounts, breach detection, photo fingerprinting). The app:
- Requires account creation (Clerk auth)
- Handles OAuth tokens for social platforms
- Stores personal identity information
- Is appropriately rated 4+/Everyone with "Unrestricted Web Access" flagged (OAuth flows)

---

## 3. App Store Connect (iOS)

### Metadata (pre-filled in `metadata/ios/en-US/`)

| Field | Value |
|---|---|
| Name | ShieldID — Identity Protection |
| Subtitle | AI-Powered Impersonator Shield |
| Category | Utilities (primary), Lifestyle (secondary) |
| Age Rating | 4+ (see Section 2a) |
| Privacy Policy URL | https://\<your-domain\>/api/legal/privacy |
| Support URL | https://\<your-domain\>/api/legal/support |
| Copyright | © 2026 ShieldID |

### Steps [Console]

1. **App Information:** Fill name, subtitle, category, content rights (see Section 2a)
2. **Pricing & Availability:** Set price to Free (monetized via in-app purchases via RevenueCat)
3. **In-App Purchases:** Confirm RevenueCat products are linked (do not configure IAP directly in App Store Connect — RevenueCat manages this)
4. **App Privacy:** Complete the privacy nutrition label:
   - Data collected: Contact Info (email for breach scanning), Identifiers (user ID)
   - Data used for: App Functionality, Analytics
   - Data not linked to user: Diagnostic
   - No data sold to third parties
5. **App Review Information:** See Section 10

---

## 4. Google Play Console (Android)

### Metadata (pre-filled in `metadata/android/en-US/`)

| Field | Value |
|---|---|
| Title | ShieldID — Identity Guard |
| Short Description | AI-powered identity & impersonator protection |
| Category | Productivity |
| Content Rating | Everyone (see Section 2b) |
| Privacy Policy URL | https://\<your-domain\>/api/legal/privacy |

### Steps [Console]

1. **Store listing:** Paste copy from `metadata/android/en-US/`
2. **Content rating:** Complete questionnaire (Section 2b)
3. **Target audience:** Set to 18+ (handles personal identity data)
4. **App access:** No restrictions — reviewer can create an account with test credentials (Section 10)
5. **Ads:** App does not contain ads → declare **No ads**
6. **Data safety:** Declare:
   - Data collected: Email address (used for breach checking, not shared/sold)
   - No precise location collected
   - Data encrypted in transit: Yes (HTTPS/TLS)
   - Users can request deletion: Yes (via profile → delete account)

---

## 5. Screenshots

Required sizes — must be uploaded manually in App Store Connect / Play Console:

### iOS Screenshots

| Device | Size | Required |
|---|---|---|
| iPhone 6.9" (iPhone 16 Pro Max) | 1320×2868 px | **Yes — featured** |
| iPhone 6.7" (iPhone 14 Plus) | 1284×2778 px | Yes |
| iPad Pro 13" (M4) | 2064×2752 px | Yes if iPad listed |

Recommended screens to capture:
1. Dashboard (security score ring, shield status)
2. Alerts feed (threat cards)
3. Scan in progress (radar animation)
4. Tools screen (AI Scam Analyzer, Photo Monitor)
5. Threat detail with AI analysis

### Android Screenshots

| Type | Size | Required |
|---|---|---|
| Phone | 1080×1920 px (minimum) | Yes |
| 7-inch tablet | 1200×1920 px | Recommended |
| 10-inch tablet | 1920×1200 px | Recommended |

---

## 6. Privacy & Legal

- **Privacy Policy:** Served at `/api/legal/privacy` (Express route `routes/legal.ts`)
- **Terms of Service:** Served at `/api/legal/terms`
- **In-app legal screen:** `app/(tabs)/profile.tsx` → Settings → Legal (links to web routes)
- **Data deletion:** Users can delete their account via Profile → Account → Delete Account

Both URLs must use HTTPS in production. Update `<your-domain>` placeholders above with the deployed domain from `$REPLIT_DOMAINS`.

---

## 7. Export Compliance

ShieldID uses standard HTTPS encryption only (TLS for all API calls). No custom cryptographic implementations are present.

**iOS (App Store Connect):** When prompted during review:
- Does this app use encryption? **Yes** (standard HTTPS/TLS — exempt)
- Is the encryption exempt from export regulations? **Yes** — standard SSL/TLS only
- Do you need an ERN (Encryption Registration Number)? **No**

Set in App Store Connect: App Information → Export Compliance → "Uses only standard HTTPS/TLS encryption"

**Android (Google Play):** No special declaration required for standard HTTPS.

---

## 8. TestFlight / Internal Testing

### TestFlight (iOS)

1. After `eas submit`, the build appears in App Store Connect → TestFlight
2. Add internal testers under **Internal Group** (team members with App Store Connect access)
3. For external beta (up to 10,000 testers), submit to Beta App Review:
   - Beta description: "Test ShieldID's identity protection features including scan, alerts, and AI threat analysis"
   - Beta feedback email: support@\<your-domain\>

### Google Play Internal Testing

1. Create an **Internal testing** release in Play Console
2. Add tester emails (up to 100)
3. Share the opt-in URL with testers
4. Promote to **Closed testing** → **Open testing** → **Production** as confidence grows

---

## 9. Pricing & Availability

- **Base app:** Free to download
- **Monetization:** RevenueCat in-app purchases (configured in RevenueCat dashboard)
  - Pro: monthly / yearly subscription
  - Premium: monthly / yearly subscription
- **Regions:** All available countries
- **Release type:** Manual release (hold for developer release after review approval)

---

## 10. Review Notes

Provide these notes in App Store Connect and Google Play Console review submission:

```
ShieldID is an AI-powered identity protection app that monitors social media 
accounts for impersonators, stolen photos, and data breaches.

TEST ACCOUNT CREDENTIALS:
• Create a new account using Sign In with Apple / Google / Email on the auth screen
• OR use the demo mode: tap "Try Demo" on the auth screen (no credentials needed)

DEMO MODE:
The app includes a built-in demo mode with simulated threat data so reviewers 
can explore all features without needing real social media accounts connected.

KEY FEATURES TO REVIEW:
1. Dashboard — Security score ring, shield status, connected accounts overview
2. Scan — Tap "Start Full Scan" to run an identity scan (demo: returns simulated results)
3. Alerts — Filterable threat feed (All/High/Medium/Low)
4. Tools — AI Scam Analyzer, Photo Monitor, Recovery Hub
5. Profile — Subscription status, connected accounts, settings

SOCIAL OAUTH FLOWS:
The app supports connecting Instagram/Facebook/X accounts via OAuth. These are 
standard browser-based OAuth flows — no special credentials needed to review 
(the demo mode bypasses these flows entirely).

PERMISSIONS:
• Camera: Used for photo fingerprinting (can be declined — feature works without it)
• Photo Library: Used for identity fingerprinting (can be declined)  
• Notifications: Used for real-time threat alerts (can be declined)
• Face ID: Used to protect the app (optional, can be declined)
• Network: Required for API communication (standard)
```
