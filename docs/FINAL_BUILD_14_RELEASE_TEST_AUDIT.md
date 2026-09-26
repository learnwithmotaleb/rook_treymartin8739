# Rook Build 14 — Final Release Testing Audit

**Audit date:** September 21, 2026  
**Release:** iOS 1.0.0, build 14  
**Purpose:** Release-blocking verification before the next Apple App Review submission  
**Decision:** **DO NOT SUBMIT** until every `BLOCKER` and `REQUIRED` item below has recorded passing evidence.

---

## 1. Audit rules

This is the authoritative test checklist for build 14. It replaces the functional test steps in `docs/reviewer-test-script.md` where that document conflicts with the current app.

### Status legend

- `PASS — automated`: Verified in the browser/API release-candidate test on September 21, 2026.
- `PASS — configuration`: Verified through App Store Connect, Clerk, or backend APIs.
- `REQUIRED — device`: Must be tested on the signed build on a physical iPhone.
- `REQUIRED — manual`: Must be verified in App Store Connect, production, or an external provider.
- `BLOCKER`: Submission is forbidden until the item passes.
- `N/A`: Confirmed not present in the submitted build; reviewer instructions and metadata must not mention it.

### Evidence required for every manual pass

Record:

1. Tester name
2. Date and time
3. Device model and iOS version
4. Build number (`14`)
5. Account type used
6. Expected result
7. Actual result
8. Screenshot or screen recording
9. Relevant API/request status or server log when applicable
10. Final `PASS` or `FAIL`

Do not mark an item passed because the code exists, a simulator worked, or an older build worked.

---

## 2. Current release state

- [x] `PASS — configuration` Build 14 exists in App Store Connect.
- [x] `PASS — configuration` Build 14 processing state is `VALID`.
- [x] `PASS — configuration` Build 14 is not expired.
- [x] `PASS — configuration` Build 13 remains attached to the rejected version.
- [x] `PASS — configuration` Build 14 has **not** been attached or resubmitted.
- [x] `PASS — configuration` Dedicated App Review account bootstrap and fixture seeding return success.
- [x] `PASS — configuration` Dedicated App Review one-time Clerk sign-in ticket is issued.
- [ ] `BLOCKER` Install build 14 from TestFlight on a physical iPhone.
- [ ] `BLOCKER` Complete all native-device tests in sections 5–16.
- [ ] `BLOCKER` Resolve every App Store metadata/rejection item in sections 17–20.
- [ ] `BLOCKER` Repeat the final reviewer walkthrough on a clean device using only the credentials and instructions Apple will receive.

---

## 3. Apple review requirements that control this audit

Apple's current App Review Guidelines require:

- The app to be tested for crashes and bugs.
- Complete and accurate metadata.
- Current reviewer contact information.
- Full access to every account-based feature through an active demo account or fully featured demo mode.
- All backend services to remain live during review.
- Detailed review notes for non-obvious features and in-app purchases.
- Restorable purchases to have a restore mechanism.
- Auto-renewable subscriptions to provide ongoing value and work across supported devices.
- Apps that support account creation to offer in-app account deletion.
- Social-login apps to comply with Apple's login-service rules, including Sign in with Apple where applicable.
- Privacy disclosures and permission prompts to match the data actually collected and used.

Authoritative source:  
https://developer.apple.com/app-store/review/guidelines

The checklist also incorporates the rejection materials in `attached_assets/`, especially:

- Broken or inaccessible demo credentials
- Broken first-time Sign in with Apple
- iPad review behavior
- Face/photo data questionnaire
- Age-rating selections
- Subscription review access
- Promotional in-app purchase artwork

---

## 4. Test accounts and environments

Prepare these accounts before device testing:

### A. Clean first-time user

- Never used Rook
- No onboarding state
- No connected accounts
- No subscription
- Eligible for introductory offer if the app presents one
- Used for Apple, Google, email signup, permission, onboarding, and purchase tests

### B. Returning free user

- Onboarding complete
- No active subscription
- Known scan quota state
- Used for sign-out, returning sign-in, restore-none, and quota tests

### C. Active Premium user

- Active RevenueCat `premium` entitlement
- Used to test server-tier hydration, daily monitoring copy, unlimited features, cancellation management, and cross-device restore

### D. Expired/cancelled subscriber

- Previously purchased
- Entitlement expired or cancelled
- Used to prove the paywall and purchase flow are available to Apple
- This is specifically important because prior review requested an expired/no-subscription state

### E. Dedicated App Review user

- Credentials stored only in App Store Connect's protected App Review Information fields
- Fixture seeding succeeds
- Reviewer signs in without needing access to a private inbox
- Account exposes the features described in review notes

### F. Meta test identities

- Instagram Business/Creator tester
- Facebook test user
- Added to the correct Meta app roles
- Credentials stored only in Meta reviewer instructions

### Environment checks

- [ ] `BLOCKER` Production API is deployed and healthy.
- [ ] `BLOCKER` Production Clerk tenant contains or can bootstrap the reviewer identity.
- [ ] `BLOCKER` RevenueCat production offering is current and returns monthly and annual packages.
- [ ] `BLOCKER` App Store subscription products are cleared for submission with the app version.
- [ ] `BLOCKER` Push credentials work in the distribution build.
- [ ] `BLOCKER` Meta and X redirect URLs exactly match production and the mobile deep link.
- [ ] `BLOCKER` Review support inbox is actively monitored throughout review.
- [ ] `BLOCKER` No test requires the reviewer to receive an email or OTP in an inbox they cannot access.

---

## 5. Installation, launch, and global reliability

- [ ] `REQUIRED — device` Fresh TestFlight install launches without crash.
- [ ] `REQUIRED — device` App icon, launch screen, product name, and version are correct.
- [ ] `REQUIRED — device` Animated splash completes and never loops.
- [ ] `REQUIRED — device` Slow startup exits to a clear recoverable state rather than a blank screen.
- [ ] `REQUIRED — device` Force quit and reopen preserve the correct signed-in/signed-out state.
- [ ] `REQUIRED — device` Background then foreground refreshes account state without duplicate navigation.
- [ ] `REQUIRED — device` Airplane mode shows a useful error and does not crash.
- [ ] `REQUIRED — device` API timeout produces a recoverable message, not an infinite spinner.
- [ ] `REQUIRED — device` Expired session returns safely to authentication.
- [ ] `REQUIRED — device` Invalid/deleted deep-link target shows a safe not-found state.
- [ ] `REQUIRED — device` No screen is obscured by the notch, home indicator, keyboard, or safe area.
- [ ] `REQUIRED — device` Dynamic text does not clip essential labels or buttons.
- [ ] `REQUIRED — manual` Confirm the App Store version does not support iPad if iPad is intentionally unsupported.
- [ ] `BLOCKER` If Apple can still install on iPad, run this complete audit on the iPad class used in the rejection.

---

## 6. Authentication and account creation

### Email/password

- [ ] `REQUIRED — device` Create account with valid email and password.
- [ ] `REQUIRED — device` Terms and Privacy acceptance is initially unchecked.
- [ ] `REQUIRED — device` Account creation is blocked until required agreements are accepted.
- [ ] `REQUIRED — device` Age requirement is stated consistently with policy and App Store rating.
- [ ] `REQUIRED — device` Verification code screen appears.
- [ ] `REQUIRED — device` Correct code succeeds.
- [ ] `REQUIRED — device` Wrong code shows an actionable error.
- [ ] `REQUIRED — device` Resend works and cannot be abused by rapid taps.
- [ ] `REQUIRED — device` Weak/invalid password errors are understandable.
- [ ] `REQUIRED — device` Existing email follows the correct sign-in/recovery path.
- [ ] `REQUIRED — device` Sign in with valid credentials reaches the correct destination.
- [ ] `REQUIRED — device` Invalid credentials do not reveal whether an account exists beyond intended Clerk behavior.

### Sign in with Apple — prior rejection focus

- [ ] `BLOCKER` First-time Sign in with Apple completes on build 14.
- [ ] `BLOCKER` Apple authorization creates the Clerk user when the identity is new.
- [ ] `BLOCKER` The newly created Apple user is not rejected as a nonexistent Rook account.
- [ ] `BLOCKER` The new Clerk session becomes active immediately.
- [ ] `BLOCKER` Terms, Privacy, and age acknowledgements are captured in the same first-time flow.
- [ ] `BLOCKER` Hide My Email works.
- [ ] `BLOCKER` User cancelling Apple's sheet returns safely to Auth.
- [ ] `BLOCKER` Apple error/denial produces a useful error and allows retry.
- [ ] `BLOCKER` Returning Apple user skips onboarding and lands in the app.
- [ ] `BLOCKER` Apple account with revoked app access can authenticate or recover cleanly.
- [ ] `BLOCKER` Account deletion removes the Rook account and handles Apple-account deletion requirements.

### Sign in with Google

- [ ] `BLOCKER` First-time Google sign-in creates and activates the user.
- [ ] `BLOCKER` First-time Google user completes Terms, Privacy, and age acknowledgements.
- [ ] `BLOCKER` Returning Google user skips onboarding.
- [ ] `REQUIRED — device` Cancelling Google sign-in returns safely to Auth.
- [ ] `REQUIRED — device` Provider error can be retried.

### Dedicated App Review access

- [x] `PASS — configuration` Review endpoint validates the configured access code.
- [x] `PASS — configuration` Stale configured reviewer ID recovers by resolving or creating the protected reviewer identity.
- [x] `PASS — configuration` Reviewer metadata marker is applied server-side.
- [x] `PASS — configuration` Reviewer fixture seeding succeeds.
- [x] `PASS — configuration` One-time sign-in ticket is issued.
- [ ] `BLOCKER` Use the exact App Store Connect reviewer identifier and access code in build 14 on a clean device.
- [ ] `BLOCKER` Reviewer sign-in requires no private inbox or second-factor access.
- [ ] `BLOCKER` Reviewer reaches the intended Dashboard within 15 seconds.
- [ ] `BLOCKER` Reviewer data and tier exactly match the final review notes.
- [ ] `BLOCKER` Reviewer access remains available for the entire review window.

---

## 7. Onboarding

- [x] `PASS — automated` Fresh user reaches onboarding.
- [x] `PASS — automated` Skip path records onboarding completion.
- [x] `PASS — automated` Zero-input onboarding does not start or consume a scan.
- [x] `PASS — automated` Zero-input onboarding shows no fabricated threats.
- [x] `PASS — automated` Zero-threat paywall still hydrates the subscription.
- [x] `PASS — automated` Zero-threat paywall does not fetch/display a threat preview.
- [x] `PASS — automated` “Continue with free plan” reaches the main app.
- [x] `PASS — automated` Returning user does not replay onboarding.
- [ ] `REQUIRED — device` Complete every screen using Back and Continue.
- [ ] `REQUIRED — device` Interrupt onboarding by force quit, then resume.
- [ ] `REQUIRED — device` Enter username only; real name remains blank and no placeholder is submitted.
- [ ] `REQUIRED — device` Enter real name only.
- [ ] `REQUIRED — device` Enter both username and real name.
- [ ] `REQUIRED — device` Enter neither; no scan starts and quota remains unused.
- [ ] `REQUIRED — device` Test leading/trailing spaces.
- [ ] `REQUIRED — device` Test `@username` and username without `@`.
- [ ] `REQUIRED — device` Test Unicode, punctuation, emoji, pasted profile URL, and very long input.
- [ ] `REQUIRED — device` Test harmless SQL/XSS-like strings; input is treated as text.
- [ ] `REQUIRED — device` No placeholder/example identity influences scan parameters.
- [ ] `REQUIRED — device` Photo step explains why access is requested before the OS prompt.
- [ ] `REQUIRED — device` Photo permission allow, deny, cancel, and retry all work.
- [ ] `REQUIRED — device` Onboarding cannot trap a user on a paywall.
- [ ] `REQUIRED — device` Monthly/annual pricing and trial text match StoreKit exactly.
- [ ] `REQUIRED — device` No fake countdown, fabricated social proof, simulated finding, or guaranteed-protection claim appears.

---

## 8. Dashboard

- [x] `PASS — automated` Clean account shows zero threats.
- [x] `PASS — automated` Clean account shows `Last scan: Never`.
- [x] `PASS — automated` Clean account does not show another user's profile or scan data.
- [ ] `REQUIRED — device` Loading state renders without layout breakage.
- [ ] `REQUIRED — device` Pull/foreground refresh updates data once.
- [ ] `REQUIRED — device` Security score and explanation agree.
- [ ] `REQUIRED — device` Threat count equals Alerts.
- [ ] `REQUIRED — device` Monitored account and photo counts equal Profile/Scan.
- [ ] `REQUIRED — device` Upgrade CTA opens the paywall.
- [ ] `REQUIRED — device` Connect-account CTA opens the platform picker.
- [ ] `REQUIRED — device` Tapping a recent threat opens the correct threat.
- [ ] `REQUIRED — device` Offline/error state is recoverable.
- [ ] `REQUIRED — device` Reviewer fixture values match the final reviewer notes exactly.

---

## 9. Connected accounts and OAuth

### Platform picker

- [ ] `REQUIRED — device` Instagram, Facebook, and X appear as supported.
- [ ] `REQUIRED — device` TikTok, LinkedIn, YouTube, and Snapchat are clearly non-actionable if marked Coming Soon.
- [ ] `REQUIRED — device` Cancel/back returns without changing data.

### Instagram

- [ ] `BLOCKER` OAuth opens in the expected secure browser.
- [ ] `BLOCKER` Only the approved current scope is requested.
- [ ] `BLOCKER` Successful callback returns to Rook.
- [ ] `BLOCKER` Account appears connected with correct identity.
- [ ] `REQUIRED — device` User denial returns safely and can retry.
- [ ] `REQUIRED — device` Browser cancellation returns safely.
- [ ] `REQUIRED — device` Expired/used OAuth state is rejected.
- [ ] `REQUIRED — device` Disconnect removes tokens and derived account data as disclosed.

### Facebook

- [ ] `BLOCKER` OAuth requests only current approved permissions.
- [ ] `BLOCKER` Successful callback returns to Rook and marks the account connected.
- [ ] `REQUIRED — device` Denial, cancellation, expired state, and retry work.
- [ ] `REQUIRED — device` Disconnect removes tokens and derived data.

### X

- [ ] `BLOCKER` PKCE OAuth opens and returns through the Rook deep link.
- [ ] `REQUIRED — device` Cancellation and invalid state are recoverable.
- [ ] `REQUIRED — device` Refresh token expiry marks the account for reconnection.
- [ ] `REQUIRED — device` Disconnect succeeds.

### Manage accounts

- [ ] `REQUIRED — device` Active, pending, and reconnect-needed states are accurate.
- [ ] `REQUIRED — device` Edit/save updates the account.
- [ ] `REQUIRED — device` Remove confirmation can be cancelled.
- [ ] `REQUIRED — device` Confirmed remove updates Dashboard, Profile, Scan, and quota context.
- [ ] `REQUIRED — device` Removing the last account leaves a valid empty state.
- [ ] `REQUIRED — device` Account A's data never appears for account B after account switching.

---

## 10. Scan engine

- [x] `PASS — automated` Empty identity profile does not invoke discovery.
- [x] `PASS — automated` Empty identity profile does not consume free quota.
- [x] `PASS — automated` Empty profiles do not share a cache fingerprint.
- [x] `PASS — automated` Clean user retains `0/1` free scan usage.
- [ ] `BLOCKER` Username-only scan completes without injecting a default real name.
- [ ] `BLOCKER` Real-name-only scan completes.
- [ ] `BLOCKER` Username + real name + photo scan completes.
- [ ] `BLOCKER` Scan progress advances and labels are truthful.
- [ ] `BLOCKER` Scan completes with either honest findings or an honest clean result.
- [ ] `BLOCKER` Findings belong only to the tested identity.
- [ ] `REQUIRED — device` Duplicate taps create one scan, not multiple jobs.
- [ ] `REQUIRED — device` Leaving and returning to Scan restores the active job state.
- [ ] `REQUIRED — device` Backgrounding and resuming preserves progress.
- [ ] `REQUIRED — device` No-account/no-input state explains what is needed.
- [ ] `REQUIRED — device` Free scan quota increments exactly once after a real scan.
- [ ] `REQUIRED — device` Exhausted free quota opens the correct paywall.
- [ ] `REQUIRED — device` Premium scan is not incorrectly quota blocked.
- [ ] `REQUIRED — device` API timeout/failure produces an error with retry.
- [ ] `REQUIRED — device` Stale connected-account token requests reconnection rather than silently failing.
- [ ] `REQUIRED — manual` Run a scan while the database/API is under expected production load.
- [ ] `REQUIRED — manual` Confirm scheduled Premium scans run at the documented cadence.
- [ ] `REQUIRED — manual` Confirm notifications are not sent for false or suppressed findings.

---

## 11. Alerts, threat detail, resolution, reporting, and sharing

- [ ] `BLOCKER` Reviewer account shows the exact number and severity of threats described in review notes.
- [ ] `REQUIRED — device` Alerts loading, empty, error, and populated states render.
- [ ] `REQUIRED — device` All/High/Medium/Low filters return correct items.
- [ ] `REQUIRED — device` Resolved/unresolved state is accurate.
- [ ] `REQUIRED — device` Threat detail opens the selected threat.
- [ ] `REQUIRED — device` Invalid/deleted/other-user threat IDs do not expose data.
- [ ] `REQUIRED — device` “Yours” and “Theirs” images are correct and load.
- [ ] `REQUIRED — device` Match score, severity, evidence, detected signals, and AI explanation agree.
- [ ] `REQUIRED — device` Copy says potential match/suspicious result rather than confirmed criminal conduct.
- [ ] `REQUIRED — device` Report action opens the correct official platform guidance.
- [ ] `REQUIRED — device` Resolve confirmation can be cancelled.
- [ ] `REQUIRED — device` Confirmed resolve updates threat detail, Alerts, Dashboard, and score.
- [ ] `REQUIRED — device` Suppressed/resolved account does not immediately reappear from cache.
- [ ] `REQUIRED — device` Native Share opens the iOS share sheet with correct content.
- [ ] `REQUIRED — device` Cancelling Share returns safely.
- [ ] `REQUIRED — device` Share failure displays a recoverable error.
- [ ] `REQUIRED — device` No downloadable-report claim appears unless the feature actually exists.

---

## 12. Photo monitoring and photo permissions

- [ ] `BLOCKER` Photo Monitor opens in build 14.
- [ ] `BLOCKER` Photo-library prompt text matches actual use.
- [ ] `REQUIRED — device` Allow permission permits selection.
- [ ] `REQUIRED — device` Deny permission shows a clear explanation and Settings path.
- [ ] `REQUIRED — device` Revoke permission in Settings, return, and recover.
- [ ] `REQUIRED — device` Cancel picker returns safely.
- [ ] `REQUIRED — device` Valid photo uploads/processes once.
- [ ] `REQUIRED — device` Oversized, corrupt, or unsupported image is rejected clearly.
- [ ] `REQUIRED — device` Offline photo search fails safely.
- [ ] `REQUIRED — device` No-match result is honest.
- [ ] `REQUIRED — device` Match result links to correct evidence.
- [ ] `REQUIRED — manual` Verify exactly what photo bytes, URLs, hashes, and embeddings are stored.
- [ ] `REQUIRED — manual` Verify third-party processing matches the Privacy Policy.
- [ ] `REQUIRED — manual` Verify raw photos are not retained beyond the disclosed period.

---

## 13. Subscription, purchase, restore, and entitlement

- [x] `PASS — automated` Zero-threat onboarding still hydrates the server plan.
- [x] `PASS — automated` Free-plan close action is accessible.
- [x] `PASS — automated` Server-granted tier can hydrate the paywall.
- [ ] `BLOCKER` StoreKit returns monthly and annual products in build 14.
- [ ] `BLOCKER` Product names, localized price, period, and trial match App Store Connect.
- [ ] `BLOCKER` Terms and Privacy links open before purchase.
- [ ] `BLOCKER` Auto-renewal and cancellation copy is visible and accurate.
- [ ] `BLOCKER` Monthly purchase completes in sandbox/TestFlight.
- [ ] `BLOCKER` Annual purchase completes in sandbox/TestFlight.
- [ ] `BLOCKER` RevenueCat entitlement becomes `premium`.
- [ ] `BLOCKER` Server tier syncs after purchase.
- [ ] `BLOCKER` Premium features unlock without relaunch.
- [ ] `BLOCKER` Restore Purchases restores an eligible purchase.
- [ ] `BLOCKER` Restore with no purchase shows a clear non-success result.
- [ ] `BLOCKER` Expired/cancelled subscriber sees the purchase flow.
- [ ] `REQUIRED — device` User-cancelled purchase is not shown as an error purchase.
- [ ] `REQUIRED — device` Declined, pending, offline, and StoreKit-unavailable states are recoverable.
- [ ] `REQUIRED — device` Already-Premium user does not see a misleading purchase CTA.
- [ ] `REQUIRED — device` Manage Subscription opens Apple's subscription management.
- [ ] `REQUIRED — device` Account deletion warns that store billing must be cancelled separately.
- [ ] `REQUIRED — manual` RevenueCat webhook updates renewal, cancellation, expiration, and billing-problem states.
- [ ] `REQUIRED — manual` Subscription works on a second device using the same Apple account.

---

## 14. Notifications, background behavior, and deep links

- [ ] `BLOCKER` Notification pre-prompt appears at an appropriate time.
- [ ] `REQUIRED — device` “Not Now” leaves the app usable.
- [ ] `BLOCKER` Enable triggers the native iOS permission prompt.
- [ ] `BLOCKER` Allowed permission registers a production Expo push token.
- [ ] `REQUIRED — device` Denied permission shows a Settings recovery path.
- [ ] `REQUIRED — device` Revoking permission is reflected when returning to the app.
- [ ] `REQUIRED — device` Per-category toggles persist.
- [ ] `REQUIRED — device` New-threat notification is delivered.
- [ ] `REQUIRED — device` Scan-complete notification is delivered.
- [ ] `REQUIRED — device` Weekly reminder behavior matches its setting.
- [ ] `BLOCKER` Tapping a threat notification opens the correct threat from foreground.
- [ ] `BLOCKER` Tapping it from background opens the correct threat.
- [ ] `BLOCKER` Tapping it from terminated state opens the correct threat.
- [ ] `REQUIRED — device` Alerts, Scan, and Dashboard payloads route correctly.
- [ ] `REQUIRED — device` Unknown payload falls back safely.
- [ ] `REQUIRED — device` Deleted-threat payload does not crash.
- [ ] `REQUIRED — device` Signed-out notification target does not expose private data.
- [ ] `REQUIRED — device` Sign out/account switch deregisters or reassigns the token correctly.

---

## 15. Profile, settings, privacy, and legal

### Profile and settings

- [ ] `REQUIRED — device` Profile name, handle, tier, avatar, account count, and identity badge are correct.
- [ ] `REQUIRED — device` Edit profile saves valid changes.
- [ ] `REQUIRED — device` Cancel edit discards changes.
- [ ] `REQUIRED — device` Avatar allow/deny/cancel/upload/error paths work.
- [ ] `REQUIRED — device` Security screen contains no nonfunctional controls.
- [ ] `REQUIRED — device` Notification settings reflect native permission state.
- [ ] `REQUIRED — device` Support opens a working support path.
- [ ] `REQUIRED — device` Terms and Privacy render inside the app.
- [ ] `REQUIRED — manual` Public Support, Privacy, and Terms URLs load over HTTPS.

### Photo consent and privacy

- [x] `PASS — automated` Consent can be enabled.
- [x] `PASS — automated` Consent can be withdrawn.
- [x] `PASS — automated` Confirmed withdrawal calls deletion exactly once.
- [x] `PASS — automated` Cancel does not trigger deletion.
- [x] `PASS — automated` Re-enabling clears stale withdrawal feedback.
- [x] `PASS — automated` Photo-data deletion endpoint succeeds.
- [x] `PASS — automated` Data export JSON downloads/returns.
- [ ] `REQUIRED — device` Consent notice is readable and not preselected.
- [ ] `REQUIRED — device` Withdrawing consent disables future photo scanning.
- [ ] `REQUIRED — manual` Verify photo-derived data is deleted within the disclosed time.
- [ ] `REQUIRED — manual` Verify backup-retention claims.
- [ ] `REQUIRED — manual` Verify data export includes every promised data category.
- [ ] `REQUIRED — manual` Verify users can reach a human to dispute a false result where required.

---

## 16. Sign out, returning access, and account deletion

- [x] `PASS — automated` Sign-out modal appears.
- [x] `PASS — automated` Cancel leaves the user signed in.
- [x] `PASS — automated` Confirmed sign-out returns to Auth.
- [x] `PASS — automated` Signed-out protected APIs return 401 with no user data.
- [x] `PASS — automated` Returning login bypasses onboarding.
- [x] `PASS — automated` Returning user preserves correct consent, threats, and quota.
- [x] `PASS — automated` Delete Account warning states permanence and separate store cancellation.
- [x] `PASS — automated` Cancel deletion leaves the account intact.
- [x] `PASS — automated` Confirmed deletion returns 204.
- [x] `PASS — automated` Clerk user deletion succeeds.
- [x] `PASS — automated` Post-delete notification cleanup cannot recreate the user.
- [x] `PASS — automated` App returns to Auth with no prior data.
- [ ] `BLOCKER` Repeat sign out and returning sign-in on physical build 14.
- [ ] `BLOCKER` Repeat full account deletion on physical build 14.
- [ ] `BLOCKER` Confirm same deleted identity is not silently treated as a returning account.
- [ ] `REQUIRED — manual` Verify no orphaned accounts, scans, threats, photos, tokens, subscriptions, fingerprints, or identity profiles remain.
- [ ] `REQUIRED — device` Re-registering the same email follows the intended first-time-user behavior.
- [ ] `REQUIRED — device` Delete while offline fails safely and does not falsely claim success.
- [ ] `REQUIRED — device` Delete with an active subscription preserves Apple's billing warning.

---

## 17. Reviewer walkthrough for the submitted build

Run this exact walkthrough after all feature tests pass:

1. Delete Rook from the test device.
2. Install build 14 from TestFlight.
3. Confirm the device has no prior Rook local state.
4. Launch Rook.
5. Use only the credentials and steps stored in App Store Connect.
6. Confirm reviewer access succeeds without email inbox access.
7. Confirm Dashboard loads within 15 seconds.
8. Confirm displayed score, threat count, accounts, photos, and tier exactly match review notes.
9. Open each seeded threat.
10. Verify evidence images, percentages, explanation, and report action.
11. Filter Alerts.
12. Start a scan and wait for completion.
13. Open Connect Account, verify the supported platform screen, then cancel unless review notes require live OAuth.
14. Open the paywall from an expired/free account.
15. Verify monthly, annual, trial, Restore Purchases, Terms, and Privacy.
16. Open Photo Monitor and verify permission behavior.
17. Open Privacy & Data, export data, and cancel destructive actions.
18. Open Support, Terms, and Privacy.
19. Sign out and sign back in.
20. Confirm there are no crashes, blank screens, infinite spinners, stale data, or inaccessible buttons.

### Obsolete reviewer-script steps

- [x] `PASS — documentation` Removed old **Tools tab**, **AI Scam Analyzer**, and related steps from the canonical reviewer instructions.
- [x] `PASS — documentation` Removed unverified seeded counts and match percentages from reviewer instructions and screenshot guidance.
- [x] `PASS — documentation` Reviewer instructions require live Sign in with Apple testing; a video is not a substitute.
- [x] `PASS — documentation` Reviewer instructions no longer limit Apple to a Cancel path when testing supported integrations.
- [x] `PASS — documentation` Removed `user_photos` as a current build-14 permission; Facebook is documented as `public_profile` only.
- [x] `PASS — documentation` Published one canonical build-14 reviewer script and labeled the conflicting legacy guide superseded.

---

## 18. App Store metadata and rejection-history audit

### Demo access — Guideline 2.1

- [ ] `BLOCKER` Replace stale credentials in App Store Connect.
- [ ] `BLOCKER` Validate the exact credentials on a clean device.
- [ ] `BLOCKER` Reviewer has full access to described functionality.
- [ ] `BLOCKER` Backend and fixture seeding remain live.
- [ ] `BLOCKER` Review notes explain the access-code flow clearly.

### Sign in with Apple — Guideline 2.1(a) / login rules

- [ ] `BLOCKER` Attach evidence that first-time Apple sign-in passes on build 14.
- [ ] `BLOCKER` Confirm supported-device availability so Apple cannot install on an untested iPad.
- [ ] `BLOCKER` If iPad remains available, include iPad evidence.

### Face/photo data questionnaire

- [ ] `BLOCKER` Answer what photo/face-related data is collected.
- [ ] `BLOCKER` Explain each purpose.
- [ ] `BLOCKER` List each third party receiving data.
- [ ] `BLOCKER` State storage format/location.
- [ ] `BLOCKER` State retention and deletion timing.
- [ ] `BLOCKER` Quote matching Privacy Policy sections.
- [ ] `BLOCKER` Confirm every statement against actual runtime/database behavior.
- [ ] `BLOCKER` Obtain legal review for biometric/privacy wording where needed.

### Age rating

- [x] `PASS — documentation` Release documents now distinguish the Apple/Google content-rating questionnaire from account eligibility and remove contradictory 4+/13+/18+ instructions.
- [x] `PASS — documentation` Active release documents consistently state the in-app signup, Terms, and Privacy minimum eligibility is 17.
- [ ] `BLOCKER` Confirm the App Store Connect age-rating questionnaire and any Age Assurance/In-App Controls selections in the console; repository documentation alone is not evidence of the submitted console state.

### Subscription and promoted IAP

- [ ] `BLOCKER` Provide Apple an expired/no-subscription path.
- [ ] `BLOCKER` Verify products and trials are reviewable in every enabled territory.
- [ ] `BLOCKER` Confirm subscription review images are unique, product-specific, and legible.
- [ ] `BLOCKER` Remove price text from promotional metadata/art where Apple disallows or has rejected it.
- [ ] `BLOCKER` Confirm the standard EULA URL appears where required.

### Metadata consistency

- [x] `PASS — documentation` Chose one subtitle and one secondary category in the canonical metadata file.
- [x] `PASS — documentation` Corrected the copyright year in the canonical metadata file.
- [x] `PASS — documentation` Replaced hard-coded screenshot dimensions with current App Store Connect device-family guidance.
- [x] `PASS — documentation` Confirmed Support, Marketing, and Privacy URLs are consistently documented.
- [x] `PASS — documentation` Revised the app description to match supported platforms and current functionality.
- [x] `PASS — documentation` Removed unsupported “track every place,” “instant,” “always,” and guaranteed-protection claims.
- [x] `PASS — documentation` Confirmed Coming Soon platforms are not described as currently functional.
- [ ] `BLOCKER` Confirm privacy nutrition labels match Clerk, RevenueCat, push, photos, Vision/OpenAI/search, and server processing.

---

## 19. Meta review audit

- [ ] `BLOCKER` Request only scopes used by build 14.
- [x] `PASS — code and documentation` Build 14 requests Facebook `public_profile` only and does not submit or describe `user_photos` as live.
- [ ] `BLOCKER` Verify Instagram and Facebook reviewer test identities and roles.
- [ ] `BLOCKER` Verify exact production callback URLs and mobile deep link.
- [ ] `BLOCKER` Complete live OAuth from the review build.
- [ ] `BLOCKER` Confirm permission explanations match actual processing.
- [ ] `BLOCKER` Confirm disconnect and account deletion remove Meta tokens/data.
- [ ] `BLOCKER` Confirm data-deletion callback is registered and works.
- [ ] `REQUIRED — manual` Record a supplemental current-build review video.
- [ ] `BLOCKER` Ensure the video does not replace live reviewer access.
- [ ] `BLOCKER` Retire or label older Meta instructions that tell reviewers to approve unavailable permissions.

---

## 20. Backend, security, and operations

- [ ] `REQUIRED — manual` Production health endpoint succeeds.
- [ ] `REQUIRED — manual` All authenticated user endpoints reject missing/invalid auth.
- [ ] `REQUIRED — manual` Cross-user IDs cannot read or mutate another user's data.
- [ ] `REQUIRED — manual` Reviewer/admin endpoints reject missing or invalid admin credentials.
- [ ] `REQUIRED — manual` Reviewer access is rate limited.
- [ ] `REQUIRED — manual` OAuth state is single-use and expires.
- [ ] `REQUIRED — manual` OAuth secrets/tokens are absent from logs.
- [ ] `REQUIRED — manual` RevenueCat webhook rejects invalid signatures.
- [ ] `REQUIRED — manual` Meta webhooks/deletion callbacks validate signatures.
- [ ] `REQUIRED — manual` Scan and photo endpoints enforce rate and payload limits.
- [ ] `REQUIRED — manual` Request-size and malformed-request handling is verified.
- [ ] `REQUIRED — manual` Scheduled jobs do not crash the API.
- [ ] `REQUIRED — manual` Database backup and restore procedure is known.
- [ ] `REQUIRED — manual` Production monitoring covers authentication, purchase, scan, OAuth, notification, and deletion errors.
- [ ] `REQUIRED — manual` No production secret is bundled into the client.
- [ ] `REQUIRED — manual` Dependency and static security scans have no unresolved critical/high release blocker.

---

## 21. Final go/no-go sign-off

### Automatic no-go conditions

Do not submit if any of these is true:

- Any `BLOCKER` is not passed.
- Any required physical-device flow was not run on build 14.
- Sign in with Apple was not tested as a genuinely new identity.
- Reviewer credentials were not tested from a clean install.
- Reviewer requires an inaccessible inbox or OTP.
- Purchase or Restore Purchases was not tested through StoreKit.
- Reviewer notes do not match the seeded account.
- App Store metadata or privacy answers conflict with the app.
- Build 14 is not the build attached to the final submission.
- Backend services are not production-ready and monitored.
- A test produced a crash, blank screen, infinite spinner, wrong-user data, fabricated result, duplicate charge, or incomplete deletion.

### Required approvals

- [ ] Engineering: all automated and API checks pass.
- [ ] iOS device tester: all build 14 native checks pass.
- [ ] Product: reviewer script matches build 14.
- [ ] Privacy/legal: photo/face data and retention answers approved.
- [ ] Operations: reviewer support and production monitoring ready.
- [ ] App Store Connect owner: metadata, age rating, privacy labels, IAPs, screenshots, and review notes verified.
- [ ] Final approver: authorizes attaching build 14.
- [ ] Final approver: authorizes submitting for review.

