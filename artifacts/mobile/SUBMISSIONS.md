# Rook — App Store Submission Guide

This document covers every manual step required to ship Rook to the Apple App Store and Google Play Store. Steps that cannot be automated via EAS or app.json are marked **[Console]** — they must be done through App Store Connect or Google Play Console.

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
2. Select **Rook → App Store → [Version] → App Information**
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
2. Select **Rook → Policy → App content**
3. Under **Target audience and content**, set:
   - Target age group: **18 and over** (Rook handles personal identity and financial-adjacent data)
   - Does the app appeal primarily to children? **No**
4. Under **Content rating**, click **Start questionnaire**:
   - App category: **Utility**
   - Answer all violence/sexual content/profanity questions: **No** to all
   - Contains user-generated content (UGC): **No** (users connect their own existing accounts; they do not generate content within the app)
   - Expected rating: **ESRB: Everyone**, **PEGI: 3**, **USK: 0** (or equivalent "Everyone" in all regions)
5. Click **Save** and confirm the rating is applied.

### 2c. Minimum Age Justification

Rook does not target children. It handles sensitive personal identity data (social media accounts, breach detection, photo fingerprinting). The app:
- Requires account creation (Clerk auth)
- Handles OAuth tokens for social platforms
- Stores personal identity information
- Is appropriately rated 4+/Everyone with "Unrestricted Web Access" flagged (OAuth flows)

---

## 3. App Store Connect (iOS)

### Metadata (pre-filled in `metadata/ios/en-US/`)

| Field | Value |
|---|---|
| Name | Rook — Identity Protection |
| Subtitle | AI-Powered Impersonator Shield |
| Category | Utilities (primary), Lifestyle (secondary) |
| Age Rating | 4+ (see Section 2a) |
| Privacy Policy URL | https://\<your-domain\>/api/legal/privacy |
| Support URL | https://\<your-domain\>/api/legal/support |
| Copyright | © 2026 Rook |

### Steps [Console]

1. **App Information:** Fill name, subtitle, category, content rights (see Section 2a)
2. **Pricing & Availability:** Set price to Free (monetized via in-app purchases via RevenueCat)
3. **In-App Purchases:** Create the store products and introductory offers in App Store Connect, then link them in RevenueCat
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
| Title | Rook — Identity Guard |
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

Rook uses standard HTTPS encryption only (TLS for all API calls). No custom cryptographic implementations are present.

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
   - Beta description: "Test Rook's identity protection features including scan, alerts, and AI threat analysis"
   - Beta feedback email: support@\<your-domain\>

### Google Play Internal Testing

1. Create an **Internal testing** release in Play Console
2. Add tester emails (up to 100)
3. Share the opt-in URL with testers
4. Promote to **Closed testing** → **Open testing** → **Production** as confidence grows

---

## 9. Pricing & Availability

- **Base app:** Free to download
- **Monetization:** Rook Premium through RevenueCat
  - Monthly: `premium_monthly_v2` — $9.99/month
  - Annual: `premium_annual_v2` — $69.99/year
  - Eligible new subscribers: 7-day introductory trial
- **Regions:** All available countries
- **Release type:** Manual release (hold for developer release after review approval)

---

## 10. Review Notes

Provide these notes in App Store Connect and Google Play Console review submission:

