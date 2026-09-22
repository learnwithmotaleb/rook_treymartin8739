# Rook — App Store Metadata

## App Store Connect (iOS)

### App Name (30 chars max)
```
Rook: Impersonation Protection
```

### Subtitle (30 chars max)
```
AI Guard for Your Online Identity
```

### Description (4000 chars max)
```
Rook helps you monitor your online identity for impersonators, suspicious
matches, and unauthorized use of your public profile and photos.

WHAT ROOK DOES
At launch, Rook supports connecting Instagram, Facebook, and X. TikTok,
LinkedIn, YouTube, and Snapchat are marked Coming Soon and are not actionable.
When Rook identifies a potential threat, the app presents available evidence,
an explanation, and links to relevant official platform guidance.

KEY FEATURES

🔍 Impersonator Detection
Rook checks public web results and supported connected-account signals for
accounts that may mimic your identity. Results are potential matches, not
determinations of criminal conduct or guaranteed platform action.

📸 Stolen Photo Monitoring
Rook can compare supported photo signals and show available evidence when a
potentially unauthorized use is identified. Coverage depends on the connected
platforms and sources available to the scan.

🧠 AI Threat Analysis
Potential threats include an AI-assisted explanation, risk indicators, detected
signals, available evidence, and suggested next steps.

📅 Scheduled Automatic Monitoring
Rook Premium users receive the scheduled monitoring cadence shown in the app
and can run supported manual scans.

🔔 Push Alerts
Review potential threats in one alert feed, resolve items, and open official
platform reporting guidance from your phone.

🔒 Identity Score
Your personal security score (0–100) updates in real time as threats are found and resolved, giving you a clear picture of your current exposure.

PLANS

Free — 1 connected account and 1 manual scan per month
Rook Premium — expanded connected-account limits, scheduled monitoring, alerts,
evidence, and advanced risk indicators as described in the app

Rook is built for creators, influencers, executives, public figures, and anyone with a meaningful digital presence worth protecting.

---
Rook monitors publicly available information and supported connected-account
signals only. Rook is not affiliated with any social media platform. Coverage,
results, and platform enforcement decisions are not guaranteed.
```

### Keywords (100 chars, comma-separated)
```
identity theft,impersonator,social media monitor,brand protection,AI security,privacy guard,scam
```

### Support URL
```
https://tryrook.app/support
```
*(redirect to: mailto:support@getrook.app)*

### Marketing URL
```
https://tryrook.app
```

### Privacy Policy URL
```
https://tryrook.app/privacy
```

### Copyright
```
© 2026 Rook. All rights reserved.
```

### Category
```
Primary:   Utilities
Secondary: Social Networking
```

### Age / eligibility
```
Content-rating questionnaire: complete in App Store Connect
Account eligibility: users must be at least 17
```

### App Version
```
1.0.0
```

### Bundle ID
```
com.getrook.app
```

---

## Google Play Store (Android)

### App Name (50 chars max)
```
Rook: AI Identity Protection
```

### Short Description (80 chars max)
```
AI-powered identity monitor. Find impersonators before they harm your brand.
```

### Full Description (4000 chars max)
*(same as App Store description above)*

### Category
```
Tools
```

### Content Rating
```
Everyone
```

### Package Name
```
com.getrook.app
```

---

## Screenshot Requirements

Saved to `attached_assets/appstore/` — 5 screenshots generated:

| File | Screen |
|---|---|
| `screenshot-01-dashboard.png` | Security score dashboard |
| `screenshot-02-alerts.png` | Threat alerts feed |
| `screenshot-03-scan.png` | Active scan radar |
| `screenshot-04-threat-detail.png` | Threat detail + AI analysis |
| `screenshot-05-subscription.png` | Paywall / pricing |

**Required sizes for App Store upload:**
- iPhone 6.7" (iPhone 15 Pro Max): 1290 × 2796 px — **required**
- iPhone 6.5" (iPhone 14 Plus): 1284 × 2778 px — required for older device support
- iPad 12.9" (3rd gen+): 2048 × 2732 px — required if supporting iPad

> The generated screenshots are marketing-quality mockups. For final submission,
> use EAS Build + Simulator/device screenshots at the exact required resolutions.

---

## What Still Needs To Happen (External)

### Apple Developer Account
1. Enroll at https://developer.apple.com ($99/year)
2. Register Bundle ID `com.getrook.app` in Certificates, IDs & Profiles
3. Create app in App Store Connect → My Apps → "+" → New App
4. Create In-App Purchases:
   - Product ID: `premium_monthly_v2` — $9.99/month — "Rook Premium Monthly"
   - Product ID: `premium_annual_v2` — $69.99/year — "Rook Premium Annual"
   - Add a 7-day introductory trial to both products for eligible new subscribers

### RevenueCat Setup
1. Create project at https://app.revenuecat.com
2. Add iOS app (com.getrook.app) and Android app
3. Use the single current Entitlement: `premium`
4. Create Products matching Apple/Google IDs above
5. Make Offering ID `premium` current, with `$rc_monthly` and `$rc_annual` packages
6. Do not recreate the retired Pro or scan-unlock products, entitlements, or offerings
7. Copy API keys → add to Replit secrets:
   - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
   - `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
   - `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`

### EAS Build (run from terminal)
```bash
# Install EAS CLI
npm install -g eas-cli

# Login with your Expo account
eas login

# Build iOS for TestFlight (first run sets up signing automatically)
eas build --platform ios --profile preview

# Build Android APK for testing
eas build --platform android --profile preview

# Submit to App Store (after TestFlight testing)
eas submit --platform ios
```