**Current decision:** `NO-GO — native-device and submission-metadata blockers remain open.`
# Rook Build 14 — Final Release Testing Audit

**Audit date:** September 21, 2026  
**Release:** iOS 1.0.0, build 14  
**Purpose:** Release-blocking verification before the next Apple App Review submission  
**Decision:** **DO NOT SUBMIT** until every `BLOCKER` and `REQUIRED` item below has recorded passing evidence.

---

## 1. Audit rules

This is the authoritative test checklist for build 14. It replaces the functional test steps in `docs/reviewer-test-script.md` where that document conflicts with the current app.

### Status legend

- `PASS — automated`: Verified in the browser/API release-candidate test on September 21, 2026.
- `PASS — configuration`: Verified through App Store Connect, Clerk, or backend APIs.
- `REQUIRED — device`: Must be tested on the signed build on a physical iPhone.
- `REQUIRED — manual`: Must be verified in App Store Connect, production, or an external provider.
- `BLOCKER`: Submission is forbidden until the item passes.
- `N/A`: Confirmed not present in the submitted build; reviewer instructions and metadata must not mention it.

### Evidence required for every manual pass

Record:

1. Tester name
2. Date and time
3. Device model and iOS version
4. Build number (`14`)
5. Account type used
6. Expected result
7. Actual result
8. Screenshot or screen recording
9. Relevant API/request status or server log when applicable
10. Final `PASS` or `FAIL`

Do not mark an item passed because the code exists, a simulator worked, or an older build worked.

---

## 2. Current release state

- [x] `PASS — configuration` Build 14 exists in App Store Connect.
- [x] `PASS — configuration` Build 14 processing state is `VALID`.
- [x] `PASS — configuration` Build 14 is not expired.
- [x] `PASS — configuration` Build 13 remains attached to the rejected version.
- [x] `PASS — configuration` Build 14 has **not** been attached or resubmitted.
- [x] `PASS — configuration` Dedicated App Review account bootstrap and fixture seeding return success.
- [x] `PASS — configuration` Dedicated App Review one-time Clerk sign-in ticket is issued.
- [ ] `BLOCKER` Install build 14 from TestFlight on a physical iPhone.
- [ ] `BLOCKER` Complete all native-device tests in sections 5–16.
- [ ] `BLOCKER` Resolve every App Store metadata/rejection item in sections 17–20.
- [ ] `BLOCKER` Repeat the final reviewer walkthrough on a clean device using only the credentials and instructions Apple will receive.

---

## 3. Apple review requirements that control this audit

Apple's current App Review Guidelines require:

- The app to be tested for crashes and bugs.
- Complete and accurate metadata.
- Current reviewer contact information.
- Full access to every account-based feature through an active demo account or fully featured demo mode.
- All backend services to remain live during review.
- Detailed review notes for non-obvious features and in-app purchases.
- Restorable purchases to have a restore mechanism.
- Auto-renewable subscriptions to provide ongoing value and work across supported devices.
- Apps that support account creation to offer in-app account deletion.
- Social-login apps to comply with Apple's login-service rules, including Sign in with Apple where applicable.
- Privacy disclosures and permission prompts to match the data actually collected and used.

Authoritative source:  
https://developer.apple.com/app-store/review/guidelines

The checklist also incorporates the rejection materials in `attached_assets/`, especially:

- Broken or inaccessible demo credentials
- Broken first-time Sign in with Apple
- iPad review behavior
- Face/photo data questionnaire
- Age-rating selections
- Subscription review access
- Promotional in-app purchase artwork

---

## 4. Test accounts and environments

Prepare these accounts before device testing:

### A. Clean first-time user

- Never used Rook
- No onboarding state
- No connected accounts
- No subscription
- Eligible for introductory offer if the app presents one
- Used for Apple, Google, email signup, permission, onboarding, and purchase tests

### B. Returning free user

- Onboarding complete
- No active subscription
- Known scan quota state
- Used for sign-out, returning sign-in, restore-none, and quota tests

### C. Active Premium user

- Active RevenueCat `premium` entitlement
- Used to test server-tier hydration, daily monitoring copy, unlimited features, cancellation management, and cross-device restore

### D. Expired/cancelled subscriber

- Previously purchased
- Entitlement expired or cancelled
- Used to prove the paywall and purchase flow are available to Apple
- This is specifically important because prior review requested an expired/no-subscription state

### E. Dedicated App Review user

- Credentials stored only in App Store Connect's protected App Review Information fields
- Fixture seeding succeeds
- Reviewer signs in without needing access to a private inbox
- Account exposes the features described in review notes

### F. Meta test identities

- Instagram Business/Creator tester
- Facebook test user
- Added to the correct Meta app roles
- Credentials stored only in Meta reviewer instructions

### Environment checks

- [ ] `BLOCKER` Production API is deployed and healthy.
- [ ] `BLOCKER` Production Clerk tenant contains or can bootstrap the reviewer identity.
- [ ] `BLOCKER` RevenueCat production offering is current and returns monthly and annual packages.
- [ ] `BLOCKER` App Store subscription products are cleared for submission with the app version.
- [ ] `BLOCKER` Push credentials work in the distribution build.
- [ ] `BLOCKER` Meta and X redirect URLs exactly match production and the mobile deep link.
- [ ] `BLOCKER` Review support inbox is actively monitored throughout review.
- [ ] `BLOCKER` No test requires the reviewer to receive an email or OTP in an inbox they cannot access.

---

## 5. Installation, launch, and global reliability

- [ ] `REQUIRED — device` Fresh TestFlight install launches without crash.
- [ ] `REQUIRED — device` App icon, launch screen, product name, and version are correct.
- [ ] `REQUIRED — device` Animated splash completes and never loops.
- [ ] `REQUIRED — device` Slow startup exits to a clear recoverable state rather than a blank screen.
- [ ] `REQUIRED — device` Force quit and reopen preserve the correct signed-in/signed-out state.
- [ ] `REQUIRED — device` Background then foreground refreshes account state without duplicate navigation.
- [ ] `REQUIRED — device` Airplane mode shows a useful error and does not crash.
- [ ] `REQUIRED — device` API timeout produces a recoverable message, not an infinite spinner.
- [ ] `REQUIRED — device` Expired session returns safely to authentication.
- [ ] `REQUIRED — device` Invalid/deleted deep-link target shows a safe not-found state.
- [ ] `REQUIRED — device` No screen is obscured by the notch, home indicator, keyboard, or safe area.
- [ ] `REQUIRED — device` Dynamic text does not clip essential labels or buttons.
- [ ] `REQUIRED — manual` Confirm the App Store version does not support iPad if iPad is intentionally unsupported.
- [ ] `BLOCKER` If Apple can still install on iPad, run this complete audit on the iPad class used in the rejection.

---

## 6. Authentication and account creation

### Email/password

- [ ] `REQUIRED — device` Create account with valid email and password.
- [ ] `REQUIRED — device` Terms and Privacy acceptance is initially unchecked.
- [ ] `REQUIRED — device` Account creation is blocked until required agreements are accepted.
- [ ] `REQUIRED — device` Age requirement is stated consistently with policy and App Store rating.
- [ ] `REQUIRED — device` Verification code screen appears.
- [ ] `REQUIRED — device` Correct code succeeds.
- [ ] `REQUIRED — device` Wrong code shows an actionable error.
- [ ] `REQUIRED — device` Resend works and cannot be abused by rapid taps.
- [ ] `REQUIRED — device` Weak/invalid password errors are understandable.
- [ ] `REQUIRED — device` Existing email follows the correct sign-in/recovery path.
- [ ] `REQUIRED — device` Sign in with valid credentials reaches the correct destination.
- [ ] `REQUIRED — device` Invalid credentials do not reveal whether an account exists beyond intended Clerk behavior.

### Sign in with Apple — prior rejection focus

- [ ] `BLOCKER` First-time Sign in with Apple completes on build 14.
- [ ] `BLOCKER` Apple authorization creates the Clerk user when the identity is new.
- [ ] `BLOCKER` The newly created Apple user is not rejected as a nonexistent Rook account.
- [ ] `BLOCKER` The new Clerk session becomes active immediately.
- [ ] `BLOCKER` Terms, Privacy, and age acknowledgements are captured in the same first-time flow.
- [ ] `BLOCKER` Hide My Email works.
- [ ] `BLOCKER` User cancelling Apple's sheet returns safely to Auth.
- [ ] `BLOCKER` Apple error/denial produces a useful error and allows retry.
- [ ] `BLOCKER` Returning Apple user skips onboarding and lands in the app.
- [ ] `BLOCKER` Apple account with revoked app access can authenticate or recover cleanly.
- [ ] `BLOCKER` Account deletion removes the Rook account and handles Apple-account deletion requirements.

### Sign in with Google

- [ ] `BLOCKER` First-time Google sign-in creates and activates the user.
- [ ] `BLOCKER` First-time Google user completes Terms, Privacy, and age acknowledgements.
- [ ] `BLOCKER` Returning Google user skips onboarding.
- [ ] `REQUIRED — device` Cancelling Google sign-in returns safely to Auth.
- [ ] `REQUIRED — device` Provider error can be retried.

### Dedicated App Review access

- [x] `PASS — configuration` Review endpoint validates the configured access code.
- [x] `PASS — configuration` Stale configured reviewer ID recovers by resolving or creating the protected reviewer identity.
- [x] `PASS — configuration` Reviewer metadata marker is applied server-side.
- [x] `PASS — configuration` Reviewer fixture seeding succeeds.
- [x] `PASS — configuration` One-time sign-in ticket is issued.
- [ ] `BLOCKER` Use the exact App Store Connect reviewer identifier and access code in build 14 on a clean device.
- [ ] `BLOCKER` Reviewer sign-in requires no private inbox or second-factor access.
- [ ] `BLOCKER` Reviewer reaches the intended Dashboard within 15 seconds.
- [ ] `BLOCKER` Reviewer data and tier exactly match the final review notes.
- [ ] `BLOCKER` Reviewer access remains available for the entire review window.

---

## 7. Onboarding

- [x] `PASS — automated` Fresh user reaches onboarding.
- [x] `PASS — automated` Skip path records onboarding completion.
- [x] `PASS — automated` Zero-input onboarding does not start or consume a scan.
- [x] `PASS — automated` Zero-input onboarding shows no fabricated threats.
- [x] `PASS — automated` Zero-threat paywall still hydrates the subscription.
- [x] `PASS — automated` Zero-threat paywall does not fetch/display a threat preview.
- [x] `PASS — automated` “Continue with free plan” reaches the main app.
- [x] `PASS — automated` Returning user does not replay onboarding.
- [ ] `REQUIRED — device` Complete every screen using Back and Continue.
- [ ] `REQUIRED — device` Interrupt onboarding by force quit, then resume.
- [ ] `REQUIRED — device` Enter username only; real name remains blank and no placeholder is submitted.
- [ ] `REQUIRED — device` Enter real name only.
- [ ] `REQUIRED — device` Enter both username and real name.
- [ ] `REQUIRED — device` Enter neither; no scan starts and quota remains unused.
- [ ] `REQUIRED — device` Test leading/trailing spaces.
- [ ] `REQUIRED — device` Test `@username` and username without `@`.
- [ ] `REQUIRED — device` Test Unicode, punctuation, emoji, pasted profile URL, and very long input.
- [ ] `REQUIRED — device` Test harmless SQL/XSS-like strings; input is treated as text.
- [ ] `REQUIRED — device` No placeholder/example identity influences scan parameters.
- [ ] `REQUIRED — device` Photo step explains why access is requested before the OS prompt.
- [ ] `REQUIRED — device` Photo permission allow, deny, cancel, and retry all work.
- [ ] `REQUIRED — device` Onboarding cannot trap a user on a paywall.
- [ ] `REQUIRED — device` Monthly/annual pricing and trial text match StoreKit exactly.
- [ ] `REQUIRED — device` No fake countdown, fabricated social proof, simulated finding, or guaranteed-protection claim appears.

---

## 8. Dashboard

- [x] `PASS — automated` Clean account shows zero threats.
- [x] `PASS — automated` Clean account shows `Last scan: Never`.
- [x] `PASS — automated` Clean account does not show another user's profile or scan data.
- [ ] `REQUIRED — device` Loading state renders without layout breakage.
- [ ] `REQUIRED — device` Pull/foreground refresh updates data once.
- [ ] `REQUIRED — device` Security score and explanation agree.
- [ ] `REQUIRED — device` Threat count equals Alerts.
- [ ] `REQUIRED — device` Monitored account and photo counts equal Profile/Scan.
- [ ] `REQUIRED — device` Upgrade CTA opens the paywall.
- [ ] `REQUIRED — device` Connect-account CTA opens the platform picker.
- [ ] `REQUIRED — device` Tapping a recent threat opens the correct threat.
- [ ] `REQUIRED — device` Offline/error state is recoverable.
- [ ] `REQUIRED — device` Reviewer fixture values match the final reviewer notes exactly.

---

## 9. Connected accounts and OAuth

### Platform picker

- [ ] `REQUIRED — device` Instagram, Facebook, and X appear as supported.
- [ ] `REQUIRED — device` TikTok, LinkedIn, YouTube, and Snapchat are clearly non-actionable if marked Coming Soon.
- [ ] `REQUIRED — device` Cancel/back returns without changing data.

### Instagram

- [ ] `BLOCKER` OAuth opens in the expected secure browser.
- [ ] `BLOCKER` Only the approved current scope is requested.
- [ ] `BLOCKER` Successful callback returns to Rook.
- [ ] `BLOCKER` Account appears connected with correct identity.
- [ ] `REQUIRED — device` User denial returns safely and can retry.
- [ ] `REQUIRED — device` Browser cancellation returns safely.
- [ ] `REQUIRED — device` Expired/used OAuth state is rejected.
- [ ] `REQUIRED — device` Disconnect removes tokens and derived account data as disclosed.

### Facebook

- [ ] `BLOCKER` OAuth requests only current approved permissions.
- [ ] `BLOCKER` Successful callback returns to Rook and marks the account connected.
- [ ] `REQUIRED — device` Denial, cancellation, expired state, and retry work.
- [ ] `REQUIRED — device` Disconnect removes tokens and derived data.

### X

- [ ] `BLOCKER` PKCE OAuth opens and returns through the Rook deep link.
- [ ] `REQUIRED — device` Cancellation and invalid state are recoverable.
- [ ] `REQUIRED — device` Refresh token expiry marks the account for reconnection.
- [ ] `REQUIRED — device` Disconnect succeeds.

### Manage accounts

- [ ] `REQUIRED — device` Active, pending, and reconnect-needed states are accurate.
- [ ] `REQUIRED — device` Edit/save updates the account.
- [ ] `REQUIRED — device` Remove confirmation can be cancelled.
- [ ] `REQUIRED — device` Confirmed remove updates Dashboard, Profile, Scan, and quota context.
- [ ] `REQUIRED — device` Removing the last account leaves a valid empty state.
- [ ] `REQUIRED — device` Account A's data never appears for account B after account switching.

---

## 10. Scan engine

- [x] `PASS — automated` Empty identity profile does not invoke discovery.
- [x] `PASS — automated` Empty identity profile does not consume free quota.
- [x] `PASS — automated` Empty profiles do not share a cache fingerprint.
- [x] `PASS — automated` Clean user retains `0/1` free scan usage.
- [ ] `BLOCKER` Username-only scan completes without injecting a default real name.
- [ ] `BLOCKER` Real-name-only scan completes.
- [ ] `BLOCKER` Username + real name + photo scan completes.
- [ ] `BLOCKER` Scan progress advances and labels are truthful.
- [ ] `BLOCKER` Scan completes with either honest findings or an honest clean result.
- [ ] `BLOCKER` Findings belong only to the tested identity.
- [ ] `REQUIRED — device` Duplicate taps create one scan, not multiple jobs.
- [ ] `REQUIRED — device` Leaving and returning to Scan restores the active job state.
- [ ] `REQUIRED — device` Backgrounding and resuming preserves progress.
- [ ] `REQUIRED — device` No-account/no-input state explains what is needed.
- [ ] `REQUIRED — device` Free scan quota increments exactly once after a real scan.
- [ ] `REQUIRED — device` Exhausted free quota opens the correct paywall.
- [ ] `REQUIRED — device` Premium scan is not incorrectly quota blocked.
- [ ] `REQUIRED — device` API timeout/failure produces an error with retry.
- [ ] `REQUIRED — device` Stale connected-account token requests reconnection rather than silently failing.
- [ ] `REQUIRED — manual` Run a scan while the database/API is under expected production load.
- [ ] `REQUIRED — manual` Confirm scheduled Premium scans run at the documented cadence.
- [ ] `REQUIRED — manual` Confirm notifications are not sent for false or suppressed findings.

---

## 11. Alerts, threat detail, resolution, reporting, and sharing

- [ ] `BLOCKER` Reviewer account shows the exact number and severity of threats described in review notes.
- [ ] `REQUIRED — device` Alerts loading, empty, error, and populated states render.
- [ ] `REQUIRED — device` All/High/Medium/Low filters return correct items.
- [ ] `REQUIRED — device` Resolved/unresolved state is accurate.
- [ ] `REQUIRED — device` Threat detail opens the selected threat.
- [ ] `REQUIRED — device` Invalid/deleted/other-user threat IDs do not expose data.
- [ ] `REQUIRED — device` “Yours” and “Theirs” images are correct and load.
- [ ] `REQUIRED — device` Match score, severity, evidence, detected signals, and AI explanation agree.
- [ ] `REQUIRED — device` Copy says potential match/suspicious result rather than confirmed criminal conduct.
- [ ] `REQUIRED — device` Report action opens the correct official platform guidance.
- [ ] `REQUIRED — device` Resolve confirmation can be cancelled.
- [ ] `REQUIRED — device` Confirmed resolve updates threat detail, Alerts, Dashboard, and score.
- [ ] `REQUIRED — device` Suppressed/resolved account does not immediately reappear from cache.
- [ ] `REQUIRED — device` Native Share opens the iOS share sheet with correct content.
- [ ] `REQUIRED — device` Cancelling Share returns safely.
- [ ] `REQUIRED — device` Share failure displays a recoverable error.
- [ ] `REQUIRED — device` No downloadable-report claim appears unless the feature actually exists.

---

## 12. Photo monitoring and photo permissions

- [ ] `BLOCKER` Photo Monitor opens in build 14.
- [ ] `BLOCKER` Photo-library prompt text matches actual use.
- [ ] `REQUIRED — device` Allow permission permits selection.
- [ ] `REQUIRED — device` Deny permission shows a clear explanation and Settings path.
- [ ] `REQUIRED — device` Revoke permission in Settings, return, and recover.
- [ ] `REQUIRED — device` Cancel picker returns safely.
- [ ] `REQUIRED — device` Valid photo uploads/processes once.
- [ ] `REQUIRED — device` Oversized, corrupt, or unsupported image is rejected clearly.
- [ ] `REQUIRED — device` Offline photo search fails safely.
- [ ] `REQUIRED — device` No-match result is honest.
- [ ] `REQUIRED — device` Match result links to correct evidence.
- [ ] `REQUIRED — manual` Verify exactly what photo bytes, URLs, hashes, and embeddings are stored.
- [ ] `REQUIRED — manual` Verify third-party processing matches the Privacy Policy.
- [ ] `REQUIRED — manual` Verify raw photos are not retained beyond the disclosed period.

---

## 13. Subscription, purchase, restore, and entitlement

- [x] `PASS — automated` Zero-threat onboarding still hydrates the server plan.
- [x] `PASS — automated` Free-plan close action is accessible.
- [x] `PASS — automated` Server-granted tier can hydrate the paywall.
- [ ] `BLOCKER` StoreKit returns monthly and annual products in build 14.
- [ ] `BLOCKER` Product names, localized price, period, and trial match App Store Connect.
- [ ] `BLOCKER` Terms and Privacy links open before purchase.
- [ ] `BLOCKER` Auto-renewal and cancellation copy is visible and accurate.
- [ ] `BLOCKER` Monthly purchase completes in sandbox/TestFlight.
- [ ] `BLOCKER` Annual purchase completes in sandbox/TestFlight.
- [ ] `BLOCKER` RevenueCat entitlement becomes `premium`.
- [ ] `BLOCKER` Server tier syncs after purchase.
- [ ] `BLOCKER` Premium features unlock without relaunch.
- [ ] `BLOCKER` Restore Purchases restores an eligible purchase.
- [ ] `BLOCKER` Restore with no purchase shows a clear non-success result.
- [ ] `BLOCKER` Expired/cancelled subscriber sees the purchase flow.
- [ ] `REQUIRED — device` User-cancelled purchase is not shown as an error purchase.
- [ ] `REQUIRED — device` Declined, pending, offline, and StoreKit-unavailable states are recoverable.
- [ ] `REQUIRED — device` Already-Premium user does not see a misleading purchase CTA.
- [ ] `REQUIRED — device` Manage Subscription opens Apple's subscription management.
- [ ] `REQUIRED — device` Account deletion warns that store billing must be cancelled separately.
- [ ] `REQUIRED — manual` RevenueCat webhook updates renewal, cancellation, expiration, and billing-problem states.
- [ ] `REQUIRED — manual` Subscription works on a second device using the same Apple account.

---

## 14. Notifications, background behavior, and deep links

- [ ] `BLOCKER` Notification pre-prompt appears at an appropriate time.
- [ ] `REQUIRED — device` “Not Now” leaves the app usable.
- [ ] `BLOCKER` Enable triggers the native iOS permission prompt.
- [ ] `BLOCKER` Allowed permission registers a production Expo push token.
- [ ] `REQUIRED — device` Denied permission shows a Settings recovery path.
- [ ] `REQUIRED — device` Revoking permission is reflected when returning to the app.
- [ ] `REQUIRED — device` Per-category toggles persist.
- [ ] `REQUIRED — device` New-threat notification is delivered.
- [ ] `REQUIRED — device` Scan-complete notification is delivered.
- [ ] `REQUIRED — device` Weekly reminder behavior matches its setting.
- [ ] `BLOCKER` Tapping a threat notification opens the correct threat from foreground.
- [ ] `BLOCKER` Tapping it from background opens the correct threat.
- [ ] `BLOCKER` Tapping it from terminated state opens the correct threat.
- [ ] `REQUIRED — device` Alerts, Scan, and Dashboard payloads route correctly.
- [ ] `REQUIRED — device` Unknown payload falls back safely.
- [ ] `REQUIRED — device` Deleted-threat payload does not crash.
- [ ] `REQUIRED — device` Signed-out notification target does not expose private data.
- [ ] `REQUIRED — device` Sign out/account switch deregisters or reassigns the token correctly.

---

## 15. Profile, settings, privacy, and legal

### Profile and settings

- [ ] `REQUIRED — device` Profile name, handle, tier, avatar, account count, and identity badge are correct.
- [ ] `REQUIRED — device` Edit profile saves valid changes.
- [ ] `REQUIRED — device` Cancel edit discards changes.
- [ ] `REQUIRED — device` Avatar allow/deny/cancel/upload/error paths work.
- [ ] `REQUIRED — device` Security screen contains no nonfunctional controls.
- [ ] `REQUIRED — device` Notification settings reflect native permission state.
- [ ] `REQUIRED — device` Support opens a working support path.
- [ ] `REQUIRED — device` Terms and Privacy render inside the app.
- [ ] `REQUIRED — manual` Public Support, Privacy, and Terms URLs load over HTTPS.

### Photo consent and privacy

- [x] `PASS — automated` Consent can be enabled.
- [x] `PASS — automated` Consent can be withdrawn.
- [x] `PASS — automated` Confirmed withdrawal calls deletion exactly once.
- [x] `PASS — automated` Cancel does not trigger deletion.
- [x] `PASS — automated` Re-enabling clears stale withdrawal feedback.
- [x] `PASS — automated` Photo-data deletion endpoint succeeds.
- [x] `PASS — automated` Data export JSON downloads/returns.
- [ ] `REQUIRED — device` Consent notice is readable and not preselected.
- [ ] `REQUIRED — device` Withdrawing consent disables future photo scanning.
- [ ] `REQUIRED — manual` Verify photo-derived data is deleted within the disclosed time.
- [ ] `REQUIRED — manual` Verify backup-retention claims.
- [ ] `REQUIRED — manual` Verify data export includes every promised data category.
- [ ] `REQUIRED — manual` Verify users can reach a human to dispute a false result where required.

---

## 16. Sign out, returning access, and account deletion

- [x] `PASS — automated` Sign-out modal appears.
- [x] `PASS — automated` Cancel leaves the user signed in.
- [x] `PASS — automated` Confirmed sign-out returns to Auth.
- [x] `PASS — automated` Signed-out protected APIs return 401 with no user data.
- [x] `PASS — automated` Returning login bypasses onboarding.
- [x] `PASS — automated` Returning user preserves correct consent, threats, and quota.
- [x] `PASS — automated` Delete Account warning states permanence and separate store cancellation.
- [x] `PASS — automated` Cancel deletion leaves the account intact.
- [x] `PASS — automated` Confirmed deletion returns 204.
- [x] `PASS — automated` Clerk user deletion succeeds.
- [x] `PASS — automated` Post-delete notification cleanup cannot recreate the user.
- [x] `PASS — automated` App returns to Auth with no prior data.
- [ ] `BLOCKER` Repeat sign out and returning sign-in on physical build 14.
- [ ] `BLOCKER` Repeat full account deletion on physical build 14.
- [ ] `BLOCKER` Confirm same deleted identity is not silently treated as a returning account.
- [ ] `REQUIRED — manual` Verify no orphaned accounts, scans, threats, photos, tokens, subscriptions, fingerprints, or identity profiles remain.
- [ ] `REQUIRED — device` Re-registering the same email follows the intended first-time-user behavior.
- [ ] `REQUIRED — device` Delete while offline fails safely and does not falsely claim success.
- [ ] `REQUIRED — device` Delete with an active subscription preserves Apple's billing warning.

---

## 17. Reviewer walkthrough for the submitted build

Run this exact walkthrough after all feature tests pass:

1. Delete Rook from the test device.
2. Install build 14 from TestFlight.
3. Confirm the device has no prior Rook local state.
4. Launch Rook.
5. Use only the credentials and steps stored in App Store Connect.
6. Confirm reviewer access succeeds without email inbox access.
7. Confirm Dashboard loads within 15 seconds.
8. Confirm displayed score, threat count, accounts, photos, and tier exactly match review notes.
9. Open each seeded threat.
10. Verify evidence images, percentages, explanation, and report action.
11. Filter Alerts.
12. Start a scan and wait for completion.
13. Open Connect Account, verify the supported platform screen, then cancel unless review notes require live OAuth.
14. Open the paywall from an expired/free account.
15. Verify monthly, annual, trial, Restore Purchases, Terms, and Privacy.
16. Open Photo Monitor and verify permission behavior.
17. Open Privacy & Data, export data, and cancel destructive actions.
18. Open Support, Terms, and Privacy.
19. Sign out and sign back in.
20. Confirm there are no crashes, blank screens, infinite spinners, stale data, or inaccessible buttons.

### Obsolete reviewer-script steps

- [x] `PASS — documentation` Removed old **Tools tab**, **AI Scam Analyzer**, and related steps from the canonical reviewer instructions.
- [x] `PASS — documentation` Removed unverified seeded counts and match percentages from reviewer instructions and screenshot guidance.
- [x] `PASS — documentation` Reviewer instructions require live Sign in with Apple testing; a video is not a substitute.
- [x] `PASS — documentation` Reviewer instructions no longer limit Apple to a Cancel path when testing supported integrations.
- [x] `PASS — documentation` Removed `user_photos` as a current build-14 permission; Facebook is documented as `public_profile` only.
- [x] `PASS — documentation` Published one canonical build-14 reviewer script and labeled the conflicting legacy guide superseded.

---

## 18. App Store metadata and rejection-history audit

### Demo access — Guideline 2.1

- [ ] `BLOCKER` Replace stale credentials in App Store Connect.
- [ ] `BLOCKER` Validate the exact credentials on a clean device.
- [ ] `BLOCKER` Reviewer has full access to described functionality.
- [ ] `BLOCKER` Backend and fixture seeding remain live.
- [ ] `BLOCKER` Review notes explain the access-code flow clearly.

### Sign in with Apple — Guideline 2.1(a) / login rules

- [ ] `BLOCKER` Attach evidence that first-time Apple sign-in passes on build 14.
- [ ] `BLOCKER` Confirm supported-device availability so Apple cannot install on an untested iPad.
- [ ] `BLOCKER` If iPad remains available, include iPad evidence.

### Face/photo data questionnaire

- [ ] `BLOCKER` Answer what photo/face-related data is collected.
- [ ] `BLOCKER` Explain each purpose.
- [ ] `BLOCKER` List each third party receiving data.
- [ ] `BLOCKER` State storage format/location.
- [ ] `BLOCKER` State retention and deletion timing.
- [ ] `BLOCKER` Quote matching Privacy Policy sections.
- [ ] `BLOCKER` Confirm every statement against actual runtime/database behavior.
- [ ] `BLOCKER` Obtain legal review for biometric/privacy wording where needed.

### Age rating

- [x] `PASS — documentation` Release documents now distinguish the Apple/Google content-rating questionnaire from account eligibility and remove contradictory 4+/13+/18+ instructions.
- [x] `PASS — documentation` Active release documents consistently state the in-app signup, Terms, and Privacy minimum eligibility is 17.
- [ ] `BLOCKER` Confirm the App Store Connect age-rating questionnaire and any Age Assurance/In-App Controls selections in the console; repository documentation alone is not evidence of the submitted console state.

### Subscription and promoted IAP

- [ ] `BLOCKER` Provide Apple an expired/no-subscription path.
- [ ] `BLOCKER` Verify products and trials are reviewable in every enabled territory.
- [ ] `BLOCKER` Confirm subscription review images are unique, product-specific, and legible.
- [ ] `BLOCKER` Remove price text from promotional metadata/art where Apple disallows or has rejected it.
- [ ] `BLOCKER` Confirm the standard EULA URL appears where required.

### Metadata consistency

- [x] `PASS — documentation` Chose one subtitle and one secondary category in the canonical metadata file.
- [x] `PASS — documentation` Corrected the copyright year in the canonical metadata file.
- [x] `PASS — documentation` Replaced hard-coded screenshot dimensions with current App Store Connect device-family guidance.
- [x] `PASS — documentation` Confirmed Support, Marketing, and Privacy URLs are consistently documented.
- [x] `PASS — documentation` Revised the app description to match supported platforms and current functionality.
- [x] `PASS — documentation` Removed unsupported “track every place,” “instant,” “always,” and guaranteed-protection claims.
- [x] `PASS — documentation` Confirmed Coming Soon platforms are not described as currently functional.
- [ ] `BLOCKER` Confirm privacy nutrition labels match Clerk, RevenueCat, push, photos, Vision/OpenAI/search, and server processing.

---

## 19. Meta review audit

- [ ] `BLOCKER` Request only scopes used by build 14.
- [x] `PASS — code and documentation` Build 14 requests Facebook `public_profile` only and does not submit or describe `user_photos` as live.
- [ ] `BLOCKER` Verify Instagram and Facebook reviewer test identities and roles.
- [ ] `BLOCKER` Verify exact production callback URLs and mobile deep link.
- [ ] `BLOCKER` Complete live OAuth from the review build.
- [ ] `BLOCKER` Confirm permission explanations match actual processing.
- [ ] `BLOCKER` Confirm disconnect and account deletion remove Meta tokens/data.
- [ ] `BLOCKER` Confirm data-deletion callback is registered and works.
- [ ] `REQUIRED — manual` Record a supplemental current-build review video.
- [ ] `BLOCKER` Ensure the video does not replace live reviewer access.
- [ ] `BLOCKER` Retire or label older Meta instructions that tell reviewers to approve unavailable permissions.

---

## 20. Backend, security, and operations

- [ ] `REQUIRED — manual` Production health endpoint succeeds.
- [ ] `REQUIRED — manual` All authenticated user endpoints reject missing/invalid auth.
- [ ] `REQUIRED — manual` Cross-user IDs cannot read or mutate another user's data.
- [ ] `REQUIRED — manual` Reviewer/admin endpoints reject missing or invalid admin credentials.
- [ ] `REQUIRED — manual` Reviewer access is rate limited.
- [ ] `REQUIRED — manual` OAuth state is single-use and expires.
- [ ] `REQUIRED — manual` OAuth secrets/tokens are absent from logs.
- [ ] `REQUIRED — manual` RevenueCat webhook rejects invalid signatures.
- [ ] `REQUIRED — manual` Meta webhooks/deletion callbacks validate signatures.
- [ ] `REQUIRED — manual` Scan and photo endpoints enforce rate and payload limits.
- [ ] `REQUIRED — manual` Request-size and malformed-request handling is verified.
- [ ] `REQUIRED — manual` Scheduled jobs do not crash the API.
- [ ] `REQUIRED — manual` Database backup and restore procedure is known.
- [ ] `REQUIRED — manual` Production monitoring covers authentication, purchase, scan, OAuth, notification, and deletion errors.
- [ ] `REQUIRED — manual` No production secret is bundled into the client.
- [ ] `REQUIRED — manual` Dependency and static security scans have no unresolved critical/high release blocker.

---

## 21. Final go/no-go sign-off

### Automatic no-go conditions

Do not submit if any of these is true:

- Any `BLOCKER` is not passed.
- Any required physical-device flow was not run on build 14.
- Sign in with Apple was not tested as a genuinely new identity.
- Reviewer credentials were not tested from a clean install.
- Reviewer requires an inaccessible inbox or OTP.
- Purchase or Restore Purchases was not tested through StoreKit.
- Reviewer notes do not match the seeded account.
- App Store metadata or privacy answers conflict with the app.
- Build 14 is not the build attached to the final submission.
- Backend services are not production-ready and monitored.
- A test produced a crash, blank screen, infinite spinner, wrong-user data, fabricated result, duplicate charge, or incomplete deletion.

### Required approvals

- [ ] Engineering: all automated and API checks pass.
- [ ] iOS device tester: all build 14 native checks pass.
- [ ] Product: reviewer script matches build 14.
- [ ] Privacy/legal: photo/face data and retention answers approved.
- [ ] Operations: reviewer support and production monitoring ready.
- [ ] App Store Connect owner: metadata, age rating, privacy labels, IAPs, screenshots, and review notes verified.
- [ ] Final approver: authorizes attaching build 14.
- [ ] Final approver: authorizes submitting for review.