```
Rook is an AI-powered identity protection app that monitors social media 
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

---

## 11. Meta App Review

### 11a. Permission Justification Table

| Permission | Platform | Review Required | Where Called | Why Needed |
|---|---|---|---|---|
| `instagram_business_basic` | Instagram | No (business permission) | `platformAdapter.ts` `InstagramAdapter.getProfile()` · `oauth.ts` Instagram callback | Fetches username, profile picture, and follower count so Rook can display the connected account and use it as an identity anchor for impersonator detection |
| `public_profile` | Facebook | No (basic permission) | `platformAdapter.ts` `FacebookAdapter.getProfile()` · `oauth.ts` Facebook callback | Fetches Facebook ID and display name so Rook can identify and display the connected account |
| `user_photos` | Facebook | **Yes — deferred** | Intentionally removed from initial submission | Would allow photo monitoring for Facebook uploads; to be submitted for App Review after initial approval |

### 11b. Reviewer Step-by-Step Instructions

**Prerequisites:**
1. Install via TestFlight link provided in App Store Connect review notes.
2. Launch the app — auth screen appears immediately.

**Step 1 — Create account & onboarding:**
1. Auth screen → tap **Sign in with Apple** (or Google / Email)
2. Account created — onboarding slides appear (4 slides)
3. Tap **Next** through all → **Get Started** → select protection goal → **Continue**
4. Dashboard appears (security score at 0 until accounts are connected)

**Step 2 — Demo Mode (recommended for review — no social accounts needed):**
1. Dashboard → tap 📊 icon (top right) → **Try Demo Mode**
2. App fills with simulated Instagram/Facebook/X accounts and 3 pre-seeded threats
3. Security score ring animates to 72, Alerts tab shows threat cards, Scan tab becomes active
4. All features fully usable in demo mode without real OAuth connections

**Step 3 — Connect Instagram (uses test tester account from 11c):**
1. Dashboard → **Connect Accounts** → **Instagram**
2. In-app browser opens → sign in with the test Instagram account
3. Grant `instagram_business_basic` permission → browser closes
4. Dashboard: "Instagram Connected ✓" — account card shows username + follower count

**Step 4 — Connect Facebook (uses test account from 11c):**
1. Dashboard → **Connect Accounts** → **Facebook**
2. In-app browser opens → sign in with the test Facebook account
3. Grant `public_profile` → browser closes
4. Dashboard: "Facebook Connected ✓" — account card shows display name

**Step 5 — Run a scan:**
1. Tap **Scan** tab → radar animation
2. Tap **Start Full Scan** → progress bar → results in ~5–10 s
3. "No new threats found — you're protected" **or** threat cards if demo mode active

**Step 6 — Alerts & Threat Detail:**
1. Tap **Alerts** tab → threat feed with filter bar (All / High / Medium / Low)
2. Tap any threat card → Threat Detail screen (suspicious account, similarity score, AI analysis)
3. Tap **Resolve** → threat dismissed from feed

**Step 7 — Tools tab:**
1. **AI Scam Analyzer** → paste text → **Analyze** → AI verdict
2. **Photo Monitor** → upload a photo → photo indexed for monitoring
3. **Recovery Hub** → informational resource screen

**Step 8 — Profile & data deletion:**
1. Tap **Profile** → edit avatar / name / username
2. **Subscription** → Rook Premium monthly/yearly paywall, 7-day trial, restore purchases
3. **Security Settings** → active sessions, biometric lock
4. **Legal** → Privacy Policy + Terms of Service web view
5. **Delete Account** → confirmation dialog → full data deletion

### 11c. Test Account Setup Guide

**Instagram tester account:**
1. Meta Developer Console → Rook app → **Instagram → Roles → Add Tester**
2. Enter the reviewer's Instagram username → **Submit**
3. Reviewer accepts: Instagram app → Settings → Apps and Websites → Tester Invites → Accept
4. Tester can now complete Instagram OAuth without App Review approval

**Facebook test user:**
1. Meta Developer Console → Rook app → **Roles → Test Users → Add**
2. Create a test user or add an existing Facebook account as a tester
3. Test users can grant `public_profile` immediately (no App Review needed)
4. Provide reviewer with the test user login link + credentials

**Seed reviewer account with demo data:**
```bash
curl -X POST https://getrook.app/api/admin/seed-reviewer \
  -H "Content-Type: application/json" \
  -H "x-admin-key: $ADMIN_API_KEY" \
  -d '{"clerkId": "<reviewer_clerk_id>"}'
