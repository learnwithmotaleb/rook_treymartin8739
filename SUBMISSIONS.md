# Rook — App Store Submission Checklist

A step-by-step guide for the manual tasks required to publish on the Apple App Store and Google Play Store.

---

## Prerequisites

- [ ] **Apple Developer Program** — Enroll at [developer.apple.com](https://developer.apple.com) · $99/year · requires identity verification (1–2 days)
- [ ] **Google Play Developer Account** — Enroll at [play.google.com/console](https://play.google.com/console) · $25 one-time · instant approval

---

## Step 1 — Apple App Store Setup

### 1a. Register the Bundle ID
1. Go to [developer.apple.com/account](https://developer.apple.com/account) → **Identifiers** → **+**
2. Select **App IDs** → **App** → Continue
3. Description: `Rook`
4. Bundle ID (Explicit): `com.getrook.app`
5. Enable capabilities: **Push Notifications**, **Sign in with Apple** (optional)
6. Click **Register**

### 1b. Create the App Record in App Store Connect
1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **My Apps** → **+** → **New App**
2. Platform: **iOS**
3. Name: `Rook`
4. Primary Language: **English (U.S.)**
5. Bundle ID: Select `com.getrook.app` from dropdown
6. SKU: `rook-ios-001`
7. User Access: **Full Access**
8. Click **Create**

### 1c. Fill App Store Metadata
Copy/paste from `metadata/ios/en-US/`:

| Field | Source File | Notes |
|-------|------------|-------|
| Name | `name.txt` | |
| Subtitle | `subtitle.txt` | 30 char max |
| Description | `description.txt` | 4000 char max |
| Keywords | `keywords.txt` | 100 char max, comma-separated |
| Promotional Text | `promotional_text.txt` | 170 char max, can change without resubmit |
| Support URL | — | `https://YOUR_DOMAIN/api/legal/terms` |
| Privacy Policy URL | — | `https://YOUR_DOMAIN/api/legal/privacy` |
| Marketing URL | — | `https://YOUR_DOMAIN` (optional) |

### 1d. App Information
- **Category**: Utilities (Primary) — optionally Social Networking (Secondary)
- **Age Rating**: Click **Edit** → Answer all questions → Rating: **4+** (no mature content)
- **Content Rights**: Does not contain third-party content → Yes

### 1e. Create In-App Purchase Products
Go to **App Store Connect** → Your App → **Monetization** → **In-App Purchases** → **+**

Create these 4 products (type: **Auto-Renewable Subscription**):

| Reference Name | Product ID | Price |
|---------------|-----------|-------|
| Rook Pro Monthly | `rook_pro_monthly` | $7.99/month |
| Rook Pro Annual | `rook_pro_annual` | $59.99/year |
| Rook Premium Monthly | `rook_premium_monthly` | $14.99/month |
| Rook Premium Annual | `rook_premium_annual` | $99.99/year |

For each subscription:
- Subscription Group: Create group named **"Rook Protection"**
- Display Name: Match the Reference Name above
- Enable **Introductory Offer**: 7-day free trial
- Localization: Add English (U.S.) display name and description

### 1f. Screenshots (Required — minimum 3 per device)
Required device sizes:
- **6.7" Display** (iPhone 15 Pro Max, iPhone 14 Plus) — 1290 × 2796 px
- **5.5" Display** (iPhone 8 Plus) — 1242 × 2208 px

Recommended screens to capture:
1. Dashboard — security score ring with stats
2. Alerts feed — showing threat cards
3. Active scan — radar animation
4. Threat detail — AI evidence screen
5. Subscription paywall

**How to capture** (after EAS build):
```bash
# Build for iOS simulator
cd artifacts/mobile
npx eas build --platform ios --profile development

# Run on iPhone 15 Pro Max simulator (6.7")
# Run on iPhone 8 Plus simulator (5.5")
# Use Cmd+S or Device > Screenshot in Simulator
```

---

## Step 2 — RevenueCat Setup

1. Go to [app.revenuecat.com](https://app.revenuecat.com) → **Projects** → your project → **Apps** → **+ New App**
2. Select **App Store** → Paste your **App Store Connect API Key** (generate at App Store Connect → Users & Access → Integrations → App Store Connect API)
3. Go to **Products** → **+ New Product** → add all 4 product IDs from Step 1e
4. Go to **Entitlements** → create `pro` and `premium` entitlements
5. Go to **Offerings** → create offerings named `pro` and `premium`:
   - `pro` offering → add `$rc_monthly` (Pro Monthly) and `$rc_annual` (Pro Annual) packages
   - `premium` offering → add `$rc_monthly` (Premium Monthly) and `$rc_annual` (Premium Annual) packages
6. Get your **RevenueCat API keys** (iOS, Android, and Test) from **Project Settings** → **API Keys**
7. Add to Replit secrets:
   - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
   - `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
   - `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`

---

## Step 3 — Google APIs

### 3a. Google Cloud Vision (Reverse Image Search)
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create or select a project
3. Enable **Cloud Vision API** (APIs & Services → Library → search "Vision")
4. Create credentials: **Service Account** → download JSON key
5. Add key contents to Replit secret: `GOOGLE_VISION_KEY`
6. Enable billing (Vision API has a free tier of 1,000 units/month)

### 3b. Google Custom Search (Username discovery)
You already have `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_CX` set. Verify:
- Billing is enabled on the project
- Custom Search Engine at [programmablesearchengine.google.com](https://programmablesearchengine.google.com) is configured to search the entire web

---

## Step 4 — OpenAI API
1. Go to [platform.openai.com](https://platform.openai.com) → **API Keys** → **Create new secret key**
2. Add to Replit secrets: `OPENAI_API_KEY`
3. Recommended model: `gpt-4o-mini` (fast + cost-efficient for scan analysis)
4. Set a usage limit in OpenAI dashboard to prevent runaway costs

---

## Step 5 — Meta Platform (Instagram OAuth)
> ⚠️ Longest lead time — start this immediately. Approval takes 1–4 weeks.

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**
2. Use case: **Other** → App type: **Consumer**
3. Add product: **Instagram** → **Instagram Basic Display**
4. Fill in:
   - Valid OAuth Redirect URIs: `mobile://oauth`
   - Deauthorize Callback URL: `https://YOUR_DOMAIN/api/oauth/instagram/deauth`
   - Data Deletion Request URL: `https://YOUR_DOMAIN/api/oauth/instagram/delete`
5. Submit for App Review:
   - Privacy Policy URL: `https://YOUR_DOMAIN/api/legal/privacy`
   - Record a screencast of your app connecting an Instagram account
   - Submit `instagram_basic` and `instagram_manage_insights` permissions for review
6. Once approved, add to Replit secrets:
   - `INSTAGRAM_CLIENT_ID` (already set — verify it's the production key)
   - `INSTAGRAM_CLIENT_SECRET` (already set — verify it's the production key)
   - `EXPO_PUBLIC_INSTAGRAM_CLIENT_ID` (already set)

---

## Step 6 — EAS Build & Submit

### 6a. Configure eas.json
Update `artifacts/mobile/eas.json` with your real values:
- Replace `REPLACE_WITH_YOUR_APPLE_ID` with your Apple ID email
- Replace `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` with your numeric app ID (found in App Store Connect URL)
- Replace `REPLACE_WITH_YOUR_TEAM_ID` with your Apple Team ID (found at developer.apple.com/account)

### 6b. First Build
```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Log in to Expo account
eas login

# Configure the project (first time only)
cd artifacts/mobile
eas build:configure

# Build for iOS production
eas build --platform ios --profile production

# Submit to App Store (after build completes)
eas submit --platform ios --profile production
```

### 6c. First Submission Checklist (App Store Connect)
Before clicking **Submit for Review**:
- [ ] All screenshots uploaded (6.7" and 5.5")
- [ ] Privacy Policy URL filled in
- [ ] Support URL filled in
- [ ] Export Compliance: Does app use encryption? → **Yes** (HTTPS), standard encryption → **Yes**
- [ ] Advertising Identifier (IDFA): **No** (Rook does not use IDFA)
- [ ] Content Rights confirmed
- [ ] Age Rating set to **4+**
- [ ] In-App Purchases added and linked to subscription group
- [ ] At least one in-app purchase is in **Ready to Submit** state

---

## Step 7 — Google Play (Android)

1. Go to [play.google.com/console](https://play.google.com/console) → **Create app**
2. App name: `Rook - Identity Protection`
3. Default language: **English (United States)**
4. App or game: **App** · Free or paid: **Free** (with in-app purchases)
5. Fill store listing from `metadata/android/en-US/`
6. Upload screenshots (phone: 1080×1920 minimum)
7. Create subscription products matching the iOS products above
8. Build and upload AAB:
   ```bash
   eas build --platform android --profile production
   eas submit --platform android --profile production
   ```

---

## Live URLs (replace YOUR_DOMAIN with your Replit deployment domain)

| Purpose | URL |
|---------|-----|
| Privacy Policy | `https://YOUR_DOMAIN/api/legal/privacy` |
| Terms of Service | `https://YOUR_DOMAIN/api/legal/terms` |
| Support | `mailto:support@getrook.app` |

Deploy the API server first so these URLs are live before submitting to Apple.