**Current decision:** `NO-GO — native-device and submission-metadata blockers remain open.`
# Rook Build 14 — Final Release Testing Audit

**Audit date:** September 21, 2026  
**Release:** iOS 1.0.0, build 14  
**Purpose:** Release-blocking verification before the next Apple App Review submission  
**Decision:** **DO NOT SUBMIT** until every `BLOCKER` and `REQUIRED` item below has recorded passing evidence.

---

## 1. Audit rules

This is the authoritative test checklist for build 14. It replaces the functional test steps in `docs/reviewer-test-script.md` where that document conflicts with the current app.

### Status legend

- `PASS — automated`: Verified in the browser/API release-candidate test on September 21, 2026.
- `PASS — configuration`: Verified through App Store Connect, Clerk, or backend APIs.
- `REQUIRED — device`: Must be tested on the signed build on a physical iPhone.
- `REQUIRED — manual`: Must be verified in App Store Connect, production, or an external provider.
- `BLOCKER`: Submission is forbidden until the item passes.
- `N/A`: Confirmed not present in the submitted build; reviewer instructions and metadata must not mention it.

### Evidence required for every manual pass

Record:

1. Tester name
2. Date and time
3. Device model and iOS version
4. Build number (`14`)
5. Account type used
6. Expected result
7. Actual result
8. Screenshot or screen recording
9. Relevant API/request status or server log when applicable
10. Final `PASS` or `FAIL`

Do not mark an item passed because the code exists, a simulator worked, or an older build worked.

---

## 2. Current release state

- [x] `PASS — configuration` Build 14 exists in App Store Connect.
- [x] `PASS — configuration` Build 14 processing state is `VALID`.
- [x] `PASS — configuration` Build 14 is not expired.
- [x] `PASS — configuration` Build 13 remains attached to the rejected version.
- [x] `PASS — configuration` Build 14 has **not** been attached or resubmitted.
- [x] `PASS — configuration` Dedicated App Review account bootstrap and fixture seeding return success.
- [x] `PASS — configuration` Dedicated App Review one-time Clerk sign-in ticket is issued.
- [ ] `BLOCKER` Install build 14 from TestFlight on a physical iPhone.
- [ ] `BLOCKER` Complete all native-device tests in sections 5–16.
- [ ] `BLOCKER` Resolve every App Store metadata/rejection item in sections 17–20.
- [ ] `BLOCKER` Repeat the final reviewer walkthrough on a clean device using only the credentials and instructions Apple will receive.

---

## 3. Apple review requirements that control this audit

Apple's current App Review Guidelines require:

- The app to be tested for crashes and bugs.
- Complete and accurate metadata.
- Current reviewer contact information.
- Full access to every account-based feature through an active demo account or fully featured demo mode.
- All backend services to remain live during review.
- Detailed review notes for non-obvious features and in-app purchases.
- Restorable purchases to have a restore mechanism.
- Auto-renewable subscriptions to provide ongoing value and work across supported devices.
- Apps that support account creation to offer in-app account deletion.
- Social-login apps to comply with Apple's login-service rules, including Sign in with Apple where applicable.
- Privacy disclosures and permission prompts to match the data actually collected and used.

Authoritative source:  
https://developer.apple.com/app-store/review/guidelines

The checklist also incorporates the rejection materials in `attached_assets/`, especially:

- Broken or inaccessible demo credentials
- Broken first-time Sign in with Apple
- iPad review behavior
- Face/photo data questionnaire
- Age-rating selections
- Subscription review access
- Promotional in-app purchase artwork

---

## 4. Test accounts and environments

Prepare these accounts before device testing:

### A. Clean first-time user

- Never used Rook
- No onboarding state
- No connected accounts
- No subscription
- Eligible for introductory offer if the app presents one
- Used for Apple, Google, email signup, permission, onboarding, and purchase tests

### B. Returning free user

- Onboarding complete
- No active subscription
- Known scan quota state
- Used for sign-out, returning sign-in, restore-none, and quota tests

### C. Active Premium user

- Active RevenueCat `premium` entitlement
- Used to test server-tier hydration, daily monitoring copy, unlimited features, cancellation management, and cross-device restore

### D. Expired/cancelled subscriber

- Previously purchased
- Entitlement expired or cancelled
- Used to prove the paywall and purchase flow are available to Apple
- This is specifically important because prior review requested an expired/no-subscription state

### E. Dedicated App Review user

- Credentials stored only in App Store Connect's protected App Review Information fields
- Fixture seeding succeeds
- Reviewer signs in without needing access to a private inbox
- Account exposes the features described in review notes

### F. Meta test identities

- Instagram Business/Creator tester
- Facebook test user
- Added to the correct Meta app roles
- Credentials stored only in Meta reviewer instructions

### Environment checks

- [ ] `BLOCKER` Production API is deployed and healthy.
- [ ] `BLOCKER` Production Clerk tenant contains or can bootstrap the reviewer identity.
- [ ] `BLOCKER` RevenueCat production offering is current and returns monthly and annual packages.
- [ ] `BLOCKER` App Store subscription products are cleared for submission with the app version.
- [ ] `BLOCKER` Push credentials work in the distribution build.
- [ ] `BLOCKER` Meta and X redirect URLs exactly match production and the mobile deep link.
- [ ] `BLOCKER` Review support inbox is actively monitored throughout review.
- [ ] `BLOCKER` No test requires the reviewer to receive an email or OTP in an inbox they cannot access.

---

## 5. Installation, launch, and global reliability

- [ ] `REQUIRED — device` Fresh TestFlight install launches without crash.
- [ ] `REQUIRED — device` App icon, launch screen, product name, and version are correct.
- [ ] `REQUIRED — device` Animated splash completes and never loops.
- [ ] `REQUIRED — device` Slow startup exits to a clear recoverable state rather than a blank screen.
- [ ] `REQUIRED — device` Force quit and reopen preserve the correct signed-in/signed-out state.
- [ ] `REQUIRED — device` Background then foreground refreshes account state without duplicate navigation.
- [ ] `REQUIRED — device` Airplane mode shows a useful error and does not crash.
- [ ] `REQUIRED — device` API timeout produces a recoverable message, not an infinite spinner.
- [ ] `REQUIRED — device` Expired session returns safely to authentication.
- [ ] `REQUIRED — device` Invalid/deleted deep-link target shows a safe not-found state.
- [ ] `REQUIRED — device` No screen is obscured by the notch, home indicator, keyboard, or safe area.
- [ ] `REQUIRED — device` Dynamic text does not clip essential labels or buttons.
- [ ] `REQUIRED — manual` Confirm the App Store version does not support iPad if iPad is intentionally unsupported.
- [ ] `BLOCKER` If Apple can still install on iPad, run this complete audit on the iPad class used in the rejection.

---

## 6. Authentication and account creation

### Email/password

- [ ] `REQUIRED — device` Create account with valid email and password.
- [ ] `REQUIRED — device` Terms and Privacy acceptance is initially unchecked.
- [ ] `REQUIRED — device` Account creation is blocked until required agreements are accepted.
- [ ] `REQUIRED — device` Age requirement is stated consistently with policy and App Store rating.
- [ ] `REQUIRED — device` Verification code screen appears.
- [ ] `REQUIRED — device` Correct code succeeds.
- [ ] `REQUIRED — device` Wrong code shows an actionable error.
- [ ] `REQUIRED — device` Resend works and cannot be abused by rapid taps.
- [ ] `REQUIRED — device` Weak/invalid password errors are understandable.
- [ ] `REQUIRED — device` Existing email follows the correct sign-in/recovery path.
- [ ] `REQUIRED — device` Sign in with valid credentials reaches the correct destination.
- [ ] `REQUIRED — device` Invalid credentials do not reveal whether an account exists beyond intended Clerk behavior.

### Sign in with Apple — prior rejection focus

- [ ] `BLOCKER` First-time Sign in with Apple completes on build 14.
- [ ] `BLOCKER` Apple authorization creates the Clerk user when the identity is new.
- [ ] `BLOCKER` The newly created Apple user is not rejected as a nonexistent Rook account.
- [ ] `BLOCKER` The new Clerk session becomes active immediately.
- [ ] `BLOCKER` Terms, Privacy, and age acknowledgements are captured in the same first-time flow.
- [ ] `BLOCKER` Hide My Email works.
- [ ] `BLOCKER` User cancelling Apple's sheet returns safely to Auth.
- [ ] `BLOCKER` Apple error/denial produces a useful error and allows retry.
- [ ] `BLOCKER` Returning Apple user skips onboarding and lands in the app.
- [ ] `BLOCKER` Apple account with revoked app access can authenticate or recover cleanly.
- [ ] `BLOCKER` Account deletion removes the Rook account and handles Apple-account deletion requirements.

### Sign in with Google

- [ ] `BLOCKER` First-time Google sign-in creates and activates the user.
- [ ] `BLOCKER` First-time Google user completes Terms, Privacy, and age acknowledgements.
- [ ] `BLOCKER` Returning Google user skips onboarding.
- [ ] `REQUIRED — device` Cancelling Google sign-in returns safely to Auth.
- [ ] `REQUIRED — device` Provider error can be retried.

### Dedicated App Review access

- [x] `PASS — configuration` Review endpoint validates the configured access code.
- [x] `PASS — configuration` Stale configured reviewer ID recovers by resolving or creating the protected reviewer identity.
- [x] `PASS — configuration` Reviewer metadata marker is applied server-side.
- [x] `PASS — configuration` Reviewer fixture seeding succeeds.
- [x] `PASS — configuration` One-time sign-in ticket is issued.
- [ ] `BLOCKER` Use the exact App Store Connect reviewer identifier and access code in build 14 on a clean device.
- [ ] `BLOCKER` Reviewer sign-in requires no private inbox or second-factor access.
- [ ] `BLOCKER` Reviewer reaches the intended Dashboard within 15 seconds.
- [ ] `BLOCKER` Reviewer data and tier exactly match the final review notes.
- [ ] `BLOCKER` Reviewer access remains available for the entire review window.

---

## 7. Onboarding

- [x] `PASS — automated` Fresh user reaches onboarding.
- [x] `PASS — automated` Skip path records onboarding completion.
- [x] `PASS — automated` Zero-input onboarding does not start or consume a scan.
- [x] `PASS — automated` Zero-input onboarding shows no fabricated threats.
- [x] `PASS — automated` Zero-threat paywall still hydrates the subscription.
- [x] `PASS — automated` Zero-threat paywall does not fetch/display a threat preview.
- [x] `PASS — automated` “Continue with free plan” reaches the main app.
- [x] `PASS — automated` Returning user does not replay onboarding.
- [ ] `REQUIRED — device` Complete every screen using Back and Continue.
- [ ] `REQUIRED — device` Interrupt onboarding by force quit, then resume.
- [ ] `REQUIRED — device` Enter username only; real name remains blank and no placeholder is submitted.
- [ ] `REQUIRED — device` Enter real name only.
- [ ] `REQUIRED — device` Enter both username and real name.
- [ ] `REQUIRED — device` Enter neither; no scan starts and quota remains unused.
- [ ] `REQUIRED — device` Test leading/trailing spaces.
- [ ] `REQUIRED — device` Test `@username` and username without `@`.
- [ ] `REQUIRED — device` Test Unicode, punctuation, emoji, pasted profile URL, and very long input.
- [ ] `REQUIRED — device` Test harmless SQL/XSS-like strings; input is treated as text.
- [ ] `REQUIRED — device` No placeholder/example identity influences scan parameters.
- [ ] `REQUIRED — device` Photo step explains why access is requested before the OS prompt.
- [ ] `REQUIRED — device` Photo permission allow, deny, cancel, and retry all work.
- [ ] `REQUIRED — device` Onboarding cannot trap a user on a paywall.
- [ ] `REQUIRED — device` Monthly/annual pricing and trial text match StoreKit exactly.
- [ ] `REQUIRED — device` No fake countdown, fabricated social proof, simulated finding, or guaranteed-protection claim appears.

---

## 8. Dashboard

- [x] `PASS — automated` Clean account shows zero threats.
- [x] `PASS — automated` Clean account shows `Last scan: Never`.
- [x] `PASS — automated` Clean account does not show another user's profile or scan data.
- [ ] `REQUIRED — device` Loading state renders without layout breakage.
- [ ] `REQUIRED — device` Pull/foreground refresh updates data once.
- [ ] `REQUIRED — device` Security score and explanation agree.
- [ ] `REQUIRED — device` Threat count equals Alerts.
- [ ] `REQUIRED — device` Monitored account and photo counts equal Profile/Scan.
- [ ] `REQUIRED — device` Upgrade CTA opens the paywall.
- [ ] `REQUIRED — device` Connect-account CTA opens the platform picker.
- [ ] `REQUIRED — device` Tapping a recent threat opens the correct threat.
- [ ] `REQUIRED — device` Offline/error state is recoverable.
- [ ] `REQUIRED — device` Reviewer fixture values match the final reviewer notes exactly.

---

## 9. Connected accounts and OAuth

### Platform picker

- [ ] `REQUIRED — device` Instagram, Facebook, and X appear as supported.
- [ ] `REQUIRED — device` TikTok, LinkedIn, YouTube, and Snapchat are clearly non-actionable if marked Coming Soon.
- [ ] `REQUIRED — device` Cancel/back returns without changing data.

### Instagram

- [ ] `BLOCKER` OAuth opens in the expected secure browser.
- [ ] `BLOCKER` Only the approved current scope is requested.
- [ ] `BLOCKER` Successful callback returns to Rook.
- [ ] `BLOCKER` Account appears connected with correct identity.
- [ ] `REQUIRED — device` User denial returns safely and can retry.
- [ ] `REQUIRED — device` Browser cancellation returns safely.
- [ ] `REQUIRED — device` Expired/used OAuth state is rejected.
- [ ] `REQUIRED — device` Disconnect removes tokens and derived account data as disclosed.

### Facebook

- [ ] `BLOCKER` OAuth requests only current approved permissions.
- [ ] `BLOCKER` Successful callback returns to Rook and marks the account connected.
- [ ] `REQUIRED — device` Denial, cancellation, expired state, and retry work.
- [ ] `REQUIRED — device` Disconnect removes tokens and derived data.

### X

- [ ] `BLOCKER` PKCE OAuth opens and returns through the Rook deep link.
- [ ] `REQUIRED — device` Cancellation and invalid state are recoverable.
- [ ] `REQUIRED — device` Refresh token expiry marks the account for reconnection.
- [ ] `REQUIRED — device` Disconnect succeeds.

### Manage accounts

- [ ] `REQUIRED — device` Active, pending, and reconnect-needed states are accurate.
- [ ] `REQUIRED — device` Edit/save updates the account.
- [ ] `REQUIRED — device` Remove confirmation can be cancelled.
- [ ] `REQUIRED — device` Confirmed remove updates Dashboard, Profile, Scan, and quota context.
- [ ] `REQUIRED — device` Removing the last account leaves a valid empty state.
- [ ] `REQUIRED — device` Account A's data never appears for account B after account switching.

---

## 10. Scan engine

- [x] `PASS — automated` Empty identity profile does not invoke discovery.
- [x] `PASS — automated` Empty identity profile does not consume free quota.
- [x] `PASS — automated` Empty profiles do not share a cache fingerprint.
- [x] `PASS — automated` Clean user retains `0/1` free scan usage.
- [ ] `BLOCKER` Username-only scan completes without injecting a default real name.
- [ ] `BLOCKER` Real-name-only scan completes.
- [ ] `BLOCKER` Username + real name + photo scan completes.
- [ ] `BLOCKER` Scan progress advances and labels are truthful.
- [ ] `BLOCKER` Scan completes with either honest findings or an honest clean result.
- [ ] `BLOCKER` Findings belong only to the tested identity.
- [ ] `REQUIRED — device` Duplicate taps create one scan, not multiple jobs.
- [ ] `REQUIRED — device` Leaving and returning to Scan restores the active job state.
- [ ] `REQUIRED — device` Backgrounding and resuming preserves progress.
- [ ] `REQUIRED — device` No-account/no-input state explains what is needed.
- [ ] `REQUIRED — device` Free scan quota increments exactly once after a real scan.
- [ ] `REQUIRED — device` Exhausted free quota opens the correct paywall.
- [ ] `REQUIRED — device` Premium scan is not incorrectly quota blocked.
- [ ] `REQUIRED — device` API timeout/failure produces an error with retry.
- [ ] `REQUIRED — device` Stale connected-account token requests reconnection rather than silently failing.
- [ ] `REQUIRED — manual` Run a scan while the database/API is under expected production load.
- [ ] `REQUIRED — manual` Confirm scheduled Premium scans run at the documented cadence.
- [ ] `REQUIRED — manual` Confirm notifications are not sent for false or suppressed findings.

---

## 11. Alerts, threat detail, resolution, reporting, and sharing

- [ ] `BLOCKER` Reviewer account shows the exact number and severity of threats described in review notes.
- [ ] `REQUIRED — device` Alerts loading, empty, error, and populated states render.
- [ ] `REQUIRED — device` All/High/Medium/Low filters return correct items.
- [ ] `REQUIRED — device` Resolved/unresolved state is accurate.
- [ ] `REQUIRED — device` Threat detail opens the selected threat.
- [ ] `REQUIRED — device` Invalid/deleted/other-user threat IDs do not expose data.
- [ ] `REQUIRED — device` “Yours” and “Theirs” images are correct and load.
- [ ] `REQUIRED — device` Match score, severity, evidence, detected signals, and AI explanation agree.
- [ ] `REQUIRED — device` Copy says potential match/suspicious result rather than confirmed criminal conduct.
- [ ] `REQUIRED — device` Report action opens the correct official platform guidance.
- [ ] `REQUIRED — device` Resolve confirmation can be cancelled.
- [ ] `REQUIRED — device` Confirmed resolve updates threat detail, Alerts, Dashboard, and score.
- [ ] `REQUIRED — device` Suppressed/resolved account does not immediately reappear from cache.
- [ ] `REQUIRED — device` Native Share opens the iOS share sheet with correct content.
- [ ] `REQUIRED — device` Cancelling Share returns safely.
- [ ] `REQUIRED — device` Share failure displays a recoverable error.
- [ ] `REQUIRED — device` No downloadable-report claim appears unless the feature actually exists.

---

## 12. Photo monitoring and photo permissions

- [ ] `BLOCKER` Photo Monitor opens in build 14.
- [ ] `BLOCKER` Photo-library prompt text matches actual use.
- [ ] `REQUIRED — device` Allow permission permits selection.
- [ ] `REQUIRED — device` Deny permission shows a clear explanation and Settings path.
- [ ] `REQUIRED — device` Revoke permission in Settings, return, and recover.
- [ ] `REQUIRED — device` Cancel picker returns safely.
- [ ] `REQUIRED — device` Valid photo uploads/processes once.
- [ ] `REQUIRED — device` Oversized, corrupt, or unsupported image is rejected clearly.
- [ ] `REQUIRED — device` Offline photo search fails safely.
- [ ] `REQUIRED — device` No-match result is honest.
- [ ] `REQUIRED — device` Match result links to correct evidence.
- [ ] `REQUIRED — manual` Verify exactly what photo bytes, URLs, hashes, and embeddings are stored.
- [ ] `REQUIRED — manual` Verify third-party processing matches the Privacy Policy.
- [ ] `REQUIRED — manual` Verify raw photos are not retained beyond the disclosed period.

---

## 13. Subscription, purchase, restore, and entitlement

- [x] `PASS — automated` Zero-threat onboarding still hydrates the server plan.
- [x] `PASS — automated` Free-plan close action is accessible.
- [x] `PASS — automated` Server-granted tier can hydrate the paywall.
- [ ] `BLOCKER` StoreKit returns monthly and annual products in build 14.
- [ ] `BLOCKER` Product names, localized price, period, and trial match App Store Connect.
- [ ] `BLOCKER` Terms and Privacy links open before purchase.
- [ ] `BLOCKER` Auto-renewal and cancellation copy is visible and accurate.
- [ ] `BLOCKER` Monthly purchase completes in sandbox/TestFlight.
- [ ] `BLOCKER` Annual purchase completes in sandbox/TestFlight.
- [ ] `BLOCKER` RevenueCat entitlement becomes `premium`.
- [ ] `BLOCKER` Server tier syncs after purchase.
- [ ] `BLOCKER` Premium features unlock without relaunch.
- [ ] `BLOCKER` Restore Purchases restores an eligible purchase.
- [ ] `BLOCKER` Restore with no purchase shows a clear non-success result.
- [ ] `BLOCKER` Expired/cancelled subscriber sees the purchase flow.
- [ ] `REQUIRED — device` User-cancelled purchase is not shown as an error purchase.
- [ ] `REQUIRED — device` Declined, pending, offline, and StoreKit-unavailable states are recoverable.
- [ ] `REQUIRED — device` Already-Premium user does not see a misleading purchase CTA.
- [ ] `REQUIRED — device` Manage Subscription opens Apple's subscription management.
- [ ] `REQUIRED — device` Account deletion warns that store billing must be cancelled separately.
- [ ] `REQUIRED — manual` RevenueCat webhook updates renewal, cancellation, expiration, and billing-problem states.
- [ ] `REQUIRED — manual` Subscription works on a second device using the same Apple account.

---

## 14. Notifications, background behavior, and deep links

- [ ] `BLOCKER` Notification pre-prompt appears at an appropriate time.
- [ ] `REQUIRED — device` “Not Now” leaves the app usable.
- [ ] `BLOCKER` Enable triggers the native iOS permission prompt.
- [ ] `BLOCKER` Allowed permission registers a production Expo push token.
- [ ] `REQUIRED — device` Denied permission shows a Settings recovery path.
- [ ] `REQUIRED — device` Revoking permission is reflected when returning to the app.
- [ ] `REQUIRED — device` Per-category toggles persist.
- [ ] `REQUIRED — device` New-threat notification is delivered.
- [ ] `REQUIRED — device` Scan-complete notification is delivered.
- [ ] `REQUIRED — device` Weekly reminder behavior matches its setting.
- [ ] `BLOCKER` Tapping a threat notification opens the correct threat from foreground.
- [ ] `BLOCKER` Tapping it from background opens the correct threat.
- [ ] `BLOCKER` Tapping it from terminated state opens the correct threat.
- [ ] `REQUIRED — device` Alerts, Scan, and Dashboard payloads route correctly.
- [ ] `REQUIRED — device` Unknown payload falls back safely.
- [ ] `REQUIRED — device` Deleted-threat payload does not crash.
- [ ] `REQUIRED — device` Signed-out notification target does not expose private data.
- [ ] `REQUIRED — device` Sign out/account switch deregisters or reassigns the token correctly.

---

## 15. Profile, settings, privacy, and legal

### Profile and settings

- [ ] `REQUIRED — device` Profile name, handle, tier, avatar, account count, and identity badge are correct.
- [ ] `REQUIRED — device` Edit profile saves valid changes.
- [ ] `REQUIRED — device` Cancel edit discards changes.
- [ ] `REQUIRED — device` Avatar allow/deny/cancel/upload/error paths work.
- [ ] `REQUIRED — device` Security screen contains no nonfunctional controls.
- [ ] `REQUIRED — device` Notification settings reflect native permission state.
- [ ] `REQUIRED — device` Support opens a working support path.
- [ ] `REQUIRED — device` Terms and Privacy render inside the app.
- [ ] `REQUIRED — manual` Public Support, Privacy, and Terms URLs load over HTTPS.

### Photo consent and privacy

- [x] `PASS — automated` Consent can be enabled.
- [x] `PASS — automated` Consent can be withdrawn.
- [x] `PASS — automated` Confirmed withdrawal calls deletion exactly once.
- [x] `PASS — automated` Cancel does not trigger deletion.
- [x] `PASS — automated` Re-enabling clears stale withdrawal feedback.
- [x] `PASS — automated` Photo-data deletion endpoint succeeds.
- [x] `PASS — automated` Data export JSON downloads/returns.
- [ ] `REQUIRED — device` Consent notice is readable and not preselected.
- [ ] `REQUIRED — device` Withdrawing consent disables future photo scanning.
- [ ] `REQUIRED — manual` Verify photo-derived data is deleted within the disclosed time.
- [ ] `REQUIRED — manual` Verify backup-retention claims.
- [ ] `REQUIRED — manual` Verify data export includes every promised data category.
- [ ] `REQUIRED — manual` Verify users can reach a human to dispute a false result where required.

---

## 16. Sign out, returning access, and account deletion

- [x] `PASS — automated` Sign-out modal appears.
- [x] `PASS — automated` Cancel leaves the user signed in.
- [x] `PASS — automated` Confirmed sign-out returns to Auth.
- [x] `PASS — automated` Signed-out protected APIs return 401 with no user data.
- [x] `PASS — automated` Returning login bypasses onboarding.
- [x] `PASS — automated` Returning user preserves correct consent, threats, and quota.
- [x] `PASS — automated` Delete Account warning states permanence and separate store cancellation.
- [x] `PASS — automated` Cancel deletion leaves the account intact.
- [x] `PASS — automated` Confirmed deletion returns 204.
- [x] `PASS — automated` Clerk user deletion succeeds.
- [x] `PASS — automated` Post-delete notification cleanup cannot recreate the user.
- [x] `PASS — automated` App returns to Auth with no prior data.
- [ ] `BLOCKER` Repeat sign out and returning sign-in on physical build 14.
- [ ] `BLOCKER` Repeat full account deletion on physical build 14.
- [ ] `BLOCKER` Confirm same deleted identity is not silently treated as a returning account.
- [ ] `REQUIRED — manual` Verify no orphaned accounts, scans, threats, photos, tokens, subscriptions, fingerprints, or identity profiles remain.
- [ ] `REQUIRED — device` Re-registering the same email follows the intended first-time-user behavior.
- [ ] `REQUIRED — device` Delete while offline fails safely and does not falsely claim success.
- [ ] `REQUIRED — device` Delete with an active subscription preserves Apple's billing warning.

---

## 17. Reviewer walkthrough for the submitted build

Run this exact walkthrough after all feature tests pass:

1. Delete Rook from the test device.
2. Install build 14 from TestFlight.
3. Confirm the device has no prior Rook local state.
4. Launch Rook.
5. Use only the credentials and steps stored in App Store Connect.
6. Confirm reviewer access succeeds without email inbox access.
7. Confirm Dashboard loads within 15 seconds.
8. Confirm displayed score, threat count, accounts, photos, and tier exactly match review notes.
9. Open each seeded threat.
10. Verify evidence images, percentages, explanation, and report action.
11. Filter Alerts.
12. Start a scan and wait for completion.
13. Open Connect Account, verify the supported platform screen, then cancel unless review notes require live OAuth.
14. Open the paywall from an expired/free account.
15. Verify monthly, annual, trial, Restore Purchases, Terms, and Privacy.
16. Open Photo Monitor and verify permission behavior.
17. Open Privacy & Data, export data, and cancel destructive actions.
18. Open Support, Terms, and Privacy.
19. Sign out and sign back in.
20. Confirm there are no crashes, blank screens, infinite spinners, stale data, or inaccessible buttons.

### Obsolete reviewer-script steps

- [x] `PASS — documentation` Removed old **Tools tab**, **AI Scam Analyzer**, and related steps from the canonical reviewer instructions.
- [x] `PASS — documentation` Removed unverified seeded counts and match percentages from reviewer instructions and screenshot guidance.
- [x] `PASS — documentation` Reviewer instructions require live Sign in with Apple testing; a video is not a substitute.
- [x] `PASS — documentation` Reviewer instructions no longer limit Apple to a Cancel path when testing supported integrations.
- [x] `PASS — documentation` Removed `user_photos` as a current build-14 permission; Facebook is documented as `public_profile` only.
- [x] `PASS — documentation` Published one canonical build-14 reviewer script and labeled the conflicting legacy guide superseded.

---

## 18. App Store metadata and rejection-history audit

### Demo access — Guideline 2.1

- [ ] `BLOCKER` Replace stale credentials in App Store Connect.
- [ ] `BLOCKER` Validate the exact credentials on a clean device.
- [ ] `BLOCKER` Reviewer has full access to described functionality.
- [ ] `BLOCKER` Backend and fixture seeding remain live.
- [ ] `BLOCKER` Review notes explain the access-code flow clearly.

### Sign in with Apple — Guideline 2.1(a) / login rules

- [ ] `BLOCKER` Attach evidence that first-time Apple sign-in passes on build 14.
- [ ] `BLOCKER` Confirm supported-device availability so Apple cannot install on an untested iPad.
- [ ] `BLOCKER` If iPad remains available, include iPad evidence.

### Face/photo data questionnaire

- [ ] `BLOCKER` Answer what photo/face-related data is collected.
- [ ] `BLOCKER` Explain each purpose.
- [ ] `BLOCKER` List each third party receiving data.
- [ ] `BLOCKER` State storage format/location.
- [ ] `BLOCKER` State retention and deletion timing.
- [ ] `BLOCKER` Quote matching Privacy Policy sections.
- [ ] `BLOCKER` Confirm every statement against actual runtime/database behavior.
- [ ] `BLOCKER` Obtain legal review for biometric/privacy wording where needed.

### Age rating

- [x] `PASS — documentation` Release documents now distinguish the Apple/Google content-rating questionnaire from account eligibility and remove contradictory 4+/13+/18+ instructions.
- [x] `PASS — documentation` Active release documents consistently state the in-app signup, Terms, and Privacy minimum eligibility is 17.
- [ ] `BLOCKER` Confirm the App Store Connect age-rating questionnaire and any Age Assurance/In-App Controls selections in the console; repository documentation alone is not evidence of the submitted console state.

### Subscription and promoted IAP

- [ ] `BLOCKER` Provide Apple an expired/no-subscription path.
- [ ] `BLOCKER` Verify products and trials are reviewable in every enabled territory.
- [ ] `BLOCKER` Confirm subscription review images are unique, product-specific, and legible.
- [ ] `BLOCKER` Remove price text from promotional metadata/art where Apple disallows or has rejected it.
- [ ] `BLOCKER` Confirm the standard EULA URL appears where required.

### Metadata consistency

- [x] `PASS — documentation` Chose one subtitle and one secondary category in the canonical metadata file.
- [x] `PASS — documentation` Corrected the copyright year in the canonical metadata file.
- [x] `PASS — documentation` Replaced hard-coded screenshot dimensions with current App Store Connect device-family guidance.
- [x] `PASS — documentation` Confirmed Support, Marketing, and Privacy URLs are consistently documented.
- [x] `PASS — documentation` Revised the app description to match supported platforms and current functionality.
- [x] `PASS — documentation` Removed unsupported “track every place,” “instant,” “always,” and guaranteed-protection claims.
- [x] `PASS — documentation` Confirmed Coming Soon platforms are not described as currently functional.
- [ ] `BLOCKER` Confirm privacy nutrition labels match Clerk, RevenueCat, push, photos, Vision/OpenAI/search, and server processing.

---

## 19. Meta review audit

- [ ] `BLOCKER` Request only scopes used by build 14.
- [x] `PASS — code and documentation` Build 14 requests Facebook `public_profile` only and does not submit or describe `user_photos` as live.
- [ ] `BLOCKER` Verify Instagram and Facebook reviewer test identities and roles.
- [ ] `BLOCKER` Verify exact production callback URLs and mobile deep link.
- [ ] `BLOCKER` Complete live OAuth from the review build.
- [ ] `BLOCKER` Confirm permission explanations match actual processing.
- [ ] `BLOCKER` Confirm disconnect and account deletion remove Meta tokens/data.
- [ ] `BLOCKER` Confirm data-deletion callback is registered and works.
- [ ] `REQUIRED — manual` Record a supplemental current-build review video.
- [ ] `BLOCKER` Ensure the video does not replace live reviewer access.
- [ ] `BLOCKER` Retire or label older Meta instructions that tell reviewers to approve unavailable permissions.

---

## 20. Backend, security, and operations

- [ ] `REQUIRED — manual` Production health endpoint succeeds.
- [ ] `REQUIRED — manual` All authenticated user endpoints reject missing/invalid auth.
- [ ] `REQUIRED — manual` Cross-user IDs cannot read or mutate another user's data.
- [ ] `REQUIRED — manual` Reviewer/admin endpoints reject missing or invalid admin credentials.
- [ ] `REQUIRED — manual` Reviewer access is rate limited.
- [ ] `REQUIRED — manual` OAuth state is single-use and expires.
- [ ] `REQUIRED — manual` OAuth secrets/tokens are absent from logs.
- [ ] `REQUIRED — manual` RevenueCat webhook rejects invalid signatures.
- [ ] `REQUIRED — manual` Meta webhooks/deletion callbacks validate signatures.
- [ ] `REQUIRED — manual` Scan and photo endpoints enforce rate and payload limits.
- [ ] `REQUIRED — manual` Request-size and malformed-request handling is verified.
- [ ] `REQUIRED — manual` Scheduled jobs do not crash the API.
- [ ] `REQUIRED — manual` Database backup and restore procedure is known.
- [ ] `REQUIRED — manual` Production monitoring covers authentication, purchase, scan, OAuth, notification, and deletion errors.
- [ ] `REQUIRED — manual` No production secret is bundled into the client.
- [ ] `REQUIRED — manual` Dependency and static security scans have no unresolved critical/high release blocker.

---

## 21. Final go/no-go sign-off

### Automatic no-go conditions

Do not submit if any of these is true:

- Any `BLOCKER` is not passed.
- Any required physical-device flow was not run on build 14.
- Sign in with Apple was not tested as a genuinely new identity.
- Reviewer credentials were not tested from a clean install.
- Reviewer requires an inaccessible inbox or OTP.
- Purchase or Restore Purchases was not tested through StoreKit.
- Reviewer notes do not match the seeded account.
- App Store metadata or privacy answers conflict with the app.
- Build 14 is not the build attached to the final submission.
- Backend services are not production-ready and monitored.
- A test produced a crash, blank screen, infinite spinner, wrong-user data, fabricated result, duplicate charge, or incomplete deletion.

### Required approvals

- [ ] Engineering: all automated and API checks pass.
- [ ] iOS device tester: all build 14 native checks pass.
- [ ] Product: reviewer script matches build 14.
- [ ] Privacy/legal: photo/face data and retention answers approved.
- [ ] Operations: reviewer support and production monitoring ready.
- [ ] App Store Connect owner: metadata, age rating, privacy labels, IAPs, screenshots, and review notes verified.
- [ ] Final approver: authorizes attaching build 14.
- [ ] Final approver: authorizes submitting for review.

