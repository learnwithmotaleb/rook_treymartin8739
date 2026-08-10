# ROOK — FINAL PRE-SUBMISSION RELEASE AUDIT

**Date:** August 10, 2026  
**Scope:** Meta App Review + Apple App Store + Security + Privacy  
**Auditor:** Engineering (automated + manual)

---

## 1. Executive Summary

Rook is substantially ready for submission with the fixes applied during this audit. No P0 issues remain outstanding after the session. Several P1 items were fixed; a small number of P1 items require manual action (Meta dashboard, Apple credentials, legal review). P2/P3 items are documented below.

The application correctly:
- Uses only `instagram_business_basic` (no review-gated scopes)
- Uses only `public_profile` for Facebook
- Has HMAC state tokens for OAuth, PKCE for X
- Has data deletion, deauthorization, and account-notify webhooks
- Scopes all API data by authenticated user ID (no IDOR)
- Cascades deletes correctly to all child tables
- Has a working account deletion flow including Clerk user removal

---

## 2. Meta Review Readiness

**CONDITIONAL PASS** — Code is ready. Manual platform configuration required.

✅ `instagram_business_basic` only — no review-gated scopes  
✅ `public_profile` only for Facebook  
✅ HMAC state token (one-time use) on all OAuth flows  
✅ Data deletion callback at `/api/oauth/webhooks/facebook` (HMAC-verified)  
✅ Deauthorize callback at `/api/oauth/webhooks/facebook`  
✅ Account notification webhook  
✅ Instagram 60-day token auto-refresh  
✅ Seed-reviewer endpoint (`POST /api/admin/seed-reviewer`) for App Review  
✅ No scope beyond what is used  
⚠️ **M1 MANUAL**: Register `com.getrook.app://oauth` as valid redirect URI in Meta App Dashboard for both Instagram and Facebook products  
⚠️ **M2 MANUAL**: Add reviewer Instagram (Business/Creator) + Facebook test accounts as Testers in Meta Developer Console  
⚠️ **M3 MANUAL**: Set `ADMIN_API_KEY` secret in production deployment (seed-reviewer returns 503 without it)  
⚠️ **M4 MANUAL**: Record ≤5-min review video per script in `SUBMISSIONS.md` Section 11d  

---

## 3. Apple Review Readiness

**CONDITIONAL PASS** — Code compliance satisfied. Store Connect configuration required.

✅ Explicit terms acceptance checkbox (unchecked by default) added to signup  
✅ Terms and Privacy Policy links are tappable from paywall and auth screens  
✅ Auto-renewal clearly disclosed in subscription fine print  
✅ Cancellation timing disclosed ("at least 24 hours before renewal")  
✅ Restore Purchases available on paywall  
✅ No fake testimonials or fabricated ratings (replaced with honest feature highlights)  
✅ No dark patterns in subscription flow  
✅ Account deletion flow works (deletes Clerk user + all DB data)  
✅ Camera permission request explained before prompt  
⚠️ **A1 MANUAL**: Fill EAS `eas.json` placeholders (Apple ID, ASC App ID, Team ID)  
⚠️ **A2 MANUAL**: Upload App Store screenshots for all required device sizes  
⚠️ **A3 MANUAL**: Complete App Privacy nutrition label in App Store Connect (see Section 12)  
⚠️ **A4 MANUAL**: Configure RevenueCat IAP products in App Store Connect (`premium_monthly_v2`, `premium_annual_v2`)  
⚠️ **A5 MANUAL**: Provide reviewer login credentials in App Review notes  

---

## 4. Security Readiness

**CONDITIONAL PASS** — Core security controls are in place. Some hardening improvements applied.

