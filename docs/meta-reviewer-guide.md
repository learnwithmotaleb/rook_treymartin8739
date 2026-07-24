# Rook — Meta App Review Guide

**App:** Rook — Identity Protection  
**Bundle ID:** `com.getrook.app`  
**iOS version:** 1.0.0 (Build 1)  
**Permissions under review:** `instagram_business_basic`, `user_photos` (Facebook)  
**Live domain:** `https://getrook.app`  
**Support email:** support@getrook.app  

---

## Overview

Rook is an AI-powered identity protection app that monitors social media platforms for impersonators, stolen photos, and unauthorized use of a user's likeness. The app connects to a user's own social accounts to:

1. **Verify identity ownership** — confirm the connecting user is the legitimate account holder
2. **Build a photo fingerprint** — compute perceptual hashes (pHash/dHash) from the user's own photos; no photos are stored, only 64-bit hash values
3. **Run ongoing scans** — compare the fingerprint against suspicious accounts found during monitoring to detect impersonators
4. **Alert the user** — deliver real-time push notifications when a threat is detected

Rook never accesses, stores, or transmits photos from a user's account to any third party. All photo processing (perceptual hashing) happens server-side on Rook's infrastructure, and only the resulting hash integers are retained.

---

## Permissions Requested

### 1. `instagram_business_basic` (Instagram Graph API)

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

**Scope:** User's own Facebook photo albums  
**Who can grant it:** Any Facebook account holder  

**Why Rook needs it:**  
Rook requests `user_photos` to access the authenticated user's own Facebook photo library. These photos are used exclusively to:
1. Compute perceptual hash (dHash) values — 64-bit integers that represent the visual fingerprint of each photo
2. Store only the hash integers (not the photos themselves) in Rook's database
3. Compare the fingerprint against suspicious accounts found during monitoring scans

**What Rook does NOT do:**
- Upload, store, or transmit the user's photos to any external service
- Share photo data with any third party
- Use photos for advertising or profiling
- Access photos from other users' accounts

**Copy for Meta review form:**  
> "Rook requests `user_photos` to build a perceptual hash fingerprint from the user's own Facebook photos. This fingerprint (stored as 64-bit integers, never as images) is used to detect impersonators who have copied the user's photos. No photos are stored or transmitted externally. The permission is used only while the user is actively connected and can be revoked at any time from Facebook's app settings."

---

## iOS System Permissions (App Store Review)

The following permissions are declared in `app.json` and shown to users at runtime:

| Permission | Usage String | When Requested |
|-----------|-------------|---------------|
| Camera (`NSCameraUsageDescription`) | "Rook uses your camera to scan photos for your identity fingerprint." | User taps "Add photo" in Photo Monitor |
| Photo Library (`NSPhotoLibraryUsageDescription`) | "Rook accesses your photos to build your identity fingerprint and detect stolen images." | User connects Instagram/Facebook or taps "Import photos" |
| Notifications (`NSUserNotificationsUsageDescription`) | "Rook sends real-time alerts when threats to your identity are detected." | After first scan completes |
| Face ID (`NSFaceIDUsageDescription`) | "Rook uses Face ID to protect access to your identity data." | User enables Face ID lock in Profile → Security Settings |

Permissions are requested lazily — never on first launch. Users see the system dialog only when they explicitly perform the action that requires the permission.

---

## Test Account

Use the following credentials to review all features:

| Field | Value |
|-------|-------|
| Email | `rooktestuser@gmail.com` |
| Password | `RookReview2026!` |
| Subscription tier | Premium (full feature access) |
| Pre-loaded data | 4 threat alerts · 3 connected accounts · 47 photos indexed |

> **Important — new device verification:** Rook uses Clerk for authentication. The first sign-in on any new device triggers a mandatory one-time email verification code (a standard fraud-prevention step). If you see a "Verify it's you" screen after entering credentials, a 6-digit code was sent to `rooktestuser@gmail.com`. Enter the code to continue. This only happens once per device. If you are blocked at this step, contact us via the App Review notes and we will confirm receipt and provide the code immediately.