**Current decision:** `NO-GO — native-device and submission-metadata blockers remain open.`
# Rook Build 14 — Final Release Testing Audit

**Audit date:** September 21, 2026  
**Release:** iOS 1.0.0, build 14  
**Purpose:** Release-blocking verification before the next Apple App Review submission  
**Decision:** **DO NOT SUBMIT** until every `BLOCKER` and `REQUIRED` item below has recorded passing evidence.

---

## 1. Audit rules

This is the authoritative test checklist for build 14. It replaces the functional test steps in `docs/reviewer-test-script.md` where that document conflicts with the current app.

### Status legend

- `PASS — automated`: Verified in the browser/API release-candidate test on September 21, 2026.
- `PASS — configuration`: Verified through App Store Connect, Clerk, or backend APIs.
- `REQUIRED — device`: Must be tested on the signed build on a physical iPhone.
- `REQUIRED — manual`: Must be verified in App Store Connect, production, or an external provider.
- `BLOCKER`: Submission is forbidden until the item passes.
- `N/A`: Confirmed not present in the submitted build; reviewer instructions and metadata must not mention it.

### Evidence required for every manual pass

Record:

1. Tester name
2. Date and time
3. Device model and iOS version
4. Build number (`14`)
5. Account type used
6. Expected result
7. Actual result
8. Screenshot or screen recording
9. Relevant API/request status or server log when applicable
10. Final `PASS` or `FAIL`

Do not mark an item passed because the code exists, a simulator worked, or an older build worked.

---

## 2. Current release state

- [x] `PASS — configuration` Build 14 exists in App Store Connect.
- [x] `PASS — configuration` Build 14 processing state is `VALID`.
- [x] `PASS — configuration` Build 14 is not expired.
- [x] `PASS — configuration` Build 13 remains attached to the rejected version.
- [x] `PASS — configuration` Build 14 has **not** been attached or resubmitted.
- [x] `PASS — configuration` Dedicated App Review account bootstrap and fixture seeding return success.
- [x] `PASS — configuration` Dedicated App Review one-time Clerk sign-in ticket is issued.
- [ ] `BLOCKER` Install build 14 from TestFlight on a physical iPhone.
- [ ] `BLOCKER` Complete all native-device tests in sections 5–16.
- [ ] `BLOCKER` Resolve every App Store metadata/rejection item in sections 17–20.
- [ ] `BLOCKER` Repeat the final reviewer walkthrough on a clean device using only the credentials and instructions Apple will receive.

---

## 3. Apple review requirements that control this audit

Apple's current App Review Guidelines require:

- The app to be tested for crashes and bugs.
- Complete and accurate metadata.
- Current reviewer contact information.
- Full access to every account-based feature through an active demo account or fully featured demo mode.
- All backend services to remain live during review.
- Detailed review notes for non-obvious features and in-app purchases.
- Restorable purchases to have a restore mechanism.
- Auto-renewable subscriptions to provide ongoing value and work across supported devices.
- Apps that support account creation to offer in-app account deletion.
- Social-login apps to comply with Apple's login-service rules, including Sign in with Apple where applicable.
- Privacy disclosures and permission prompts to match the data actually collected and used.

Authoritative source:  
https://developer.apple.com/app-store/review/guidelines

The checklist also incorporates the rejection materials in `attached_assets/`, especially:

- Broken or inaccessible demo credentials
- Broken first-time Sign in with Apple
- iPad review behavior
- Face/photo data questionnaire
- Age-rating selections
- Subscription review access
- Promotional in-app purchase artwork

---

## 4. Test accounts and environments

Prepare these accounts before device testing:

### A. Clean first-time user

- Never used Rook
- No onboarding state
- No connected accounts
- No subscription
- Eligible for introductory offer if the app presents one
- Used for Apple, Google, email signup, permission, onboarding, and purchase tests

### B. Returning free user

- Onboarding complete
- No active subscription
- Known scan quota state
- Used for sign-out, returning sign-in, restore-none, and quota tests

### C. Active Premium user

- Active RevenueCat `premium` entitlement
- Used to test server-tier hydration, daily monitoring copy, unlimited features, cancellation management, and cross-device restore

### D. Expired/cancelled subscriber

- Previously purchased
- Entitlement expired or cancelled
- Used to prove the paywall and purchase flow are available to Apple
- This is specifically important because prior review requested an expired/no-subscription state

### E. Dedicated App Review user

- Credentials stored only in App Store Connect's protected App Review Information fields
- Fixture seeding succeeds
- Reviewer signs in without needing access to a private inbox
- Account exposes the features described in review notes

### F. Meta test identities

- Instagram Business/Creator tester
- Facebook test user
- Added to the correct Meta app roles
- Credentials stored only in Meta reviewer instructions

### Environment checks

- [ ] `BLOCKER` Production API is deployed and healthy.
- [ ] `BLOCKER` Production Clerk tenant contains or can bootstrap the reviewer identity.
- [ ] `BLOCKER` RevenueCat production offering is current and returns monthly and annual packages.
- [ ] `BLOCKER` App Store subscription products are cleared for submission with the app version.
- [ ] `BLOCKER` Push credentials work in the distribution build.
- [ ] `BLOCKER` Meta and X redirect URLs exactly match production and the mobile deep link.
- [ ] `BLOCKER` Review support inbox is actively monitored throughout review.
- [ ] `BLOCKER` No test requires the reviewer to receive an email or OTP in an inbox they cannot access.

---

## 5. Installation, launch, and global reliability

- [ ] `REQUIRED — device` Fresh TestFlight install launches without crash.
- [ ] `REQUIRED — device` App icon, launch screen, product name, and version are correct.
- [ ] `REQUIRED — device` Animated splash completes and never loops.
- [ ] `REQUIRED — device` Slow startup exits to a clear recoverable state rather than a blank screen.
- [ ] `REQUIRED — device` Force quit and reopen preserve the correct signed-in/signed-out state.
- [ ] `REQUIRED — device` Background then foreground refreshes account state without duplicate navigation.
- [ ] `REQUIRED — device` Airplane mode shows a useful error and does not crash.
- [ ] `REQUIRED — device` API timeout produces a recoverable message, not an infinite spinner.
- [ ] `REQUIRED — device` Expired session returns safely to authentication.
- [ ] `REQUIRED — device` Invalid/deleted deep-link target shows a safe not-found state.
- [ ] `REQUIRED — device` No screen is obscured by the notch, home indicator, keyboard, or safe area.
- [ ] `REQUIRED — device` Dynamic text does not clip essential labels or buttons.
- [ ] `REQUIRED — manual` Confirm the App Store version does not support iPad if iPad is intentionally unsupported.
- [ ] `BLOCKER` If Apple can still install on iPad, run this complete audit on the iPad class used in the rejection.

---

## 6. Authentication and account creation

### Email/password

- [ ] `REQUIRED — device` Create account with valid email and password.
- [ ] `REQUIRED — device` Terms and Privacy acceptance is initially unchecked.
- [ ] `REQUIRED — device` Account creation is blocked until required agreements are accepted.
- [ ] `REQUIRED — device` Age requirement is stated consistently with policy and App Store rating.
- [ ] `REQUIRED — device` Verification code screen appears.
- [ ] `REQUIRED — device` Correct code succeeds.
- [ ] `REQUIRED — device` Wrong code shows an actionable error.
- [ ] `REQUIRED — device` Resend works and cannot be abused by rapid taps.
- [ ] `REQUIRED — device` Weak/invalid password errors are understandable.
- [ ] `REQUIRED — device` Existing email follows the correct sign-in/recovery path.
- [ ] `REQUIRED — device` Sign in with valid credentials reaches the correct destination.
- [ ] `REQUIRED — device` Invalid credentials do not reveal whether an account exists beyond intended Clerk behavior.

### Sign in with Apple — prior rejection focus

- [ ] `BLOCKER` First-time Sign in with Apple completes on build 14.
- [ ] `BLOCKER` Apple authorization creates the Clerk user when the identity is new.
- [ ] `BLOCKER` The newly created Apple user is not rejected as a nonexistent Rook account.
- [ ] `BLOCKER` The new Clerk session becomes active immediately.
- [ ] `BLOCKER` Terms, Privacy, and age acknowledgements are captured in the same first-time flow.
- [ ] `BLOCKER` Hide My Email works.
- [ ] `BLOCKER` User cancelling Apple's sheet returns safely to Auth.
- [ ] `BLOCKER` Apple error/denial produces a useful error and allows retry.
- [ ] `BLOCKER` Returning Apple user skips onboarding and lands in the app.
- [ ] `BLOCKER` Apple account with revoked app access can authenticate or recover cleanly.
- [ ] `BLOCKER` Account deletion removes the Rook account and handles Apple-account deletion requirements.

### Sign in with Google

- [ ] `BLOCKER` First-time Google sign-in creates and activates the user.
- [ ] `BLOCKER` First-time Google user completes Terms, Privacy, and age acknowledgements.
- [ ] `BLOCKER` Returning Google user skips onboarding.
- [ ] `REQUIRED — device` Cancelling Google sign-in returns safely to Auth.
- [ ] `REQUIRED — device` Provider error can be retried.

### Dedicated App Review access

- [x] `PASS — configuration` Review endpoint validates the configured access code.
- [x] `PASS — configuration` Stale configured reviewer ID recovers by resolving or creating the protected reviewer identity.
- [x] `PASS — configuration` Reviewer metadata marker is applied server-side.
- [x] `PASS — configuration` Reviewer fixture seeding succeeds.
- [x] `PASS — configuration` One-time sign-in ticket is issued.
- [ ] `BLOCKER` Use the exact App Store Connect reviewer identifier and access code in build 14 on a clean device.
- [ ] `BLOCKER` Reviewer sign-in requires no private inbox or second-factor access.
- [ ] `BLOCKER` Reviewer reaches the intended Dashboard within 15 seconds.
- [ ] `BLOCKER` Reviewer data and tier exactly match the final review notes.
- [ ] `BLOCKER` Reviewer access remains available for the entire review window.

---

## 7. Onboarding

- [x] `PASS — automated` Fresh user reaches onboarding.
- [x] `PASS — automated` Skip path records onboarding completion.
- [x] `PASS — automated` Zero-input onboarding does not start or consume a scan.
- [x] `PASS — automated` Zero-input onboarding shows no fabricated threats.
- [x] `PASS — automated` Zero-threat paywall still hydrates the subscription.
- [x] `PASS — automated` Zero-threat paywall does not fetch/display a threat preview.
- [x] `PASS — automated` “Continue with free plan” reaches the main app.
- [x] `PASS — automated` Returning user does not replay onboarding.
- [ ] `REQUIRED — device` Complete every screen using Back and Continue.
- [ ] `REQUIRED — device` Interrupt onboarding by force quit, then resume.
- [ ] `REQUIRED — device` Enter username only; real name remains blank and no placeholder is submitted.
- [ ] `REQUIRED — device` Enter real name only.
- [ ] `REQUIRED — device` Enter both username and real name.
- [ ] `REQUIRED — device` Enter neither; no scan starts and quota remains unused.
- [ ] `REQUIRED — device` Test leading/trailing spaces.
- [ ] `REQUIRED — device` Test `@username` and username without `@`.
- [ ] `REQUIRED — device` Test Unicode, punctuation, emoji, pasted profile URL, and very long input.
- [ ] `REQUIRED — device` Test harmless SQL/XSS-like strings; input is treated as text.
- [ ] `REQUIRED — device` No placeholder/example identity influences scan parameters.
- [ ] `REQUIRED — device` Photo step explains why access is requested before the OS prompt.
- [ ] `REQUIRED — device` Photo permission allow, deny, cancel, and retry all work.
- [ ] `REQUIRED — device` Onboarding cannot trap a user on a paywall.
- [ ] `REQUIRED — device` Monthly/annual pricing and trial text match StoreKit exactly.
- [ ] `REQUIRED — device` No fake countdown, fabricated social proof, simulated finding, or guaranteed-protection claim appears.

---

## 8. Dashboard

- [x] `PASS — automated` Clean account shows zero threats.
- [x] `PASS — automated` Clean account shows `Last scan: Never`.
- [x] `PASS — automated` Clean account does not show another user's profile or scan data.
- [ ] `REQUIRED — device` Loading state renders without layout breakage.
- [ ] `REQUIRED — device` Pull/foreground refresh updates data once.
- [ ] `REQUIRED — device` Security score and explanation agree.
- [ ] `REQUIRED — device` Threat count equals Alerts.
- [ ] `REQUIRED — device` Monitored account and photo counts equal Profile/Scan.
- [ ] `REQUIRED — device` Upgrade CTA opens the paywall.
- [ ] `REQUIRED — device` Connect-account CTA opens the platform picker.
- [ ] `REQUIRED — device` Tapping a recent threat opens the correct threat.
- [ ] `REQUIRED — device` Offline/error state is recoverable.
- [ ] `REQUIRED — device` Reviewer fixture values match the final reviewer notes exactly.

---

## 9. Connected accounts and OAuth

### Platform picker

- [ ] `REQUIRED — device` Instagram, Facebook, and X appear as supported.
- [ ] `REQUIRED — device` TikTok, LinkedIn, YouTube, and Snapchat are clearly non-actionable if marked Coming Soon.
- [ ] `REQUIRED — device` Cancel/back returns without changing data.

### Instagram

- [ ] `BLOCKER` OAuth opens in the expected secure browser.
- [ ] `BLOCKER` Only the approved current scope is requested.
- [ ] `BLOCKER` Successful callback returns to Rook.
- [ ] `BLOCKER` Account appears connected with correct identity.
- [ ] `REQUIRED — device` User denial returns safely and can retry.
- [ ] `REQUIRED — device` Browser cancellation returns safely.
- [ ] `REQUIRED — device` Expired/used OAuth state is rejected.
- [ ] `REQUIRED — device` Disconnect removes tokens and derived account data as disclosed.

### Facebook

- [ ] `BLOCKER` OAuth requests only current approved permissions.
- [ ] `BLOCKER` Successful callback returns to Rook and marks the account connected.
- [ ] `REQUIRED — device` Denial, cancellation, expired state, and retry work.
- [ ] `REQUIRED — device` Disconnect removes tokens and derived data.

### X

- [ ] `BLOCKER` PKCE OAuth opens and returns through the Rook deep link.
- [ ] `REQUIRED — device` Cancellation and invalid state are recoverable.
- [ ] `REQUIRED — device` Refresh token expiry marks the account for reconnection.
- [ ] `REQUIRED — device` Disconnect succeeds.

### Manage accounts

- [ ] `REQUIRED — device` Active, pending, and reconnect-needed states are accurate.
- [ ] `REQUIRED — device` Edit/save updates the account.
- [ ] `REQUIRED — device` Remove confirmation can be cancelled.
- [ ] `REQUIRED — device` Confirmed remove updates Dashboard, Profile, Scan, and quota context.
- [ ] `REQUIRED — device` Removing the last account leaves a valid empty state.
- [ ] `REQUIRED — device` Account A's data never appears for account B after account switching.

---

## 10. Scan engine

- [x] `PASS — automated` Empty identity profile does not invoke discovery.
- [x] `PASS — automated` Empty identity profile does not consume free quota.
- [x] `PASS — automated` Empty profiles do not share a cache fingerprint.
- [x] `PASS — automated` Clean user retains `0/1` free scan usage.
- [ ] `BLOCKER` Username-only scan completes without injecting a default real name.
- [ ] `BLOCKER` Real-name-only scan completes.
- [ ] `BLOCKER` Username + real name + photo scan completes.
- [ ] `BLOCKER` Scan progress advances and labels are truthful.
- [ ] `BLOCKER` Scan completes with either honest findings or an honest clean result.
- [ ] `BLOCKER` Findings belong only to the tested identity.
- [ ] `REQUIRED — device` Duplicate taps create one scan, not multiple jobs.
- [ ] `REQUIRED — device` Leaving and returning to Scan restores the active job state.
- [ ] `REQUIRED — device` Backgrounding and resuming preserves progress.
- [ ] `REQUIRED — device` No-account/no-input state explains what is needed.
- [ ] `REQUIRED — device` Free scan quota increments exactly once after a real scan.
- [ ] `REQUIRED — device` Exhausted free quota opens the correct paywall.
- [ ] `REQUIRED — device` Premium scan is not incorrectly quota blocked.
- [ ] `REQUIRED — device` API timeout/failure produces an error with retry.
- [ ] `REQUIRED — device` Stale connected-account token requests reconnection rather than silently failing.
- [ ] `REQUIRED — manual` Run a scan while the database/API is under expected production load.
- [ ] `REQUIRED — manual` Confirm scheduled Premium scans run at the documented cadence.
- [ ] `REQUIRED — manual` Confirm notifications are not sent for false or suppressed findings.

---

## 11. Alerts, threat detail, resolution, reporting, and sharing

- [ ] `BLOCKER` Reviewer account shows the exact number and severity of threats described in review notes.
- [ ] `REQUIRED — device` Alerts loading, empty, error, and populated states render.
- [ ] `REQUIRED — device` All/High/Medium/Low filters return correct items.
- [ ] `REQUIRED — device` Resolved/unresolved state is accurate.
- [ ] `REQUIRED — device` Threat detail opens the selected threat.
- [ ] `REQUIRED — device` Invalid/deleted/other-user threat IDs do not expose data.
- [ ] `REQUIRED — device` “Yours” and “Theirs” images are correct and load.
- [ ] `REQUIRED — device` Match score, severity, evidence, detected signals, and AI explanation agree.
- [ ] `REQUIRED — device` Copy says potential match/suspicious result rather than confirmed criminal conduct.
- [ ] `REQUIRED — device` Report action opens the correct official platform guidance.
- [ ] `REQUIRED — device` Resolve confirmation can be cancelled.
- [ ] `REQUIRED — device` Confirmed resolve updates threat detail, Alerts, Dashboard, and score.
- [ ] `REQUIRED — device` Suppressed/resolved account does not immediately reappear from cache.
- [ ] `REQUIRED — device` Native Share opens the iOS share sheet with correct content.
- [ ] `REQUIRED — device` Cancelling Share returns safely.
- [ ] `REQUIRED — device` Share failure displays a recoverable error.
- [ ] `REQUIRED — device` No downloadable-report claim appears unless the feature actually exists.

---

## 12. Photo monitoring and photo permissions

- [ ] `BLOCKER` Photo Monitor opens in build 14.
- [ ] `BLOCKER` Photo-library prompt text matches actual use.
- [ ] `REQUIRED — device` Allow permission permits selection.
- [ ] `REQUIRED — device` Deny permission shows a clear explanation and Settings path.
- [ ] `REQUIRED — device` Revoke permission in Settings, return, and recover.
- [ ] `REQUIRED — device` Cancel picker returns safely.
- [ ] `REQUIRED — device` Valid photo uploads/processes once.
- [ ] `REQUIRED — device` Oversized, corrupt, or unsupported image is rejected clearly.
- [ ] `REQUIRED — device` Offline photo search fails safely.
- [ ] `REQUIRED — device` No-match result is honest.
- [ ] `REQUIRED — device` Match result links to correct evidence.
- [ ] `REQUIRED — manual` Verify exactly what photo bytes, URLs, hashes, and embeddings are stored.
- [ ] `REQUIRED — manual` Verify third-party processing matches the Privacy Policy.
- [ ] `REQUIRED — manual` Verify raw photos are not retained beyond the disclosed period.

---

## 13. Subscription, purchase, restore, and entitlement

- [x] `PASS — automated` Zero-threat onboarding still hydrates the server plan.
- [x] `PASS — automated` Free-plan close action is accessible.
- [x] `PASS — automated` Server-granted tier can hydrate the paywall.
- [ ] `BLOCKER` StoreKit returns monthly and annual products in build 14.
- [ ] `BLOCKER` Product names, localized price, period, and trial match App Store Connect.
- [ ] `BLOCKER` Terms and Privacy links open before purchase.
- [ ] `BLOCKER` Auto-renewal and cancellation copy is visible and accurate.
- [ ] `BLOCKER` Monthly purchase completes in sandbox/TestFlight.
- [ ] `BLOCKER` Annual purchase completes in sandbox/TestFlight.
- [ ] `BLOCKER` RevenueCat entitlement becomes `premium`.
- [ ] `BLOCKER` Server tier syncs after purchase.
- [ ] `BLOCKER` Premium features unlock without relaunch.
- [ ] `BLOCKER` Restore Purchases restores an eligible purchase.
- [ ] `BLOCKER` Restore with no purchase shows a clear non-success result.
- [ ] `BLOCKER` Expired/cancelled subscriber sees the purchase flow.
- [ ] `REQUIRED — device` User-cancelled purchase is not shown as an error purchase.
- [ ] `REQUIRED — device` Declined, pending, offline, and StoreKit-unavailable states are recoverable.
- [ ] `REQUIRED — device` Already-Premium user does not see a misleading purchase CTA.
- [ ] `REQUIRED — device` Manage Subscription opens Apple's subscription management.
- [ ] `REQUIRED — device` Account deletion warns that store billing must be cancelled separately.
- [ ] `REQUIRED — manual` RevenueCat webhook updates renewal, cancellation, expiration, and billing-problem states.
- [ ] `REQUIRED — manual` Subscription works on a second device using the same Apple account.

---

## 14. Notifications, background behavior, and deep links

- [ ] `BLOCKER` Notification pre-prompt appears at an appropriate time.
- [ ] `REQUIRED — device` “Not Now” leaves the app usable.
- [ ] `BLOCKER` Enable triggers the native iOS permission prompt.
- [ ] `BLOCKER` Allowed permission registers a production Expo push token.
- [ ] `REQUIRED — device` Denied permission shows a Settings recovery path.
- [ ] `REQUIRED — device` Revoking permission is reflected when returning to the app.
- [ ] `REQUIRED — device` Per-category toggles persist.
- [ ] `REQUIRED — device` New-threat notification is delivered.
- [ ] `REQUIRED — device` Scan-complete notification is delivered.
- [ ] `REQUIRED — device` Weekly reminder behavior matches its setting.
- [ ] `BLOCKER` Tapping a threat notification opens the correct threat from foreground.
- [ ] `BLOCKER` Tapping it from background opens the correct threat.
- [ ] `BLOCKER` Tapping it from terminated state opens the correct threat.
- [ ] `REQUIRED — device` Alerts, Scan, and Dashboard payloads route correctly.
- [ ] `REQUIRED — device` Unknown payload falls back safely.
- [ ] `REQUIRED — device` Deleted-threat payload does not crash.
- [ ] `REQUIRED — device` Signed-out notification target does not expose private data.
- [ ] `REQUIRED — device` Sign out/account switch deregisters or reassigns the token correctly.

---

## 15. Profile, settings, privacy, and legal

### Profile and settings

- [ ] `REQUIRED — device` Profile name, handle, tier, avatar, account count, and identity badge are correct.
- [ ] `REQUIRED — device` Edit profile saves valid changes.
- [ ] `REQUIRED — device` Cancel edit discards changes.
- [ ] `REQUIRED — device` Avatar allow/deny/cancel/upload/error paths work.
- [ ] `REQUIRED — device` Security screen contains no nonfunctional controls.
- [ ] `REQUIRED — device` Notification settings reflect native permission state.
- [ ] `REQUIRED — device` Support opens a working support path.
- [ ] `REQUIRED — device` Terms and Privacy render inside the app.
- [ ] `REQUIRED — manual` Public Support, Privacy, and Terms URLs load over HTTPS.

### Photo consent and privacy

- [x] `PASS — automated` Consent can be enabled.
- [x] `PASS — automated` Consent can be withdrawn.
- [x] `PASS — automated` Confirmed withdrawal calls deletion exactly once.
- [x] `PASS — automated` Cancel does not trigger deletion.
- [x] `PASS — automated` Re-enabling clears stale withdrawal feedback.
- [x] `PASS — automated` Photo-data deletion endpoint succeeds.
- [x] `PASS — automated` Data export JSON downloads/returns.
- [ ] `REQUIRED — device` Consent notice is readable and not preselected.
- [ ] `REQUIRED — device` Withdrawing consent disables future photo scanning.
- [ ] `REQUIRED — manual` Verify photo-derived data is deleted within the disclosed time.
- [ ] `REQUIRED — manual` Verify backup-retention claims.
- [ ] `REQUIRED — manual` Verify data export includes every promised data category.
- [ ] `REQUIRED — manual` Verify users can reach a human to dispute a false result where required.

---

## 16. Sign out, returning access, and account deletion

- [x] `PASS — automated` Sign-out modal appears.
- [x] `PASS — automated` Cancel leaves the user signed in.
- [x] `PASS — automated` Confirmed sign-out returns to Auth.
- [x] `PASS — automated` Signed-out protected APIs return 401 with no user data.
- [x] `PASS — automated` Returning login bypasses onboarding.
- [x] `PASS — automated` Returning user preserves correct consent, threats, and quota.
- [x] `PASS — automated` Delete Account warning states permanence and separate store cancellation.
- [x] `PASS — automated` Cancel deletion leaves the account intact.
- [x] `PASS — automated` Confirmed deletion returns 204.
- [x] `PASS — automated` Clerk user deletion succeeds.
- [x] `PASS — automated` Post-delete notification cleanup cannot recreate the user.
- [x] `PASS — automated` App returns to Auth with no prior data.
- [ ] `BLOCKER` Repeat sign out and returning sign-in on physical build 14.
- [ ] `BLOCKER` Repeat full account deletion on physical build 14.
- [ ] `BLOCKER` Confirm same deleted identity is not silently treated as a returning account.
- [ ] `REQUIRED — manual` Verify no orphaned accounts, scans, threats, photos, tokens, subscriptions, fingerprints, or identity profiles remain.
- [ ] `REQUIRED — device` Re-registering the same email follows the intended first-time-user behavior.
- [ ] `REQUIRED — device` Delete while offline fails safely and does not falsely claim success.
- [ ] `REQUIRED — device` Delete with an active subscription preserves Apple's billing warning.

---

## 17. Reviewer walkthrough for the submitted build

Run this exact walkthrough after all feature tests pass:

1. Delete Rook from the test device.
2. Install build 14 from TestFlight.
3. Confirm the device has no prior Rook local state.
4. Launch Rook.
5. Use only the credentials and steps stored in App Store Connect.
6. Confirm reviewer access succeeds without email inbox access.
7. Confirm Dashboard loads within 15 seconds.
8. Confirm displayed score, threat count, accounts, photos, and tier exactly match review notes.
9. Open each seeded threat.
10. Verify evidence images, percentages, explanation, and report action.
11. Filter Alerts.
12. Start a scan and wait for completion.
13. Open Connect Account, verify the supported platform screen, then cancel unless review notes require live OAuth.
14. Open the paywall from an expired/free account.
15. Verify monthly, annual, trial, Restore Purchases, Terms, and Privacy.
16. Open Photo Monitor and verify permission behavior.
17. Open Privacy & Data, export data, and cancel destructive actions.
18. Open Support, Terms, and Privacy.
19. Sign out and sign back in.
20. Confirm there are no crashes, blank screens, infinite spinners, stale data, or inaccessible buttons.

### Obsolete reviewer-script steps

- [x] `PASS — documentation` Removed old **Tools tab**, **AI Scam Analyzer**, and related steps from the canonical reviewer instructions.
- [x] `PASS — documentation` Removed unverified seeded counts and match percentages from reviewer instructions and screenshot guidance.
- [x] `PASS — documentation` Reviewer instructions require live Sign in with Apple testing; a video is not a substitute.
- [x] `PASS — documentation` Reviewer instructions no longer limit Apple to a Cancel path when testing supported integrations.
- [x] `PASS — documentation` Removed `user_photos` as a current build-14 permission; Facebook is documented as `public_profile` only.
- [x] `PASS — documentation` Published one canonical build-14 reviewer script and labeled the conflicting legacy guide superseded.

---

## 18. App Store metadata and rejection-history audit

### Demo access — Guideline 2.1

- [ ] `BLOCKER` Replace stale credentials in App Store Connect.
- [ ] `BLOCKER` Validate the exact credentials on a clean device.
- [ ] `BLOCKER` Reviewer has full access to described functionality.
- [ ] `BLOCKER` Backend and fixture seeding remain live.
- [ ] `BLOCKER` Review notes explain the access-code flow clearly.

### Sign in with Apple — Guideline 2.1(a) / login rules

- [ ] `BLOCKER` Attach evidence that first-time Apple sign-in passes on build 14.
- [ ] `BLOCKER` Confirm supported-device availability so Apple cannot install on an untested iPad.
- [ ] `BLOCKER` If iPad remains available, include iPad evidence.

### Face/photo data questionnaire

- [ ] `BLOCKER` Answer what photo/face-related data is collected.
- [ ] `BLOCKER` Explain each purpose.
- [ ] `BLOCKER` List each third party receiving data.
- [ ] `BLOCKER` State storage format/location.
- [ ] `BLOCKER` State retention and deletion timing.
- [ ] `BLOCKER` Quote matching Privacy Policy sections.
- [ ] `BLOCKER` Confirm every statement against actual runtime/database behavior.
- [ ] `BLOCKER` Obtain legal review for biometric/privacy wording where needed.

### Age rating

- [x] `PASS — documentation` Release documents now distinguish the Apple/Google content-rating questionnaire from account eligibility and remove contradictory 4+/13+/18+ instructions.
- [x] `PASS — documentation` Active release documents consistently state the in-app signup, Terms, and Privacy minimum eligibility is 17.
- [ ] `BLOCKER` Confirm the App Store Connect age-rating questionnaire and any Age Assurance/In-App Controls selections in the console; repository documentation alone is not evidence of the submitted console state.

### Subscription and promoted IAP

- [ ] `BLOCKER` Provide Apple an expired/no-subscription path.
- [ ] `BLOCKER` Verify products and trials are reviewable in every enabled territory.
- [ ] `BLOCKER` Confirm subscription review images are unique, product-specific, and legible.
- [ ] `BLOCKER` Remove price text from promotional metadata/art where Apple disallows or has rejected it.
- [ ] `BLOCKER` Confirm the standard EULA URL appears where required.

### Metadata consistency

- [x] `PASS — documentation` Chose one subtitle and one secondary category in the canonical metadata file.
- [x] `PASS — documentation` Corrected the copyright year in the canonical metadata file.
- [x] `PASS — documentation` Replaced hard-coded screenshot dimensions with current App Store Connect device-family guidance.
- [x] `PASS — documentation` Confirmed Support, Marketing, and Privacy URLs are consistently documented.
- [x] `PASS — documentation` Revised the app description to match supported platforms and current functionality.
- [x] `PASS — documentation` Removed unsupported “track every place,” “instant,” “always,” and guaranteed-protection claims.
- [x] `PASS — documentation` Confirmed Coming Soon platforms are not described as currently functional.
- [ ] `BLOCKER` Confirm privacy nutrition labels match Clerk, RevenueCat, push, photos, Vision/OpenAI/search, and server processing.

---

## 19. Meta review audit

- [ ] `BLOCKER` Request only scopes used by build 14.
- [x] `PASS — code and documentation` Build 14 requests Facebook `public_profile` only and does not submit or describe `user_photos` as live.
- [ ] `BLOCKER` Verify Instagram and Facebook reviewer test identities and roles.
- [ ] `BLOCKER` Verify exact production callback URLs and mobile deep link.
- [ ] `BLOCKER` Complete live OAuth from the review build.
- [ ] `BLOCKER` Confirm permission explanations match actual processing.
- [ ] `BLOCKER` Confirm disconnect and account deletion remove Meta tokens/data.
- [ ] `BLOCKER` Confirm data-deletion callback is registered and works.
- [ ] `REQUIRED — manual` Record a supplemental current-build review video.
- [ ] `BLOCKER` Ensure the video does not replace live reviewer access.
- [ ] `BLOCKER` Retire or label older Meta instructions that tell reviewers to approve unavailable permissions.

---

## 20. Backend, security, and operations

- [ ] `REQUIRED — manual` Production health endpoint succeeds.
- [ ] `REQUIRED — manual` All authenticated user endpoints reject missing/invalid auth.
- [ ] `REQUIRED — manual` Cross-user IDs cannot read or mutate another user's data.
- [ ] `REQUIRED — manual` Reviewer/admin endpoints reject missing or invalid admin credentials.
- [ ] `REQUIRED — manual` Reviewer access is rate limited.
- [ ] `REQUIRED — manual` OAuth state is single-use and expires.
- [ ] `REQUIRED — manual` OAuth secrets/tokens are absent from logs.
- [ ] `REQUIRED — manual` RevenueCat webhook rejects invalid signatures.
- [ ] `REQUIRED — manual` Meta webhooks/deletion callbacks validate signatures.
- [ ] `REQUIRED — manual` Scan and photo endpoints enforce rate and payload limits.
- [ ] `REQUIRED — manual` Request-size and malformed-request handling is verified.
- [ ] `REQUIRED — manual` Scheduled jobs do not crash the API.
- [ ] `REQUIRED — manual` Database backup and restore procedure is known.
- [ ] `REQUIRED — manual` Production monitoring covers authentication, purchase, scan, OAuth, notification, and deletion errors.
- [ ] `REQUIRED — manual` No production secret is bundled into the client.
- [ ] `REQUIRED — manual` Dependency and static security scans have no unresolved critical/high release blocker.

---

## 21. Final go/no-go sign-off

### Automatic no-go conditions

Do not submit if any of these is true:

- Any `BLOCKER` is not passed.
- Any required physical-device flow was not run on build 14.
- Sign in with Apple was not tested as a genuinely new identity.
- Reviewer credentials were not tested from a clean install.
- Reviewer requires an inaccessible inbox or OTP.
- Purchase or Restore Purchases was not tested through StoreKit.
- Reviewer notes do not match the seeded account.
- App Store metadata or privacy answers conflict with the app.
- Build 14 is not the build attached to the final submission.
- Backend services are not production-ready and monitored.
- A test produced a crash, blank screen, infinite spinner, wrong-user data, fabricated result, duplicate charge, or incomplete deletion.

### Required approvals

- [ ] Engineering: all automated and API checks pass.
- [ ] iOS device tester: all build 14 native checks pass.
- [ ] Product: reviewer script matches build 14.
- [ ] Privacy/legal: photo/face data and retention answers approved.
- [ ] Operations: reviewer support and production monitoring ready.
- [ ] App Store Connect owner: metadata, age rating, privacy labels, IAPs, screenshots, and review notes verified.
- [ ] Final approver: authorizes attaching build 14.
- [ ] Final approver: authorizes submitting for review.

