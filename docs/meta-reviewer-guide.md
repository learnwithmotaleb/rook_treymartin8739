# Rook — Meta App Review Guide

**App:** Rook — Identity Protection  
**Bundle ID:** `com.getrook.app`  
**iOS version:** 1.0.0 (Build 2)
**Live domain:** `https://tryrook.app`
**Support email:** support@getrook.app  

---

## Overview

Rook is an AI-powered identity protection app that monitors social media platforms for impersonators, stolen photos, and unauthorized use of a user's likeness. The app connects to a user's own social accounts to:

1. **Verify identity ownership** — confirm the connecting user is the legitimate account holder
2. **Build a photo fingerprint** — compute perceptual hashes (pHash/dHash) from the user's own photos; no photos are stored, only 64-bit hash values
3. **Run ongoing scans** — compare the fingerprint against suspicious accounts found during monitoring to detect impersonators
4. **Alert the user** — deliver real-time push notifications when a threat is detected

Rook never stores or transmits photos from a user's account to any third party. All photo processing (perceptual hashing) happens server-side on Rook's infrastructure, and only the resulting hash integers are retained.

---

## Permissions Requested and Current Status

| Permission | Platform | Current App State | Submission Goal |
|-----------|----------|------------------|----------------|
| `instagram_business_basic` | Instagram | ✅ Active in live app | Seeking approval |
| `user_photos` | Facebook | ⏳ Pending approval; app currently uses `public_profile` | Seeking approval |
| `public_profile` | Facebook | ✅ Active in live app (no review required) | Already live |

> **Important note for reviewers:** The Facebook OAuth consent screen in the current live app requests `public_profile` only. `user_photos` is the additional permission being submitted for Meta App Review in this submission. The tap path below for demonstrating `user_photos` describes the intended flow once the permission is approved; reviewers can also view the screen recording included in the submission package to see the full intended flow end-to-end.

---

## Permissions — Detail

### 1. `instagram_business_basic` (Instagram Graph API)

**Status:** Currently active in live app.  
**Scope:** Profile metadata, follower count, profile picture URL, media captions  
**Who can grant it:** Instagram Business or Creator account holders  

**Why Rook needs it:**  
Rook requests `instagram_business_basic` to allow users to connect their Instagram account for identity monitoring. This permission gives Rook read-only access to:
- The user's public profile (ID, username, follower count, profile picture URL)
- Captions from the user's own posts (used to build a text-based identity fingerprint)