✅ All authenticated endpoints derive user identity from Clerk token (server-side); no client-supplied user IDs trusted  
✅ No IDOR found across accounts, scans, threats, photos, billing, notifications, identity  
✅ Admin routes require `X-Admin-Key` header; returns 503 if key not configured  
✅ Rate limiting added to scan, AI analysis, and photo search endpoints  
✅ SSRF guard added (`src/lib/ssrf.ts`) — blocks private IPs, localhost, metadata endpoints  
✅ SSRF guard applied to `POST /photos/search` (user-supplied URL)  
✅ SSRF guard applied to `photoHashService.ts` `computeDHash()`  
✅ OAuth `console.error` secret-prefix logging removed; uses structured `logger.error` without secrets  
✅ Webhook signatures verified (HMAC) for Facebook/Instagram  
✅ 20 MB global body limit; no unbounded uploads  
✅ Helmet security headers applied  
✅ CORS restricted to known origins + Replit dev domains  
⚠️ **S1**: Scan dedup (SELECT-before-INSERT for running jobs) is non-atomic — low-risk but could create duplicate jobs under simultaneous requests. A DB partial unique index on `(user_id, status)` WHERE `status='running'` would eliminate it.  
⚠️ **S2**: SSRF guard uses `redirect: "error"` in `photoHashService` but other services (`webSearchService.ts` URL probes) still use `redirect: "follow"` on externally-sourced URLs — those URLs come from Serper/Google results so risk is low, but not zero.  
⚠️ **S3**: Avatar upload validates size but does not verify magic bytes (actual image format). Sharp will reject non-images at processing time, but a malformed file reaching Sharp is a minor DoS vector.  

---

## 5. Privacy Readiness

**CONDITIONAL PASS** — Data minimization is good. Legal disclosure gaps flagged for counsel.

✅ No dark-web monitor (removed previously)  
✅ OAuth tokens stored encrypted (at-rest database encryption depends on hosting provider)  
✅ Profile photos stored as compressed base64 (160×160 JPEG) — no external object storage  
✅ Account deletion cascades to all child tables (verified via schema audit)  
✅ `terms_accepted_at` and `terms_version` now recorded server-side  
✅ `POST /me/terms` endpoint added for explicit acceptance recording  
✅ Terms acceptance called after email verification completes  
⚠️ **P1 LEGAL**: Image processing (pHash + Google Vision embeddings) may constitute biometric/facial processing in certain jurisdictions (Illinois BIPA, Texas CUBI, EU GDPR Biometric). Flag for qualified legal review before launch.  
⚠️ **P2 LEGAL**: Privacy Policy and Terms of Service should explicitly cover: image processing methodology, pHash storage and retention, third-party API data sharing (Google Vision, OpenAI, Serper, Google CSE), false-positive liability disclaimer, and age requirement (recommended: 17+).  
⚠️ **P3**: OAuth tokens for disconnected accounts: confirm stale tokens are revoked at Meta when a user disconnects (disconnect flow should call Meta token revocation API).  

---

## 6. Critical Issues Found

### P0 Issues — All Fixed

| # | Issue | File | Fix Applied |
|---|-------|------|-------------|
| P0-1 | `"e.g. Sophie Rain"` placeholder in real-name field — could appear as search term | `connect-account.tsx:701` | Changed to `"e.g. Jane Smith"` |
| P0-2 | Fabricated testimonials + fake stats (4.8★, 50,000+ identities) in onboarding — App Store violation | `onboarding.tsx:1168-1218` | Replaced with honest "How Rook Works" feature-highlight screen |
| P0-3 | Terms acceptance not recorded server-side; no checkbox — compliance gap | DB schema, `users.ts`, `auth.tsx` | Added `terms_accepted_at`/`terms_version` columns, `POST /me/terms` endpoint, explicit checkbox in signup UI |
| P0-4 | `console.error` in `oauth.ts` logged `secretPrefix` (first 4 chars of FB client secret) | `oauth.ts:518-525` | Replaced with `logger.error` omitting all secret fields |

### P1 Issues — All Fixed

| # | Issue | File | Fix Applied |
|---|-------|------|-------------|
| P1-1 | No rate limiting on `/scan`, `/ai/*`, `/photos/search` — denial-of-wallet risk | `app.ts`, `routes/index.ts` | Added `scanLimiter` (6/10min), `aiLimiter` (20/10min), `photoSearchLimiter` (30/10min) |
| P1-2 | SSRF: user-supplied URL in `POST /photos/search` fetched without private-IP validation | `photos.ts`, `photoHashService.ts` | Added `ssrf.ts` guard; applied to both paths |
| P1-3 | Misleading "continuously monitors" / "instantly alerted" copy — App Store / Meta policy risk | Multiple files | Changed to "periodically scans" / "when matches are found" throughout |
| P1-4 | "Sophie Rain" in webSearchService.ts comment | `webSearchService.ts:1259` | Changed to "Jane Smith" |
| P1-5 | "SOC 2 ready" claim on auth screen — unverifiable | `auth.tsx:484` | Changed to "Secured with industry-standard encryption" |
| P1-6 | "fully protected" / "confirmed impersonator" copy in alerts/security screens | `alerts.tsx`, `security-settings.tsx`, `subscription.tsx` | Changed to "strong account security" / "reviewed" / "potential match" |

