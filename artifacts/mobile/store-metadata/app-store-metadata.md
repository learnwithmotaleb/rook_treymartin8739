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
Rook is your AI-powered identity shield — monitoring the open web for impersonators, stolen photos, and identity threats.

WHAT ROOK DOES
At launch, Rook connects to Instagram, Facebook, and X (Twitter). TikTok, LinkedIn, YouTube, and Snapchat connections are marked Coming Soon and are not actionable. When a threat is detected, you're alerted with AI analysis, evidence, and actionable next steps.

KEY FEATURES

🔍 Impersonator Detection
Our AI scans public web results and supported connected-account signals to find accounts mimicking you — before they can scam your followers, clients, or fans.

📸 Stolen Photo Monitoring
We track every place your photos appear across the web. If someone is using your face without permission, Rook finds it and shows you exactly where.

🧠 AI Threat Analysis
Every detected threat includes a complete AI breakdown — risk score, confidence level, detected signals, matched evidence, and a tailored action plan.

📅 Scheduled Automatic Monitoring
Rook Premium users get daily automated scans. Zero manual effort — your identity is always being watched.

🔔 Instant Push Alerts
One centralized alert feed. Review, dismiss, or report threats from your phone with everything you need in one place.

🔒 Identity Score
Your personal security score (0–100) updates in real time as threats are found and resolved, giving you a clear picture of your current exposure.

PLANS

Free — 1 connected account and 1 manual scan per month
Rook Premium — Unlimited connected accounts, daily monitoring, alerts, full evidence, advanced risk scoring, and reports

Rook is built for creators, influencers, executives, public figures, and anyone with a meaningful digital presence worth protecting.

---
Rook monitors publicly available information only. Rook is not affiliated with any social media platform.
```

### Keywords (100 chars, comma-separated)
```
identity theft,impersonator,social media monitor,brand protection,AI security,privacy guard,scam
```

### Support URL
```
https://getrook.app/support
```
*(redirect to: mailto:support@getrook.app)*

### Marketing URL
```
https://getrook.app
```

### Privacy Policy URL
```
https://getrook.app/privacy
```

### Copyright
```
© 2025 Rook. All rights reserved.
```

### Category
```
Primary:   Utilities
Secondary: Social Networking
```

### Age Rating
```
4+ (no objectionable content)
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