Rook uses this data exclusively to:
1. Verify the connecting user is the legitimate account owner
2. Retrieve the profile picture URL to build an identity anchor
3. Index caption text for content fingerprinting (detecting accounts that copy the user's captions verbatim)

**What Rook does NOT do:**
- Post to Instagram on the user's behalf
- Access private messages or Stories
- Share the user's data with any third party
- Store photos (only hashes of photo fingerprints are stored)

**Copy for Meta review form:**  
> "Rook is an AI-powered identity protection app. We request `instagram_business_basic` to allow users to connect their Instagram account and verify their identity profile. This enables our system to build a photo fingerprint from the user's own media and detect impersonation accounts that have stolen the user's photos or are mimicking their handle. Without this permission, we cannot verify that the connecting user is the legitimate account owner, and cannot build the reference dataset needed for impersonation detection."

---

### 2. `user_photos` (Facebook Graph API)

**Status:** Pending Meta App Review approval. Current live app requests `public_profile` only. `user_photos` will be added to the Facebook OAuth scope once Meta approval is granted.  
**Scope:** User's own Facebook photo albums  
**Who can grant it:** Any Facebook account holder  

**Why Rook needs it:**  
After `user_photos` is approved, Rook will use it to access the authenticated user's own Facebook photo library. These photos will be used exclusively to:
1. Compute perceptual hash (dHash) values — 64-bit integers that represent the visual fingerprint of each photo
2. Store only the hash integers (not the photos themselves) in Rook's database
3. Compare the fingerprint against suspicious accounts found during monitoring scans

**What Rook does NOT do with `user_photos`:**
- Upload, store, or transmit the user's photos to any external service
- Share photo data with any third party
- Use photos for advertising or profiling
- Access photos from other users' accounts

**Copy for Meta review form:**  
> "Rook requests `user_photos` to build a perceptual hash fingerprint from the user's own Facebook photos. This fingerprint (stored as 64-bit integers, never as images) is used to detect impersonators who have copied the user's photos. No photos are stored or transmitted externally. The permission is used only while the user is actively connected and can be revoked at any time from Facebook's app settings."

---

### 3. `public_profile` (Facebook Graph API — already live, no review required)

**Status:** Currently active in live app. No Meta App Review required for this permission.  
**Scope:** User's public name and profile picture URL  

**Why Rook uses it now:** Rook uses `public_profile` to display the user's name and avatar in the Connected Accounts section, confirming the correct account was connected. This permission is in use today while `user_photos` review is pending.

---

## iOS System Permissions (App Store Review)

The following permissions are declared in `app.json` and shown to users at runtime via the system dialog:

| Permission | Usage String | When Requested |
|-----------|-------------|---------------|
| Camera (`NSCameraUsageDescription`) | "Rook uses your camera to scan photos for your identity fingerprint." | User taps "Add photo" in Photo Monitor |
| Photo Library (`NSPhotoLibraryUsageDescription`) | "Rook accesses your photos to build your identity fingerprint and detect stolen images." | User connects Instagram/Facebook or taps "Import photos" |
| Notifications (`NSUserNotificationsUsageDescription`) | "Rook sends real-time alerts when threats to your identity are detected." | After first scan completes |
| Face ID (`NSFaceIDUsageDescription`) | "Rook uses Face ID to protect access to your identity data." | User enables Face ID lock in Profile → Security Settings |

Permissions are requested lazily — never on first launch. Users see the system dialog only when they explicitly perform the action that requires the permission.

---

## Test Account

Reviewer credentials are not embedded in this document for security reasons. Retrieve them as follows:

- **App Store review:** Included in the "Notes for reviewer" field of the App Review submission in App Store Connect.
- **Meta App Review:** Included in the "Instructions for reviewer" field of the Meta App Review submission and/or available on request via the support email below.

The reviewer account is pre-configured with:
- Premium subscription (full feature access)
- 4 active threat alerts (1 High, 2 Medium, 1 Low)
- 3 connected social accounts (Instagram, Facebook, X)
- 47 photos indexed in the monitoring system
- Security score: 64/100

> **New-device verification note:** Rook uses Clerk for authentication. The first sign-in on any new device triggers a mandatory one-time email verification code (a standard fraud-prevention step that cannot be disabled on Replit-managed Clerk). If you see a "Verify it's you" screen after entering credentials, check the reviewer inbox for a 6-digit code. This only happens once per device. If review is blocked at this step, contact us via the App Review Notes — we monitor this continuously and will respond within 2 hours during business hours.

---

## Tap Paths to Demonstrate Each Permission

### Demonstrating `instagram_business_basic` (currently active)

1. Launch Rook → sign in with the reviewer credentials
2. Tap the **Profile** tab (bottom right)
3. Scroll to **Connected Accounts** → tap **"+ Add Account"**
4. Tap **Instagram**
5. The app opens an in-app browser (ASWebAuthenticationSession) to `instagram.com`
6. Sign in with a test Instagram Business or Creator account
7. The Instagram consent screen shows the scope being requested: `instagram_business_basic`
8. Tap **Allow** → the browser closes automatically
9. Return to the Profile tab — Instagram now appears as a connected account with a verified checkmark

**What you will observe on the consent screen:** The Instagram authorization page lists `instagram_business_basic` (read access to profile and media metadata). No write permissions are requested.

---

### Demonstrating `user_photos` (pending approval — use screen recording)

Because `user_photos` requires Meta App Review approval before it can be added to the live app's Facebook OAuth scope, the current live app shows only `public_profile` on the Facebook consent screen.

**To demonstrate the intended `user_photos` flow:**
- A screen recording is included in the review submission package showing the full OAuth consent screen with `user_photos` requested (recorded from a development build with the scope enabled).
- The data handling described in the `user_photos` section above applies identically to the live implementation once the permission is granted.

**Current Facebook consent screen (live app — `public_profile` only):**
1. Profile tab → Connected Accounts → **"+ Add Account"** → **Facebook**
2. In-app browser opens to `facebook.com`
3. Consent screen shows: `public_profile` (name and profile picture)
4. Tap **Allow** → browser closes; Facebook appears as connected

**Intended flow after `user_photos` approval (as shown in screen recording):**
1. Same OAuth entry path as above
2. Consent screen will additionally show: `user_photos` (view your photos)
3. After the user grants consent, Rook's background scan reads photo metadata, computes dHash fingerprints, and stores only the integer values

---

### Demonstrating Camera Permission

1. Profile tab → **Tools** → **Photo Monitor**
2. Tap **"Scan a new photo"** or **"Add reference photo"**
3. System dialog appears: *"Rook uses your camera to scan photos for your identity fingerprint."*
4. Tap Allow → camera opens → take a photo → Rook computes a perceptual hash

---

### Demonstrating Photo Library Permission

1. Profile tab → **Tools** → **Photo Monitor**
2. Tap **"Import from Library"**
3. System dialog appears: *"Rook accesses your photos to build your identity fingerprint and detect stolen images."*
4. Grant access → select photos → hashes are computed

---

### Demonstrating Push Notifications

1. Tap the **Scan** tab → tap **"Start Scan"**
2. After the scan completes, the system notification permission dialog appears: *"Rook sends real-time alerts when threats to your identity are detected."*
3. Tap Allow
4. Pre-loaded threat alerts trigger visible push notification badges

---

## Full Review Flow

### Step 1 — Dashboard
After sign-in the reviewer lands on the **Dashboard** tab:
- Security score ring reads **64/100**
- **"4 Active Threats"** displayed
- 3 connected account icons (Instagram, Facebook, X) in Connected Accounts
- Stats: "47 Photos Indexed", "3 Accounts Monitored"

### Step 2 — Alerts
Tap the **Alerts** tab:
- Threat feed shows 4 pre-loaded alerts
- Filter bar lets you switch between All / High / Medium / Low
- Tap any alert → opens Threat Detail screen with AI analysis
- Tap **Resolve** to dismiss a threat

### Step 3 — Scan
Tap the **Scan** tab:
- Radar pulse animation showing the monitoring system
- Tap **"Start Scan"** — progress bar advances through pipeline steps
- Scan completes and returns an updated threat count

### Step 4 — Profile
Tap the **Profile** tab:
- Name, avatar, Premium subscription badge
- Connected Accounts section with add/remove controls
- Settings — notification preferences, privacy, sign-out
- Subscription — shows current plan, allows restore

---

## Common Reviewer Questions

**Q: Why does Rook need `instagram_business_basic` instead of a less permissive scope?**  
A: `instagram_business_basic` is the minimum scope available for Instagram Business/Creator accounts that provides both the profile endpoint and media access needed to build an identity fingerprint. There is no more granular scope available through the Instagram Graph API that would provide the profile picture URL and follower count in one request.

**Q: Why is `user_photos` not yet active in the live Facebook flow?**  
A: `user_photos` is a restricted permission that requires Meta App Review approval before it can be used in production. This submission is the review process for that approval. The current live app uses `public_profile` only, which does not require review. Once `user_photos` is approved, we will add it to the Facebook OAuth scope and update the app.

**Q: Does Rook store users' photos?**  
A: No. Rook downloads photo thumbnails transiently during a scan, computes a 64-bit perceptual hash (dHash) integer, and immediately discards the image data. Only the hash integer is stored in the database. The `media_items` table stores the public CDN URL of the photo (the same URL that is publicly visible on the user's social profile) and a hash value — not pixel data.

**Q: How does Rook use the Facebook data?**  
A: Rook uses the Facebook profile (`public_profile`) to display the user's name and avatar in the app, confirming the correct account was connected. Once `user_photos` is approved, Rook will additionally compute perceptual hashes from the user's photo library for identity fingerprinting. The data is used only to protect the connecting user — it is never used for advertising, cross-user profiling, or shared with any third party.

**Q: Can users revoke access?**  
A: Yes. Users can disconnect any connected account from Profile → Connected Accounts → [Platform] → Disconnect. This deletes the stored access token and all associated fingerprint data for that account. The user can also revoke permissions directly from Facebook/Instagram's app settings page, which invalidates the token on Rook's side on the next API call.

**Q: What is the data retention policy?**  
A: Rook retains threat history and fingerprint data for the duration of the user's account. On account deletion, all data (users, connected accounts, scans, threats, fingerprints, billing history) is cascade-deleted from the database. The Clerk authentication record is also deleted.

**Q: Does Rook post anything to the user's Facebook or Instagram?**  
A: No. Rook requests only read permissions. The app never posts, comments, likes, or performs any write action on the user's accounts.

**Q: Is the app available to users under 13?**  
A: No. The app requires account creation through Clerk, which enforces a minimum age of 13 per its terms of service. The app does not collect data from children and Clerk's auth flow prevents registration for users under 13. The App Store age rating is set to 4+ (All Ages) at the distribution level per Apple's rating guidelines.

---

## OAuth Redirect URIs

These URIs must be registered in the Meta App Dashboard:

| Platform | Redirect URI |
|----------|-------------|
| Instagram — server callback | `https://tryrook.app/api/oauth/instagram/callback` |
| Instagram — mobile deep link | `com.getrook.app://oauth` |
| Facebook — server callback | `https://tryrook.app/api/oauth/facebook/callback` |
| Facebook — mobile deep link | `com.getrook.app://oauth` |

> The mobile deep-link URIs are used when Rook detects the callback is coming from an iOS/Android client (via User-Agent). ASWebAuthenticationSession intercepts the `com.getrook.app://oauth` URL and returns control to the app automatically.

---

## Data Flow — Instagram OAuth Handshake

```
User taps "Connect Instagram"
  → App calls POST /api/oauth/state (authenticated; gets HMAC-signed token, 15-min window)
  → App opens ASWebAuthenticationSession → instagram.com/oauth/authorize
      (scope: instagram_business_basic)
  → User grants consent on Instagram
  → Meta redirects to https://tryrook.app/api/oauth/instagram/callback?code=...&state=...
  → Server verifies HMAC state token (one-time use, 15-min expiry)
  → Server exchanges code for short-lived token via POST (client_secret not in URL/logs)
  → Server upgrades to long-lived token (60 days)
  → Server fetches /me profile (username, profile picture URL, followers)
  → Server stores token + profile metadata in connected_accounts table
  → Server redirects browser to com.getrook.app://oauth?status=connected
  → ASWebAuthenticationSession closes; app updates UI
  → Background scan begins (computes pHash from profile photo)
```

---

## Contact

For urgent review questions, blocked review steps, or to request reviewer credentials:

- **App Review Notes:** Include the request in the App Review submission
- **Email:** support@getrook.app
- **Response SLA:** Within 2 hours during business hours (9 AM–6 PM PT)
