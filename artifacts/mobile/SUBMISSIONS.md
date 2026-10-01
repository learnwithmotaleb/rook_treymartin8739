# Rook — iOS 1.0.1 submission guide

Read-only App Store Connect build GETs on 2026-10-01 found the latest valid, nonexpired iOS version 1.0.1 build 13, uploaded 2026-09-30 at 20:28:43 PDT (2026-10-01 at 03:28:43Z); older version 1.0.0 build 15 remains. Build 13 predates current Photo Monitor changes. App Store versions API returned 403, so exact installed build and build attached to the App Store version remain unverified; no mutations were made. The historical successful managed iOS [Launch workflow](https://expo.dev/workflows/01a0f579-19f5-764a-8fcb-0e4739f102d1) remains prior evidence; latest `getExpoLaunchLogs` returned no current session, which does not negate that historical evidence. This does not prove current attachment, signed-build identity, production parity, or native-device test results.

## Canonical store metadata

| Field | Value |
|---|---|
| Name | Rook: Impersonation Protection |
| Subtitle | AI Guard for Your Online Identity |
| Primary category | Utilities |
| Secondary category | Social Networking |
| Privacy Policy | https://tryrook.app/privacy |
| Support | https://tryrook.app/support |
| Marketing | https://tryrook.app |
| Terms | https://tryrook.app/terms |
| Account eligibility | Users must be at least 17 |
| iPad support | No (`supportsTablet: false`) |

Do not use API-route placeholders, alternate subtitles/categories, or reviewer credentials in source-controlled documents.

## Age eligibility versus store content rating

Rook's in-app signup, Terms, and Privacy notice require users to be at least **17**. This is the product's minimum account eligibility and must be stated consistently wherever eligibility is discussed.

Apple's Age Rating questionnaire and Google's Content Rating questionnaire are separate descriptions of content exposure. Complete them in their respective consoles and do not represent the content rating as the eligibility rule. Do not describe Rook as 4+, Everyone, or child-directed for account eligibility.

For Apple's **Unrestricted Web Access** question, answer based on the actual build: Rook does not provide a general-purpose browser. It opens limited provider authorization pages and links to official guidance. Scanning public sources does not itself provide unrestricted web browsing.

Record the questionnaire result separately after console completion; do not invent a resulting rating in repository documentation.

## Version and build evidence

- [ ] Confirm whether build 13 is attached to the App Store version and verify the exact installed build. The versions API returned 403; build 13 is the latest valid, nonexpired 1.0.1 build found, but attachment and installed identity are unknown.
- [ ] Record the actual signed build number from App Store Connect or the signed artifact. `artifacts/mobile/app.json` declares version `1.0.1` and desired iOS build `16`; managed App Store Launch numbers builds independently, so this is not evidence of a published build number.
- [ ] Do not require build number 16 or higher as a condition for the 1.0.1 review.
- [ ] Current Profile and Legal source use dynamic version/build identity distinguishing Expo Go/browser from native. An older installed binary can still show old labels; verify only on the new signed build.

## Reviewer access and walkthrough

Use the normal **Sign In** screen. Put `review:<reviewer email>` in the **Email** field and the current protected access code in **Password**. The app sends those values to the App Review ticket flow; it is not a separate reviewer login UI or ordinary Clerk password sign-in. The code value is configured outside source through `APP_REVIEW_ACCESS_CODE`; it has not been verified in this repository. An authorized operator must confirm the production configuration and App Store Connect protected password field match. Never put credentials in this file.

The reviewer seeder creates illustrative, explicitly marked sample alert/scan history and requests a Free/canceled subscription only when no subscription already exists. It does not seed verified connected social accounts or a monitored-photo list. The investigation and authorized review-sample image are demonstrations only—not a real impersonation, copied-photo finding, provider authorization, or live discovery. Workspace fixture evidence points both sample comparison sides to the same supplied illustrative image; captions in the marked detail are **Your Photo** and **Example Image**. The hosted sample JPEG's SHA matches the supplied processed image. A read-only production query found six existing marked evidence rows with broken root-photo URLs before the current source detail-response normalization patch. Publish and verify that patch before claiming corrected sample display in production.

The current web/API service is deployed at `https://tryrook.app`; its hosted `https://tryrook.app/landing/reviewer-sample-photo.jpg?v=1de1d25649bd` image matches the supplied processed image by SHA. Current source normalizes detail-response photo URLs only for trusted marked samples. After publishing this source change, existing marked evidence will not require sign-out/re-seed; this source fix is not yet confirmed live. Do not imply it has been published or that production behavior is verified until checked after publication.

Build 13 predates the current Photo Monitor changes. Workspace mobile source adds a clearly marked, display-only **Review Example** derived from marked server sample evidence. It is excluded from real scans and has dismissal/account-boundary handling, but requires a newer signed build; another build of version 1.0.1 can include it. Managed App Store Launch assigns build numbers independently, so its exact build number is unknown. Verify the sample marking, scan exclusion, dismissal, and account-boundary behavior on the new signed build; do not claim it is in build 13 or the currently attached build.

Use `../../docs/reviewer-test-script.md` for current version 1.0.1 navigation and the internal device walkthrough. `../../docs/build-15-apple-review.md` records build 15 historically and is not the current submission guide.

## Native and production verification

- [ ] Publish the current web/API source, including detail-response normalization for trusted sample-photo evidence. Production nonsecret `EXPO_PUBLIC_API_URL=https://tryrook.app` and `EXPO_PUBLIC_APP_ENV=production` values are set, but runtime publication remains required and does not prove the signed binary contains those values.
- [ ] Start a new managed App Store Launch from current source. Version 1.0.1 can be reused; managed launch assigns build numbers independently of the desired `app.json` build 16.
- [ ] Install the newly processed build through TestFlight and verify its exact identity and required flows on a native device.
- [ ] Test normal reviewer sign-in and the required Terms/age recovery path on the exact attached native build.
- [ ] Walk through Dashboard, Alerts/sample detail, Scan, and Profile on a clean supported iPhone. From Profile, scroll to its **Settings** section for Subscription, Photo Monitor, and other settings destinations; Settings is not a separate screen.
- [ ] Verify current source release-parity changes on the signed build: dynamic Profile/Legal version-build identity that distinguishes Expo Go/browser from native, Profile deletion through the shared authenticated API, and OAuth fallbacks/legal URLs using the common validated origin.
- [ ] Test photo consent, photo permission, and only authorized photo upload/import paths; separately verify production data behavior.
- [ ] Test OAuth cancellation/callbacks, notifications/deep links, StoreKit offerings/purchase/restore, and subscription sync as applicable.
- [ ] Verify production API, live Privacy Policy and Terms, current legal-version enforcement, consent withdrawal, photo-data deletion, export, and account deletion. Coordinate server legal gates with clients that can recover from a required acknowledgment.
- [ ] Keep App Store Connect age-rating, privacy-label, subscription, screenshots, and review metadata unconfirmed until checked in the console.

A seeded sample, App Store Connect build record, historical successful workflow, clean source inspection, or workspace API source is not evidence that these device and production checks passed. Do not claim live sign-in, StoreKit, or device behavior without verification.

## Outstanding release gates

- [ ] Replace and verify the promoted in-app-purchase image in App Store Connect.
- [ ] Set Apple **Age Assurance** to **None** unless a genuine age-assurance mechanism is implemented. A minimum account age of 17 is not itself age assurance.
- [ ] Test Meta provider authorization/access and eligible-account media import, plus photo permission and explicit consent, on the exact native build with production configuration.
- [ ] Verify live Privacy Policy and Terms, production API behavior, and mobile/legal privacy parity, including consent, retention, export, withdrawal, and deletion.
- [ ] Publish and externally verify trusted-sample detail-response URL normalization before claiming the live API returns corrected sample images; the hosted JPEG itself has been SHA-verified.

## Legal and privacy URLs

- Privacy Policy: https://tryrook.app/privacy
- Terms of Service: https://tryrook.app/terms
- Support: https://tryrook.app/support

Verify the live pages and disclosures, deletion/withdrawal behavior, export behavior, and console metadata before marking submission verification complete.