**Current decision:** `NO-GO — native-device and submission-metadata blockers remain open.`
# Rook Build 14 — Final Release Testing Audit

**Audit date:** September 21, 2026  
**Release:** iOS 1.0.0, build 14  
**Purpose:** Release-blocking verification before the next Apple App Review submission  
**Decision:** **DO NOT SUBMIT** until every `BLOCKER` and `REQUIRED` item below has recorded passing evidence.

---

## 1. Audit rules

This is the authoritative test checklist for build 14. It replaces the functional test steps in `docs/reviewer-test-script.md` where that document conflicts with the current app.

### Status legend

- `PASS — automated`: Verified in the browser/API release-candidate test on September 21, 2026.
- `PASS — configuration`: Verified through App Store Connect, Clerk, or backend APIs.
- `REQUIRED — device`: Must be tested on the signed build on a physical iPhone.
- `REQUIRED — manual`: Must be verified in App Store Connect, production, or an external provider.
- `BLOCKER`: Submission is forbidden until the item passes.
- `N/A`: Confirmed not present in the submitted build; reviewer instructions and metadata must not mention it.

### Evidence required for every manual pass

Record:

1. Tester name
2. Date and time
3. Device model and iOS version
4. Build number (`14`)
5. Account type used
6. Expected result
7. Actual result
8. Screenshot or screen recording
9. Relevant API/request status or server log when applicable
10. Final `PASS` or `FAIL`

Do not mark an item passed because the code exists, a simulator worked, or an older build worked.

---

## 2. Current release state

- [x] `PASS — configuration` Build 14 exists in App Store Connect.
- [x] `PASS — configuration` Build 14 processing state is `VALID`.
- [x] `PASS — configuration` Build 14 is not expired.
- [x] `PASS — configuration` Build 13 remains attached to the rejected version.
- [x] `PASS — configuration` Build 14 has **not** been attached or resubmitted.
- [x] `PASS — configuration` Dedicated App Review account bootstrap and fixture seeding return success.
- [x] `PASS — configuration` Dedicated App Review one-time Clerk sign-in ticket is issued.
- [ ] `BLOCKER` Install build 14 from TestFlight on a physical iPhone.
- [ ] `BLOCKER` Complete all native-device tests in sections 5–16.
- [ ] `BLOCKER` Resolve every App Store metadata/rejection item in sections 17–20.
- [ ] `BLOCKER` Repeat the final reviewer walkthrough on a clean device using only the credentials and instructions Apple will receive.

---

## 3. Apple review requirements that control this audit

Apple's current App Review Guidelines require:

- The app to be tested for crashes and bugs.
- Complete and accurate metadata.
- Current reviewer contact information.
- Full access to every account-based feature through an active demo account or fully featured demo mode.
- All backend services to remain live during review.
- Detailed review notes for non-obvious features and in-app purchases.
- Restorable purchases to have a restore mechanism.
- Auto-renewable subscriptions to provide ongoing value and work across supported devices.
- Apps that support account creation to offer in-app account deletion.
- Social-login apps to comply with Apple's login-service rules, including Sign in with Apple where applicable.
- Privacy disclosures and permission prompts to match the data actually collected and used.

Authoritative source:  
https://developer.apple.com/app-store/review/guidelines

The checklist also incorporates the rejection materials in `attached_assets/`, especially:

- Broken or inaccessible demo credentials
- Broken first-time Sign in with Apple
- iPad review behavior
- Face/photo data questionnaire
- Age-rating selections
- Subscription review access
- Promotional in-app purchase artwork

---

## 4. Test accounts and environments

Prepare these accounts before device testing:

### A. Clean first-time user

- Never used Rook
- No onboarding state
- No connected accounts
- No subscription
- Eligible for introductory offer if the app presents one
- Used for Apple, Google, email signup, permission, onboarding, and purchase tests

### B. Returning free user

- Onboarding complete
- No active subscription
- Known scan quota state
- Used for sign-out, returning sign-in, restore-none, and quota tests

### C. Active Premium user

- Active RevenueCat `premium` entitlement
- Used to test server-tier hydration, daily monitoring copy, unlimited features, cancellation management, and cross-device restore

### D. Expired/cancelled subscriber

- Previously purchased
- Entitlement expired or cancelled
- Used to prove the paywall and purchase flow are available to Apple
- This is specifically important because prior review requested an expired/no-subscription state

### E. Dedicated App Review user

- Credentials stored only in App Store Connect's protected App Review Information fields
- Fixture seeding succeeds
- Reviewer signs in without needing access to a private inbox
- Account exposes the features described in review notes

### F. Meta test identities

- Instagram Business/Creator tester
- Facebook test user
- Added to the correct Meta app roles
- Credentials stored only in Meta reviewer instructions

### Environment checks

- [ ] `BLOCKER` Production API is deployed and healthy.
- [ ] `BLOCKER` Production Clerk tenant contains or can bootstrap the reviewer identity.
- [ ] `BLOCKER` RevenueCat production offering is current and returns monthly and annual packages.
- [ ] `BLOCKER` App Store subscription products are cleared for submission with the app version.
- [ ] `BLOCKER` Push credentials work in the distribution build.
- [ ] `BLOCKER` Meta and X redirect URLs exactly match production and the mobile deep link.
- [ ] `BLOCKER` Review support inbox is actively monitored throughout review.
- [ ] `BLOCKER` No test requires the reviewer to receive an email or OTP in an inbox they cannot access.

---

## 5. Installation, launch, and global reliability

- [ ] `REQUIRED — device` Fresh TestFlight install launches without crash.
- [ ] `REQUIRED — device` App icon, launch screen, product name, and version are correct.
- [ ] `REQUIRED — device` Animated splash completes and never loops.
- [ ] `REQUIRED — device` Slow startup exits to a clear recoverable state rather than a blank screen.
- [ ] `REQUIRED — device` Force quit and reopen preserve the correct signed-in/signed-out state.
- [ ] `REQUIRED — device` Background then foreground refreshes account state without duplicate navigation.
- [ ] `REQUIRED — device` Airplane mode shows a useful error and does not crash.
- [ ] `REQUIRED — device` API timeout produces a recoverable message, not an infinite spinner.
- [ ] `REQUIRED — device` Expired session returns safely to authentication.
- [ ] `REQUIRED — device` Invalid/deleted deep-link target shows a safe not-found state.
- [ ] `REQUIRED — device` No screen is obscured by the notch, home indicator, keyboard, or safe area.
- [ ] `REQUIRED — device` Dynamic text does not clip essential labels or buttons.
- [ ] `REQUIRED — manual` Confirm the App Store version does not support iPad if iPad is intentionally unsupported.
- [ ] `BLOCKER` If Apple can still install on iPad, run this complete audit on the iPad class used in the rejection.

---

## 6. Authentication and account creation

### Email/password

- [ ] `REQUIRED — device` Create account with valid email and password.
- [ ] `REQUIRED — device` Terms and Privacy acceptance is initially unchecked.
- [ ] `REQUIRED — device` Account creation is blocked until required agreements are accepted.
- [ ] `REQUIRED — device` Age requirement is stated consistently with policy and App Store rating.
- [ ] `REQUIRED — device` Verification code screen appears.
- [ ] `REQUIRED — device` Correct code succeeds.
- [ ] `REQUIRED — device` Wrong code shows an actionable error.
- [ ] `REQUIRED — device` Resend works and cannot be abused by rapid taps.
- [ ] `REQUIRED — device` Weak/invalid password errors are understandable.
- [ ] `REQUIRED — device` Existing email follows the correct sign-in/recovery path.
- [ ] `REQUIRED — device` Sign in with valid credentials reaches the correct destination.
- [ ] `REQUIRED — device` Invalid credentials do not reveal whether an account exists beyond intended Clerk behavior.

### Sign in with Apple — prior rejection focus

- [ ] `BLOCKER` First-time Sign in with Apple completes on build 14.
- [ ] `BLOCKER` Apple authorization creates the Clerk user when the identity is new.
- [ ] `BLOCKER` The newly created Apple user is not rejected as a nonexistent Rook account.
- [ ] `BLOCKER` The new Clerk session becomes active immediately.
- [ ] `BLOCKER` Terms, Privacy, and age acknowledgements are captured in the same first-time flow.
- [ ] `BLOCKER` Hide My Email works.
- [ ] `BLOCKER` User cancelling Apple's sheet returns safely to Auth.
- [ ] `BLOCKER` Apple error/denial produces a useful error and allows retry.
- [ ] `BLOCKER` Returning Apple user skips onboarding and lands in the app.
- [ ] `BLOCKER` Apple account with revoked app access can authenticate or recover cleanly.
- [ ] `BLOCKER` Account deletion removes the Rook account and handles Apple-account deletion requirements.

### Sign in with Google

- [ ] `BLOCKER` First-time Google sign-in creates and activates the user.
- [ ] `BLOCKER` First-time Google user completes Terms, Privacy, and age acknowledgements.
- [ ] `BLOCKER` Returning Google user skips onboarding.
- [ ] `REQUIRED — device` Cancelling Google sign-in returns safely to Auth.
- [ ] `REQUIRED — device` Provider error can be retried.

### Dedicated App Review access

- [x] `PASS — configuration` Review endpoint validates the configured access code.
- [x] `PASS — configuration` Stale configured reviewer ID recovers by resolving or creating the protected reviewer identity.
- [x] `PASS — configuration` Reviewer metadata marker is applied server-side.
- [x] `PASS — configuration` Reviewer fixture seeding succeeds.
- [x] `PASS — configuration` One-time sign-in ticket is issued.
- [ ] `BLOCKER` Use the exact App Store Connect reviewer identifier and access code in build 14 on a clean device.
- [ ] `BLOCKER` Reviewer sign-in requires no private inbox or second-factor access.
- [ ] `BLOCKER` Reviewer reaches the intended Dashboard within 15 seconds.
- [ ] `BLOCKER` Reviewer data and tier exactly match the final review notes.
- [ ] `BLOCKER` Reviewer access remains available for the entire review window.

---

## 7. Onboarding

- [x] `PASS — automated` Fresh user reaches onboarding.
- [x] `PASS — automated` Skip path records onboarding completion.
- [x] `PASS — automated` Zero-input onboarding does not start or consume a scan.
- [x] `PASS — automated` Zero-input onboarding shows no fabricated threats.
- [x] `PASS — automated` Zero-threat paywall still hydrates the subscription.
- [x] `PASS — automated` Zero-threat paywall does not fetch/display a threat preview.
- [x] `PASS — automated` “Continue with free plan” reaches the main app.
- [x] `PASS — automated` Returning user does not replay onboarding.
- [ ] `REQUIRED — device` Complete every screen using Back and Continue.
- [ ] `REQUIRED — device` Interrupt onboarding by force quit, then resume.
- [ ] `REQUIRED — device` Enter username only; real name remains blank and no placeholder is submitted.
- [ ] `REQUIRED — device` Enter real name only.
- [ ] `REQUIRED — device` Enter both username and real name.
- [ ] `REQUIRED — device` Enter neither; no scan starts and quota remains unused.
- [ ] `REQUIRED — device` Test leading/trailing spaces.
- [ ] `REQUIRED — device` Test `@username` and username without `@`.
- [ ] `REQUIRED — device` Test Unicode, punctuation, emoji, pasted profile URL, and very long input.
- [ ] `REQUIRED — device` Test harmless SQL/XSS-like strings; input is treated as text.
- [ ] `REQUIRED — device` No placeholder/example identity influences scan parameters.
- [ ] `REQUIRED — device` Photo step explains why access is requested before the OS prompt.
- [ ] `REQUIRED — device` Photo permission allow, deny, cancel, and retry all work.
- [ ] `REQUIRED — device` Onboarding cannot trap a user on a paywall.
- [ ] `REQUIRED — device` Monthly/annual pricing and trial text match StoreKit exactly.
- [ ] `REQUIRED — device` No fake countdown, fabricated social proof, simulated finding, or guaranteed-protection claim appears.

---

## 8. Dashboard

- [x] `PASS — automated` Clean account shows zero threats.
- [x] `PASS — automated` Clean account shows `Last scan: Never`.
- [x] `PASS — automated` Clean account does not show another user's profile or scan data.
- [ ] `REQUIRED — device` Loading state renders without layout breakage.
- [ ] `REQUIRED — device` Pull/foreground refresh updates data once.
- [ ] `REQUIRED — device` Security score and explanation agree.
- [ ] `REQUIRED — device` Threat count equals Alerts.
- [ ] `REQUIRED — device` Monitored account and photo counts equal Profile/Scan.
- [ ] `REQUIRED — device` Upgrade CTA opens the paywall.
- [ ] `REQUIRED — device` Connect-account CTA opens the platform picker.
- [ ] `REQUIRED — device` Tapping a recent threat opens the correct threat.
- [ ] `REQUIRED — device` Offline/error state is recoverable.
- [ ] `REQUIRED — device` Reviewer fixture values match the final reviewer notes exactly.

---

## 9. Connected accounts and OAuth

### Platform picker

- [ ] `REQUIRED — device` Instagram, Facebook, and X appear as supported.
- [ ] `REQUIRED — device` TikTok, LinkedIn, YouTube, and Snapchat are clearly non-actionable if marked Coming Soon.
- [ ] `REQUIRED — device` Cancel/back returns without changing data.

### Instagram

- [ ] `BLOCKER` OAuth opens in the expected secure browser.
- [ ] `BLOCKER` Only the approved current scope is requested.
- [ ] `BLOCKER` Successful callback returns to Rook.
- [ ] `BLOCKER` Account appears connected with correct identity.
- [ ] `REQUIRED — device` User denial returns safely and can retry.
- [ ] `REQUIRED — device` Browser cancellation returns safely.
- [ ] `REQUIRED — device` Expired/used OAuth state is rejected.
- [ ] `REQUIRED — device` Disconnect removes tokens and derived account data as disclosed.

### Facebook

- [ ] `BLOCKER` OAuth requests only current approved permissions.
- [ ] `BLOCKER` Successful callback returns to Rook and marks the account connected.
- [ ] `REQUIRED — device` Denial, cancellation, expired state, and retry work.
- [ ] `REQUIRED — device` Disconnect removes tokens and derived data.

### X

- [ ] `BLOCKER` PKCE OAuth opens and returns through the Rook deep link.
- [ ] `REQUIRED — device` Cancellation and invalid state are recoverable.
- [ ] `REQUIRED — device` Refresh token expiry marks the account for reconnection.
- [ ] `REQUIRED — device` Disconnect succeeds.

### Manage accounts

- [ ] `REQUIRED — device` Active, pending, and reconnect-needed states are accurate.
- [ ] `REQUIRED — device` Edit/save updates the account.
- [ ] `REQUIRED — device` Remove confirmation can be cancelled.
- [ ] `REQUIRED — device` Confirmed remove updates Dashboard, Profile, Scan, and quota context.
- [ ] `REQUIRED — device` Removing the last account leaves a valid empty state.
- [ ] `REQUIRED — device` Account A's data never appears for account B after account switching.

---

## 10. Scan engine

- [x] `PASS — automated` Empty identity profile does not invoke discovery.
- [x] `PASS — automated` Empty identity profile does not consume free quota.
- [x] `PASS — automated` Empty profiles do not share a cache fingerprint.
- [x] `PASS — automated` Clean user retains `0/1` free scan usage.
- [ ] `BLOCKER` Username-only scan completes without injecting a default real name.
- [ ] `BLOCKER` Real-name-only scan completes.
- [ ] `BLOCKER` Username + real name + photo scan completes.
- [ ] `BLOCKER` Scan progress advances and labels are truthful.
- [ ] `BLOCKER` Scan completes with either honest findings or an honest clean result.
- [ ] `BLOCKER` Findings belong only to the tested identity.
- [ ] `REQUIRED — device` Duplicate taps create one scan, not multiple jobs.
- [ ] `REQUIRED — device` Leaving and returning to Scan restores the active job state.
- [ ] `REQUIRED — device` Backgrounding and resuming preserves progress.
- [ ] `REQUIRED — device` No-account/no-input state explains what is needed.
- [ ] `REQUIRED — device` Free scan quota increments exactly once after a real scan.
- [ ] `REQUIRED — device` Exhausted free quota opens the correct paywall.
- [ ] `REQUIRED — device` Premium scan is not incorrectly quota blocked.
- [ ] `REQUIRED — device` API timeout/failure produces an error with retry.
- [ ] `REQUIRED — device` Stale connected-account token requests reconnection rather than silently failing.
- [ ] `REQUIRED — manual` Run a scan while the database/API is under expected production load.
- [ ] `REQUIRED — manual` Confirm scheduled Premium scans run at the documented cadence.
- [ ] `REQUIRED — manual` Confirm notifications are not sent for false or suppressed findings.

---

## 11. Alerts, threat detail, resolution, reporting, and sharing

- [ ] `BLOCKER` Reviewer account shows the exact number and severity of threats described in review notes.
- [ ] `REQUIRED — device` Alerts loading, empty, error, and populated states render.
- [ ] `REQUIRED — device` All/High/Medium/Low filters return correct items.
- [ ] `REQUIRED — device` Resolved/unresolved state is accurate.
- [ ] `REQUIRED — device` Threat detail opens the selected threat.
- [ ] `REQUIRED — device` Invalid/deleted/other-user threat IDs do not expose data.
- [ ] `REQUIRED — device` “Yours” and “Theirs” images are correct and load.
- [ ] `REQUIRED — device` Match score, severity, evidence, detected signals, and AI explanation agree.
- [ ] `REQUIRED — device` Copy says potential match/suspicious result rather than confirmed criminal conduct.
- [ ] `REQUIRED — device` Report action opens the correct official platform guidance.
- [ ] `REQUIRED — device` Resolve confirmation can be cancelled.
- [ ] `REQUIRED — device` Confirmed resolve updates threat detail, Alerts, Dashboard, and score.
- [ ] `REQUIRED — device` Suppressed/resolved account does not immediately reappear from cache.
- [ ] `REQUIRED — device` Native Share opens the iOS share sheet with correct content.
- [ ] `REQUIRED — device` Cancelling Share returns safely.
- [ ] `REQUIRED — device` Share failure displays a recoverable error.
- [ ] `REQUIRED — device` No downloadable-report claim appears unless the feature actually exists.

---

## 12. Photo monitoring and photo permissions

- [ ] `BLOCKER` Photo Monitor opens in build 14.
- [ ] `BLOCKER` Photo-library prompt text matches actual use.
- [ ] `REQUIRED — device` Allow permission permits selection.
- [ ] `REQUIRED — device` Deny permission shows a clear explanation and Settings path.
- [ ] `REQUIRED — device` Revoke permission in Settings, return, and recover.
- [ ] `REQUIRED — device` Cancel picker returns safely.
- [ ] `REQUIRED — device` Valid photo uploads/processes once.
- [ ] `REQUIRED — device` Oversized, corrupt, or unsupported image is rejected clearly.
- [ ] `REQUIRED — device` Offline photo search fails safely.
- [ ] `REQUIRED — device` No-match result is honest.
- [ ] `REQUIRED — device` Match result links to correct evidence.
- [ ] `REQUIRED — manual` Verify exactly what photo bytes, URLs, hashes, and embeddings are stored.
- [ ] `REQUIRED — manual` Verify third-party processing matches the Privacy Policy.
- [ ] `REQUIRED — manual` Verify raw photos are not retained beyond the disclosed period.

---

## 13. Subscription, purchase, restore, and entitlement

- [x] `PASS — automated` Zero-threat onboarding still hydrates the server plan.
- [x] `PASS — automated` Free-plan close action is accessible.
- [x] `PASS — automated` Server-granted tier can hydrate the paywall.
- [ ] `BLOCKER` StoreKit returns monthly and annual products in build 14.
- [ ] `BLOCKER` Product names, localized price, period, and trial match App Store Connect.
- [ ] `BLOCKER` Terms and Privacy links open before purchase.
- [ ] `BLOCKER` Auto-renewal and cancellation copy is visible and accurate.
- [ ] `BLOCKER` Monthly purchase completes in sandbox/TestFlight.
- [ ] `BLOCKER` Annual purchase completes in sandbox/TestFlight.
- [ ] `BLOCKER` RevenueCat entitlement becomes `premium`.
- [ ] `BLOCKER` Server tier syncs after purchase.
- [ ] `BLOCKER` Premium features unlock without relaunch.
- [ ] `BLOCKER` Restore Purchases restores an eligible purchase.
- [ ] `BLOCKER` Restore with no purchase shows a clear non-success result.
- [ ] `BLOCKER` Expired/cancelled subscriber sees the purchase flow.
- [ ] `REQUIRED — device` User-cancelled purchase is not shown as an error purchase.
- [ ] `REQUIRED — device` Declined, pending, offline, and StoreKit-unavailable states are recoverable.
- [ ] `REQUIRED — device` Already-Premium user does not see a misleading purchase CTA.
- [ ] `REQUIRED — device` Manage Subscription opens Apple's subscription management.
- [ ] `REQUIRED — device` Account deletion warns that store billing must be cancelled separately.
- [ ] `REQUIRED — manual` RevenueCat webhook updates renewal, cancellation, expiration, and billing-problem states.
- [ ] `REQUIRED — manual` Subscription works on a second device using the same Apple account.

---

## 14. Notifications, background behavior, and deep links

- [ ] `BLOCKER` Notification pre-prompt appears at an appropriate time.
- [ ] `REQUIRED — device` “Not Now” leaves the app usable.
- [ ] `BLOCKER` Enable triggers the native iOS permission prompt.
- [ ] `BLOCKER` Allowed permission registers a production Expo push token.
- [ ] `REQUIRED — device` Denied permission shows a Settings recovery path.
- [ ] `REQUIRED — device` Revoking permission is reflected when returning to the app.
- [ ] `REQUIRED — device` Per-category toggles persist.
- [ ] `REQUIRED — device` New-threat notification is delivered.
- [ ] `REQUIRED — device` Scan-complete notification is delivered.
- [ ] `REQUIRED — device` Weekly reminder behavior matches its setting.
- [ ] `BLOCKER` Tapping a threat notification opens the correct threat from foreground.
- [ ] `BLOCKER` Tapping it from background opens the correct threat.
- [ ] `BLOCKER` Tapping it from terminated state opens the correct threat.
- [ ] `REQUIRED — device` Alerts, Scan, and Dashboard payloads route correctly.
- [ ] `REQUIRED — device` Unknown payload falls back safely.
- [ ] `REQUIRED — device` Deleted-threat payload does not crash.
- [ ] `REQUIRED — device` Signed-out notification target does not expose private data.
- [ ] `REQUIRED — device` Sign out/account switch deregisters or reassigns the token correctly.

---

## 15. Profile, settings, privacy, and legal

### Profile and settings

- [ ] `REQUIRED — device` Profile name, handle, tier, avatar, account count, and identity badge are correct.
- [ ] `REQUIRED — device` Edit profile saves valid changes.
- [ ] `REQUIRED — device` Cancel edit discards changes.
- [ ] `REQUIRED — device` Avatar allow/deny/cancel/upload/error paths work.
- [ ] `REQUIRED — device` Security screen contains no nonfunctional controls.
- [ ] `REQUIRED — device` Notification settings reflect native permission state.
- [ ] `REQUIRED — device` Support opens a working support path.
- [ ] `REQUIRED — device` Terms and Privacy render inside the app.
- [ ] `REQUIRED — manual` Public Support, Privacy, and Terms URLs load over HTTPS.

### Photo consent and privacy

- [x] `PASS — automated` Consent can be enabled.
- [x] `PASS — automated` Consent can be withdrawn.
- [x] `PASS — automated` Confirmed withdrawal calls deletion exactly once.
- [x] `PASS — automated` Cancel does not trigger deletion.
- [x] `PASS — automated` Re-enabling clears stale withdrawal feedback.
- [x] `PASS — automated` Photo-data deletion endpoint succeeds.
- [x] `PASS — automated` Data export JSON downloads/returns.
- [ ] `REQUIRED — device` Consent notice is readable and not preselected.
- [ ] `REQUIRED — device` Withdrawing consent disables future photo scanning.
- [ ] `REQUIRED — manual` Verify photo-derived data is deleted within the disclosed time.
- [ ] `REQUIRED — manual` Verify backup-retention claims.
- [ ] `REQUIRED — manual` Verify data export includes every promised data category.
- [ ] `REQUIRED — manual` Verify users can reach a human to dispute a false result where required.

---

## 16. Sign out, returning access, and account deletion

- [x] `PASS — automated` Sign-out modal appears.
- [x] `PASS — automated` Cancel leaves the user signed in.
- [x] `PASS — automated` Confirmed sign-out returns to Auth.
- [x] `PASS — automated` Signed-out protected APIs return 401 with no user data.
- [x] `PASS — automated` Returning login bypasses onboarding.
- [x] `PASS — automated` Returning user preserves correct consent, threats, and quota.
- [x] `PASS — automated` Delete Account warning states permanence and separate store cancellation.
- [x] `PASS — automated` Cancel deletion leaves the account intact.
- [x] `PASS — automated` Confirmed deletion returns 204.
- [x] `PASS — automated` Clerk user deletion succeeds.
- [x] `PASS — automated` Post-delete notification cleanup cannot recreate the user.
- [x] `PASS — automated` App returns to Auth with no prior data.
- [ ] `BLOCKER` Repeat sign out and returning sign-in on physical build 14.
- [ ] `BLOCKER` Repeat full account deletion on physical build 14.
- [ ] `BLOCKER` Confirm same deleted identity is not silently treated as a returning account.
- [ ] `REQUIRED — manual` Verify no orphaned accounts, scans, threats, photos, tokens, subscriptions, fingerprints, or identity profiles remain.
- [ ] `REQUIRED — device` Re-registering the same email follows the intended first-time-user behavior.
- [ ] `REQUIRED — device` Delete while offline fails safely and does not falsely claim success.
- [ ] `REQUIRED — device` Delete with an active subscription preserves Apple's billing warning.

---

## 17. Reviewer walkthrough for the submitted build

Run this exact walkthrough after all feature tests pass:

1. Delete Rook from the test device.
2. Install build 14 from TestFlight.
3. Confirm the device has no prior Rook local state.
4. Launch Rook.
5. Use only the credentials and steps stored in App Store Connect.
6. Confirm reviewer access succeeds without email inbox access.
7. Confirm Dashboard loads within 15 seconds.
8. Confirm displayed score, threat count, accounts, photos, and tier exactly match review notes.
9. Open each seeded threat.
10. Verify evidence images, percentages, explanation, and report action.
11. Filter Alerts.
12. Start a scan and wait for completion.
13. Open Connect Account, verify the supported platform screen, then cancel unless review notes require live OAuth.
14. Open the paywall from an expired/free account.
15. Verify monthly, annual, trial, Restore Purchases, Terms, and Privacy.
16. Open Photo Monitor and verify permission behavior.
17. Open Privacy & Data, export data, and cancel destructive actions.
18. Open Support, Terms, and Privacy.
19. Sign out and sign back in.
20. Confirm there are no crashes, blank screens, infinite spinners, stale data, or inaccessible buttons.

### Obsolete reviewer-script steps

- [x] `PASS — documentation` Removed old **Tools tab**, **AI Scam Analyzer**, and related steps from the canonical reviewer instructions.
- [x] `PASS — documentation` Removed unverified seeded counts and match percentages from reviewer instructions and screenshot guidance.
- [x] `PASS — documentation` Reviewer instructions require live Sign in with Apple testing; a video is not a substitute.
- [x] `PASS — documentation` Reviewer instructions no longer limit Apple to a Cancel path when testing supported integrations.
- [x] `PASS — documentation` Removed `user_photos` as a current build-14 permission; Facebook is documented as `public_profile` only.
- [x] `PASS — documentation` Published one canonical build-14 reviewer script and labeled the conflicting legacy guide superseded.

---

## 18. App Store metadata and rejection-history audit

### Demo access — Guideline 2.1

- [ ] `BLOCKER` Replace stale credentials in App Store Connect.
- [ ] `BLOCKER` Validate the exact credentials on a clean device.
- [ ] `BLOCKER` Reviewer has full access to described functionality.
- [ ] `BLOCKER` Backend and fixture seeding remain live.
- [ ] `BLOCKER` Review notes explain the access-code flow clearly.

### Sign in with Apple — Guideline 2.1(a) / login rules

- [ ] `BLOCKER` Attach evidence that first-time Apple sign-in passes on build 14.
- [ ] `BLOCKER` Confirm supported-device availability so Apple cannot install on an untested iPad.
- [ ] `BLOCKER` If iPad remains available, include iPad evidence.

### Face/photo data questionnaire

- [ ] `BLOCKER` Answer what photo/face-related data is collected.
- [ ] `BLOCKER` Explain each purpose.
- [ ] `BLOCKER` List each third party receiving data.
- [ ] `BLOCKER` State storage format/location.
- [ ] `BLOCKER` State retention and deletion timing.
- [ ] `BLOCKER` Quote matching Privacy Policy sections.
- [ ] `BLOCKER` Confirm every statement against actual runtime/database behavior.
- [ ] `BLOCKER` Obtain legal review for biometric/privacy wording where needed.

### Age rating

- [x] `PASS — documentation` Release documents now distinguish the Apple/Google content-rating questionnaire from account eligibility and remove contradictory 4+/13+/18+ instructions.
- [x] `PASS — documentation` Active release documents consistently state the in-app signup, Terms, and Privacy minimum eligibility is 17.
- [ ] `BLOCKER` Confirm the App Store Connect age-rating questionnaire and any Age Assurance/In-App Controls selections in the console; repository documentation alone is not evidence of the submitted console state.

### Subscription and promoted IAP

- [ ] `BLOCKER` Provide Apple an expired/no-subscription path.
- [ ] `BLOCKER` Verify products and trials are reviewable in every enabled territory.
- [ ] `BLOCKER` Confirm subscription review images are unique, product-specific, and legible.
- [ ] `BLOCKER` Remove price text from promotional metadata/art where Apple disallows or has rejected it.
- [ ] `BLOCKER` Confirm the standard EULA URL appears where required.

### Metadata consistency

- [x] `PASS — documentation` Chose one subtitle and one secondary category in the canonical metadata file.
- [x] `PASS — documentation` Corrected the copyright year in the canonical metadata file.
- [x] `PASS — documentation` Replaced hard-coded screenshot dimensions with current App Store Connect device-family guidance.
- [x] `PASS — documentation` Confirmed Support, Marketing, and Privacy URLs are consistently documented.
- [x] `PASS — documentation` Revised the app description to match supported platforms and current functionality.
- [x] `PASS — documentation` Removed unsupported “track every place,” “instant,” “always,” and guaranteed-protection claims.
- [x] `PASS — documentation` Confirmed Coming Soon platforms are not described as currently functional.
- [ ] `BLOCKER` Confirm privacy nutrition labels match Clerk, RevenueCat, push, photos, Vision/OpenAI/search, and server processing.

---

## 19. Meta review audit

- [ ] `BLOCKER` Request only scopes used by build 14.
- [x] `PASS — code and documentation` Build 14 requests Facebook `public_profile` only and does not submit or describe `user_photos` as live.
- [ ] `BLOCKER` Verify Instagram and Facebook reviewer test identities and roles.
- [ ] `BLOCKER` Verify exact production callback URLs and mobile deep link.
- [ ] `BLOCKER` Complete live OAuth from the review build.
- [ ] `BLOCKER` Confirm permission explanations match actual processing.
- [ ] `BLOCKER` Confirm disconnect and account deletion remove Meta tokens/data.
- [ ] `BLOCKER` Confirm data-deletion callback is registered and works.
- [ ] `REQUIRED — manual` Record a supplemental current-build review video.
- [ ] `BLOCKER` Ensure the video does not replace live reviewer access.
- [ ] `BLOCKER` Retire or label older Meta instructions that tell reviewers to approve unavailable permissions.

---

## 20. Backend, security, and operations

- [ ] `REQUIRED — manual` Production health endpoint succeeds.
- [ ] `REQUIRED — manual` All authenticated user endpoints reject missing/invalid auth.
- [ ] `REQUIRED — manual` Cross-user IDs cannot read or mutate another user's data.
- [ ] `REQUIRED — manual` Reviewer/admin endpoints reject missing or invalid admin credentials.
- [ ] `REQUIRED — manual` Reviewer access is rate limited.
- [ ] `REQUIRED — manual` OAuth state is single-use and expires.
- [ ] `REQUIRED — manual` OAuth secrets/tokens are absent from logs.
- [ ] `REQUIRED — manual` RevenueCat webhook rejects invalid signatures.
- [ ] `REQUIRED — manual` Meta webhooks/deletion callbacks validate signatures.
- [ ] `REQUIRED — manual` Scan and photo endpoints enforce rate and payload limits.
- [ ] `REQUIRED — manual` Request-size and malformed-request handling is verified.
- [ ] `REQUIRED — manual` Scheduled jobs do not crash the API.
- [ ] `REQUIRED — manual` Database backup and restore procedure is known.
- [ ] `REQUIRED — manual` Production monitoring covers authentication, purchase, scan, OAuth, notification, and deletion errors.
- [ ] `REQUIRED — manual` No production secret is bundled into the client.
- [ ] `REQUIRED — manual` Dependency and static security scans have no unresolved critical/high release blocker.

---

## 21. Final go/no-go sign-off

### Automatic no-go conditions

Do not submit if any of these is true:

- Any `BLOCKER` is not passed.
- Any required physical-device flow was not run on build 14.
- Sign in with Apple was not tested as a genuinely new identity.
- Reviewer credentials were not tested from a clean install.
- Reviewer requires an inaccessible inbox or OTP.
- Purchase or Restore Purchases was not tested through StoreKit.
- Reviewer notes do not match the seeded account.
- App Store metadata or privacy answers conflict with the app.
- Build 14 is not the build attached to the final submission.
- Backend services are not production-ready and monitored.
- A test produced a crash, blank screen, infinite spinner, wrong-user data, fabricated result, duplicate charge, or incomplete deletion.

### Required approvals

- [ ] Engineering: all automated and API checks pass.
- [ ] iOS device tester: all build 14 native checks pass.
- [ ] Product: reviewer script matches build 14.
- [ ] Privacy/legal: photo/face data and retention answers approved.
- [ ] Operations: reviewer support and production monitoring ready.
- [ ] App Store Connect owner: metadata, age rating, privacy labels, IAPs, screenshots, and review notes verified.
- [ ] Final approver: authorizes attaching build 14.
- [ ] Final approver: authorizes submitting for review.