```
Populates the reviewer's Rook account with connected accounts, 3 threat cards, AI analysis, and identity fingerprint data. The reviewer's Clerk ID appears in the URL bar after sign-in or can be retrieved from the Profile tab → user ID display.

### 11d. App Review Video Script (< 5 minutes)

| Time | Action | Talking Point |
|---|---|---|
| 0:00–0:15 | Launch from home screen → auth screen | "Rook — AI identity protection. Users sign in via Apple, Google, or email using Clerk." |
| 0:15–0:35 | Sign in with Apple → onboarding | "New users see a 4-step onboarding. Swipe through → Get Started → select protection goal." |
| 0:35–1:00 | Dashboard → enable Demo Mode | "Demo Mode loads simulated data so reviewers can see all features instantly." |
| 1:00–1:15 | Dashboard overview | "Security score ring (72/100), connected accounts, 3 active alerts, recent scan time." |
| 1:15–1:50 | Connect Instagram (live OAuth) | "Tap Connect → Instagram. Browser opens, user signs in, grants `instagram_business_basic`. Browser closes — account connected." |
| 1:50–2:10 | Connect Facebook (live OAuth) | "Tap Connect → Facebook. User grants `public_profile` only. Account connected immediately." |
| 2:10–2:45 | Scan tab → Start Full Scan | "Radar pulse animation while scanning. Results appear: no threats or threat cards." |
| 2:45–3:15 | Alerts → Threat Detail | "Tap a threat: suspicious account, similarity score, AI analysis. Tap Resolve to dismiss." |
| 3:15–3:40 | Tools → AI Scam Analyzer | "Paste a suspicious message → Analyze → AI verdict with confidence level." |
| 3:40–4:00 | Photo Monitor | "Upload photo → indexed for similarity matching across social platforms." |
| 4:00–4:30 | Profile → Subscription paywall | "Tap Subscription → Rook Premium at $9.99/month or $69.99/year, with a 7-day introductory trial for eligible new subscribers. Restore Purchases is available." |
| 4:30–4:50 | Delete Account flow | "Profile → Delete Account → confirmation → all data purged within 30 days." |
| 4:50–5:00 | Closing | "All Meta API calls use v22.0. Permissions: `instagram_business_basic` (no review), `public_profile` (no review). HTTPS + HMAC state + PKCE throughout." |

### 11e. Pre-Flight Launch Checklist

#### Meta App Review
- [x] `instagram_business_basic` — business permission, no App Review needed
- [x] `public_profile` — basic permission, no App Review needed
- [x] `user_photos` — removed from scope; to be submitted for review post-launch
- [x] Facebook auth URL upgraded to v22.0
- [x] Facebook Graph API token exchange pinned to v22.0
- [x] Facebook Graph API profile + permissions endpoints pinned to v22.0
- [x] Data deletion callback at `POST /api/oauth/facebook/data-deletion`
- [x] Privacy Policy live at `https://getrook.app/privacy`
- [x] Terms of Service live at `https://getrook.app/terms`
- [x] Business address + phone in Privacy Policy and Terms of Service
- [x] Instagram tokens auto-refreshed every 24 h (before 60-day expiry)
- [x] HMAC-signed OAuth state token (CSRF protection, 15-min window)
- [x] PKCE implemented for X/Twitter OAuth
- [x] All Meta API fetch calls: 10-second timeout + 429 exponential-backoff retry
- [x] CORS restricted to explicit allowlist (getrook.app, tryrook.app, Replit domains)
- [ ] **[M1 — Manual]** Register `com.getrook.app://oauth` as OAuth redirect URI in Meta App Dashboard → Products → Instagram/Facebook → Valid OAuth Redirect URIs
- [ ] **[M2 — Manual]** Add reviewer Instagram and Facebook accounts as Testers in Meta Developer Console
- [ ] **[M3 — Manual]** Set `ADMIN_API_KEY` in production deployment for seed-reviewer endpoint
- [ ] **[M4 — Manual]** Record ≤5-min App Review video following Section 11d script
- [ ] **[M5 — Manual]** Submit `user_photos` for Facebook App Review after initial approval

#### Apple App Store
- [x] Bundle ID: `com.getrook.app`
- [x] URL scheme: `com.getrook.app`
- [x] Privacy Policy URL in `app.json`
- [x] Camera, Photo Library, Notifications, Face ID usage strings in `infoPlist`
- [x] `ITSAppUsesNonExemptEncryption: false` (standard HTTPS/TLS only)
- [x] `UIBackgroundModes`: fetch, remote-notification declared
- [x] EAS production `EXPO_PUBLIC_API_URL` → `https://getrook.app`
- [x] Age rating: 4+ All Ages with Unrestricted Web Access flagged (OAuth browser flows)
- [x] RevenueCat in-app purchases: one Premium entitlement with monthly and annual subscriptions
- [x] Restore Purchases flow implemented in paywall screen
- [ ] **[M6 — Manual]** Fill EAS submit placeholders in `eas.json` (Apple ID, ASC App ID, Team ID)
- [ ] **[M7 — Manual]** Upload 5 iPhone 6.9" screenshots in App Store Connect (see Section 5)
- [ ] **[M8 — Manual]** Complete App Privacy nutrition label in App Store Connect
- [ ] **[M9 — Manual]** Set age rating questionnaire in App Store Connect (see Section 2a)
- [ ] **[M10 — Manual]** Create `premium_monthly_v2` and `premium_annual_v2` in App Store Connect and Google Play, set $9.99/$69.99 pricing, and add the 7-day introductory offers
