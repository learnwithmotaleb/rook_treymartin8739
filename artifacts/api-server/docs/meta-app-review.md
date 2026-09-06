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
| **Data stored** | Hashed perceptual fingerprints (pHash) of the user's own photos. Raw photos are never stored. |
| **Data shared** | Photo URLs may be sent to the Google Cloud Vision and OpenAI processors disclosed in Rook's photo-consent notice and Privacy Policy, only after explicit consent. |

**Why this scope is needed:**  
Rook must read the user's own public posts to compute perceptual photo hashes. These hashes are compared against suspicious accounts discovered through web searches — if the hashes match, the account is flagged as a potential impersonator. Without `instagram_business_basic`, Rook cannot fetch the media needed to build the user's identity fingerprint.

**User experience flow:**
1. User taps "Connect Instagram" inside Rook.
2. User is directed to Instagram OAuth consent screen.
3. After approval, Rook fetches account metadata and offers the user a choice of reference photos.
4. Before any selected photo is hashed or sent to a disclosed processor, Rook presents its separate photo-processing notice and records explicit consent. Skip performs no photo processing.
5. Consented photos are hashed; raw pixel data is discarded after processing.
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

| Category | Detail |
|---|---|
| **Token storage** | OAuth access tokens stored encrypted in a PostgreSQL database, never in client-side storage. |
| **Token refresh** | Instagram long-lived tokens refreshed automatically every 50 days. X refresh tokens rotated on each use. |
| **Token expiry** | If refresh fails after 3 attempts, the token is discarded, `needs_reconnect` is flagged, and the user is notified via push notification to re-authenticate. |
| **Data deletion** | On account removal (`DELETE /api/accounts/:id`), all tokens, hashes, and stored media for that account are deleted. |
| **Data retention** | No raw photos stored. Perceptual hashes are retained only while the account is connected. |
| **Third-party processing** | Google Cloud Vision and OpenAI may receive consented photo data for the limited identity-monitoring purposes disclosed in the in-app notice and Privacy Policy. Data is not sold or used for advertising. |
| **Minors** | Rook's Terms of Service require users to be 18+. |

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
