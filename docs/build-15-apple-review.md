# Rook iOS 1.0.0 (15) — Apple resubmission gate and reviewer copy

**Status: NO-GO for resubmission or sending the reply below until the unchecked
items pass.** This document addresses Apple's September 14, 2026 message
about version 1.0 (12), plus the unresolved September 10 feedback. The signed
store-distribution build 15 was uploaded to App Store Connect; an upload is
not proof that Apple finished processing it, that it is attached to the
rejected version, or that any rejection has been resolved.

## Required checks against the actual submission

- [ ] App Store Connect: build **1.0.0 (15)** has completed processing and is
  attached to the version being resubmitted. Do not use build 12, 13, or 14.
- [ ] On the exact TestFlight build, use the **exact identifier and access
  code that Apple will receive** in the protected App Review fields. From a
  signed-out fresh install, tap **Sign In → App Review access**, enter the
  identifier in the email field and the code in the password/code field, tap
  **Enter App Review**, and confirm Dashboard and subscription paywall work
  without inbox access. The account must remain active throughout review.
  Confirm its subscription is free/expired/canceled, not Premium. Code for a
  reviewer ticket and expired fixture exists, but this device test is not
  recorded here. The previous ordinary email/password credentials failed.
- [ ] Run **Sign in with Apple** using a genuinely new Apple ID on a clean
  installation of build 15 and verify onboarding, then repeat for a returning
  Apple ID. Apple previously saw an error on iPad Air 11-inch (M3), iPadOS 27.
  `supportsTablet: false` is configured, but does not establish that Apple
  cannot install the iPhone app on iPad. If the build is available on iPad,
  repeat these tests on iPad. Do not claim this is fixed based on code alone.
- [ ] In App Store Connect, **remove the promoted IAP/win-back image and
  promotion** if the product is not being promoted; otherwise replace the
  image with unique, legible, product-specific art that is neither the app
  icon nor an in-app screenshot and contains **no price text**. Check
  “Rook Premium Monthly,” other promoted products, localizations and win-back
  offers. This is console metadata, not changed by build 15.
- [ ] Verify the Age Rating **Age Assurance** answer is **None** unless an
  actual age-assurance mechanism is present and can be shown to Apple.
  A 17+ signup checkbox is not an age-assurance mechanism. Verify the
  final questionnaire and rating in App Store Connect.
- [ ] Verify the live `https://tryrook.app/privacy` is the policy intended
  for this release. It currently differs from the newer policy in the
  repository, including the Section 2 heading and description of image
  transfers/retention. The reply must quote **the live page actually served**
  at review time, not the unshipped source. Confirm the app's in-app paths
  and actual deletion behavior against that page.
- [ ] Confirm the production API actually serves the Facebook uploaded-photo
  handling expected by build 15. The live privacy page currently differs
  from the workspace server source, indicating production may be behind.
  In onboarding, the first media fetch occurs immediately after OAuth while
  the server requires photo consent, so a brand-new user without prior
  consent may see no Facebook photo picker. Do not tell Apple or Meta this
  complete photo-selection journey was verified until a live device test
  proves it. A client/server fix would require another signed build and
  production API publish, not merely revised reviewer notes.
- [ ] Recheck live subscription offerings, purchase and restore from the
  free/expired reviewer identity on the signed build. Confirm no email OTP,
  paywall lockout, or off-platform credentials are needed.
- [ ] Confirm Apple review contact information, support URL and all review
  fields are correct. Use the **App Review Information** fields for the
  reviewer identifier and access code; never put them in this repository.

## Reviewer notes to paste in App Store Connect — only after checks pass

> Rook — Identity Protection, iOS 1.0.0 (15). Please review the build attached
> to this version, not an earlier TestFlight build. Support:
> support@getrook.app. Privacy: https://tryrook.app/privacy.
>
> **Reviewer access:** From the welcome screen, tap **Sign In**, then
> **App Review access** below the sign-in button. Enter the review identifier
> supplied in the App Review Information username field into **Email** and
> the access code supplied in the password field into **App Review Access
> Code**. Tap **Enter App Review**. This is an access-code sign-in, not a normal
> email/password sign-in; it does not require reading an email or entering a
> one-time email code. The reviewer account has a free/expired subscription
> state so the Premium purchase screen can be opened and tested. If access
> fails, contact support@getrook.app.
>
> **What to test:** Dashboard shows the reviewer account's sample scan
> history and alerts. Open Alerts → an alert → threat detail for evidence and
> reporting guidance. Open Scan to review the current account/photo context
> and start a scan. Open Profile → Subscription to view monthly/yearly Premium
> offerings, localized prices, terms and Restore Purchases from the
> free/expired state. Profile → Settings → Photo Monitor and
> Profile → Settings → Privacy & Data contain photo-processing controls;
> consent is separate and optional.
> Profile → Legal & Privacy opens the legal information, including the
> Privacy Policy. Rook provides detection and guidance; it does not file
> social-platform reports or guarantee removal.
>
> **Social accounts:** Instagram, Facebook and X have connection entry
> points. Instagram requests `instagram_business_basic`; Facebook requests
> `public_profile,user_photos`. Connecting either requires authorization by
> the reviewer’s own eligible social account and relevant provider access.
> The sample account entries are a review fixture, **not** proof of live
> provider authorization. TikTok, YouTube, LinkedIn and Snapchat are
> Coming Soon. There is no Tools tab or AI Scam Analyzer.
>
> **Photo data:** Rook may process photos containing faces for whole-image
> similarity/impersonation monitoring after separate photo consent. It does
> not create a facial-geometry template or perform facial recognition.
> Privacy Policy Section 2 covers collection, purpose, sharing, retention
> and consent withdrawal; Section 7 covers retention and deletion.

