# Meta App Review — Rook Identity Protection

This document describes what Rook does, why each Meta permission is requested, and provides the information reviewers need to verify each use case.

---

## App Overview

**App name:** Rook — Identity Protection  
**Category:** Utilities / Privacy & Security  
**Platform:** iOS (Expo / React Native) + Server-side API  
**Purpose:** Rook monitors a user's own social media accounts for impersonators, stolen photos, and credential leaks. Instagram, Facebook, and X are the launch-ready connections; other platforms shown in the app are non-actionable Coming Soon items. After separate explicit photo-processing consent, users may select photos to build an identity fingerprint and detect copycats across the web.

---

## Permissions Requested

### Instagram — `instagram_business_basic`

| Field | Value |
|---|---|
| **Scope** | `instagram_business_basic` |
| **API endpoints used** | `GET /me`, `GET /me/media` |
| **Data accessed** | Username, follower count, profile photo, post thumbnails |
| **Data NOT accessed** | DMs, comments, stories, insights, contact lists |
| **Data stored** | dHash records, source URLs, optional embeddings, and related metadata for selected media. A compressed avatar image may be stored in the user's profile; source images are otherwise processed transiently. |
| **Data shared** | Photo URLs may be sent to the Google Cloud Vision and OpenAI processors disclosed in Rook's photo-consent notice and Privacy Policy, only after explicit consent. |

**Why this scope is needed:**  
Rook must read the user's own public posts to compute perceptual photo hashes. These hashes are compared against suspicious accounts discovered through web searches — if the hashes match, the account is flagged as a potential impersonator. Without `instagram_business_basic`, Rook cannot fetch the media needed to build the user's identity fingerprint.

**User experience flow:**
1. User taps "Connect Instagram" inside Rook.
2. User is directed to Instagram OAuth consent screen.
3. After approval, Rook fetches account metadata and offers the user a choice of reference photos.
4. Before any selected photo is hashed or sent to a disclosed processor, Rook presents its separate photo-processing notice and records explicit consent. Skip performs no photo processing.
5. Consented photos are processed for image similarity. dHash/source records and, where used, embeddings are stored; a compressed avatar selected in the app may remain in the profile. Rook does not perform facial recognition or create a facial-geometry template.
6. Rook periodically refreshes the token (every 50 days) to keep monitoring active.

**Screencast / test credentials:**  
_(Attach screencast of the OAuth flow + monitoring dashboard in your App Review submission. Provide a sandboxed test Instagram Business account for the reviewer if required.)_

---

### Facebook — `public_profile`

| Field | Value |
|---|---|
| **Scope** | `public_profile` |
| **API endpoints used** | `GET /me?fields=id,name,email,picture` |
| **Data accessed** | Name, user ID, public profile photo |
| **Data NOT accessed** | Friends list, feed, messages, page data |
| **Data stored** | Display name + profile photo URL for UI display. |
| **Data shared** | Never shared with third parties. |

**Why this scope is needed:**  
When a user connects their Facebook account, Rook needs to confirm the account's real identity (name + profile photo) to build the identity anchor used for impersonator detection. `public_profile` is the minimum permission required by the Graph API to read this data.

---

## Data Handling

## Apple App Review — Face/Photo Data Answer (credential-free)

**What photo data does the app access?** With a user's explicit photo-processing consent, Rook may process the user's profile photo, post images, reel thumbnails, and photos the user selects in the app. The service can send raw image bytes or source URLs to Google Cloud Vision and OpenAI for disclosed image analysis. Rook compares image similarity; it does not perform facial recognition or create a facial-geometry template.

**What does Rook store?** Rook stores dHash image fingerprints, source URLs, optional AI identity embeddings, visual-fingerprint metadata, and a compressed avatar image when the user selects one. dHash and embeddings are derived comparison data and are not raw photos. OAuth tokens are not included in exports.

**How can a user delete it?** Profile → Settings → Privacy → Manage Photo Data provides “Withdraw Consent & Delete Photo Data” and “Delete Photo Data Only.” Both delete locally stored hashes/source URLs, embeddings, visual-fingerprint records, and the stored avatar from active systems. Withdrawal also disables new photo processing; account deletion removes active account data. Current policy states backups are purged within 30 days where backups apply.