---

## 7. Issues Fixed (Full Change Log)

### `artifacts/mobile/app/connect-account.tsx`
- **Change**: `placeholder="e.g. Sophie Rain"` → `placeholder="e.g. Jane Smith"`
- **Why**: Placeholder name of a real public figure; could enter scan queries if user submits without editing

### `artifacts/mobile/app/onboarding.tsx`
- **Change**: Replaced `SocialProofScreen` (fake testimonials + 4.8★ + 50,000+ stat) with `SocialProofScreen` that shows 4 factual "How Rook Works" cards
- **Change**: "Alert you instantly" → "Alert you when matches are found"
- **Change**: "Continuous daily monitoring" → "Scheduled daily scans"  
- **Change**: "Real-time push alerts" → "Push alerts when matches are found"
- **Change**: "monitors continuously — every platform, every day" → "schedules daily scans across connected platforms"
- **Change**: "Impersonation is one of the fastest-growing forms of online fraud" → "Online identity fraud is a growing concern" (headline was unsourced)

### `artifacts/mobile/app/auth.tsx`
- **Change**: Added `termsAccepted` state; terms checkbox (`TermsCheckbox` component) required before "Create Account" is enabled
- **Change**: `handleSubmit` validates checkbox in register mode; shows error if unchecked
- **Change**: After email verification completes, calls `recordTermsAcceptance()` server-side (fire-and-forget)
- **Change**: "256-bit encrypted · SOC 2 ready" → "Secured with industry-standard encryption"

### `artifacts/mobile/app/(tabs)/alerts.tsx`
- **Change**: "You're fully protected" → "Run a scan anytime to check for new results"
- **Change**: "every confirmed impersonator" → "every result you've reviewed"

### `artifacts/mobile/app/security-settings.tsx`
- **Change**: "Excellent — fully protected" → "Excellent — strong account security"

### `artifacts/mobile/app/subscription.tsx`
- **Change**: "Continuous scan across all platforms" → "Periodic scan across connected platforms"
- **Change**: "Watching X, Instagram..." → "Searches X, Instagram..."
- **Change**: "Rook continuously monitors your identity" → "Rook periodically scans for potential misuse"
- **Change**: "confirmed via reverse image search" → "potential match — detected via reverse image search"
- **Change**: "Identity impersonation detected" → "Potential impersonation match"

### `artifacts/mobile/app/support.tsx`
- **Change**: "immediately alerted with evidence" → "receive a push notification with the evidence for your review"
- **Change**: "We actively monitor Instagram and Facebook" → "Rook searches Instagram, Facebook, X (Twitter), TikTok, and more using public web search"

### `artifacts/mobile/hooks/useNotifications.ts`
- **Change**: "instant alerts when threats to your identity are detected" → "when potential matches to your identity are found"

### `artifacts/mobile/lib/api.ts`
- **Change**: Added `CURRENT_TERMS_VERSION = "2026-08-10"` constant
- **Change**: Added `recordTermsAcceptance()` function

### `artifacts/api-server/src/routes/oauth.ts`
- **Change**: Added `import { logger }` from logger
- **Change**: Replaced `console.error` (which logged `secretPrefix`, `secretLen`, `redirectUri`) with `logger.error` that omits all secret-adjacent fields

### `artifacts/api-server/src/routes/users.ts`
- **Change**: Added `POST /me/terms` endpoint — validates `termsVersion`, writes `termsAcceptedAt` + `termsVersion` to users table

### `artifacts/api-server/src/routes/photos.ts`
- **Change**: Added SSRF guard on `imageUrl` before fetching

### `artifacts/api-server/src/routes/index.ts`
- **Change**: Applied `scanLimiter`, `aiLimiter`, `photoSearchLimiter` to respective route prefixes

### `artifacts/api-server/src/services/photoHashService.ts`
- **Change**: Added SSRF validation in `computeDHash()`; changed to `redirect: "error"` to prevent open-redirect bypass

### `artifacts/api-server/src/services/webSearchService.ts`
- **Change**: Comment "Sophie Rain" → "Jane Smith"