**Current decision:** `NO-GO — native-device and submission-metadata blockers remain open.`
# Rook Build 14 — Final Release Testing Audit

**Audit date:** September 21, 2026  
**Release:** iOS 1.0.0, build 14  
**Purpose:** Release-blocking verification before the next Apple App Review submission  
**Decision:** **DO NOT SUBMIT** until every `BLOCKER` and `REQUIRED` item below has recorded passing evidence.

---

## 1. Audit rules

This is the authoritative test checklist for build 14. It replaces the functional test steps in `docs/reviewer-test-script.md` where that document conflicts with the current app.

### Status legend

- `PASS — automated`: Verified in the browser/API release-candidate test on September 21, 2026.
- `PASS — configuration`: Verified through App Store Connect, Clerk, or backend APIs.
- `REQUIRED — device`: Must be tested on the signed build on a physical iPhone.
- `REQUIRED — manual`: Must be verified in App Store Connect, production, or an external provider.
- `BLOCKER`: Submission is forbidden until the item passes.
- `N/A`: Confirmed not present in the submitted build; reviewer instructions and metadata must not mention it.

### Evidence required for every manual pass

Record:

1. Tester name
2. Date and time
3. Device model and iOS version
4. Build number (`14`)
5. Account type used
6. Expected result
7. Actual result
8. Screenshot or screen recording
9. Relevant API/request status or server log when applicable
10. Final `PASS` or `FAIL`

Do not mark an item passed because the code exists, a simulator worked, or an older build worked.

---

## 2. Current release state

- [x] `PASS — configuration` Build 14 exists in App Store Connect.
- [x] `PASS — configuration` Build 14 processing state is `VALID`.
- [x] `PASS — configuration` Build 14 is not expired.
- [x] `PASS — configuration` Build 13 remains attached to the rejected version.
- [x] `PASS — configuration` Build 14 has **not** been attached or resubmitted.
- [x] `PASS — configuration` Dedicated App Review account bootstrap and fixture seeding return success.
- [x] `PASS — configuration` Dedicated App Review one-time Clerk sign-in ticket is issued.
- [ ] `BLOCKER` Install build 14 from TestFlight on a physical iPhone.
- [ ] `BLOCKER` Complete all native-device tests in sections 5–16.
- [ ] `BLOCKER` Resolve every App Store metadata/rejection item in sections 17–20.
- [ ] `BLOCKER` Repeat the final reviewer walkthrough on a clean device using only the credentials and instructions Apple will receive.

---

## 3. Apple review requirements that control this audit

Apple's current App Review Guidelines require:

- The app to be tested for crashes and bugs.
- Complete and accurate metadata.
- Current reviewer contact information.
- Full access to every account-based feature through an active demo account or fully featured demo mode.
- All backend services to remain live during review.
- Detailed review notes for non-obvious features and in-app purchases.
- Restorable purchases to have a restore mechanism.
- Auto-renewable subscriptions to provide ongoing value and work across supported devices.
- Apps that support account creation to offer in-app account deletion.
- Social-login apps to comply with Apple's login-service rules, including Sign in with Apple where applicable.
- Privacy disclosures and permission prompts to match the data actually collected and used.

Authoritative source:  
https://developer.apple.com/app-store/review/guidelines

The checklist also incorporates the rejection materials in `attached_assets/`, especially:

- Broken or inaccessible demo credentials
- Broken first-time Sign in with Apple
- iPad review behavior
- Face/photo data questionnaire
- Age-rating selections
- Subscription review access
- Promotional in-app purchase artwork

---

## 4. Test accounts and environments

Prepare these accounts before device testing:

### A. Clean first-time user

- Never used Rook
- No onboarding state
- No connected accounts
- No subscription
- Eligible for introductory offer if the app presents one
- Used for Apple, Google, email signup, permission, onboarding, and purchase tests

### B. Returning free user

- Onboarding complete
- No active subscription
- Known scan quota state
- Used for sign-out, returning sign-in, restore-none, and quota tests

### C. Active Premium user

- Active RevenueCat `premium` entitlement
- Used to test server-tier hydration, daily monitoring copy, unlimited features, cancellation management, and cross-device restore

### D. Expired/cancelled subscriber

- Previously purchased
- Entitlement expired or cancelled
- Used to prove the paywall and purchase flow are available to Apple
- This is specifically important because prior review requested an expired/no-subscription state

### E. Dedicated App Review user

- Credentials stored only in App Store Connect's protected App Review Information fields
- Fixture seeding succeeds
- Reviewer signs in without needing access to a private inbox
- Account exposes the features described in review notes

### F. Meta test identities

- Instagram Business/Creator tester
- Facebook test user
- Added to the correct Meta app roles
- Credentials stored only in Meta reviewer instructions

### Environment checks

- [ ] `BLOCKER` Production API is deployed and healthy.
- [ ] `BLOCKER` Production Clerk tenant contains or can bootstrap the reviewer identity.
- [ ] `BLOCKER` RevenueCat production offering is current and returns monthly and annual packages.
- [ ] `BLOCKER` App Store subscription products are cleared for submission with the app version.
- [ ] `BLOCKER` Push credentials work in the distribution build.
- [ ] `BLOCKER` Meta and X redirect URLs exactly match production and the mobile deep link.
- [ ] `BLOCKER` Review support inbox is actively monitored throughout review.
- [ ] `BLOCKER` No test requires the reviewer to receive an email or OTP in an inbox they cannot access.

---

## 5. Installation, launch, and global reliability

- [ ] `REQUIRED — device` Fresh TestFlight install launches without crash.
- [ ] `REQUIRED — device` App icon, launch screen, product name, and version are correct.
- [ ] `REQUIRED — device` Animated splash completes and never loops.
- [ ] `REQUIRED — device` Slow startup exits to a clear recoverable state rather than a blank screen.
- [ ] `REQUIRED — device` Force quit and reopen preserve the correct signed-in/signed-out state.
- [ ] `REQUIRED — device` Background then foreground refreshes account state without duplicate navigation.
- [ ] `REQUIRED — device` Airplane mode shows a useful error and does not crash.
- [ ] `REQUIRED — device` API timeout produces a recoverable message, not an infinite spinner.
- [ ] `REQUIRED — device` Expired session returns safely to authentication.
- [ ] `REQUIRED — device` Invalid/deleted deep-link target shows a safe not-found state.
- [ ] `REQUIRED — device` No screen is obscured by the notch, home indicator, keyboard, or safe area.
- [ ] `REQUIRED — device` Dynamic text does not clip essential labels or buttons.
- [ ] `REQUIRED — manual` Confirm the App Store version does not support iPad if iPad is intentionally unsupported.
- [ ] `BLOCKER` If Apple can still install on iPad, run this complete audit on the iPad class used in the rejection.

---

## 6. Authentication and account creation

### Email/password

- [ ] `REQUIRED — device` Create account with valid email and password.
- [ ] `REQUIRED — device` Terms and Privacy acceptance is initially unchecked.
- [ ] `REQUIRED — device` Account creation is blocked until required agreements are accepted.
- [ ] `REQUIRED — device` Age requirement is stated consistently with policy and App Store rating.
- [ ] `REQUIRED — device` Verification code screen appears.
- [ ] `REQUIRED — device` Correct code succeeds.
- [ ] `REQUIRED — device` Wrong code shows an actionable error.
- [ ] `REQUIRED — device` Resend works and cannot be abused by rapid taps.
- [ ] `REQUIRED — device` Weak/invalid password errors are understandable.
- [ ] `REQUIRED — device` Existing email follows the correct sign-in/recovery path.
- [ ] `REQUIRED — device` Sign in with valid credentials reaches the correct destination.
- [ ] `REQUIRED — device` Invalid credentials do not reveal whether an account exists beyond intended Clerk behavior.

### Sign in with Apple — prior rejection focus

- [ ] `BLOCKER` First-time Sign in with Apple completes on build 14.
- [ ] `BLOCKER` Apple authorization creates the Clerk user when the identity is new.
- [ ] `BLOCKER` The newly created Apple user is not rejected as a nonexistent Rook account.
- [ ] `BLOCKER` The new Clerk session becomes active immediately.
- [ ] `BLOCKER` Terms, Privacy, and age acknowledgements are captured in the same first-time flow.
- [ ] `BLOCKER` Hide My Email works.
- [ ] `BLOCKER` User cancelling Apple's sheet returns safely to Auth.
- [ ] `BLOCKER` Apple error/denial produces a useful error and allows retry.
- [ ] `BLOCKER` Returning Apple user skips onboarding and lands in the app.
- [ ] `BLOCKER` Apple account with revoked app access can authenticate or recover cleanly.
- [ ] `BLOCKER` Account deletion removes the Rook account and handles Apple-account deletion requirements.

### Sign in with Google

- [ ] `BLOCKER` First-time Google sign-in creates and activates the user.
- [ ] `BLOCKER` First-time Google user completes Terms, Privacy, and age acknowledgements.
- [ ] `BLOCKER` Returning Google user skips onboarding.
- [ ] `REQUIRED — device` Cancelling Google sign-in returns safely to Auth.
- [ ] `REQUIRED — device` Provider error can be retried.

### Dedicated App Review access

- [x] `PASS — configuration` Review endpoint validates the configured access code.
- [x] `PASS — configuration` Stale configured reviewer ID recovers by resolving or creating the protected reviewer identity.
- [x] `PASS — configuration` Reviewer metadata marker is applied server-side.
- [x] `PASS — configuration` Reviewer fixture seeding succeeds.
- [x] `PASS — configuration` One-time sign-in ticket is issued.
- [ ] `BLOCKER` Use the exact App Store Connect reviewer identifier and access code in build 14 on a clean device.
- [ ] `BLOCKER` Reviewer sign-in requires no private inbox or second-factor access.
- [ ] `BLOCKER` Reviewer reaches the intended Dashboard within 15 seconds.
- [ ] `BLOCKER` Reviewer data and tier exactly match the final review notes.
- [ ] `BLOCKER` Reviewer access remains available for the entire review window.

---

## 7. Onboarding

- [x] `PASS — automated` Fresh user reaches onboarding.
- [x] `PASS — automated` Skip path records onboarding completion.
- [x] `PASS — automated` Zero-input onboarding does not start or consume a scan.
- [x] `PASS — automated` Zero-input onboarding shows no fabricated threats.
- [x] `PASS — automated` Zero-threat paywall still hydrates the subscription.
- [x] `PASS — automated` Zero-threat paywall does not fetch/display a threat preview.
- [x] `PASS — automated` “Continue with free plan” reaches the main app.
- [x] `PASS — automated` Returning user does not replay onboarding.
- [ ] `REQUIRED — device` Complete every screen using Back and Continue.
- [ ] `REQUIRED — device` Interrupt onboarding by force quit, then resume.
- [ ] `REQUIRED — device` Enter username only; real name remains blank and no placeholder is submitted.
- [ ] `REQUIRED — device` Enter real name only.
- [ ] `REQUIRED — device` Enter both username and real name.
- [ ] `REQUIRED — device` Enter neither; no scan starts and quota remains unused.
- [ ] `REQUIRED — device` Test leading/trailing spaces.
- [ ] `REQUIRED — device` Test `@username` and username without `@`.
- [ ] `REQUIRED — device` Test Unicode, punctuation, emoji, pasted profile URL, and very long input.
- [ ] `REQUIRED — device` Test harmless SQL/XSS-like strings; input is treated as text.
- [ ] `REQUIRED — device` No placeholder/example identity influences scan parameters.
- [ ] `REQUIRED — device` Photo step explains why access is requested before the OS prompt.
- [ ] `REQUIRED — device` Photo permission allow, deny, cancel, and retry all work.
- [ ] `REQUIRED — device` Onboarding cannot trap a user on a paywall.
- [ ] `REQUIRED — device` Monthly/annual pricing and trial text match StoreKit exactly.
- [ ] `REQUIRED — device` No fake countdown, fabricated social proof, simulated finding, or guaranteed-protection claim appears.

---

## 8. Dashboard

- [x] `PASS — automated` Clean account shows zero threats.
- [x] `PASS — automated` Clean account shows `Last scan: Never`.
- [x] `PASS — automated` Clean account does not show another user's profile or scan data.
- [ ] `REQUIRED — device` Loading state renders without layout breakage.
- [ ] `REQUIRED — device` Pull/foreground refresh updates data once.
- [ ] `REQUIRED — device` Security score and explanation agree.
- [ ] `REQUIRED — device` Threat count equals Alerts.
- [ ] `REQUIRED — device` Monitored account and photo counts equal Profile/Scan.
- [ ] `REQUIRED — device` Upgrade CTA opens the paywall.
- [ ] `REQUIRED — device` Connect-account CTA opens the platform picker.
- [ ] `REQUIRED — device` Tapping a recent threat opens the correct threat.
- [ ] `REQUIRED — device` Offline/error state is recoverable.
- [ ] `REQUIRED — device` Reviewer fixture values match the final reviewer notes exactly.

---

## 9. Connected accounts and OAuth

### Platform picker

- [ ] `REQUIRED — device` Instagram, Facebook, and X appear as supported.
- [ ] `REQUIRED — device` TikTok, LinkedIn, YouTube, and Snapchat are clearly non-actionable if marked Coming Soon.
- [ ] `REQUIRED — device` Cancel/back returns without changing data.

### Instagram

- [ ] `BLOCKER` OAuth opens in the expected secure browser.
- [ ] `BLOCKER` Only the approved current scope is requested.
- [ ] `BLOCKER` Successful callback returns to Rook.
- [ ] `BLOCKER` Account appears connected with correct identity.
- [ ] `REQUIRED — device` User denial returns safely and can retry.
- [ ] `REQUIRED — device` Browser cancellation returns safely.
- [ ] `REQUIRED — device` Expired/used OAuth state is rejected.
- [ ] `REQUIRED — device` Disconnect removes tokens and derived account data as disclosed.

### Facebook

- [ ] `BLOCKER` OAuth requests only current approved permissions.
- [ ] `BLOCKER` Successful callback returns to Rook and marks the account connected.
- [ ] `REQUIRED — device` Denial, cancellation, expired state, and retry work.
- [ ] `REQUIRED — device` Disconnect removes tokens and derived data.

### X

- [ ] `BLOCKER` PKCE OAuth opens and returns through the Rook deep link.
- [ ] `REQUIRED — device` Cancellation and invalid state are recoverable.
- [ ] `REQUIRED — device` Refresh token expiry marks the account for reconnection.
- [ ] `REQUIRED — device` Disconnect succeeds.

### Manage accounts

- [ ] `REQUIRED — device` Active, pending, and reconnect-needed states are accurate.
- [ ] `REQUIRED — device` Edit/save updates the account.
- [ ] `REQUIRED — device` Remove confirmation can be cancelled.
- [ ] `REQUIRED — device` Confirmed remove updates Dashboard, Profile, Scan, and quota context.
- [ ] `REQUIRED — device` Removing the last account leaves a valid empty state.
- [ ] `REQUIRED — device` Account A's data never appears for account B after account switching.

---

## 10. Scan engine

- [x] `PASS — automated` Empty identity profile does not invoke discovery.
- [x] `PASS — automated` Empty identity profile does not consume free quota.
- [x] `PASS — automated` Empty profiles do not share a cache fingerprint.
- [x] `PASS — automated` Clean user retains `0/1` free scan usage.
- [ ] `BLOCKER` Username-only scan completes without injecting a default real name.
- [ ] `BLOCKER` Real-name-only scan completes.
- [ ] `BLOCKER` Username + real name + photo scan completes.
- [ ] `BLOCKER` Scan progress advances and labels are truthful.
- [ ] `BLOCKER` Scan completes with either honest findings or an honest clean result.
- [ ] `BLOCKER` Findings belong only to the tested identity.
- [ ] `REQUIRED — device` Duplicate taps create one scan, not multiple jobs.
- [ ] `REQUIRED — device` Leaving and returning to Scan restores the active job state.
- [ ] `REQUIRED — device` Backgrounding and resuming preserves progress.
- [ ] `REQUIRED — device` No-account/no-input state explains what is needed.
- [ ] `REQUIRED — device` Free scan quota increments exactly once after a real scan.
- [ ] `REQUIRED — device` Exhausted free quota opens the correct paywall.
- [ ] `REQUIRED — device` Premium scan is not incorrectly quota blocked.
- [ ] `REQUIRED — device` API timeout/failure produces an error with retry.
- [ ] `REQUIRED — device` Stale connected-account token requests reconnection rather than silently failing.
- [ ] `REQUIRED — manual` Run a scan while the database/API is under expected production load.
- [ ] `REQUIRED — manual` Confirm scheduled Premium scans run at the documented cadence.
- [ ] `REQUIRED — manual` Confirm notifications are not sent for false or suppressed findings.

---

## 11. Alerts, threat detail, resolution, reporting, and sharing

- [ ] `BLOCKER` Reviewer account shows the exact number and severity of threats described in review notes.
- [ ] `REQUIRED — device` Alerts loading, empty, error, and populated states render.
- [ ] `REQUIRED — device` All/High/Medium/Low filters return correct items.
- [ ] `REQUIRED — device` Resolved/unresolved state is accurate.
- [ ] `REQUIRED — device` Threat detail opens the selected threat.
- [ ] `REQUIRED — device` Invalid/deleted/other-user threat IDs do not expose data.
- [ ] `REQUIRED — device` “Yours” and “Theirs” images are correct and load.
- [ ] `REQUIRED — device` Match score, severity, evidence, detected signals, and AI explanation agree.
- [ ] `REQUIRED — device` Copy says potential match/suspicious result rather than confirmed criminal conduct.
- [ ] `REQUIRED — device` Report action opens the correct official platform guidance.
- [ ] `REQUIRED — device` Resolve confirmation can be cancelled.
- [ ] `REQUIRED — device` Confirmed resolve updates threat detail, Alerts, Dashboard, and score.
- [ ] `REQUIRED — device` Suppressed/resolved account does not immediately reappear from cache.
- [ ] `REQUIRED — device` Native Share opens the iOS share sheet with correct content.
- [ ] `REQUIRED — device` Cancelling Share returns safely.
- [ ] `REQUIRED — device` Share failure displays a recoverable error.
- [ ] `REQUIRED — device` No downloadable-report claim appears unless the feature actually exists.

---

## 12. Photo monitoring and photo permissions

- [ ] `BLOCKER` Photo Monitor opens in build 14.
- [ ] `BLOCKER` Photo-library prompt text matches actual use.
- [ ] `REQUIRED — device` Allow permission permits selection.
- [ ] `REQUIRED — device` Deny permission shows a clear explanation and Settings path.
- [ ] `REQUIRED — device` Revoke permission in Settings, return, and recover.
- [ ] `REQUIRED — device` Cancel picker returns safely.
- [ ] `REQUIRED — device` Valid photo uploads/processes once.
- [ ] `REQUIRED — device` Oversized, corrupt, or unsupported image is rejected clearly.
- [ ] `REQUIRED — device` Offline photo search fails safely.
- [ ] `REQUIRED — device` No-match result is honest.
- [ ] `REQUIRED — device` Match result links to correct evidence.
- [ ] `REQUIRED — manual` Verify exactly what photo bytes, URLs, hashes, and embeddings are stored.
- [ ] `REQUIRED — manual` Verify third-party processing matches the Privacy Policy.
- [ ] `REQUIRED — manual` Verify raw photos are not retained beyond the disclosed period.

---

## 13. Subscription, purchase, restore, and entitlement

- [x] `PASS — automated` Zero-threat onboarding still hydrates the server plan.
- [x] `PASS — automated` Free-plan close action is accessible.
- [x] `PASS — automated` Server-granted tier can hydrate the paywall.
- [ ] `BLOCKER` StoreKit returns monthly and annual products in build 14.
- [ ] `BLOCKER` Product names, localized price, period, and trial match App Store Connect.
- [ ] `BLOCKER` Terms and Privacy links open before purchase.
- [ ] `BLOCKER` Auto-renewal and cancellation copy is visible and accurate.
- [ ] `BLOCKER` Monthly purchase completes in sandbox/TestFlight.
- [ ] `BLOCKER` Annual purchase completes in sandbox/TestFlight.
- [ ] `BLOCKER` RevenueCat entitlement becomes `premium`.
- [ ] `BLOCKER` Server tier syncs after purchase.
- [ ] `BLOCKER` Premium features unlock without relaunch.
- [ ] `BLOCKER` Restore Purchases restores an eligible purchase.
- [ ] `BLOCKER` Restore with no purchase shows a clear non-success result.
- [ ] `BLOCKER` Expired/cancelled subscriber sees the purchase flow.
- [ ] `REQUIRED — device` User-cancelled purchase is not shown as an error purchase.
- [ ] `REQUIRED — device` Declined, pending, offline, and StoreKit-unavailable states are recoverable.
- [ ] `REQUIRED — device` Already-Premium user does not see a misleading purchase CTA.
- [ ] `REQUIRED — device` Manage Subscription opens Apple's subscription management.
- [ ] `REQUIRED — device` Account deletion warns that store billing must be cancelled separately.
- [ ] `REQUIRED — manual` RevenueCat webhook updates renewal, cancellation, expiration, and billing-problem states.
- [ ] `REQUIRED — manual` Subscription works on a second device using the same Apple account.

---

## 14. Notifications, background behavior, and deep links

- [ ] `BLOCKER` Notification pre-prompt appears at an appropriate time.
- [ ] `REQUIRED — device` “Not Now” leaves the app usable.
- [ ] `BLOCKER` Enable triggers the native iOS permission prompt.
- [ ] `BLOCKER` Allowed permission registers a production Expo push token.
- [ ] `REQUIRED — device` Denied permission shows a Settings recovery path.
- [ ] `REQUIRED — device` Revoking permission is reflected when returning to the app.
- [ ] `REQUIRED — device` Per-category toggles persist.
- [ ] `REQUIRED — device` New-threat notification is delivered.
- [ ] `REQUIRED — device` Scan-complete notification is delivered.
- [ ] `REQUIRED — device` Weekly reminder behavior matches its setting.
- [ ] `BLOCKER` Tapping a threat notification opens the correct threat from foreground.
- [ ] `BLOCKER` Tapping it from background opens the correct threat.
- [ ] `BLOCKER` Tapping it from terminated state opens the correct threat.
- [ ] `REQUIRED — device` Alerts, Scan, and Dashboard payloads route correctly.
- [ ] `REQUIRED — device` Unknown payload falls back safely.
- [ ] `REQUIRED — device` Deleted-threat payload does not crash.
- [ ] `REQUIRED — device` Signed-out notification target does not expose private data.
- [ ] `REQUIRED — device` Sign out/account switch deregisters or reassigns the token correctly.

---

## 15. Profile, settings, privacy, and legal

### Profile and settings

- [ ] `REQUIRED — device` Profile name, handle, tier, avatar, account count, and identity badge are correct.
- [ ] `REQUIRED — device` Edit profile saves valid changes.
- [ ] `REQUIRED — device` Cancel edit discards changes.
- [ ] `REQUIRED — device` Avatar allow/deny/cancel/upload/error paths work.
- [ ] `REQUIRED — device` Security screen contains no nonfunctional controls.
- [ ] `REQUIRED — device` Notification settings reflect native permission state.
- [ ] `REQUIRED — device` Support opens a working support path.
- [ ] `REQUIRED — device` Terms and Privacy render inside the app.
- [ ] `REQUIRED — manual` Public Support, Privacy, and Terms URLs load over HTTPS.

### Photo consent and privacy

- [x] `PASS — automated` Consent can be enabled.
- [x] `PASS — automated` Consent can be withdrawn.
- [x] `PASS — automated` Confirmed withdrawal calls deletion exactly once.
- [x] `PASS — automated` Cancel does not trigger deletion.
- [x] `PASS — automated` Re-enabling clears stale withdrawal feedback.
- [x] `PASS — automated` Photo-data deletion endpoint succeeds.
- [x] `PASS — automated` Data export JSON downloads/returns.
- [ ] `REQUIRED — device` Consent notice is readable and not preselected.
- [ ] `REQUIRED — device` Withdrawing consent disables future photo scanning.
- [ ] `REQUIRED — manual` Verify photo-derived data is deleted within the disclosed time.
- [ ] `REQUIRED — manual` Verify backup-retention claims.
- [ ] `REQUIRED — manual` Verify data export includes every promised data category.
- [ ] `REQUIRED — manual` Verify users can reach a human to dispute a false result where required.

---

## 16. Sign out, returning access, and account deletion

- [x] `PASS — automated` Sign-out modal appears.
- [x] `PASS — automated` Cancel leaves the user signed in.
- [x] `PASS — automated` Confirmed sign-out returns to Auth.
- [x] `PASS — automated` Signed-out protected APIs return 401 with no user data.
- [x] `PASS — automated` Returning login bypasses onboarding.
- [x] `PASS — automated` Returning user preserves correct consent, threats, and quota.
- [x] `PASS — automated` Delete Account warning states permanence and separate store cancellation.
- [x] `PASS — automated` Cancel deletion leaves the account intact.
- [x] `PASS — automated` Confirmed deletion returns 204.
- [x] `PASS — automated` Clerk user deletion succeeds.
- [x] `PASS — automated` Post-delete notification cleanup cannot recreate the user.
- [x] `PASS — automated` App returns to Auth with no prior data.
- [ ] `BLOCKER` Repeat sign out and returning sign-in on physical build 14.
- [ ] `BLOCKER` Repeat full account deletion on physical build 14.
- [ ] `BLOCKER` Confirm same deleted identity is not silently treated as a returning account.
- [ ] `REQUIRED — manual` Verify no orphaned accounts, scans, threats, photos, tokens, subscriptions, fingerprints, or identity profiles remain.
- [ ] `REQUIRED — device` Re-registering the same email follows the intended first-time-user behavior.
- [ ] `REQUIRED — device` Delete while offline fails safely and does not falsely claim success.
- [ ] `REQUIRED — device` Delete with an active subscription preserves Apple's billing warning.

---

## 17. Reviewer walkthrough for the submitted build

Run this exact walkthrough after all feature tests pass:

1. Delete Rook from the test device.
2. Install build 14 from TestFlight.
3. Confirm the device has no prior Rook local state.
4. Launch Rook.
5. Use only the credentials and steps stored in App Store Connect.
6. Confirm reviewer access succeeds without email inbox access.
7. Confirm Dashboard loads within 15 seconds.
8. Confirm displayed score, threat count, accounts, photos, and tier exactly match review notes.
9. Open each seeded threat.
10. Verify evidence images, percentages, explanation, and report action.
11. Filter Alerts.
12. Start a scan and wait for completion.
13. Open Connect Account, verify the supported platform screen, then cancel unless review notes require live OAuth.
14. Open the paywall from an expired/free account.
15. Verify monthly, annual, trial, Restore Purchases, Terms, and Privacy.
16. Open Photo Monitor and verify permission behavior.
17. Open Privacy & Data, export data, and cancel destructive actions.
18. Open Support, Terms, and Privacy.
19. Sign out and sign back in.
20. Confirm there are no crashes, blank screens, infinite spinners, stale data, or inaccessible buttons.

### Obsolete reviewer-script steps

- [x] `PASS — documentation` Removed old **Tools tab**, **AI Scam Analyzer**, and related steps from the canonical reviewer instructions.
- [x] `PASS — documentation` Removed unverified seeded counts and match percentages from reviewer instructions and screenshot guidance.
- [x] `PASS — documentation` Reviewer instructions require live Sign in with Apple testing; a video is not a substitute.
- [x] `PASS — documentation` Reviewer instructions no longer limit Apple to a Cancel path when testing supported integrations.
- [x] `PASS — documentation` Removed `user_photos` as a current build-14 permission; Facebook is documented as `public_profile` only.
- [x] `PASS — documentation` Published one canonical build-14 reviewer script and labeled the conflicting legacy guide superseded.

---

## 18. App Store metadata and rejection-history audit

### Demo access — Guideline 2.1

- [ ] `BLOCKER` Replace stale credentials in App Store Connect.
- [ ] `BLOCKER` Validate the exact credentials on a clean device.
- [ ] `BLOCKER` Reviewer has full access to described functionality.
- [ ] `BLOCKER` Backend and fixture seeding remain live.
- [ ] `BLOCKER` Review notes explain the access-code flow clearly.

### Sign in with Apple — Guideline 2.1(a) / login rules

- [ ] `BLOCKER` Attach evidence that first-time Apple sign-in passes on build 14.
- [ ] `BLOCKER` Confirm supported-device availability so Apple cannot install on an untested iPad.
- [ ] `BLOCKER` If iPad remains available, include iPad evidence.

### Face/photo data questionnaire

- [ ] `BLOCKER` Answer what photo/face-related data is collected.
- [ ] `BLOCKER` Explain each purpose.
- [ ] `BLOCKER` List each third party receiving data.
- [ ] `BLOCKER` State storage format/location.
- [ ] `BLOCKER` State retention and deletion timing.
- [ ] `BLOCKER` Quote matching Privacy Policy sections.
- [ ] `BLOCKER` Confirm every statement against actual runtime/database behavior.
- [ ] `BLOCKER` Obtain legal review for biometric/privacy wording where needed.

### Age rating

- [x] `PASS — documentation` Release documents now distinguish the Apple/Google content-rating questionnaire from account eligibility and remove contradictory 4+/13+/18+ instructions.
- [x] `PASS — documentation` Active release documents consistently state the in-app signup, Terms, and Privacy minimum eligibility is 17.
- [ ] `BLOCKER` Confirm the App Store Connect age-rating questionnaire and any Age Assurance/In-App Controls selections in the console; repository documentation alone is not evidence of the submitted console state.

### Subscription and promoted IAP

- [ ] `BLOCKER` Provide Apple an expired/no-subscription path.
- [ ] `BLOCKER` Verify products and trials are reviewable in every enabled territory.
- [ ] `BLOCKER` Confirm subscription review images are unique, product-specific, and legible.
- [ ] `BLOCKER` Remove price text from promotional metadata/art where Apple disallows or has rejected it.
- [ ] `BLOCKER` Confirm the standard EULA URL appears where required.

### Metadata consistency

- [x] `PASS — documentation` Chose one subtitle and one secondary category in the canonical metadata file.
- [x] `PASS — documentation` Corrected the copyright year in the canonical metadata file.
- [x] `PASS — documentation` Replaced hard-coded screenshot dimensions with current App Store Connect device-family guidance.
- [x] `PASS — documentation` Confirmed Support, Marketing, and Privacy URLs are consistently documented.
- [x] `PASS — documentation` Revised the app description to match supported platforms and current functionality.
- [x] `PASS — documentation` Removed unsupported “track every place,” “instant,” “always,” and guaranteed-protection claims.
- [x] `PASS — documentation` Confirmed Coming Soon platforms are not described as currently functional.
- [ ] `BLOCKER` Confirm privacy nutrition labels match Clerk, RevenueCat, push, photos, Vision/OpenAI/search, and server processing.

---

## 19. Meta review audit

- [ ] `BLOCKER` Request only scopes used by build 14.
- [x] `PASS — code and documentation` Build 14 requests Facebook `public_profile` only and does not submit or describe `user_photos` as live.
- [ ] `BLOCKER` Verify Instagram and Facebook reviewer test identities and roles.
- [ ] `BLOCKER` Verify exact production callback URLs and mobile deep link.
- [ ] `BLOCKER` Complete live OAuth from the review build.
- [ ] `BLOCKER` Confirm permission explanations match actual processing.
- [ ] `BLOCKER` Confirm disconnect and account deletion remove Meta tokens/data.
- [ ] `BLOCKER` Confirm data-deletion callback is registered and works.
- [ ] `REQUIRED — manual` Record a supplemental current-build review video.
- [ ] `BLOCKER` Ensure the video does not replace live reviewer access.
- [ ] `BLOCKER` Retire or label older Meta instructions that tell reviewers to approve unavailable permissions.

---

## 20. Backend, security, and operations

- [ ] `REQUIRED — manual` Production health endpoint succeeds.
- [ ] `REQUIRED — manual` All authenticated user endpoints reject missing/invalid auth.
- [ ] `REQUIRED — manual` Cross-user IDs cannot read or mutate another user's data.
- [ ] `REQUIRED — manual` Reviewer/admin endpoints reject missing or invalid admin credentials.
- [ ] `REQUIRED — manual` Reviewer access is rate limited.
- [ ] `REQUIRED — manual` OAuth state is single-use and expires.
- [ ] `REQUIRED — manual` OAuth secrets/tokens are absent from logs.
- [ ] `REQUIRED — manual` RevenueCat webhook rejects invalid signatures.
- [ ] `REQUIRED — manual` Meta webhooks/deletion callbacks validate signatures.
- [ ] `REQUIRED — manual` Scan and photo endpoints enforce rate and payload limits.
- [ ] `REQUIRED — manual` Request-size and malformed-request handling is verified.
- [ ] `REQUIRED — manual` Scheduled jobs do not crash the API.
- [ ] `REQUIRED — manual` Database backup and restore procedure is known.
- [ ] `REQUIRED — manual` Production monitoring covers authentication, purchase, scan, OAuth, notification, and deletion errors.
- [ ] `REQUIRED — manual` No production secret is bundled into the client.
- [ ] `REQUIRED — manual` Dependency and static security scans have no unresolved critical/high release blocker.

---

## 21. Final go/no-go sign-off

### Automatic no-go conditions

Do not submit if any of these is true:

- Any `BLOCKER` is not passed.
- Any required physical-device flow was not run on build 14.
- Sign in with Apple was not tested as a genuinely new identity.
- Reviewer credentials were not tested from a clean install.
- Reviewer requires an inaccessible inbox or OTP.
- Purchase or Restore Purchases was not tested through StoreKit.
- Reviewer notes do not match the seeded account.
- App Store metadata or privacy answers conflict with the app.
- Build 14 is not the build attached to the final submission.
- Backend services are not production-ready and monitored.
- A test produced a crash, blank screen, infinite spinner, wrong-user data, fabricated result, duplicate charge, or incomplete deletion.

### Required approvals

- [ ] Engineering: all automated and API checks pass.
- [ ] iOS device tester: all build 14 native checks pass.
- [ ] Product: reviewer script matches build 14.
- [ ] Privacy/legal: photo/face data and retention answers approved.
- [ ] Operations: reviewer support and production monitoring ready.
- [ ] App Store Connect owner: metadata, age rating, privacy labels, IAPs, screenshots, and review notes verified.
- [ ] Final approver: authorizes attaching build 14.
- [ ] Final approver: authorizes submitting for review.