---

## Tap Paths to Demonstrate Each Permission

### Demonstrating `instagram_business_basic`

1. Launch Rook → sign in with the reviewer credentials above
2. Tap the **Profile** tab (bottom right)
3. Scroll to **Connected Accounts** → tap **"+ Add Account"**
4. Tap **Instagram**
5. The app opens an in-app browser (ASWebAuthenticationSession) to `instagram.com`
6. Sign in with a test Instagram account (any Business or Creator account)
7. The Instagram consent screen shows the exact scopes being requested: `instagram_business_basic`
8. Tap **Allow** → the browser closes automatically
9. Return to the Profile tab — Instagram now appears as a connected account with a verified checkmark

**What you will observe:** The app reads the username, profile picture URL, and follower count. No photos are downloaded. The consent screen clearly shows the read-only nature of the request.

---

### Demonstrating `user_photos` (Facebook)

1. From the **Profile** tab → **Connected Accounts** → tap **"+ Add Account"**
2. Tap **Facebook**
3. The app opens an in-app browser to `facebook.com`
4. Sign in with a test Facebook account
5. The Facebook consent screen shows `user_photos` (read your photos)
6. Tap **Allow** → the browser closes automatically
7. Return to the Profile tab — Facebook now appears as a connected account

**What you will observe:** After connecting, Rook initiates a background scan that reads photo metadata (not pixel data), computes perceptual hashes, and stores only the resulting integers. The Photo Monitor screen (Profile → Tools → Photo Monitor) shows the hash count, not the actual photos.

---

### Demonstrating Camera Permission

1. From the **Profile** tab → scroll to **Tools**
2. Tap **Photo Monitor**
3. Tap **"Scan a new photo"** or **"Add reference photo"**
4. The system camera permission dialog appears: *"Rook uses your camera to scan photos for your identity fingerprint."*
5. Tap Allow → the camera opens
6. Take a photo → Rook computes a perceptual hash and adds it to the fingerprint

---

### Demonstrating Photo Library Permission

1. From the **Profile** tab → **Tools** → **Photo Monitor**
2. Tap **"Import from Library"**
3. The system photo library permission dialog appears: *"Rook accesses your photos to build your identity fingerprint and detect stolen images."*
4. Grant access → user selects photos → hashes are computed

---

### Demonstrating Notifications

1. Complete the sign-in flow
2. Tap the **Scan** tab → tap **"Start Scan"**
3. After the scan completes, the system notification permission dialog appears: *"Rook sends real-time alerts when threats to your identity are detected."*
4. Tap Allow
5. Pre-loaded threat alerts also trigger visible push notification badges

---

## Demonstrating Core App Functionality (Full Review Flow)

### Step 1 — Dashboard
After sign-in the reviewer lands on the **Dashboard** tab:
- Security score ring reads **64/100** (pre-loaded for reviewer account)
- **"4 Active Threats"** displayed
- 3 connected account icons (Instagram, Facebook, X) visible in Connected Accounts
- Stats: "47 Photos Indexed", "3 Accounts Monitored"

### Step 2 — Alerts
Tap the **Alerts** tab:
- Threat feed shows 4 pre-loaded alerts (1 High, 2 Medium, 1 Low)
- Tap the filter bar to switch between All / High / Medium / Low
- Tap any alert card → opens Threat Detail screen with AI analysis
- Swipe or tap **Resolve** to dismiss a threat

### Step 3 — Scan
Tap the **Scan** tab:
- Radar pulse animation showing the monitoring system
- Tap **"Start Scan"** — progress bar advances through 6 pipeline steps
- Scan completes and returns updated threat count

### Step 4 — Profile
Tap the **Profile** tab:
- Shows name, avatar, Premium subscription badge
- **Connected Accounts** section with add/remove controls
- **Settings** — notification preferences, privacy, sign-out
- **Subscription** — shows current plan, allows upgrade/restore

---

## Common Reviewer Questions

