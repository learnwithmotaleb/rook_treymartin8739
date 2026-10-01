# Rook — iOS 1.0.1 submission guide

This is the repository's operational guide for the reported iOS 1.0.1 upload. The user reports that the version bump was successfully uploaded. This file does not prove App Store Connect processing or attachment state, the exact signed build number, production API parity, or native-device test results; retain those checks until externally evidenced.

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

- [ ] Confirm version 1.0.1 has finished processing and the intended build is attached to the App Store version under review.
- [ ] Record the actual signed build number from App Store Connect or the signed artifact. `artifacts/mobile/app.json` currently declares version `1.0.1` and iOS build number `16`; that is source configuration, not evidence of the uploaded build number.
- [ ] Do not require build number 16 or higher as a condition for the 1.0.1 review.
- [ ] Note the source-visible version discrepancy: the Profile footer in `app/(tabs)/profile.tsx` still says `Rook v1.0.0`, while the app config says `1.0.1` and the Legal screen reads its version from config.

## Reviewer access and walkthrough

Use the normal **Sign In** screen. Put `review:<reviewer email>` in the **Email** field and the current protected access code in **Password**. The app sends those values to the App Review ticket flow; it is not a separate reviewer login UI or ordinary Clerk password sign-in. The code value is configured outside source through `APP_REVIEW_ACCESS_CODE`; it has not been verified in this repository. An authorized operator must confirm the production configuration and App Store Connect protected password field match. Never put credentials in this file.

The reviewer seeder creates illustrative, explicitly marked sample alert/scan history and requests a Free/canceled subscription only when no subscription already exists. It does not seed verified connected social accounts or a 1.0.1 monitored-photo list. The investigation and authorized review-sample image are demonstrations only—not a real impersonation, copied-photo finding, provider authorization, or live discovery. Workspace fixture evidence points both sample comparison sides to the same supplied illustrative image; captions in the marked detail are **Your Photo** and **Example Image**. The production API update is unverified, so do not promise that the corrected image currently renders in 1.0.1.

Workspace backend source now targets `https://tryrook.app/landing/reviewer-sample-photo.jpg?v=1de1d25649bd` and refreshes image URLs only in explicitly marked sample rows on reviewer re-sign-in, preserving history and user actions. The production root path `/reviewer-sample-photo.jpg` was found to return 404; `/landing/reviewer-sample-photo.jpg` returned 200 with `image/jpeg`. Do not imply this workspace API change is deployed or that the current live API serves the corrected URL. After deployment, verify production behavior before claiming the existing signed investigation displays the updated image.

Workspace mobile source now adds a clearly marked, display-only **Review Example** derived from marked server sample evidence. It is excluded from real scans and has dismissal/account-boundary handling, but it is not in the already-uploaded 1.0.1 build and requires a newer signed build than that upload. Another build of version 1.0.1 can include it; its exact build number is unknown. Verify the sample marking, scan exclusion, dismissal, and account-boundary behavior on that newer signed build.

Use `../../docs/reviewer-test-script.md` for current version 1.0.1 navigation and the internal device walkthrough. `../../docs/build-15-apple-review.md` records build 15 historically and is not the current submission guide.

## Native and production verification

- [ ] Test normal reviewer sign-in and the required Terms/age recovery path on the exact attached native build.
- [ ] Walk through Dashboard, Alerts/sample detail, Scan, and Profile on a clean supported iPhone. From Profile, scroll to its **Settings** section for Subscription, Photo Monitor, and other settings destinations; Settings is not a separate screen.
- [ ] Test photo consent, photo permission, and only authorized photo upload/import paths; separately verify production data behavior.
- [ ] Test OAuth cancellation/callbacks, notifications/deep links, StoreKit offerings/purchase/restore, and subscription sync as applicable.
- [ ] Verify production API, live Privacy Policy and Terms, current legal-version enforcement, consent withdrawal, photo-data deletion, export, and account deletion. Coordinate server legal gates with clients that can recover from a required acknowledgment.
- [ ] Keep App Store Connect age-rating, privacy-label, subscription, screenshots, and review metadata unconfirmed until checked in the console.

A seeded sample, successful upload report, clean source inspection, or workspace API source is not evidence that these device and production checks passed.

## Outstanding release gates

- [ ] Replace and verify the promoted in-app-purchase image in App Store Connect.
- [ ] Set Apple **Age Assurance** to **None** unless a genuine age-assurance mechanism is implemented. A minimum account age of 17 is not itself age assurance.
- [ ] Test Meta provider authorization/access and eligible-account media import, plus photo permission and explicit consent, on the exact native build with production configuration.
- [ ] Verify live Privacy Policy and Terms, production API behavior, and mobile/legal privacy parity, including consent, retention, export, withdrawal, and deletion.
- [ ] Deploy and externally verify the reviewer sample-image URL repair before claiming the live API returns the corrected asset.

## Legal and privacy URLs

- Privacy Policy: https://tryrook.app/privacy
- Terms of Service: https://tryrook.app/terms
- Support: https://tryrook.app/support

Verify the live pages and disclosures, deletion/withdrawal behavior, export behavior, and console metadata before marking submission verification complete.