**Current decision:** `NO-GO — native-device and submission-metadata blockers remain open.`
# Rook Build 14 — Final Release Testing Audit

**Audit date:** September 21, 2026  
**Release:** iOS 1.0.0, build 14  
**Purpose:** Release-blocking verification before the next Apple App Review submission  
**Decision:** **DO NOT SUBMIT** until every `BLOCKER` and `REQUIRED` item below has recorded passing evidence.

---

## 1. Audit rules

This is the authoritative test checklist for build 14. It replaces the functional test steps in `docs/reviewer-test-script.md` where that document conflicts with the current app.

### Status legend

- `PASS — automated`: Verified in the browser/API release-candidate test on September 21, 2026.
- `PASS — configuration`: Verified through App Store Connect, Clerk, or backend APIs.
- `REQUIRED — device`: Must be tested on the signed build on a physical iPhone.
- `REQUIRED — manual`: Must be verified in App Store Connect, production, or an external provider.
- `BLOCKER`: Submission is forbidden until the item passes.
- `N/A`: Confirmed not present in the submitted build; reviewer instructions and metadata must not mention it.

### Evidence required for every manual pass

Record:

1. Tester name
2. Date and time
3. Device model and iOS version
4. Build number (`14`)
5. Account type used
6. Expected result
7. Actual result
8. Screenshot or screen recording
9. Relevant API/request status or server log when applicable
10. Final `PASS` or `FAIL`

Do not mark an item passed because the code exists, a simulator worked, or an older build worked.

---

## 2. Current release state

- [x] `PASS — configuration` Build 14 exists in App Store Connect.
- [x] `PASS — configuration` Build 14 processing state is `VALID`.
- [x] `PASS — configuration` Build 14 is not expired.
- [x] `PASS — configuration` Build 13 remains attached to the rejected version.
- [x] `PASS — configuration` Build 14 has **not** been attached or resubmitted.
- [x] `PASS — configuration` Dedicated App Review account bootstrap and fixture seeding return success.
- [x] `PASS — configuration` Dedicated App Review one-time Clerk sign-in ticket is issued.
- [ ] `BLOCKER` Install build 14 from TestFlight on a physical iPhone.
- [ ] `BLOCKER` Complete all native-device tests in sections 5–16.
- [ ] `BLOCKER` Resolve every App Store metadata/rejection item in sections 17–20.
- [ ] `BLOCKER` Repeat the final reviewer walkthrough on a clean device using only the credentials and instructions Apple will receive.

---

## 3. Apple review requirements that control this audit

Apple's current App Review Guidelines require:

- The app to be tested for crashes and bugs.
- Complete and accurate metadata.
- Current reviewer contact information.
- Full access to every account-based feature through an active demo account or fully featured demo mode.
- All backend services to remain live during review.
- Detailed review notes for non-obvious features and in-app purchases.
- Restorable purchases to have a restore mechanism.
- Auto-renewable subscriptions to provide ongoing value and work across supported devices.
- Apps that support account creation to offer in-app account deletion.
- Social-login apps to comply with Apple's login-service rules, including Sign in with Apple where applicable.
- Privacy disclosures and permission prompts to match the data actually collected and used.

Authoritative source:  
https://developer.apple.com/app-store/review/guidelines

The checklist also incorporates the rejection materials in `attached_assets/`, especially:

- Broken or inaccessible demo credentials
- Broken first-time Sign in with Apple
- iPad review behavior
- Face/photo data questionnaire
- Age-rating selections
- Subscription review access
- Promotional in-app purchase artwork

---

## 4. Test accounts and environments

Prepare these accounts before device testing:

### A. Clean first-time user

- Never used Rook
- No onboarding state
- No connected accounts
- No subscription
- Eligible for introductory offer if the app presents one
- Used for Apple, Google, email signup, permission, onboarding, and purchase tests

### B. Returning free user

- Onboarding complete
- No active subscription
- Known scan quota state
- Used for sign-out, returning sign-in, restore-none, and quota tests

### C. Active Premium user

- Active RevenueCat `premium` entitlement
- Used to test server-tier hydration, daily monitoring copy, unlimited features, cancellation management, and cross-device restore

### D. Expired/cancelled subscriber

- Previously purchased
- Entitlement expired or cancelled
- Used to prove the paywall and purchase flow are available to Apple
- This is specifically important because prior review requested an expired/no-subscription state

### E. Dedicated App Review user

- Credentials stored only in App Store Connect's protected App Review Information fields
- Fixture seeding succeeds
- Reviewer signs in without needing access to a private inbox
- Account exposes the features described in review notes

### F. Meta test identities

- Instagram Business/Creator tester
- Facebook test user
- Added to the correct Meta app roles
- Credentials stored only in Meta reviewer instructions

### Environment checks

- [ ] `BLOCKER` Production API is deployed and healthy.
- [ ] `BLOCKER` Production Clerk tenant contains or can bootstrap the reviewer identity.
- [ ] `BLOCKER` RevenueCat production offering is current and returns monthly and annual packages.
- [ ] `BLOCKER` App Store subscription products are cleared for submission with the app version.
- [ ] `BLOCKER` Push credentials work in the distribution build.
- [ ] `BLOCKER` Meta and X redirect URLs exactly match production and the mobile deep link.
- [ ] `BLOCKER` Review support inbox is actively monitored throughout review.
- [ ] `BLOCKER` No test requires the reviewer to receive an email or OTP in an inbox they cannot access.

---

## 5. Installation, launch, and global reliability

- [ ] `REQUIRED — device` Fresh TestFlight install launches without crash.
- [ ] `REQUIRED — device` App icon, launch screen, product name, and version are correct.
- [ ] `REQUIRED — device` Animated splash completes and never loops.
- [ ] `REQUIRED — device` Slow startup exits to a clear recoverable state rather than a blank screen.
- [ ] `REQUIRED — device` Force quit and reopen preserve the correct signed-in/signed-out state.
- [ ] `REQUIRED — device` Background then foreground refreshes account state without duplicate navigation.
- [ ] `REQUIRED — device` Airplane mode shows a useful error and does not crash.
- [ ] `REQUIRED — device` API timeout produces a recoverable message, not an infinite spinner.
- [ ] `REQUIRED — device` Expired session returns safely to authentication.
- [ ] `REQUIRED — device` Invalid/deleted deep-link target shows a safe not-found state.
- [ ] `REQUIRED — device` No screen is obscured by the notch, home indicator, keyboard, or safe area.
- [ ] `REQUIRED — device` Dynamic text does not clip essential labels or buttons.
- [ ] `REQUIRED — manual` Confirm the App Store version does not support iPad if iPad is intentionally unsupported.
- [ ] `BLOCKER` If Apple can still install on iPad, run this complete audit on the iPad class used in the rejection.

---

## 6. Authentication and account creation

### Email/password

- [ ] `REQUIRED — device` Create account with valid email and password.
- [ ] `REQUIRED — device` Terms and Privacy acceptance is initially unchecked.
- [ ] `REQUIRED — device` Account creation is blocked until required agreements are accepted.
- [ ] `REQUIRED — device` Age requirement is stated consistently with policy and App Store rating.
- [ ] `REQUIRED — device` Verification code screen appears.
- [ ] `REQUIRED — device` Correct code succeeds.
- [ ] `REQUIRED — device` Wrong code shows an actionable error.
- [ ] `REQUIRED — device` Resend works and cannot be abused by rapid taps.
- [ ] `REQUIRED — device` Weak/invalid password errors are understandable.
- [ ] `REQUIRED — device` Existing email follows the correct sign-in/recovery path.
- [ ] `REQUIRED — device` Sign in with valid credentials reaches the correct destination.
- [ ] `REQUIRED — device` Invalid credentials do not reveal whether an account exists beyond intended Clerk behavior.

### Sign in with Apple — prior rejection focus

- [ ] `BLOCKER` First-time Sign in with Apple completes on build 14.
- [ ] `BLOCKER` Apple authorization creates the Clerk user when the identity is new.
- [ ] `BLOCKER` The newly created Apple user is not rejected as a nonexistent Rook account.
- [ ] `BLOCKER` The new Clerk session becomes active immediately.
- [ ] `BLOCKER` Terms, Privacy, and age acknowledgements are captured in the same first-time flow.
- [ ] `BLOCKER` Hide My Email works.
- [ ] `BLOCKER` User cancelling Apple's sheet returns safely to Auth.
- [ ] `BLOCKER` Apple error/denial produces a useful error and allows retry.
- [ ] `BLOCKER` Returning Apple user skips onboarding and lands in the app.
- [ ] `BLOCKER` Apple account with revoked app access can authenticate or recover cleanly.
- [ ] `BLOCKER` Account deletion removes the Rook account and handles Apple-account deletion requirements.

### Sign in with Google

- [ ] `BLOCKER` First-time Google sign-in creates and activates the user.
- [ ] `BLOCKER` First-time Google user completes Terms, Privacy, and age acknowledgements.
- [ ] `BLOCKER` Returning Google user skips onboarding.
- [ ] `REQUIRED — device` Cancelling Google sign-in returns safely to Auth.
- [ ] `REQUIRED — device` Provider error can be retried.

### Dedicated App Review access

- [x] `PASS — configuration` Review endpoint validates the configured access code.
- [x] `PASS — configuration` Stale configured reviewer ID recovers by resolving or creating the protected reviewer identity.
- [x] `PASS — configuration` Reviewer metadata marker is applied server-side.
- [x] `PASS — configuration` Reviewer fixture seeding succeeds.
- [x] `PASS — configuration` One-time sign-in ticket is issued.
- [ ] `BLOCKER` Use the exact App Store Connect reviewer identifier and access code in build 14 on a clean device.
- [ ] `BLOCKER` Reviewer sign-in requires no private inbox or second-factor access.
- [ ] `BLOCKER` Reviewer reaches the intended Dashboard within 15 seconds.
- [ ] `BLOCKER` Reviewer data and tier exactly match the final review notes.
- [ ] `BLOCKER` Reviewer access remains available for the entire review window.

---

## 7. Onboarding

- [x] `PASS — automated` Fresh user reaches onboarding.
- [x] `PASS — automated` Skip path records onboarding completion.
- [x] `PASS — automated` Zero-input onboarding does not start or consume a scan.
- [x] `PASS — automated` Zero-input onboarding shows no fabricated threats.
- [x] `PASS — automated` Zero-threat paywall still hydrates the subscription.
- [x] `PASS — automated` Zero-threat paywall does not fetch/display a threat preview.
- [x] `PASS — automated` “Continue with free plan” reaches the main app.
- [x] `PASS — automated` Returning user does not replay onboarding.
- [ ] `REQUIRED — device` Complete every screen using Back and Continue.
- [ ] `REQUIRED — device` Interrupt onboarding by force quit, then resume.
- [ ] `REQUIRED — device` Enter username only; real name remains blank and no placeholder is submitted.
- [ ] `REQUIRED — device` Enter real name only.
- [ ] `REQUIRED — device` Enter both username and real name.
- [ ] `REQUIRED — device` Enter neither; no scan starts and quota remains unused.
- [ ] `REQUIRED — device` Test leading/trailing spaces.
- [ ] `REQUIRED — device` Test `@username` and username without `@`.
- [ ] `REQUIRED — device` Test Unicode, punctuation, emoji, pasted profile URL, and very long input.
- [ ] `REQUIRED — device` Test harmless SQL/XSS-like strings; input is treated as text.
- [ ] `REQUIRED — device` No placeholder/example identity influences scan parameters.
- [ ] `REQUIRED — device` Photo step explains why access is requested before the OS prompt.
- [ ] `REQUIRED — device` Photo permission allow, deny, cancel, and retry all work.
- [ ] `REQUIRED — device` Onboarding cannot trap a user on a paywall.
- [ ] `REQUIRED — device` Monthly/annual pricing and trial text match StoreKit exactly.
- [ ] `REQUIRED — device` No fake countdown, fabricated social proof, simulated finding, or guaranteed-protection claim appears.

---

## 8. Dashboard

- [x] `PASS — automated` Clean account shows zero threats.
- [x] `PASS — automated` Clean account shows `Last scan: Never`.
- [x] `PASS — automated` Clean account does not show another user's profile or scan data.
- [ ] `REQUIRED — device` Loading state renders without layout breakage.
- [ ] `REQUIRED — device` Pull/foreground refresh updates data once.
- [ ] `REQUIRED — device` Security score and explanation agree.
- [ ] `REQUIRED — device` Threat count equals Alerts.
- [ ] `REQUIRED — device` Monitored account and photo counts equal Profile/Scan.
- [ ] `REQUIRED — device` Upgrade CTA opens the paywall.
- [ ] `REQUIRED — device` Connect-account CTA opens the platform picker.
- [ ] `REQUIRED — device` Tapping a recent threat opens the correct threat.
- [ ] `REQUIRED — device` Offline/error state is recoverable.
- [ ] `REQUIRED — device` Reviewer fixture values match the final reviewer notes exactly.

---

## 9. Connected accounts and OAuth

### Platform picker

- [ ] `REQUIRED — device` Instagram, Facebook, and X appear as supported.
- [ ] `REQUIRED — device` TikTok, LinkedIn, YouTube, and Snapchat are clearly non-actionable if marked Coming Soon.
- [ ] `REQUIRED — device` Cancel/back returns without changing data.

### Instagram

- [ ] `BLOCKER` OAuth opens in the expected secure browser.
- [ ] `BLOCKER` Only the approved current scope is requested.
- [ ] `BLOCKER` Successful callback returns to Rook.
- [ ] `BLOCKER` Account appears connected with correct identity.
- [ ] `REQUIRED — device` User denial returns safely and can retry.
- [ ] `REQUIRED — device` Browser cancellation returns safely.
- [ ] `REQUIRED — device` Expired/used OAuth state is rejected.
- [ ] `REQUIRED — device` Disconnect removes tokens and derived account data as disclosed.

### Facebook

- [ ] `BLOCKER` OAuth requests only current approved permissions.
- [ ] `BLOCKER` Successful callback returns to Rook and marks the account connected.
- [ ] `REQUIRED — device` Denial, cancellation, expired state, and retry work.
- [ ] `REQUIRED — device` Disconnect removes tokens and derived data.

### X

- [ ] `BLOCKER` PKCE OAuth opens and returns through the Rook deep link.
- [ ] `REQUIRED — device` Cancellation and invalid state are recoverable.
- [ ] `REQUIRED — device` Refresh token expiry marks the account for reconnection.
- [ ] `REQUIRED — device` Disconnect succeeds.

### Manage accounts

- [ ] `REQUIRED — device` Active, pending, and reconnect-needed states are accurate.
- [ ] `REQUIRED — device` Edit/save updates the account.
- [ ] `REQUIRED — device` Remove confirmation can be cancelled.
- [ ] `REQUIRED — device` Confirmed remove updates Dashboard, Profile, Scan, and quota context.
- [ ] `REQUIRED — device` Removing the last account leaves a valid empty state.
- [ ] `REQUIRED — device` Account A's data never appears for account B after account switching.

---

## 10. Scan engine

- [x] `PASS — automated` Empty identity profile does not invoke discovery.
- [x] `PASS — automated` Empty identity profile does not consume free quota.
- [x] `PASS — automated` Empty profiles do not share a cache fingerprint.
- [x] `PASS — automated` Clean user retains `0/1` free scan usage.
- [ ] `BLOCKER` Username-only scan completes without injecting a default real name.
- [ ] `BLOCKER` Real-name-only scan completes.
- [ ] `BLOCKER` Username + real name + photo scan completes.
- [ ] `BLOCKER` Scan progress advances and labels are truthful.
- [ ] `BLOCKER` Scan completes with either honest findings or an honest clean result.
- [ ] `BLOCKER` Findings belong only to the tested identity.
- [ ] `REQUIRED — device` Duplicate taps create one scan, not multiple jobs.
- [ ] `REQUIRED — device` Leaving and returning to Scan restores the active job state.
- [ ] `REQUIRED — device` Backgrounding and resuming preserves progress.
- [ ] `REQUIRED — device` No-account/no-input state explains what is needed.
- [ ] `REQUIRED — device` Free scan quota increments exactly once after a real scan.
- [ ] `REQUIRED — device` Exhausted free quota opens the correct paywall.
- [ ] `REQUIRED — device` Premium scan is not incorrectly quota blocked.
- [ ] `REQUIRED — device` API timeout/failure produces an error with retry.
- [ ] `REQUIRED — device` Stale connected-account token requests reconnection rather than silently failing.
- [ ] `REQUIRED — manual` Run a scan while the database/API is under expected production load.
- [ ] `REQUIRED — manual` Confirm scheduled Premium scans run at the documented cadence.
- [ ] `REQUIRED — manual` Confirm notifications are not sent for false or suppressed findings.

---

## 11. Alerts, threat detail, resolution, reporting, and sharing

- [ ] `BLOCKER` Reviewer account shows the exact number and severity of threats described in review notes.
- [ ] `REQUIRED — device` Alerts loading, empty, error, and populated states render.
- [ ] `REQUIRED — device` All/High/Medium/Low filters return correct items.
- [ ] `REQUIRED — device` Resolved/unresolved state is accurate.
- [ ] `REQUIRED — device` Threat detail opens the selected threat.
- [ ] `REQUIRED — device` Invalid/deleted/other-user threat IDs do not expose data.
- [ ] `REQUIRED — device` “Yours” and “Theirs” images are correct and load.
- [ ] `REQUIRED — device` Match score, severity, evidence, detected signals, and AI explanation agree.
- [ ] `REQUIRED — device` Copy says potential match/suspicious result rather than confirmed criminal conduct.
- [ ] `REQUIRED — device` Report action opens the correct official platform guidance.
- [ ] `REQUIRED — device` Resolve confirmation can be cancelled.
- [ ] `REQUIRED — device` Confirmed resolve updates threat detail, Alerts, Dashboard, and score.
- [ ] `REQUIRED — device` Suppressed/resolved account does not immediately reappear from cache.
- [ ] `REQUIRED — device` Native Share opens the iOS share sheet with correct content.
- [ ] `REQUIRED — device` Cancelling Share returns safely.
- [ ] `REQUIRED — device` Share failure displays a recoverable error.
- [ ] `REQUIRED — device` No downloadable-report claim appears unless the feature actually exists.

---

## 12. Photo monitoring and photo permissions

- [ ] `BLOCKER` Photo Monitor opens in build 14.
- [ ] `BLOCKER` Photo-library prompt text matches actual use.
- [ ] `REQUIRED — device` Allow permission permits selection.
- [ ] `REQUIRED — device` Deny permission shows a clear explanation and Settings path.
- [ ] `REQUIRED — device` Revoke permission in Settings, return, and recover.
- [ ] `REQUIRED — device` Cancel picker returns safely.
- [ ] `REQUIRED — device` Valid photo uploads/processes once.
- [ ] `REQUIRED — device` Oversized, corrupt, or unsupported image is rejected clearly.
- [ ] `REQUIRED — device` Offline photo search fails safely.
- [ ] `REQUIRED — device` No-match result is honest.
- [ ] `REQUIRED — device` Match result links to correct evidence.
- [ ] `REQUIRED — manual` Verify exactly what photo bytes, URLs, hashes, and embeddings are stored.
- [ ] `REQUIRED — manual` Verify third-party processing matches the Privacy Policy.
- [ ] `REQUIRED — manual` Verify raw photos are not retained beyond the disclosed period.

---

## 13. Subscription, purchase, restore, and entitlement

- [x] `PASS — automated` Zero-threat onboarding still hydrates the server plan.
- [x] `PASS — automated` Free-plan close action is accessible.
- [x] `PASS — automated` Server-granted tier can hydrate the paywall.
- [ ] `BLOCKER` StoreKit returns monthly and annual products in build 14.
- [ ] `BLOCKER` Product names, localized price, period, and trial match App Store Connect.
- [ ] `BLOCKER` Terms and Privacy links open before purchase.
- [ ] `BLOCKER` Auto-renewal and cancellation copy is visible and accurate.
- [ ] `BLOCKER` Monthly purchase completes in sandbox/TestFlight.
- [ ] `BLOCKER` Annual purchase completes in sandbox/TestFlight.
- [ ] `BLOCKER` RevenueCat entitlement becomes `premium`.
- [ ] `BLOCKER` Server tier syncs after purchase.
- [ ] `BLOCKER` Premium features unlock without relaunch.
- [ ] `BLOCKER` Restore Purchases restores an eligible purchase.
- [ ] `BLOCKER` Restore with no purchase shows a clear non-success result.
- [ ] `BLOCKER` Expired/cancelled subscriber sees the purchase flow.
- [ ] `REQUIRED — device` User-cancelled purchase is not shown as an error purchase.
- [ ] `REQUIRED — device` Declined, pending, offline, and StoreKit-unavailable states are recoverable.
- [ ] `REQUIRED — device` Already-Premium user does not see a misleading purchase CTA.
- [ ] `REQUIRED — device` Manage Subscription opens Apple's subscription management.
- [ ] `REQUIRED — device` Account deletion warns that store billing must be cancelled separately.
- [ ] `REQUIRED — manual` RevenueCat webhook updates renewal, cancellation, expiration, and billing-problem states.
- [ ] `REQUIRED — manual` Subscription works on a second device using the same Apple account.

---

## 14. Notifications, background behavior, and deep links

- [ ] `BLOCKER` Notification pre-prompt appears at an appropriate time.
- [ ] `REQUIRED — device` “Not Now” leaves the app usable.
- [ ] `BLOCKER` Enable triggers the native iOS permission prompt.
- [ ] `BLOCKER` Allowed permission registers a production Expo push token.
- [ ] `REQUIRED — device` Denied permission shows a Settings recovery path.
- [ ] `REQUIRED — device` Revoking permission is reflected when returning to the app.
- [ ] `REQUIRED — device` Per-category toggles persist.
- [ ] `REQUIRED — device` New-threat notification is delivered.
- [ ] `REQUIRED — device` Scan-complete notification is delivered.
- [ ] `REQUIRED — device` Weekly reminder behavior matches its setting.
- [ ] `BLOCKER` Tapping a threat notification opens the correct threat from foreground.
- [ ] `BLOCKER` Tapping it from background opens the correct threat.
- [ ] `BLOCKER` Tapping it from terminated state opens the correct threat.
- [ ] `REQUIRED — device` Alerts, Scan, and Dashboard payloads route correctly.
- [ ] `REQUIRED — device` Unknown payload falls back safely.
- [ ] `REQUIRED — device` Deleted-threat payload does not crash.
- [ ] `REQUIRED — device` Signed-out notification target does not expose private data.
- [ ] `REQUIRED — device` Sign out/account switch deregisters or reassigns the token correctly.

---

## 15. Profile, settings, privacy, and legal

### Profile and settings

- [ ] `REQUIRED — device` Profile name, handle, tier, avatar, account count, and identity badge are correct.
- [ ] `REQUIRED — device` Edit profile saves valid changes.
- [ ] `REQUIRED — device` Cancel edit discards changes.
- [ ] `REQUIRED — device` Avatar allow/deny/cancel/upload/error paths work.
- [ ] `REQUIRED — device` Security screen contains no nonfunctional controls.
- [ ] `REQUIRED — device` Notification settings reflect native permission state.
- [ ] `REQUIRED — device` Support opens a working support path.
- [ ] `REQUIRED — device` Terms and Privacy render inside the app.
- [ ] `REQUIRED — manual` Public Support, Privacy, and Terms URLs load over HTTPS.

### Photo consent and privacy

- [x] `PASS — automated` Consent can be enabled.
- [x] `PASS — automated` Consent can be withdrawn.
- [x] `PASS — automated` Confirmed withdrawal calls deletion exactly once.
- [x] `PASS — automated` Cancel does not trigger deletion.
- [x] `PASS — automated` Re-enabling clears stale withdrawal feedback.
- [x] `PASS — automated` Photo-data deletion endpoint succeeds.
- [x] `PASS — automated` Data export JSON downloads/returns.
- [ ] `REQUIRED — device` Consent notice is readable and not preselected.
- [ ] `REQUIRED — device` Withdrawing consent disables future photo scanning.
- [ ] `REQUIRED — manual` Verify photo-derived data is deleted within the disclosed time.
- [ ] `REQUIRED — manual` Verify backup-retention claims.
- [ ] `REQUIRED — manual` Verify data export includes every promised data category.
- [ ] `REQUIRED — manual` Verify users can reach a human to dispute a false result where required.

---

## 16. Sign out, returning access, and account deletion

- [x] `PASS — automated` Sign-out modal appears.
- [x] `PASS — automated` Cancel leaves the user signed in.
- [x] `PASS — automated` Confirmed sign-out returns to Auth.
- [x] `PASS — automated` Signed-out protected APIs return 401 with no user data.
- [x] `PASS — automated` Returning login bypasses onboarding.
- [x] `PASS — automated` Returning user preserves correct consent, threats, and quota.
- [x] `PASS — automated` Delete Account warning states permanence and separate store cancellation.
- [x] `PASS — automated` Cancel deletion leaves the account intact.
- [x] `PASS — automated` Confirmed deletion returns 204.
- [x] `PASS — automated` Clerk user deletion succeeds.
- [x] `PASS — automated` Post-delete notification cleanup cannot recreate the user.
- [x] `PASS — automated` App returns to Auth with no prior data.
- [ ] `BLOCKER` Repeat sign out and returning sign-in on physical build 14.
- [ ] `BLOCKER` Repeat full account deletion on physical build 14.
- [ ] `BLOCKER` Confirm same deleted identity is not silently treated as a returning account.
- [ ] `REQUIRED — manual` Verify no orphaned accounts, scans, threats, photos, tokens, subscriptions, fingerprints, or identity profiles remain.
- [ ] `REQUIRED — device` Re-registering the same email follows the intended first-time-user behavior.
- [ ] `REQUIRED — device` Delete while offline fails safely and does not falsely claim success.
- [ ] `REQUIRED — device` Delete with an active subscription preserves Apple's billing warning.

---

## 17. Reviewer walkthrough for the submitted build

Run this exact walkthrough after all feature tests pass:

1. Delete Rook from the test device.
2. Install build 14 from TestFlight.
3. Confirm the device has no prior Rook local state.
4. Launch Rook.
5. Use only the credentials and steps stored in App Store Connect.
6. Confirm reviewer access succeeds without email inbox access.
7. Confirm Dashboard loads within 15 seconds.
8. Confirm displayed score, threat count, accounts, photos, and tier exactly match review notes.
9. Open each seeded threat.
10. Verify evidence images, percentages, explanation, and report action.
11. Filter Alerts.
12. Start a scan and wait for completion.
13. Open Connect Account, verify the supported platform screen, then cancel unless review notes require live OAuth.
14. Open the paywall from an expired/free account.
15. Verify monthly, annual, trial, Restore Purchases, Terms, and Privacy.
16. Open Photo Monitor and verify permission behavior.
17. Open Privacy & Data, export data, and cancel destructive actions.
18. Open Support, Terms, and Privacy.
19. Sign out and sign back in.
20. Confirm there are no crashes, blank screens, infinite spinners, stale data, or inaccessible buttons.

### Obsolete reviewer-script steps

- [x] `PASS — documentation` Removed old **Tools tab**, **AI Scam Analyzer**, and related steps from the canonical reviewer instructions.
- [x] `PASS — documentation` Removed unverified seeded counts and match percentages from reviewer instructions and screenshot guidance.
- [x] `PASS — documentation` Reviewer instructions require live Sign in with Apple testing; a video is not a substitute.
- [x] `PASS — documentation` Reviewer instructions no longer limit Apple to a Cancel path when testing supported integrations.
- [x] `PASS — documentation` Removed `user_photos` as a current build-14 permission; Facebook is documented as `public_profile` only.
- [x] `PASS — documentation` Published one canonical build-14 reviewer script and labeled the conflicting legacy guide superseded.

---

## 18. App Store metadata and rejection-history audit

### Demo access — Guideline 2.1

- [ ] `BLOCKER` Replace stale credentials in App Store Connect.
- [ ] `BLOCKER` Validate the exact credentials on a clean device.
- [ ] `BLOCKER` Reviewer has full access to described functionality.
- [ ] `BLOCKER` Backend and fixture seeding remain live.
- [ ] `BLOCKER` Review notes explain the access-code flow clearly.

### Sign in with Apple — Guideline 2.1(a) / login rules

- [ ] `BLOCKER` Attach evidence that first-time Apple sign-in passes on build 14.
- [ ] `BLOCKER` Confirm supported-device availability so Apple cannot install on an untested iPad.
- [ ] `BLOCKER` If iPad remains available, include iPad evidence.

### Face/photo data questionnaire

- [ ] `BLOCKER` Answer what photo/face-related data is collected.
- [ ] `BLOCKER` Explain each purpose.
- [ ] `BLOCKER` List each third party receiving data.
- [ ] `BLOCKER` State storage format/location.
- [ ] `BLOCKER` State retention and deletion timing.
- [ ] `BLOCKER` Quote matching Privacy Policy sections.
- [ ] `BLOCKER` Confirm every statement against actual runtime/database behavior.
- [ ] `BLOCKER` Obtain legal review for biometric/privacy wording where needed.

### Age rating

- [x] `PASS — documentation` Release documents now distinguish the Apple/Google content-rating questionnaire from account eligibility and remove contradictory 4+/13+/18+ instructions.
- [x] `PASS — documentation` Active release documents consistently state the in-app signup, Terms, and Privacy minimum eligibility is 17.
- [ ] `BLOCKER` Confirm the App Store Connect age-rating questionnaire and any Age Assurance/In-App Controls selections in the console; repository documentation alone is not evidence of the submitted console state.

### Subscription and promoted IAP

- [ ] `BLOCKER` Provide Apple an expired/no-subscription path.
- [ ] `BLOCKER` Verify products and trials are reviewable in every enabled territory.
- [ ] `BLOCKER` Confirm subscription review images are unique, product-specific, and legible.
- [ ] `BLOCKER` Remove price text from promotional metadata/art where Apple disallows or has rejected it.
- [ ] `BLOCKER` Confirm the standard EULA URL appears where required.

### Metadata consistency

- [x] `PASS — documentation` Chose one subtitle and one secondary category in the canonical metadata file.
- [x] `PASS — documentation` Corrected the copyright year in the canonical metadata file.
- [x] `PASS — documentation` Replaced hard-coded screenshot dimensions with current App Store Connect device-family guidance.
- [x] `PASS — documentation` Confirmed Support, Marketing, and Privacy URLs are consistently documented.
- [x] `PASS — documentation` Revised the app description to match supported platforms and current functionality.
- [x] `PASS — documentation` Removed unsupported “track every place,” “instant,” “always,” and guaranteed-protection claims.
- [x] `PASS — documentation` Confirmed Coming Soon platforms are not described as currently functional.
- [ ] `BLOCKER` Confirm privacy nutrition labels match Clerk, RevenueCat, push, photos, Vision/OpenAI/search, and server processing.

---

## 19. Meta review audit

- [ ] `BLOCKER` Request only scopes used by build 14.
- [x] `PASS — code and documentation` Build 14 requests Facebook `public_profile` only and does not submit or describe `user_photos` as live.
- [ ] `BLOCKER` Verify Instagram and Facebook reviewer test identities and roles.
- [ ] `BLOCKER` Verify exact production callback URLs and mobile deep link.
- [ ] `BLOCKER` Complete live OAuth from the review build.
- [ ] `BLOCKER` Confirm permission explanations match actual processing.
- [ ] `BLOCKER` Confirm disconnect and account deletion remove Meta tokens/data.
- [ ] `BLOCKER` Confirm data-deletion callback is registered and works.
- [ ] `REQUIRED — manual` Record a supplemental current-build review video.
- [ ] `BLOCKER` Ensure the video does not replace live reviewer access.
- [ ] `BLOCKER` Retire or label older Meta instructions that tell reviewers to approve unavailable permissions.

---

## 20. Backend, security, and operations

- [ ] `REQUIRED — manual` Production health endpoint succeeds.
- [ ] `REQUIRED — manual` All authenticated user endpoints reject missing/invalid auth.
- [ ] `REQUIRED — manual` Cross-user IDs cannot read or mutate another user's data.
- [ ] `REQUIRED — manual` Reviewer/admin endpoints reject missing or invalid admin credentials.
- [ ] `REQUIRED — manual` Reviewer access is rate limited.
- [ ] `REQUIRED — manual` OAuth state is single-use and expires.
- [ ] `REQUIRED — manual` OAuth secrets/tokens are absent from logs.
- [ ] `REQUIRED — manual` RevenueCat webhook rejects invalid signatures.
- [ ] `REQUIRED — manual` Meta webhooks/deletion callbacks validate signatures.
- [ ] `REQUIRED — manual` Scan and photo endpoints enforce rate and payload limits.
- [ ] `REQUIRED — manual` Request-size and malformed-request handling is verified.
- [ ] `REQUIRED — manual` Scheduled jobs do not crash the API.
- [ ] `REQUIRED — manual` Database backup and restore procedure is known.
- [ ] `REQUIRED — manual` Production monitoring covers authentication, purchase, scan, OAuth, notification, and deletion errors.
- [ ] `REQUIRED — manual` No production secret is bundled into the client.
- [ ] `REQUIRED — manual` Dependency and static security scans have no unresolved critical/high release blocker.

---

## 21. Final go/no-go sign-off

### Automatic no-go conditions

Do not submit if any of these is true:

- Any `BLOCKER` is not passed.
- Any required physical-device flow was not run on build 14.
- Sign in with Apple was not tested as a genuinely new identity.
- Reviewer credentials were not tested from a clean install.
- Reviewer requires an inaccessible inbox or OTP.
- Purchase or Restore Purchases was not tested through StoreKit.
- Reviewer notes do not match the seeded account.
- App Store metadata or privacy answers conflict with the app.
- Build 14 is not the build attached to the final submission.
- Backend services are not production-ready and monitored.
- A test produced a crash, blank screen, infinite spinner, wrong-user data, fabricated result, duplicate charge, or incomplete deletion.

### Required approvals

- [ ] Engineering: all automated and API checks pass.
- [ ] iOS device tester: all build 14 native checks pass.
- [ ] Product: reviewer script matches build 14.
- [ ] Privacy/legal: photo/face data and retention answers approved.
- [ ] Operations: reviewer support and production monitoring ready.
- [ ] App Store Connect owner: metadata, age rating, privacy labels, IAPs, screenshots, and review notes verified.
- [ ] Final approver: authorizes attaching build 14.
- [ ] Final approver: authorizes submitting for review.