**Q: Why does Rook need `instagram_business_basic` instead of a less permissive scope?**  
A: `instagram_business_basic` is the minimum scope available for Instagram Business/Creator accounts that provides both the profile endpoint and media access needed to build an identity fingerprint. There is no more granular scope available through the Instagram Graph API that would provide the profile picture URL and follower count in one request.

**Q: Does Rook store users' photos?**  
A: No. Rook downloads photo thumbnails transiently during a scan, computes a 64-bit perceptual hash (dHash) integer, and immediately discards the image data. Only the hash integer is stored in the database. The `media_items` table stores the public CDN URL of the photo (same URL Instagram makes public on the user's profile) and a hash value — not pixel data.

**Q: Where is the user's photo data stored?**  
A: In Rook's PostgreSQL database (hosted on Replit's managed infrastructure, US region). Access tokens are stored encrypted at rest. The user can revoke access at any time from Facebook/Instagram's app settings, which invalidates the stored token.

**Q: How does Rook use the Facebook data?**  
A: Rook uses the Facebook profile to (1) verify account ownership, (2) compute perceptual hashes of the user's photos for the identity fingerprint. The data is used only to protect the connecting user — it is never used for advertising, cross-user profiling, or shared with any third party.

**Q: Can users revoke access?**  
A: Yes. Users can disconnect any connected account from Profile → Connected Accounts → [Platform] → Disconnect. This deletes the stored access token and all associated fingerprint data for that account. The user can also revoke permissions directly from Facebook/Instagram's app settings page, which will invalidate the token on Rook's side on the next API call.

**Q: What is the data retention policy?**  
A: Rook retains threat history and fingerprint data for the duration of the user's account. On account deletion, all data (users, connected accounts, scans, threats, fingerprints, billing history) is cascade-deleted from the database. The Clerk authentication record is also deleted.

**Q: Does Rook post anything to the user's Facebook or Instagram?**  
A: No. Rook requests only read permissions (`instagram_business_basic`, `user_photos`). The app never posts, comments, likes, or performs any write action on the user's accounts.

**Q: Is the app available to users under 13?**  
A: No. Rook's App Store age rating is set to 4+ (All Ages) at the platform/MPAA level, but the app requires account creation through Clerk, which enforces a minimum age of 13 per its terms of service. The app does not collect data from children, and Clerk's auth flow prevents registration for users under 13.

---

## OAuth Redirect URIs (Registered in Meta Developer Console)

The following redirect URIs must be registered in the Meta App Dashboard:

| Platform | Redirect URI |
|----------|-------------|
| Instagram — server callback | `https://getrook.app/api/oauth/instagram/callback` |
| Instagram — mobile deep link | `com.getrook.app://oauth` |
| Facebook — server callback | `https://getrook.app/api/oauth/facebook/callback` |
| Facebook — mobile deep link | `com.getrook.app://oauth` |

> The mobile deep-link URIs are used when Rook detects the callback is coming from an iOS/Android client (via User-Agent). ASWebAuthenticationSession intercepts the `com.getrook.app://oauth` URL and returns control to the app automatically.

---

## Data Flow Diagram (Text)

```
User taps "Connect Instagram"
  → App calls POST /api/oauth/state (authenticated, gets HMAC-signed token)
  → App opens ASWebAuthenticationSession → instagram.com/oauth/authorize
  → User grants consent on Instagram
  → Meta redirects to https://getrook.app/api/oauth/instagram/callback?code=...&state=...
  → Server verifies HMAC state token (15-min window, one-time use)
  → Server exchanges code for short-lived token via POST (client_secret not in URL)
  → Server upgrades to long-lived token (60 days)
  → Server fetches /me profile (username, profile picture URL, followers)
  → Server stores token + profile metadata in connected_accounts table
  → Server redirects browser to com.getrook.app://oauth?status=connected
  → ASWebAuthenticationSession closes; app updates UI
  → Background scan begins (computes pHash from profile photo)
```

---

## Contact

For urgent review questions or to receive the new-device verification code for the test account:

- **App Review Notes:** include "URGENT — reviewer blocked" in the subject
- **Email:** support@getrook.app
- **Response SLA:** within 2 hours during business hours (9 AM–6 PM PT)