### `artifacts/api-server/src/lib/ssrf.ts` *(new file)*
- **Change**: SSRF protection utility — `validateFetchUrl()` and `isSafeUrl()` block private IPs, loopback, metadata endpoints, non-HTTP schemes

### `artifacts/api-server/src/middleware/rateLimiters.ts` *(new file)*
- **Change**: Three authenticated rate limiters keyed by `userId`; no IP-based keying (avoids IPv6 normalization issues)

### `lib/db/src/schema/shield.ts`
- **Change**: Added `termsAcceptedAt` (TIMESTAMPTZ, nullable) and `termsVersion` (TEXT, nullable) columns to `usersTable`
- **Migration**: Applied via `ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS terms_version TEXT` (direct SQL)

---

## 8. Remaining Issues

### Requires Manual Action (see Section 9)
- M1–M4: Meta dashboard configuration
- A1–A5: Apple/EAS configuration

### Requires Legal Review (see Section 10)
- Biometric/facial processing disclosure
- Privacy Policy gaps

### Engineering P2 (not release-blocking)
- **Scan dedup race**: Non-atomic SELECT-before-INSERT for running jobs. Add a DB partial unique index `CREATE UNIQUE INDEX ON scan_jobs (user_id) WHERE status = 'running'` after verifying no duplicate rows exist.
- **Avatar magic-byte validation**: Sharp rejects non-images at processing time, but adding `file-type` MIME check before Sharp would be more explicit.
- **SSRF on web search URL probes**: `webSearchService.ts` probes search-result URLs with `redirect: "follow"`. Changing to `redirect: "manual"` + validating the `Location` header would add a layer. Low risk since URLs come from Google/Serper results.
- **Terms acceptance for SSO paths**: Google/Apple SSO users see the disclosure text on auth screen but do not click a checkbox. Industry-standard approach — acceptable — but consider adding a modal on first SSO login.
- **`scan_jobs.status`** index exists but no partial unique constraint enforcing at-most-one running job per user.

### Engineering P3 (polish / future)
- X token refresh failures logged repeatedly — X developer access level has changed; `needsReconnect` is correctly flagged but generates noisy logs. Add backoff on failed refresh to reduce log volume.
- `server/templates/landing-page.html` placeholders are correctly replaced at runtime by `serve.js` — no fix needed.

---

## 9. Manual Developer Actions Required

| ID | Action | Priority |
|----|--------|----------|
| M1 | Register `com.getrook.app://oauth` as valid OAuth redirect URI in Meta App Dashboard for both Instagram Login and Facebook Login products | **Submission blocker** |
| M2 | Add reviewer test Instagram (Business/Creator account) + Facebook account as Testers in Meta Developer Console | **Submission blocker** |
| M3 | Set `ADMIN_API_KEY` secret in production deployment environment | **Submission blocker** (seed-reviewer endpoint returns 503 without it) |
| M4 | Record screen-capture review video per script in `SUBMISSIONS.md` Section 11d | **Submission blocker** |
| A1 | Fill EAS `eas.json` placeholders: `appleId`, `ascAppId`, `appleTeamId` | **Submission blocker** |
| A2 | Upload App Store screenshots for iPhone 6.7", 6.5", 5.5" (required) | **Submission blocker** |
| A3 | Complete App Privacy nutrition label in App Store Connect (see Section 12) | **Submission blocker** |
| A4 | Configure RevenueCat IAP products `premium_monthly_v2` + `premium_annual_v2` in App Store Connect | **Submission blocker** |
| A5 | Include App Review credentials and step-by-step instructions in review notes | Recommended |
| S1 | Rotate `FACEBOOK_APP_SECRET` / `INSTAGRAM_CLIENT_ID` / `INSTAGRAM_CLIENT_SECRET` if they were ever committed to git history | Security best practice |
| S2 | Verify Meta token revocation API is called when user disconnects an account | P2 |
| S3 | Set `REVENUECAT_WEBHOOK_SECRET` in production for verified webhook signature validation | Security |

---

## 10. Legal Counsel Review Items

The following require review by qualified legal counsel — do not treat AI-generated summaries as legal compliance:

1. **Biometric/facial data**: pHash fingerprints derived from profile photos may qualify as biometric identifiers under BIPA (Illinois), CUBI (Texas), or GDPR Article 9. Determine whether consent, notice, or a separate DPA is required for each target jurisdiction.

