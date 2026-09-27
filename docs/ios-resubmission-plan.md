# Rook iOS resubmission: shortest credible path

**Status: NO-GO.** This is a plan, not evidence that a rejection is resolved.
Apple reviewed version 1.0 (12) on September 10 and 14, 2026. Build 15
predates the current reviewer sign-in and acknowledgment fixes. Do not attach
an older build, send the conditional reply in `docs/build-15-apple-review.md`,
or resubmit until the gates below pass on one *new* signed build (>15).

## Scope and decision

Freeze new features and cosmetic improvements. Fix rejection blockers and
failures in the exact reviewer journeys only. Keep the reviewer account
**Free/expired**, because Apple specifically requested an expired-subscription
account to inspect purchasing. Do not silently grant it Premium. Preserve the
required, explicit Terms and age acknowledgments; do not seed consent.

For speed, keep a small, clearly marked **sample history** so a reviewer can
inspect alert/detail screens without owning social accounts. Sample accounts
must not claim to be OAuth-authorized or have indexed photos they do not have.
Starting a scan must never present recycled sample findings as newly
discovered live results: run the real scan, or explicitly label and separate a
sample walkthrough. Keep the normal connection and optional photo-consent
flows available, but do not promise that an unapproved third-party scope works.
Do not destructively reset a reviewer's changes every time they sign in.

## The rejection-to-proof matrix

| Apple's feedback | Required fix / proof before resubmission |
|---|---|
| **2.1, September 10 and 14:** could not use supplied credentials; needed an account with an expired subscription. | In the **production Clerk tenant**, provision the designated reviewer, confirm its server billing state is Free/expired, and supply the protected `review:<email>` identifier and access code only in App Store Connect's protected review fields. On a fresh signed install, enter those **exact** fields through normal Sign In, without inbox/OTP access; complete any in-app acknowledgments; reach Dashboard, Subscription, localized offerings and Restore Purchases. Retest after app restart and fresh install. Keep account, API and code active through the review window. |
| **2.1(a), September 14:** Sign in with Apple errored on iPad Air 11-inch (M3). | On the new signed build, test a genuinely new Apple ID and a returning Apple ID through consent, account creation, onboarding and app reopening. Determine whether Apple can install this build on iPad; if so, repeat on iPad, even if `supportsTablet` is false. Save device/build evidence. |
| **2.3.2, both messages:** promotional IAP image was a screenshot, later the app icon, with illegible text; September 10 also called out price references in promoted IAP metadata. | Fastest path: remove **promotion** of the offending monthly IAP (and check any other promoted/win-back surfaces) if not needed for launch; retain the actual purchasable subscription and required review metadata. Otherwise upload unique, legible product-specific 1024×1024 art, not a screenshot or app icon, without small/price text; remove prohibited price claims from promoted metadata. Verify the saved App Store Connect state, not just a local image. |
| **2.3.6, September 10:** In-App Controls claimed Age Assurance or Parental Controls Apple could not find. | Set Age Assurance and Parental Controls to **None** unless a corresponding real mechanism is present and tested; answer the remaining age-rating questions truthfully. A 17+ eligibility checkbox is not age assurance. Capture the final App Store Connect questionnaire/rating. |
| **2.1 / 5.1.1, both messages:** Apple requested the precise face-data collection, use, sharing, storage, retention/deletion, third parties, and exact privacy-policy quotations. | Audit real photo paths (avatar, reference upload, connected-account media, alert evidence, export and deletion), actual provider transfers and storage/backup retention. Fix any mismatch **before** promising deletion timing or a data format. Publish the matching policy and API; read the live `/privacy` page and quote its exact relevant sections in the reply. Obtain legal review of biometric/retention assertions. Do not reuse the conditional draft's claims without checking them. |

Primary rejection evidence: the two `attached_assets/Pasted-Hello-Thank-you-for-your-resubmission-Upon-further-revi_*.txt` messages (September 10 and 14). `docs/build-15-apple-review.md`, `docs/FINAL_BUILD_14_RELEASE_TEST_AUDIT.md`, and `docs/next-ios-release-audit.md` are **internal drafts/checklists**, not Apple confirmations.

## Execution order and hard gates

1. **App Store Connect cleanup now (no build required).** Inspect the currently
   selected version/build, promoted IAP and metadata in all localizations,
   subscription availability and review images, age-rating answers, privacy
   nutrition labels, support/privacy URLs, and protected review fields. Record
   actual console state; local source cannot establish it. Remove the
   unnecessary promoted IAP placement instead of designing an image if that
   meets the launch goal.
2. **One focused code-and-data stabilization pass.** Correct the reviewer
   fixture's misleading OAuth/media/scan states and repeated seeding; preserve
   a genuinely Free/expired purchase path and honest sample evidence. Fix
   reproducible blockers across sign-in, legal recovery, Apple account creation,
   onboarding, subscription/restore, and optional photo consent. Close
   privacy-policy-versus-storage/deletion contradictions. Prefer a minimal
   release fix over expanding provider scope or adding features.
3. **Production parity.** Confirm the published API, production Clerk reviewer
   identity, production subscription state, and public legal/support pages
   match the code and the planned reviewer instructions. Development API 200s
   do **not** establish production access. Do not assume a Meta permission or
   OAuth provider approval that has not been demonstrated.
4. **Build once after the fixes stabilize.** Produce a signed iOS distribution
   build with number >15, wait for App Store Connect processing, and attach
   that exact build to the version. Freeze code, API and reviewer instructions
   during the final walkthrough; any blocker fix invalidates the prior pass and
   requires another signed build.
5. **Walk the exact review journeys on that build.** Fresh-install reviewer
   sign-in and expired paywall; purchase and restore using the appropriate
   Apple test environment; new and returning Sign in with Apple on iPhone and
   on iPad if installable; acknowledgments, onboarding, sample versus live
   scans, OAuth/manual connection messaging, photo-consent/no-consent cases,
   deletion and policy navigation. Capture actual outcomes, error states and
   build/device identifiers. Do not mark an untested third-party OAuth grant
   or live photo search as passed.
6. **Only then submit.** Write short App Review notes for this exact build:
   protected credentials in their designated fields; normal Sign In steps;
   Free/expired purchase path; which alert data is sample; provider limitations;
   photo consent; current support and privacy URLs. Reply point-by-point to
   Apple's five feedback areas using only verified changes and the *live*
   policy wording. Keep the reviewer login and backend available until review
   finishes. If a gate fails, remain NO-GO rather than sending another
   conditional promise.

## Applicable Apple sources (checked September 2026)

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/):
  2.1 requires on-device completeness, working backend, review access and
  reviewable IAPs; 2.3.2 covers promoted IAP metadata; 2.3.6 requires honest
  age-rating answers; 5.1.1 covers collection, consent, privacy and deletion.
- [App Review preparation](https://developer.apple.com/app-store/review/):
  provide working demo credentials and special configuration in App Review
  Information.
- [Promoting In-App Purchases](https://developer.apple.com/app-store/promoting-in-app-purchases/):
  unique promotional image, not a screenshot or app icon; avoid overlay text.
- [Age ratings definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions):
  Age Assurance is an actual age-confirmation mechanism, not just a claimed
  rating or account eligibility rule.
- [Submit an app](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app):
  supply required metadata and choose the build for the version before review.

**Not yet verified:** the current App Store Connect console, production Clerk
and API, processed/attached build, production privacy page, native StoreKit,
Apple ID on supported hardware, Meta permissions, or Apple's eventual decision.
This plan cannot promise a review date or approval.