**Current decision:** `NO-GO — native-device and submission-metadata blockers remain open.`
# Rook Build 14 — Final Release Testing Audit

**Audit date:** September 21, 2026  
**Release:** iOS 1.0.0, build 14  
**Purpose:** Release-blocking verification before the next Apple App Review submission  
**Decision:** **DO NOT SUBMIT** until every `BLOCKER` and `REQUIRED` item below has recorded passing evidence.

---

## 1. Audit rules

This is the authoritative test checklist for build 14. It replaces the functional test steps in `docs/reviewer-test-script.md` where that document conflicts with the current app.

### Status legend

- `PASS — automated`: Verified in the browser/API release-candidate test on September 21, 2026.
- `PASS — configuration`: Verified through App Store Connect, Clerk, or backend APIs.
- `REQUIRED — device`: Must be tested on the signed build on a physical iPhone.
- `REQUIRED — manual`: Must be verified in App Store Connect, production, or an external provider.
- `BLOCKER`: Submission is forbidden until the item passes.
- `N/A`: Confirmed not present in the submitted build; reviewer instructions and metadata must not mention it.

### Evidence required for every manual pass

Record:

1. Tester name
2. Date and time
3. Device model and iOS version
4. Build number (`14`)
5. Account type used
6. Expected result
7. Actual result
8. Screenshot or screen recording
9. Relevant API/request status or server log when applicable
10. Final `PASS` or `FAIL`

Do not mark an item passed because the code exists, a simulator worked, or an older build worked.

---

## 2. Current release state

- [x] `PASS — configuration` Build 14 exists in App Store Connect.
- [x] `PASS — configuration` Build 14 processing state is `VALID`.
- [x] `PASS — configuration` Build 14 is not expired.
- [x] `PASS — configuration` Build 13 remains attached to the rejected version.
- [x] `PASS — configuration` Build 14 has **not** been attached or resubmitted.
- [x] `PASS — configuration` Dedicated App Review account bootstrap and fixture seeding return success.
- [x] `PASS — configuration` Dedicated App Review one-time Clerk sign-in ticket is issued.
- [ ] `BLOCKER` Install build 14 from TestFlight on a physical iPhone.
- [ ] `BLOCKER` Complete all native-device tests in sections 5–16.
- [ ] `BLOCKER` Resolve every App Store metadata/rejection item in sections 17–20.
- [ ] `BLOCKER` Repeat the final reviewer walkthrough on a clean device using only the credentials and instructions Apple will receive.

---

## 3. Apple review requirements that control this audit

Apple's current App Review Guidelines require:

- The app to be tested for crashes and bugs.
- Complete and accurate metadata.
- Current reviewer contact information.
- Full access to every account-based feature through an active demo account or fully featured demo mode.
- All backend services to remain live during review.
- Detailed review notes for non-obvious features and in-app purchases.
- Restorable purchases to have a restore mechanism.
- Auto-renewable subscriptions to provide ongoing value and work across supported devices.
- Apps that support account creation to offer in-app account deletion.
- Social-login apps to comply with Apple's login-service rules, including Sign in with Apple where applicable.
- Privacy disclosures and permission prompts to match the data actually collected and used.

Authoritative source:  
https://developer.apple.com/app-store/review/guidelines

The checklist also incorporates the rejection materials in `attached_assets/`, especially:

- Broken or inaccessible demo credentials
- Broken first-time Sign in with Apple
- iPad review behavior
- Face/photo data questionnaire
- Age-rating selections
- Subscription review access
- Promotional in-app purchase artwork

---

## 4. Test accounts and environments

Prepare these accounts before device testing:

### A. Clean first-time user

- Never used Rook
- No onboarding state
- No connected accounts
- No subscription
- Eligible for introductory offer if the app presents one
- Used for Apple, Google, email signup, permission, onboarding, and purchase tests

### B. Returning free user

- Onboarding complete
- No active subscription
- Known scan quota state
- Used for sign-out, returning sign-in, restore-none, and quota tests

### C. Active Premium user

- Active RevenueCat `premium` entitlement
- Used to test server-tier hydration, daily monitoring copy, unlimited features, cancellation management, and cross-device restore

### D. Expired/cancelled subscriber

- Previously purchased
- Entitlement expired or cancelled
- Used to prove the paywall and purchase flow are available to Apple
- This is specifically important because prior review requested an expired/no-subscription state

### E. Dedicated App Review user

- Credentials stored only in App Store Connect's protected App Review Information fields
- Fixture seeding succeeds
- Reviewer signs in without needing access to a private inbox
- Account exposes the features described in review notes

### F. Meta test identities

- Instagram Business/Creator tester
- Facebook test user
- Added to the correct Meta app roles
- Credentials stored only in Meta reviewer instructions

### Environment checks

- [ ] `BLOCKER` Production API is deployed and healthy.
- [ ] `BLOCKER` Production Clerk tenant contains or can bootstrap the reviewer identity.
- [ ] `BLOCKER` RevenueCat production offering is current and returns monthly and annual packages.
- [ ] `BLOCKER` App Store subscription products are cleared for submission with the app version.
- [ ] `BLOCKER` Push credentials work in the distribution build.
- [ ] `BLOCKER` Meta and X redirect URLs exactly match production and the mobile deep link.
- [ ] `BLOCKER` Review support inbox is actively monitored throughout review.
- [ ] `BLOCKER` No test requires the reviewer to receive an email or OTP in an inbox they cannot access.

---

## 5. Installation, launch, and global reliability

- [ ] `REQUIRED — device` Fresh TestFlight install launches without crash.
- [ ] `REQUIRED — device` App icon, launch screen, product name, and version are correct.
- [ ] `REQUIRED — device` Animated splash completes and never loops.
- [ ] `REQUIRED — device` Slow startup exits to a clear recoverable state rather than a blank screen.
- [ ] `REQUIRED — device` Force quit and reopen preserve the correct signed-in/signed-out state.
- [ ] `REQUIRED — device` Background then foreground refreshes account state without duplicate navigation.
- [ ] `REQUIRED — device` Airplane mode shows a useful error and does not crash.
- [ ] `REQUIRED — device` API timeout produces a recoverable message, not an infinite spinner.
- [ ] `REQUIRED — device` Expired session returns safely to authentication.
- [ ] `REQUIRED — device` Invalid/deleted deep-link target shows a safe not-found state.
- [ ] `REQUIRED — device` No screen is obscured by the notch, home indicator, keyboard, or safe area.
- [ ] `REQUIRED — device` Dynamic text does not clip essential labels or buttons.
- [ ] `REQUIRED — manual` Confirm the App Store version does not support iPad if iPad is intentionally unsupported.
- [ ] `BLOCKER` If Apple can still install on iPad, run this complete audit on the iPad class used in the rejection.

---

## 6. Authentication and account creation

### Email/password

- [ ] `REQUIRED — device` Create account with valid email and password.
- [ ] `REQUIRED — device` Terms and Privacy acceptance is initially unchecked.
- [ ] `REQUIRED — device` Account creation is blocked until required agreements are accepted.
- [ ] `REQUIRED — device` Age requirement is stated consistently with policy and App Store rating.
- [ ] `REQUIRED — device` Verification code screen appears.
- [ ] `REQUIRED — device` Correct code succeeds.
- [ ] `REQUIRED — device` Wrong code shows an actionable error.
- [ ] `REQUIRED — device` Resend works and cannot be abused by rapid taps.
- [ ] `REQUIRED — device` Weak/invalid password errors are understandable.
- [ ] `REQUIRED — device` Existing email follows the correct sign-in/recovery path.
- [ ] `REQUIRED — device` Sign in with valid credentials reaches the correct destination.
- [ ] `REQUIRED — device` Invalid credentials do not reveal whether an account exists beyond intended Clerk behavior.

### Sign in with Apple — prior rejection focus

- [ ] `BLOCKER` First-time Sign in with Apple completes on build 14.
- [ ] `BLOCKER` Apple authorization creates the Clerk user when the identity is new.
- [ ] `BLOCKER` The newly created Apple user is not rejected as a nonexistent Rook account.
- [ ] `BLOCKER` The new Clerk session becomes active immediately.
- [ ] `BLOCKER` Terms, Privacy, and age acknowledgements are captured in the same first-time flow.
- [ ] `BLOCKER` Hide My Email works.
- [ ] `BLOCKER` User cancelling Apple's sheet returns safely to Auth.
- [ ] `BLOCKER` Apple error/denial produces a useful error and allows retry.
- [ ] `BLOCKER` Returning Apple user skips onboarding and lands in the app.
- [ ] `BLOCKER` Apple account with revoked app access can authenticate or recover cleanly.
- [ ] `BLOCKER` Account deletion removes the Rook account and handles Apple-account deletion requirements.

### Sign in with Google

- [ ] `BLOCKER` First-time Google sign-in creates and activates the user.
- [ ] `BLOCKER` First-time Google user completes Terms, Privacy, and age acknowledgements.
- [ ] `BLOCKER` Returning Google user skips onboarding.
- [ ] `REQUIRED — device` Cancelling Google sign-in returns safely to Auth.
- [ ] `REQUIRED — device` Provider error can be retried.

### Dedicated App Review access

- [x] `PASS — configuration` Review endpoint validates the configured access code.
- [x] `PASS — configuration` Stale configured reviewer ID recovers by resolving or creating the protected reviewer identity.
- [x] `PASS — configuration` Reviewer metadata marker is applied server-side.
- [x] `PASS — configuration` Reviewer fixture seeding succeeds.
- [x] `PASS — configuration` One-time sign-in ticket is issued.
- [ ] `BLOCKER` Use the exact App Store Connect reviewer identifier and access code in build 14 on a clean device.
- [ ] `BLOCKER` Reviewer sign-in requires no private inbox or second-factor access.
- [ ] `BLOCKER` Reviewer reaches the intended Dashboard within 15 seconds.
- [ ] `BLOCKER` Reviewer data and tier exactly match the final review notes.
- [ ] `BLOCKER` Reviewer access remains available for the entire review window.

---

## 7. Onboarding

- [x] `PASS — automated` Fresh user reaches onboarding.
- [x] `PASS — automated` Skip path records onboarding completion.
- [x] `PASS — automated` Zero-input onboarding does not start or consume a scan.
- [x] `PASS — automated` Zero-input onboarding shows no fabricated threats.
- [x] `PASS — automated` Zero-threat paywall still hydrates the subscription.
- [x] `PASS — automated` Zero-threat paywall does not fetch/display a threat preview.
- [x] `PASS — automated` “Continue with free plan” reaches the main app.
- [x] `PASS — automated` Returning user does not replay onboarding.
- [ ] `REQUIRED — device` Complete every screen using Back and Continue.
- [ ] `REQUIRED — device` Interrupt onboarding by force quit, then resume.
- [ ] `REQUIRED — device` Enter username only; real name remains blank and no placeholder is submitted.
- [ ] `REQUIRED — device` Enter real name only.
- [ ] `REQUIRED — device` Enter both username and real name.
- [ ] `REQUIRED — device` Enter neither; no scan starts and quota remains unused.
- [ ] `REQUIRED — device` Test leading/trailing spaces.
- [ ] `REQUIRED — device` Test `@username` and username without `@`.
- [ ] `REQUIRED — device` Test Unicode, punctuation, emoji, pasted profile URL, and very long input.
- [ ] `REQUIRED — device` Test harmless SQL/XSS-like strings; input is treated as text.
- [ ] `REQUIRED — device` No placeholder/example identity influences scan parameters.
- [ ] `REQUIRED — device` Photo step explains why access is requested before the OS prompt.
- [ ] `REQUIRED — device` Photo permission allow, deny, cancel, and retry all work.
- [ ] `REQUIRED — device` Onboarding cannot trap a user on a paywall.
- [ ] `REQUIRED — device` Monthly/annual pricing and trial text match StoreKit exactly.
- [ ] `REQUIRED — device` No fake countdown, fabricated social proof, simulated finding, or guaranteed-protection claim appears.

---

## 8. Dashboard

- [x] `PASS — automated` Clean account shows zero threats.
- [x] `PASS — automated` Clean account shows `Last scan: Never`.
- [x] `PASS — automated` Clean account does not show another user's profile or scan data.
- [ ] `REQUIRED — device` Loading state renders without layout breakage.
- [ ] `REQUIRED — device` Pull/foreground refresh updates data once.
- [ ] `REQUIRED — device` Security score and explanation agree.
- [ ] `REQUIRED — device` Threat count equals Alerts.
- [ ] `REQUIRED — device` Monitored account and photo counts equal Profile/Scan.
- [ ] `REQUIRED — device` Upgrade CTA opens the paywall.
- [ ] `REQUIRED — device` Connect-account CTA opens the platform picker.
- [ ] `REQUIRED — device` Tapping a recent threat opens the correct threat.
- [ ] `REQUIRED — device` Offline/error state is recoverable.
- [ ] `REQUIRED — device` Reviewer fixture values match the final reviewer notes exactly.

---

## 9. Connected accounts and OAuth

### Platform picker

- [ ] `REQUIRED — device` Instagram, Facebook, and X appear as supported.
- [ ] `REQUIRED — device` TikTok, LinkedIn, YouTube, and Snapchat are clearly non-actionable if marked Coming Soon.
- [ ] `REQUIRED — device` Cancel/back returns without changing data.

### Instagram

- [ ] `BLOCKER` OAuth opens in the expected secure browser.
- [ ] `BLOCKER` Only the approved current scope is requested.
- [ ] `BLOCKER` Successful callback returns to Rook.
- [ ] `BLOCKER` Account appears connected with correct identity.
- [ ] `REQUIRED — device` User denial returns safely and can retry.
- [ ] `REQUIRED — device` Browser cancellation returns safely.
- [ ] `REQUIRED — device` Expired/used OAuth state is rejected.
- [ ] `REQUIRED — device` Disconnect removes tokens and derived account data as disclosed.

### Facebook

- [ ] `BLOCKER` OAuth requests only current approved permissions.
- [ ] `BLOCKER` Successful callback returns to Rook and marks the account connected.
- [ ] `REQUIRED — device` Denial, cancellation, expired state, and retry work.
- [ ] `REQUIRED — device` Disconnect removes tokens and derived data.

### X

- [ ] `BLOCKER` PKCE OAuth opens and returns through the Rook deep link.
- [ ] `REQUIRED — device` Cancellation and invalid state are recoverable.
- [ ] `REQUIRED — device` Refresh token expiry marks the account for reconnection.
- [ ] `REQUIRED — device` Disconnect succeeds.

### Manage accounts

- [ ] `REQUIRED — device` Active, pending, and reconnect-needed states are accurate.
- [ ] `REQUIRED — device` Edit/save updates the account.
- [ ] `REQUIRED — device` Remove confirmation can be cancelled.
- [ ] `REQUIRED — device` Confirmed remove updates Dashboard, Profile, Scan, and quota context.
- [ ] `REQUIRED — device` Removing the last account leaves a valid empty state.
- [ ] `REQUIRED — device` Account A's data never appears for account B after account switching.

---

## 10. Scan engine

- [x] `PASS — automated` Empty identity profile does not invoke discovery.
- [x] `PASS — automated` Empty identity profile does not consume free quota.
- [x] `PASS — automated` Empty profiles do not share a cache fingerprint.
- [x] `PASS — automated` Clean user retains `0/1` free scan usage.
- [ ] `BLOCKER` Username-only scan completes without injecting a default real name.
- [ ] `BLOCKER` Real-name-only scan completes.
- [ ] `BLOCKER` Username + real name + photo scan completes.
- [ ] `BLOCKER` Scan progress advances and labels are truthful.
- [ ] `BLOCKER` Scan completes with either honest findings or an honest clean result.
- [ ] `BLOCKER` Findings belong only to the tested identity.
- [ ] `REQUIRED — device` Duplicate taps create one scan, not multiple jobs.
- [ ] `REQUIRED — device` Leaving and returning to Scan restores the active job state.
- [ ] `REQUIRED — device` Backgrounding and resuming preserves progress.
- [ ] `REQUIRED — device` No-account/no-input state explains what is needed.
- [ ] `REQUIRED — device` Free scan quota increments exactly once after a real scan.
- [ ] `REQUIRED — device` Exhausted free quota opens the correct paywall.
- [ ] `REQUIRED — device` Premium scan is not incorrectly quota blocked.
- [ ] `REQUIRED — device` API timeout/failure produces an error with retry.
- [ ] `REQUIRED — device` Stale connected-account token requests reconnection rather than silently failing.
- [ ] `REQUIRED — manual` Run a scan while the database/API is under expected production load.
- [ ] `REQUIRED — manual` Confirm scheduled Premium scans run at the documented cadence.
- [ ] `REQUIRED — manual` Confirm notifications are not sent for false or suppressed findings.

---

## 11. Alerts, threat detail, resolution, reporting, and sharing

- [ ] `BLOCKER` Reviewer account shows the exact number and severity of threats described in review notes.
- [ ] `REQUIRED — device` Alerts loading, empty, error, and populated states render.
- [ ] `REQUIRED — device` All/High/Medium/Low filters return correct items.
- [ ] `REQUIRED — device` Resolved/unresolved state is accurate.
- [ ] `REQUIRED — device` Threat detail opens the selected threat.
- [ ] `REQUIRED — device` Invalid/deleted/other-user threat IDs do not expose data.
- [ ] `REQUIRED — device` “Yours” and “Theirs” images are correct and load.
- [ ] `REQUIRED — device` Match score, severity, evidence, detected signals, and AI explanation agree.
- [ ] `REQUIRED — device` Copy says potential match/suspicious result rather than confirmed criminal conduct.
- [ ] `REQUIRED — device` Report action opens the correct official platform guidance.
- [ ] `REQUIRED — device` Resolve confirmation can be cancelled.
- [ ] `REQUIRED — device` Confirmed resolve updates threat detail, Alerts, Dashboard, and score.
- [ ] `REQUIRED — device` Suppressed/resolved account does not immediately reappear from cache.
- [ ] `REQUIRED — device` Native Share opens the iOS share sheet with correct content.
- [ ] `REQUIRED — device` Cancelling Share returns safely.
- [ ] `REQUIRED — device` Share failure displays a recoverable error.
- [ ] `REQUIRED — device` No downloadable-report claim appears unless the feature actually exists.

---

## 12. Photo monitoring and photo permissions

- [ ] `BLOCKER` Photo Monitor opens in build 14.
- [ ] `BLOCKER` Photo-library prompt text matches actual use.
- [ ] `REQUIRED — device` Allow permission permits selection.
- [ ] `REQUIRED — device` Deny permission shows a clear explanation and Settings path.
- [ ] `REQUIRED — device` Revoke permission in Settings, return, and recover.
- [ ] `REQUIRED — device` Cancel picker returns safely.
- [ ] `REQUIRED — device` Valid photo uploads/processes once.
- [ ] `REQUIRED — device` Oversized, corrupt, or unsupported image is rejected clearly.
- [ ] `REQUIRED — device` Offline photo search fails safely.
- [ ] `REQUIRED — device` No-match result is honest.
- [ ] `REQUIRED — device` Match result links to correct evidence.
- [ ] `REQUIRED — manual` Verify exactly what photo bytes, URLs, hashes, and embeddings are stored.
- [ ] `REQUIRED — manual` Verify third-party processing matches the Privacy Policy.
- [ ] `REQUIRED — manual` Verify raw photos are not retained beyond the disclosed period.

---

## 13. Subscription, purchase, restore, and entitlement

- [x] `PASS — automated` Zero-threat onboarding still hydrates the server plan.
- [x] `PASS — automated` Free-plan close action is accessible.
- [x] `PASS — automated` Server-granted tier can hydrate the paywall.
- [ ] `BLOCKER` StoreKit returns monthly and annual products in build 14.
- [ ] `BLOCKER` Product names, localized price, period, and trial match App Store Connect.
- [ ] `BLOCKER` Terms and Privacy links open before purchase.
- [ ] `BLOCKER` Auto-renewal and cancellation copy is visible and accurate.
- [ ] `BLOCKER` Monthly purchase completes in sandbox/TestFlight.
- [ ] `BLOCKER` Annual purchase completes in sandbox/TestFlight.
- [ ] `BLOCKER` RevenueCat entitlement becomes `premium`.
- [ ] `BLOCKER` Server tier syncs after purchase.
- [ ] `BLOCKER` Premium features unlock without relaunch.
- [ ] `BLOCKER` Restore Purchases restores an eligible purchase.
- [ ] `BLOCKER` Restore with no purchase shows a clear non-success result.
- [ ] `BLOCKER` Expired/cancelled subscriber sees the purchase flow.
- [ ] `REQUIRED — device` User-cancelled purchase is not shown as an error purchase.
- [ ] `REQUIRED — device` Declined, pending, offline, and StoreKit-unavailable states are recoverable.
- [ ] `REQUIRED — device` Already-Premium user does not see a misleading purchase CTA.
- [ ] `REQUIRED — device` Manage Subscription opens Apple's subscription management.
- [ ] `REQUIRED — device` Account deletion warns that store billing must be cancelled separately.
- [ ] `REQUIRED — manual` RevenueCat webhook updates renewal, cancellation, expiration, and billing-problem states.
- [ ] `REQUIRED — manual` Subscription works on a second device using the same Apple account.

---

## 14. Notifications, background behavior, and deep links

- [ ] `BLOCKER` Notification pre-prompt appears at an appropriate time.
- [ ] `REQUIRED — device` “Not Now” leaves the app usable.
- [ ] `BLOCKER` Enable triggers the native iOS permission prompt.
- [ ] `BLOCKER` Allowed permission registers a production Expo push token.
- [ ] `REQUIRED — device` Denied permission shows a Settings recovery path.
- [ ] `REQUIRED — device` Revoking permission is reflected when returning to the app.
- [ ] `REQUIRED — device` Per-category toggles persist.
- [ ] `REQUIRED — device` New-threat notification is delivered.
- [ ] `REQUIRED — device` Scan-complete notification is delivered.
- [ ] `REQUIRED — device` Weekly reminder behavior matches its setting.
- [ ] `BLOCKER` Tapping a threat notification opens the correct threat from foreground.
- [ ] `BLOCKER` Tapping it from background opens the correct threat.
- [ ] `BLOCKER` Tapping it from terminated state opens the correct threat.
- [ ] `REQUIRED — device` Alerts, Scan, and Dashboard payloads route correctly.
- [ ] `REQUIRED — device` Unknown payload falls back safely.
- [ ] `REQUIRED — device` Deleted-threat payload does not crash.
- [ ] `REQUIRED — device` Signed-out notification target does not expose private data.
- [ ] `REQUIRED — device` Sign out/account switch deregisters or reassigns the token correctly.

---

## 15. Profile, settings, privacy, and legal

### Profile and settings

- [ ] `REQUIRED — device` Profile name, handle, tier, avatar, account count, and identity badge are correct.
- [ ] `REQUIRED — device` Edit profile saves valid changes.
- [ ] `REQUIRED — device` Cancel edit discards changes.
- [ ] `REQUIRED — device` Avatar allow/deny/cancel/upload/error paths work.
- [ ] `REQUIRED — device` Security screen contains no nonfunctional controls.
- [ ] `REQUIRED — device` Notification settings reflect native permission state.
- [ ] `REQUIRED — device` Support opens a working support path.
- [ ] `REQUIRED — device` Terms and Privacy render inside the app.
- [ ] `REQUIRED — manual` Public Support, Privacy, and Terms URLs load over HTTPS.

### Photo consent and privacy

- [x] `PASS — automated` Consent can be enabled.
- [x] `PASS — automated` Consent can be withdrawn.
- [x] `PASS — automated` Confirmed withdrawal calls deletion exactly once.
- [x] `PASS — automated` Cancel does not trigger deletion.
- [x] `PASS — automated` Re-enabling clears stale withdrawal feedback.
- [x] `PASS — automated` Photo-data deletion endpoint succeeds.
- [x] `PASS — automated` Data export JSON downloads/returns.
- [ ] `REQUIRED — device` Consent notice is readable and not preselected.
- [ ] `REQUIRED — device` Withdrawing consent disables future photo scanning.
- [ ] `REQUIRED — manual` Verify photo-derived data is deleted within the disclosed time.
- [ ] `REQUIRED — manual` Verify backup-retention claims.
- [ ] `REQUIRED — manual` Verify data export includes every promised data category.
- [ ] `REQUIRED — manual` Verify users can reach a human to dispute a false result where required.

---

## 16. Sign out, returning access, and account deletion

- [x] `PASS — automated` Sign-out modal appears.
- [x] `PASS — automated` Cancel leaves the user signed in.
- [x] `PASS — automated` Confirmed sign-out returns to Auth.
- [x] `PASS — automated` Signed-out protected APIs return 401 with no user data.
- [x] `PASS — automated` Returning login bypasses onboarding.
- [x] `PASS — automated` Returning user preserves correct consent, threats, and quota.
- [x] `PASS — automated` Delete Account warning states permanence and separate store cancellation.
- [x] `PASS — automated` Cancel deletion leaves the account intact.
- [x] `PASS — automated` Confirmed deletion returns 204.
- [x] `PASS — automated` Clerk user deletion succeeds.
- [x] `PASS — automated` Post-delete notification cleanup cannot recreate the user.
- [x] `PASS — automated` App returns to Auth with no prior data.
- [ ] `BLOCKER` Repeat sign out and returning sign-in on physical build 14.
- [ ] `BLOCKER` Repeat full account deletion on physical build 14.
- [ ] `BLOCKER` Confirm same deleted identity is not silently treated as a returning account.
- [ ] `REQUIRED — manual` Verify no orphaned accounts, scans, threats, photos, tokens, subscriptions, fingerprints, or identity profiles remain.
- [ ] `REQUIRED — device` Re-registering the same email follows the intended first-time-user behavior.
- [ ] `REQUIRED — device` Delete while offline fails safely and does not falsely claim success.
- [ ] `REQUIRED — device` Delete with an active subscription preserves Apple's billing warning.

---

## 17. Reviewer walkthrough for the submitted build

Run this exact walkthrough after all feature tests pass:

1. Delete Rook from the test device.
2. Install build 14 from TestFlight.
3. Confirm the device has no prior Rook local state.
4. Launch Rook.
5. Use only the credentials and steps stored in App Store Connect.
6. Confirm reviewer access succeeds without email inbox access.
7. Confirm Dashboard loads within 15 seconds.
8. Confirm displayed score, threat count, accounts, photos, and tier exactly match review notes.
9. Open each seeded threat.
10. Verify evidence images, percentages, explanation, and report action.
11. Filter Alerts.
12. Start a scan and wait for completion.
13. Open Connect Account, verify the supported platform screen, then cancel unless review notes require live OAuth.
14. Open the paywall from an expired/free account.
15. Verify monthly, annual, trial, Restore Purchases, Terms, and Privacy.
16. Open Photo Monitor and verify permission behavior.
17. Open Privacy & Data, export data, and cancel destructive actions.
18. Open Support, Terms, and Privacy.
19. Sign out and sign back in.
20. Confirm there are no crashes, blank screens, infinite spinners, stale data, or inaccessible buttons.

### Obsolete reviewer-script steps

- [x] `PASS — documentation` Removed old **Tools tab**, **AI Scam Analyzer**, and related steps from the canonical reviewer instructions.
- [x] `PASS — documentation` Removed unverified seeded counts and match percentages from reviewer instructions and screenshot guidance.
- [x] `PASS — documentation` Reviewer instructions require live Sign in with Apple testing; a video is not a substitute.
- [x] `PASS — documentation` Reviewer instructions no longer limit Apple to a Cancel path when testing supported integrations.
- [x] `PASS — documentation` Removed `user_photos` as a current build-14 permission; Facebook is documented as `public_profile` only.
- [x] `PASS — documentation` Published one canonical build-14 reviewer script and labeled the conflicting legacy guide superseded.

---

## 18. App Store metadata and rejection-history audit

### Demo access — Guideline 2.1

- [ ] `BLOCKER` Replace stale credentials in App Store Connect.
- [ ] `BLOCKER` Validate the exact credentials on a clean device.
- [ ] `BLOCKER` Reviewer has full access to described functionality.
- [ ] `BLOCKER` Backend and fixture seeding remain live.
- [ ] `BLOCKER` Review notes explain the access-code flow clearly.

### Sign in with Apple — Guideline 2.1(a) / login rules

- [ ] `BLOCKER` Attach evidence that first-time Apple sign-in passes on build 14.
- [ ] `BLOCKER` Confirm supported-device availability so Apple cannot install on an untested iPad.
- [ ] `BLOCKER` If iPad remains available, include iPad evidence.

### Face/photo data questionnaire

- [ ] `BLOCKER` Answer what photo/face-related data is collected.
- [ ] `BLOCKER` Explain each purpose.
- [ ] `BLOCKER` List each third party receiving data.
- [ ] `BLOCKER` State storage format/location.
- [ ] `BLOCKER` State retention and deletion timing.
- [ ] `BLOCKER` Quote matching Privacy Policy sections.
- [ ] `BLOCKER` Confirm every statement against actual runtime/database behavior.
- [ ] `BLOCKER` Obtain legal review for biometric/privacy wording where needed.

### Age rating

- [x] `PASS — documentation` Release documents now distinguish the Apple/Google content-rating questionnaire from account eligibility and remove contradictory 4+/13+/18+ instructions.
- [x] `PASS — documentation` Active release documents consistently state the in-app signup, Terms, and Privacy minimum eligibility is 17.
- [ ] `BLOCKER` Confirm the App Store Connect age-rating questionnaire and any Age Assurance/In-App Controls selections in the console; repository documentation alone is not evidence of the submitted console state.

### Subscription and promoted IAP

- [ ] `BLOCKER` Provide Apple an expired/no-subscription path.
- [ ] `BLOCKER` Verify products and trials are reviewable in every enabled territory.
- [ ] `BLOCKER` Confirm subscription review images are unique, product-specific, and legible.
- [ ] `BLOCKER` Remove price text from promotional metadata/art where Apple disallows or has rejected it.
- [ ] `BLOCKER` Confirm the standard EULA URL appears where required.

### Metadata consistency

- [x] `PASS — documentation` Chose one subtitle and one secondary category in the canonical metadata file.
- [x] `PASS — documentation` Corrected the copyright year in the canonical metadata file.
- [x] `PASS — documentation` Replaced hard-coded screenshot dimensions with current App Store Connect device-family guidance.
- [x] `PASS — documentation` Confirmed Support, Marketing, and Privacy URLs are consistently documented.
- [x] `PASS — documentation` Revised the app description to match supported platforms and current functionality.
- [x] `PASS — documentation` Removed unsupported “track every place,” “instant,” “always,” and guaranteed-protection claims.
- [x] `PASS — documentation` Confirmed Coming Soon platforms are not described as currently functional.
- [ ] `BLOCKER` Confirm privacy nutrition labels match Clerk, RevenueCat, push, photos, Vision/OpenAI/search, and server processing.

---

## 19. Meta review audit

- [ ] `BLOCKER` Request only scopes used by build 14.
- [x] `PASS — code and documentation` Build 14 requests Facebook `public_profile` only and does not submit or describe `user_photos` as live.
- [ ] `BLOCKER` Verify Instagram and Facebook reviewer test identities and roles.
- [ ] `BLOCKER` Verify exact production callback URLs and mobile deep link.
- [ ] `BLOCKER` Complete live OAuth from the review build.
- [ ] `BLOCKER` Confirm permission explanations match actual processing.
- [ ] `BLOCKER` Confirm disconnect and account deletion remove Meta tokens/data.
- [ ] `BLOCKER` Confirm data-deletion callback is registered and works.
- [ ] `REQUIRED — manual` Record a supplemental current-build review video.
- [ ] `BLOCKER` Ensure the video does not replace live reviewer access.
- [ ] `BLOCKER` Retire or label older Meta instructions that tell reviewers to approve unavailable permissions.

---

## 20. Backend, security, and operations

- [ ] `REQUIRED — manual` Production health endpoint succeeds.
- [ ] `REQUIRED — manual` All authenticated user endpoints reject missing/invalid auth.
- [ ] `REQUIRED — manual` Cross-user IDs cannot read or mutate another user's data.
- [ ] `REQUIRED — manual` Reviewer/admin endpoints reject missing or invalid admin credentials.
- [ ] `REQUIRED — manual` Reviewer access is rate limited.
- [ ] `REQUIRED — manual` OAuth state is single-use and expires.
- [ ] `REQUIRED — manual` OAuth secrets/tokens are absent from logs.
- [ ] `REQUIRED — manual` RevenueCat webhook rejects invalid signatures.
- [ ] `REQUIRED — manual` Meta webhooks/deletion callbacks validate signatures.
- [ ] `REQUIRED — manual` Scan and photo endpoints enforce rate and payload limits.
- [ ] `REQUIRED — manual` Request-size and malformed-request handling is verified.
- [ ] `REQUIRED — manual` Scheduled jobs do not crash the API.
- [ ] `REQUIRED — manual` Database backup and restore procedure is known.
- [ ] `REQUIRED — manual` Production monitoring covers authentication, purchase, scan, OAuth, notification, and deletion errors.
- [ ] `REQUIRED — manual` No production secret is bundled into the client.
- [ ] `REQUIRED — manual` Dependency and static security scans have no unresolved critical/high release blocker.

---

## 21. Final go/no-go sign-off

### Automatic no-go conditions

Do not submit if any of these is true:

- Any `BLOCKER` is not passed.
- Any required physical-device flow was not run on build 14.
- Sign in with Apple was not tested as a genuinely new identity.
- Reviewer credentials were not tested from a clean install.
- Reviewer requires an inaccessible inbox or OTP.
- Purchase or Restore Purchases was not tested through StoreKit.
- Reviewer notes do not match the seeded account.
- App Store metadata or privacy answers conflict with the app.
- Build 14 is not the build attached to the final submission.
- Backend services are not production-ready and monitored.
- A test produced a crash, blank screen, infinite spinner, wrong-user data, fabricated result, duplicate charge, or incomplete deletion.

### Required approvals

- [ ] Engineering: all automated and API checks pass.
- [ ] iOS device tester: all build 14 native checks pass.
- [ ] Product: reviewer script matches build 14.
- [ ] Privacy/legal: photo/face data and retention answers approved.
- [ ] Operations: reviewer support and production monitoring ready.
- [ ] App Store Connect owner: metadata, age rating, privacy labels, IAPs, screenshots, and review notes verified.
- [ ] Final approver: authorizes attaching build 14.
- [ ] Final approver: authorizes submitting for review.

**Current decision:** `NO-GO — native-device and submission-metadata blockers remain open.`
