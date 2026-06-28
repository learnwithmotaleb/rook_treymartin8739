# Rook — Meta App Review Guide

**App:** Rook — Identity Protection  
**Bundle ID:** `com.tryrook.app`  
**Permissions under review:** `instagram_business_basic`, `user_photos`  
**Live domain:** `https://tryrook.app`  

---

## Overview

Rook is an AI-powered identity protection app that monitors social platforms for impersonators, stolen photos, and unauthorized use of a user's likeness. The app needs access to the user's own social media data to:

1. **Verify identity ownership** of the connecting account
2. **Build a photo fingerprint** (perceptual hashes of the user's own photos)
3. **Run impersonation detection** by comparing the fingerprint against suspicious accounts found during monitoring scans

---

## Required Permissions

### `instagram_business_basic`

**Why Rook needs it:**  
Rook requests `instagram_business_basic` to allow users to connect their Instagram Business or Creator account. This permission provides access to the user's own profile and basic media metadata, which Rook uses to:
- Verify that the connecting user is the legitimate account owner
- Retrieve the user's profile photo URL to build an identity anchor
- Access captions from the user's own posts for content fingerprinting

**Copy for Meta review form:**
> "Rook is an AI-powered identity protection app. We request instagram_business_basic to allow users to connect their Instagram account and verify their identity profile. This enables our system to build a photo fingerprint from the user's own media, which is then used to detect impersonation accounts that have stolen the user's photos or are mimicking their handle. Without this permission, we cannot verify that the connecting user is the legitimate account owner, and cannot build the reference dataset needed for impersonation detection."

---

### `user_photos` (Facebook)

**Why Rook needs it:**  
Rook requests `user_photos` to access the authenticated user's own Facebook photo library. These photos are used exclusively to build a perceptual hash (dHash) fingerprint of the user's visual identity. The fingerprint is then compared against suspicious accounts found during monitoring scans.

**Important:** No photos are stored permanently. Only the computed hash values (64-bit integers) are retained. The original images are never uploaded to Rook's servers.

**Copy for Meta review form:**
> "We request user_photos to access the authenticated user's own Facebook photo library. These photos are used exclusively to build a perceptual hash (dHash) fingerprint of the user's visual identity. This fingerprint is compared against suspicious accounts found during monitoring scans. No photos are stored permanently — only the computed hash values. Without this permission, Rook cannot perform photo-based impersonation detection for Facebook-connected users."

---

## App Domains & OAuth Redirect URIs

Register these in your Facebook App Dashboard → **Settings → Basic → App Domains**:

```
tryrook.app
RookApp.replit.app
```

Register these in **Facebook Login → Settings → Valid OAuth Redirect URIs**:

```
https://tryrook.app/api/oauth/instagram/callback
https://tryrook.app/api/oauth/facebook/callback
https://RookApp.replit.app/api/oauth/instagram/callback
https://RookApp.replit.app/api/oauth/facebook/callback
```

---

## Setting Up the Meta Review Test Account

### Step 1 — Create a Test User in Meta App Dashboard

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Select your Rook app
3. In the left sidebar: **Roles → Test Users**
4. Click **"Add"** to create a new test user
5. Set a name (e.g., "Rook Reviewer") and generate a password
6. Note the email and password — these are the credentials the Meta reviewer will use

> Alternatively: If an existing Facebook account will be used for review, add it under **Roles → Testers** instead.

### Step 2 — Connect a Real Instagram Account to the Test User

The test user's Facebook account must have a linked Instagram Business or Creator account. This is required because `instagram_business_basic` only works with Business/Creator accounts.

1. Log into the test user's Facebook account
2. Go to **Settings → Linked Accounts → Instagram**
3. Connect an Instagram Business or Creator account
4. If the Instagram account is Personal, first convert it:
   - Instagram app → Settings → Account → Switch to Professional Account → Creator

### Step 3 — Upload a Profile Photo to the Test User's Account

For the photo comparison feature to demonstrate value, the test user should have a recognizable profile photo uploaded to both Facebook and Instagram.

1. Log in as the test user on Facebook
2. Upload a profile photo
3. Log in on Instagram and upload the same or similar photo as the profile picture

### Step 4 — Provide Credentials in the App Review Submission

In the App Review submission form under **"Instructions for the reviewer"**, include:

```
Test Account Credentials:
  Email:    [test user email]
  Password: [test user password]

Instagram account linked to this Facebook profile:
  Username: [instagram username]

Steps to test:
  1. Open Rook and tap "Sign In"
  2. Create a new account OR sign in with the test credentials
  3. On the Profile tab, tap "Connected Accounts"
  4. Tap "+ Connect Account"
  5. Select "Instagram" → tap "Connect Instagram"
  6. In the browser, log in with the test account credentials
  7. Approve "instagram_business_basic" permission → app shows "Connected ✓"
  8. Repeat for "Facebook" → approve "user_photos" permission
  9. Return to Dashboard → observe that the account is now being monitored
```

---

## What NOT to Do

- **Do not** pre-seed this Meta review account with reviewer threat data — leave it clean so the OAuth flows run against real data and demonstrate authentic API value
- **Do not** use a personal Instagram account — it must be Business or Creator type
- **Do not** submit with a Personal Facebook account that hasn't linked an Instagram — the `instagram_business_basic` flow will fail

---

## Demonstrating the Value of Each Permission to the Reviewer

### For `instagram_business_basic`
After connecting Instagram, the reviewer will see:
1. Their connected account appears in the Profile → Connected Accounts list ✓
2. The Scan screen shows "1 Account Monitored" (or more if Facebook also connected)
3. Running a scan → Rook fetches their profile photo and builds a photo fingerprint
4. The Photo Monitor tool shows how many photos are now indexed

### For `user_photos` (Facebook)
After connecting Facebook, the reviewer will see:
1. Their Facebook account appears as connected ✓
2. Running a scan → Rook accesses their photo library to build dHash fingerprints
3. Photo Monitor shows the indexed count increasing

---

## Privacy Policy and Data Handling

**Privacy Policy URL:** `https://tryrook.app/privacy`  
**Terms of Service URL:** `https://tryrook.app/terms`

Key data handling facts for Meta review:
- Photo data is processed in-memory only; original images are never written to disk
- Only dHash values (64-bit integers) are stored — not the images themselves
- All stored data is associated with the user's own account and not shared with third parties
- Users can delete all data at any time via Profile → Delete Account

---

## Scopes Summary Table

| Permission | Used For | Data Stored | Required? |
|---|---|---|---|
| `instagram_business_basic` | Identity verification, profile photo, caption fingerprinting | dHash of profile photo + caption hashes | Yes |
| `user_photos` | Build photo fingerprint from user's own library | dHash values only, no images | Yes |
| `public_profile` (Facebook) | Display name + profile photo in connected accounts list | Display name + avatar URL | Yes |

---

## Support Contact

For questions during the review process: **support@tryrook.app**