## Apple Resolution Center reply — conditional draft; do not send yet

> Hello App Review,
>
> Thank you for the detailed feedback on version 1.0 (12). We uploaded iOS
> version 1.0.0 (15) and have attached it to this resubmission.
>
> **Guideline 2.3.2 — promoted in-app purchase image:** [After confirming
> in App Store Connect, state which action was actually taken: “We removed the
> promotional image/promotion for Rook Premium Monthly,” OR “We replaced the
> promotional image with unique, legible, product-specific artwork with no
> price text.”] We checked the other promoted IAP/win-back assets and
> localizations for the same problems.
>
> **Guideline 2.1 — reviewer access and expired subscription:** The previous
> email/password credentials are no longer the reviewer path. The App Review
> Information fields contain a current reviewer identifier and access code.
> On the welcome screen choose **Sign In → App Review access**; enter the
> identifier as the Email and the code as the App Review Access Code, then
> tap **Enter App Review**. No inbox or OTP is required. The account exposes
> a free/expired subscription state; open **Profile → Subscription** to
> review Premium plans, purchase and Restore Purchases. [Only send after
> verifying the exact credentials and paywall on build 15.]
>
> **Guideline 2.1(a) — Sign in with Apple:** [Only after a clean native
> reproduction test passes, describe the result accurately, including
> whether build 15 is available on iPad and whether a new Apple ID can
> complete sign-in and onboarding on that device. Do not claim iPad is
> unsupported solely because `supportsTablet` is false.]
>
> **Guideline 2.1 — face/photo data:** Rook processes user-authorized
> face-containing photos (profile photos, post images, reel thumbnails and
> selected reference photos) and derives whole-image perceptual hashes,
> image embeddings and similarity metadata to find possible photo reuse or
> impersonation. It does not extract facial landmarks, construct a facial
> geometry template or perform face recognition. Raw image bytes or URLs may
> be shared with Google Cloud Vision and OpenAI for the disclosed comparison
> and analysis functions; search providers receive text queries, not photos.
> Rook's API and PostgreSQL storage run on Replit infrastructure. Selected
> compressed avatars, image-derived records, source URLs and alert evidence
> can be stored while needed for monitoring, subject to the published maximum.
> Users can withdraw consent or delete photo data from **Profile → Settings →
> Privacy & Data**; active-system photo-derived data is deleted
> and applicable backups are purged within 30 days. Consent records may be
> retained for seven years for compliance.
>
> In the live Privacy Policy at https://tryrook.app/privacy, see Section 2,
> “Biometric and Image-Derived Data — Written Notice,” under “What We
> Collect,” “Purpose of Collection,” “Length of Retention,” and
> “Third-Party Services That Receive Photo Data,” plus Section 7,
> “Data Retention and Deletion.” The current live policy states:
>
> “When you connect a social account or provide a reference photo, Rook may
> process profile photos, post images, reel thumbnails, and photos you select
> in the app. Raw image bytes or source URLs may be sent to Google Cloud
> Vision and OpenAI for the disclosed comparison and analysis features.”
>
> “Photo-derived data is not retained for more than 3 years from the date of
> collection, or 1 year after the purpose is fulfilled (whichever is sooner),
> consistent with Illinois BIPA Section 15(a) and Texas CUBI requirements.”
>
> “By accepting these Terms and the separate in-app Photo Processing Consent
> prompt, you provide the written release required under Illinois BIPA
> Section 15(b) and Texas CUBI, and the explicit consent required under GDPR
> Article 9(2)(a), for Rook to collect, store, and use the image-derived data
> described above.”
>
> **Earlier age-rating feedback (Guideline 2.3.6):** [After checking the
> App Store Connect questionnaire, confirm that Age Assurance is set to
> None; otherwise explain and show the actual in-app mechanism.]
>
> Please use the detailed steps in the updated App Review notes. Thank you.

The quoted policy text above was observed on the live page during this audit.
Recheck it immediately before sending; a production publish can change it.