2. **Image processing disclosure**: Privacy Policy must accurately describe that user photos are sent to Google Cloud Vision API and OpenAI Vision API, including what data is retained by those providers.

3. **False positive liability**: App does not confirm impersonation — it surfaces potential matches. Terms should include a strong disclaimer that results require user verification and that Rook makes no guarantee of accuracy.

4. **Age eligibility**: Recommended minimum age: 17+ (consistent with Apple's default). COPPA implications if minors can sign up.

5. **Data retention policy**: Define and document how long scan results, threat records, and pHash embeddings are retained after a user deletes their account (currently: cascade-delete removes them immediately, which is good — document this explicitly).

6. **Third-party platform independence**: Terms and Privacy Policy must state that Rook is not affiliated with Meta, Instagram, Facebook, Google, TikTok, X, Snapchat, or Apple.

7. **Subscription auto-renewal disclosure**: Verify compliance with FTC auto-renewal rules (clear disclosure before subscription begins) and applicable state auto-renewal laws (California, New York).

---

## 11. Meta Permissions Map

| Permission | Feature | User Benefit | Data Accessed | Storage | Deletion |
|-----------|---------|-------------|--------------|---------|----------|
| `instagram_business_basic` | Connect Instagram account; retrieve profile photos for identity fingerprint | Enables photo-based impersonation search | Profile info + up to 20 most recent media thumbnails | `connected_accounts`, `visual_fingerprints`, `user_photo_hashes` | Cascade on account disconnect or user deletion |
| `public_profile` (Facebook) | Connect Facebook account for identity anchor | Allows cross-platform identity matching | Name, profile picture URL | `connected_accounts` | Cascade on disconnect or deletion |

**ROOK does NOT:**
- Post to your account
- Send messages from your account
- Access your followers list
- Access private messages
- Access stories or hidden content

---

## 12. Apple App Privacy Data Map

| Data Type | Collected | Linked to Identity | Tracking | Purpose | Third Parties |
|-----------|-----------|-------------------|----------|---------|---------------|
| Name | ✅ | ✅ | ❌ | Account creation, scan identity | None |
| Email Address | ✅ | ✅ | ❌ | Authentication | Clerk |
| Photos/Videos | ✅ | ✅ | ❌ | Identity fingerprint, reverse image search | Google Cloud Vision, OpenAI Vision |
| User ID | ✅ | ✅ | ❌ | Internal account management | Clerk |
| Device ID | ✅ | ✅ | ❌ | Push notifications | Expo / Apple APNs |
| Purchase History | ✅ | ✅ | ❌ | Subscription entitlements | RevenueCat |
| Other User Content (scan targets) | ✅ | ✅ | ❌ | Impersonation search | Google Custom Search, Serper |
| Crash Data | ❌ | — | — | — | — |
| Coarse Location | ❌ | — | — | — | — |

**Required Reason APIs used:**
- `NSUserDefaultsDomain` — AsyncStorage (user preferences/session)
- Camera / Photo Library — profile photo selection (with permission)
- Push Notifications — threat alerts (with permission prompt explanation)

---

## 13. Penetration Test Results

| Test | Expected Protection | Actual Result | Fix | Retest |
|------|--------------------|--------------| ----|--------|
| Access `GET /api/threats/{other_user_threat_id}` with own auth token | 404 Not Found | ✅ Returns 404 — `userId` predicate enforced in query | Already secure | Pass |
| Access `GET /api/scan/{other_user_job_id}` | 404 Not Found | ✅ Returns 404 | Already secure | Pass |
| Unauthenticated `POST /api/scan` | 401 Unauthorized | ✅ Returns 401 | Already secure | Pass |
| `POST /api/photos/search` with `imageUrl: "http://169.254.169.254/latest/meta-data/"` | 400 Bad Request | ✅ Blocked by SSRF guard (applied this session) | Applied | Pass |
| `POST /api/photos/search` with `imageUrl: "http://localhost:5432/"` | 400 Bad Request | ✅ Blocked by SSRF guard | Applied | Pass |
| `POST /api/scan` 10× rapid fire | Rate limit 429 | ✅ Returns 429 after 6 requests per 10 min (applied this session) | Applied | Pass |
| `GET /api/admin/stats` without `X-Admin-Key` | 403 Forbidden | ✅ Returns 403 | Already secure | Pass |
| `GET /api/admin/stats` with valid key but `ADMIN_API_KEY` not set | 503 Service Unavailable | ✅ Returns 503 with message | Already secure | Pass |
| Create account, delete account, re-register same email | Should succeed cleanly | ✅ Clerk deletion + DB cascade verified in code | Applied (previous session) | Code-verified |

---

## 14. Meta Reviewer Walkthrough

**Prerequisites**: Reviewer account must be added as a Tester in Meta Developer Console (see M2).

1. **Download** Rook from TestFlight (link to be provided in review notes)
2. **Launch** the app
3. **Create a new account** using the reviewer's test email or Sign in with Apple/Google
4. **Complete onboarding** — observe: no fake urgency, no misleading statistics, no fabricated testimonials
5. **Tap "Add Account"** on the dashboard → select Instagram
6. **Observe the pre-flight chip**: "Instagram Login requires a Professional or Creator account"
7. **Tap "Connect Instagram"** — Safari opens the Meta/Instagram OAuth flow
8. **Log in** with the reviewer's test Instagram Business/Creator account
9. **Authorize** `instagram_business_basic` — observe that ONLY this permission is requested
10. **Return to app** — observe the account is connected
11. **Run a scan** — observe the app searches for potential matches
12. **To disconnect**: go to Profile → Connected Accounts → [account] → Disconnect
13. **To delete account**: Profile → Settings → Delete Account → confirm
14. **Verify deletion page** works: go to `https://tryrook.app/api/legal/privacy` → Account Deletion section

**Seed reviewer data** (for reproducible results):
```
POST /api/admin/seed-reviewer
X-Admin-Key: [ADMIN_API_KEY]
{"clerkId": "reviewer_clerk_id"}
```

---

## 15. Apple App Review Walkthrough

1. **Download** from TestFlight (credentials in review notes)
2. **Launch** → observe splash screen and logo
3. **Create account** → tap "Create Account" tab → fill name, email, password
4. **Observe**: Terms checkbox is unchecked by default; "Create Account" button is disabled until accepted
5. **Accept** Terms of Service and Privacy Policy → button activates
6. **Verify email** with the 6-digit code sent by Clerk
7. **Complete onboarding** (6 screens) — tap through all screens
8. **Add a social account** or select a photo from camera roll
9. **Tap "Run Scan"** — observe loading state and progress steps
10. **View results** (Premium paywall) — tap "Start 7-Day Free Trial" → observe pricing disclosure and auto-renewal language
11. **Restore Purchases** button is visible at bottom of paywall
12. **Profile → Settings**: 2FA toggle, notification preferences, connected accounts
13. **Profile → Delete Account**: confirms deletion with warning dialog
14. **Legal pages**: tap Privacy Policy / Terms from paywall → opens in-app browser to `https://tryrook.app` legal pages

---

## 16. Production Checklist

### Authentication & Identity
- ✅ Clerk auth configured for production
- ✅ Apple Sign In configured
- ✅ Google Sign In configured
- ✅ Session invalidation on logout
- ✅ Per-user onboarding state scoped by Clerk user ID
- ✅ Server-side `onboardingAnswers` as durable source of truth

### Meta / Instagram / Facebook
- ✅ `instagram_business_basic` only
- ✅ `public_profile` only for Facebook
- ✅ HMAC state tokens (one-time use)
- ✅ Data deletion callback
- ✅ Deauthorize callback
- ✅ Account-notify webhook
- ✅ 60-day token auto-refresh
- ✅ Instagram `invalid_request` → auto-retry with ephemeral session
- ⚠️ M1: Redirect URI registration in Meta dashboard
- ⚠️ M2: Test accounts added as Testers
- ⚠️ M3: `ADMIN_API_KEY` set in production
- ⚠️ M4: Review video recorded

### Apple / IAP / RevenueCat
- ✅ Subscription auto-renewal clearly disclosed
- ✅ Trial period disclosed
- ✅ Restore Purchases available
- ✅ Terms & Privacy links on paywall
- ✅ Cancel anytime messaging accurate
- ⚠️ A1: EAS credentials filled
- ⚠️ A2: Screenshots uploaded
- ⚠️ A3: Privacy nutrition label complete
- ⚠️ A4: IAP products configured in ASC

### Security
- ✅ Rate limiting on all expensive endpoints
- ✅ SSRF protection on user-supplied URLs
- ✅ No secrets logged
- ✅ Admin routes key-protected; 503 if unconfigured
- ✅ CORS restricted to known origins
- ✅ Helmet security headers
- ✅ 20 MB body limit
- ✅ All user data scoped by auth-derived userId
- ✅ Cascade delete verified for all 19 userId-linked tables
- ⚠️ S1: Key rotation check (review git history)
- ⚠️ S3: RevenueCat webhook secret in production

### Copy & Compliance
- ✅ No fabricated testimonials or fake statistics
- ✅ No "fully protected" / "100% secure" claims
- ✅ No "continuously monitors" / "instantly alerted" overstatements
- ✅ "Potential match" language used (not "Confirmed Impersonator")
- ✅ Terms acceptance checkbox (unchecked by default)
- ✅ Terms acceptance recorded server-side with version
- ✅ "Sophie Rain" placeholder removed
- ✅ "SOC 2 ready" claim removed
- ✅ Subscription "continuously" copy corrected throughout

### Data & Privacy
- ✅ terms_accepted_at + terms_version columns added to users table
- ✅ POST /me/terms endpoint records acceptance
- ✅ Account deletion removes Clerk user + all DB rows
- ✅ Cascade delete on all child tables verified
- ⚠️ P1 LEGAL: Biometric processing disclosure needed
- ⚠️ P2 LEGAL: Privacy Policy gaps documented

---

## FINAL RELEASE GATE

**WOULD YOU SUBMIT THIS BUILD TO META AND APPLE TODAY?**

**NO** — not yet. All P0/P1 *engineering* issues have been fixed in this session. However, the following *non-engineering* blockers remain:

### Blocking Items Before Submission

1. **M1** — Register `com.getrook.app://oauth` redirect URI in Meta App Dashboard (both products)
2. **M2** — Add reviewer test accounts as Testers in Meta Developer Console
3. **M3** — Set `ADMIN_API_KEY` in production deployment
4. **M4** — Record Meta App Review demonstration video
5. **A1** — Fill EAS `eas.json` with Apple credentials
6. **A2** — Upload App Store screenshots
7. **A3** — Complete App Privacy nutrition label in App Store Connect
8. **A4** — Configure IAP products in App Store Connect
9. **LEGAL** — Review biometric/facial processing compliance before launch in US (BIPA/CUBI) and EU (GDPR)
10. **DEPLOY** — Deploy latest code to production (`tryrook.app`) — the `ON CONFLICT DO NOTHING` reconnect fix and all audit fixes are currently only in dev

---

## TOP 10 RISKS (Ranked Highest to Lowest)

| Rank | Risk | Type |
|------|------|------|
| 1 | **Meta App Review rejection**: `com.getrook.app://oauth` redirect URI not registered in Meta dashboard → OAuth callback fails for reviewer | Submission blocker |
| 2 | **No reviewer test account**: Meta reviewer cannot complete Instagram connection if test account not added as Tester | Submission blocker |
| 3 | **Biometric processing compliance**: pHash + Google Vision embeddings from photos may trigger BIPA/GDPR without proper disclosure and consent | Legal / privacy |
| 4 | **Production not deployed**: All engineering fixes including reconnect-crash fix are in dev only; production (`tryrook.app`) is running old code | Reliability |
| 5 | **Scan accuracy false positives**: High-similarity but unrelated lookalike accounts may be surfaced; user sees them as threats. No confirmation before they appear in threat list. | User trust / Meta review |
| 6 | **Apple Privacy label incomplete**: Incomplete or inaccurate App Privacy nutrition label leads to App Store rejection | Submission blocker |
| 7 | **RevenueCat IAP products not in ASC**: Paywall works but purchases fail in production if products not created in App Store Connect | Revenue / review |
| 8 | **Legal gaps in Terms/Privacy**: Missing biometric, false-positive liability, and retention disclosures could expose the company to regulatory action | Legal |
| 9 | **Scan quota race condition**: Non-atomic quota check could allow a small window of duplicate scans under concurrent requests, causing unexpected API cost | Cost / reliability |
| 10 | **X token refresh noise**: X API credentials at current access level fail 403 on bearer token fetch — logged repeatedly as WARN; should not impact core functionality but may confuse support diagnosis | Operational |
