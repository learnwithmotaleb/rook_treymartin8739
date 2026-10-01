# Rook — iOS 1.0.1 App Review walkthrough

**App:** Rook — Identity Protection
**Platform:** iOS
**Version:** 1.0.1
**Support:** `support@getrook.app`
**Privacy:** `https://tryrook.app/privacy`
**Terms:** `https://tryrook.app/terms`

The user reports that version 1.0.1 was successfully uploaded. The latest managed iOS [Launch workflow](https://expo.dev/workflows/01a0f579-19f5-764a-8fcb-0e4739f102d1) returned `SUCCESS` when checked during this audit. That does not establish the exact signed build number, processing status, which build is attached in App Store Connect, or native sign-in success. The new Photo Monitor code in this request is not in that already-uploaded build. Install and test the exact processed build attached to the version under review. Do not infer its build number from `app.json` or require build 16 as a condition for reviewing 1.0.1. Build-15 instructions remain historical in `docs/build-15-apple-review.md`.

This is an internal walkthrough, not a record that any native-device or production test passed. Use only the current protected credentials in App Store Connect's **App Review Information** fields; never add their values to this document or source control.

## App Store Connect reviewer notes (copy/paste)

> Please use the normal **Sign In** screen. Enter the username exactly as shown in the protected **App Review Information** field, including its `review:` prefix, in **Email**. Enter the corresponding access code from the protected password field in **Password**, then tap **Sign In**. This reviewer access-code flow does not require mailbox access or an email verification code. If prompted, accept the current Terms and confirm that you are at least 17.
>
> The bottom tabs are **Dashboard**, **Alerts**, **Scan**, and **Profile**. In **Alerts**, open a sample alert to view its investigation. Examples are labeled **SAMPLE · NOT LIVE**; their images and findings are illustrative, not real impersonation discoveries.
>
> In **Profile**, scroll to the **Settings** section. Open **Subscription** for plan offerings and **Restore Purchases**, **Photo Monitor** for optional consent-based photo selection, **Privacy & Data** for data controls, or **Legal & Privacy** for policies. The review fixture does not provide a live social-account connection; provider authorization requires an eligible account. Support: support@getrook.app. Privacy: https://tryrook.app/privacy.

## Reviewer access

Use the normal **Sign In** screen:

1. Enter `review:<reviewer email>` in the **Email** field, exactly as shown in App Store Connect's protected username field.
2. Enter the current protected access code in **Password**, exactly as shown in the protected password field.
3. Tap **Sign In**.

There is no reviewer-only button or alternate login screen. The mobile source sends the `review:` identifier and password value to the App Review ticket endpoint; the API source validates the configured email/access code and then issues a short-lived Clerk sign-in ticket. The actual access-code value is supplied by `APP_REVIEW_ACCESS_CODE`, is not available in source, and has not been confirmed here. Before submission, an authorized operator must ensure the current production setting and protected App Store Connect password match. Do not use an ordinary Clerk password or a private mailbox/OTP for this ticket flow. Ordinary non-review logins can still be asked for a new-device email verification code.

If prompted for current Terms acceptance or confirmation that the reviewer is at least 17, complete the in-app recovery step before continuing.

## Review walkthrough

1. Install the exact processed 1.0.1 build attached to this App Store version on a clean supported iPhone. `supportsTablet` is false in current source; do not assume iPad is a supported target.
2. Sign in using the protected username/access-code instructions above. Confirm the actual production ticket flow on this build; source inspection alone is not a sign-in test.
3. Confirm the initial tab is **Dashboard** and the reviewer reaches the account without needing a private inbox.
4. Verify the Dashboard displays only the current review account's data.
5. Open **Alerts** and inspect **Active** and **Resolved** if present. Open a seeded example alert to inspect its detail. The seeded investigation is explicitly marked `SAMPLE · NOT LIVE`; its account, evidence, scores, and match descriptions are illustrative. Workspace fixture evidence points both comparison sides to the same supplied illustrative image, with sample captions **Your Photo** and **Example Image**. The production API update is unverified, so do not promise that the corrected image currently renders in 1.0.1. Do not treat the sample as evidence of a real impersonation, copied photo, or live discovery; do not ask the reviewer to treat a sample caption as a real accusation or report/block based on it.
6. Open the **Scan** tab (screen heading **Identity Scan**). Reviewer sample history is not proof of a new live scan. The reviewer seeder creates no verified social accounts and no monitored-photo list; a real scan requires eligible connected account or photo input. Do not describe sample history as live discovery or invent a scan result.
7. On the **Profile** tab, scroll to the **Settings** section and choose **Photo Monitor**; Settings is a section on the Profile page, not a separate screen. Inspect consent and the current **Monitored Photos** state. The page also has **Add from Camera Roll** and, when an eligible connected account is available, **Import from Accounts**. Photo processing requires explicit consent; account-media import requires a verified account and active consent. The reviewer fixture does not seed a connected account or monitored photo in the already-uploaded 1.0.1 build, and that build's Photo Monitor list is local to the mobile app. Workspace mobile source now adds a clearly marked, display-only **Review Example** derived from marked server sample evidence. It is excluded from real scans and includes dismissal/account-boundary handling, but requires a newer signed build than the 1.0.1 upload; that can still be another build of version 1.0.1. Its exact build number is unknown, so do not describe it as present in the currently uploaded build. Do not treat the sample image in alert evidence or the profile avatar as a monitored photo. Test an upload only with an image authorized for that purpose.
8. On the **Profile** tab, scroll to the **Settings** section and choose **Subscription**. The reviewer seeder requests a Free/canceled state if no subscription already exists, but it does not overwrite an existing subscription. Verify offerings, localized prices, disclosures, and **Restore Purchases** on the actual build; do not assume the fixture guarantees a particular live StoreKit or RevenueCat state.
9. From **Profile**, verify the destinations in the scrollable **Settings** section: **Notifications**, **Security**, **Help & Support**, **Privacy & Data**, and **Legal & Privacy**. **Manage** opens account management. Confirm policies and support pages are reachable. In Privacy & Data, inspect export and consent controls; do not perform withdrawal, deletion, or account deletion unless explicitly authorized.
10. Sign out, confirm protected content is no longer visible, and sign back in. Record the device, app version/build shown by App Store Connect, environment, and observed results.

## Scope and evidence notes

- The actual bottom tabs are **Dashboard**, **Alerts**, **Scan**, and **Profile**. There is no Tools tab or AI Scam Analyzer in this navigation.
- Reviewer seed data is a sample investigation, not a real target, live provider authorization, or proof that Rook discovered an impersonator. Sample details explicitly disable report/response actions.
- The authorized review-sample image is for demonstrating the interface only. It does not depict a verified impersonation or establish that anyone copied the image.
- The workspace backend targets `https://tryrook.app/landing/reviewer-sample-photo.jpg?v=1de1d25649bd` and refreshes photo URLs only in explicitly marked sample rows on reviewer re-sign-in, preserving history and actions. The production root path `/reviewer-sample-photo.jpg` was found to return 404; the `/landing/` asset returned 200 `image/jpeg`. Deployment/current production API behavior is unverified: do not claim the live API has been updated or that the corrected image URL already renders in 1.0.1.
- The workspace native **Review Example** is display-only and requires a newer signed build than the already-uploaded 1.0.1 build; another build of version 1.0.1 can include it. Its exact build number is unknown; do not guess or present it as part of the uploaded build. Its display does not populate the uploaded build's local Photo Monitor list.
- Complete production testing of Meta provider authorization/access, eligible account media import, and explicit photo permission/consent before claiming those flows work. Verify live policy/API privacy parity separately.
- Do not claim live Facebook, Instagram, or X authorization, discovery, or media import unless tested using an eligible provider-controlled account on the actual build.
- App Store upload success, workspace source, seeded records, and screenshots do not establish native sign-in success, production API/legal parity, StoreKit behavior, or a signed build number. Record those only after external verification.

For review support, email `support@getrook.app`.