**Where is this disclosed?** Privacy Policy Section 2 (“Biometric and Image-Derived Data — Written Notice”), Section 2 “Third-Party Services That Receive Photo Data,” Section 7 (“Data Retention and Deletion”), and Section 8 (“Data Export (Portability)”). The in-app notice is reachable at Profile → Settings → Privacy → Manage Photo Data. No reviewer credentials are required to read these disclosures.

| Category | Detail |
|---|---|
| **Token storage** | OAuth access tokens stored encrypted in a PostgreSQL database, never in client-side storage. |
| **Token refresh** | Instagram long-lived tokens refreshed automatically every 50 days. X refresh tokens rotated on each use. |
| **Token expiry** | If refresh fails after 3 attempts, the token is discarded, `needs_reconnect` is flagged, and the user is notified via push notification to re-authenticate. |
| **Data deletion** | On account removal (`DELETE /api/accounts/:id`), all tokens, hashes, and stored media for that account are deleted. |
| **Data retention** | dHash/source records, embeddings, visual metadata, and any compressed avatar are retained while the account is active and removed from active systems when deleted; backups are purged within 30 days where backups apply. |
| **Third-party processing** | Google Cloud Vision and OpenAI may receive consented photo data for the limited identity-monitoring purposes disclosed in the in-app notice and Privacy Policy. Data is not sold or used for advertising. |
| **Minors** | Rook's Terms of Service require users to be at least 17. |

---

## Redirect URIs

| Platform | URI |
|---|---|
| Instagram | `https://tryrook.app/api/oauth/instagram/callback` |
| Facebook | `https://tryrook.app/api/oauth/facebook/callback` |
| X (Twitter) | `https://tryrook.app/api/oauth/x/callback` |

All callbacks validate an HMAC-signed state token (15-minute TTL, one-time-use) before any data is written. Rate limiting (20 requests / minute / IP) is enforced at the callback handler level.

---

## Security Controls

- **State token replay protection:** each state token is consumed on first use; replays are rejected.
- **PKCE:** X OAuth 2.0 uses PKCE (`S256`) with a random 256-bit code verifier embedded in the signed state token.
- **Rate limiting:** OAuth initiation and callback endpoints are rate-limited per IP.
- **Token storage:** access tokens are stored server-side only; the mobile app never handles raw OAuth tokens.
- **Notification:** users receive a push notification when an account needs reconnection.

---

## Contact

For questions during App Review, contact: **security@getrook.app**

---

## Private reviewer walkthrough (A–Z)

Use this checklist for the private review environment. Credentials are
intentionally placeholders and must be supplied through the secure review
channel, never committed here.

1. **A — Access:** Install the review build, open **Sign In**, enter
   `<REVIEWER_EMAIL>`, select **App Review access**, enter the protected access
   code from App Store Connect, and tap **Enter App Review**. The access code is
   exchanged server-side for a one-time Clerk sign-in ticket, so no email OTP is
   required on a new review device.
2. **B — Begin:** Complete the age, terms, and biometric-photo consent screens.
3. **C — Connect:** Open Connections and confirm the pre-seeded Instagram,
   Facebook, and X accounts are visible.
4. **D — Dashboard:** Return to the dashboard and verify the seeded security
   score and alerts.
5. **E — Evidence:** Open a high-severity alert and review the sample-photo
   comparison, explanation, and source platform.
6. **F — Findings:** Open the remaining medium and low findings and verify each
   belongs to the signed-in account.
7. **G — Generate:** Start a new scan. The review account receives a completed
   deterministic result without requiring provider credentials or external
   account access.
8. **H — History:** Open scan history and the newly completed scan; confirm its
   findings match the reviewer account.
9. **I — Information:** Open Privacy, Terms, and consent details to verify the
   disclosed processing and deletion controls.
10. **J — Join/support:** Use the in-app support/contact link if clarification
    is needed; do not use production customer data.

The reviewer entitlement is server-side and is granted only when the
authenticated Clerk user resolves through the users table to
`APP_REVIEW_CLERK_USER_ID`. The subscription endpoint intentionally reports
the seeded account as free/canceled/expired so the purchase paywall remains
visible; the reviewer-only scan and evidence paths are separate server-side
review accommodations.
