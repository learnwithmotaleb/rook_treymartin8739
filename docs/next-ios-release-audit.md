# Rook — next signed iOS release audit

**Release decision: NO-GO.** Workspace code has changed since signed build 15.
The next distribution build must use a number greater than 15, finish
processing, and be tested before these instructions replace build-15 notes.
Do not submit or reply to Apple on the basis of source inspection alone.

## Checklist (checked means verified in the stated environment)

| Flow | Checked / completed in workspace | Still needs work or evidence |
|---|---|---|
| Reviewer sign-in security | The public review toggle and second-factor bypass were removed. Holding the logo for 800 ms opens the review form. The API now looks up only the configured Clerk user ID; it no longer creates or marks an identity from a supplied email. | Confirm that **production** has the correct reviewer ID in its production Clerk tenant and that the protected code is active for the review window. Use a clean signed install and the exact protected App Store Connect fields. Do not let an old development ID cause a 502. Rotate/revoke the access code and review account after approval; remove the code from production to disable this endpoint. Review requests for later updates require re-enabling it with valid credentials. |
| Signup agreements | Terms/privacy and separate 17+ acknowledgment now appear at the end of the form, directly above **Create Account**; SSO actions follow below. Registration requires both boxes. | Verify small-screen/keyboard/VoiceOver layout and a complete fresh signup in the new signed build. A checkbox is an account eligibility declaration, **not** Apple Age Assurance. |
| Apple/Google SSO | A new provider-created identity is asked for explicit Terms and 17+ acknowledgment before its session is activated. The API blocks normal authenticated requests without current, timestamped acknowledgments; the tabs show a recovery screen for cancelled or failed attempts and returning users with missing records. | Verify sign-out failure/recovery and first-time/returning Apple IDs on clean iPhone **and iPad if installable**. The new server gate and app must ship together: publishing it alone would lock older clients out of normal API calls. No native pass is recorded. |
| Facebook/Instagram photos | Onboarding now requests separate photo consent before fetching account media, handles a failed fetch with Retry/Continue, and submits full image URLs while showing thumbnails. | Live provider approval, actual production API parity, permissions, full-photo readability by reverse-image search, and new-build native test. A consented but empty media response must be described honestly. |
| Photo consent, deletion, export | Code exposes consent withdrawal and data export. | Verify active-system deletion and backup/processor retention against the **live** policy. Prior audits found possible orphan photo data and unverified 24-hour cleanup; do not claim those passed. Verify Meta deauthorization/data-deletion callback cleanup independently. |
| Scans, alerts, reports, push | App has these entry points in code and a seeded reviewer fixture. | Signed-build walkthrough: honest scan progress/results, own-user evidence, resolve/share/report links, background notification/deep-link safety. A seeded fixture is not a live OAuth or discovery pass. |
| Subscription and restore | Reviewer fixture code seeds free/canceled/expired state, and paywall includes StoreKit/restore logic. | Confirm RevenueCat offerings, actual StoreKit purchase/restore/expired flow, prices, disclosure, production entitlement sync, and reviewer access on the signed build. |
| Store metadata | Proposed reviewer wording below avoids hard-coded fixture counts and unverified live Meta claims. | App Store Connect: attach new processed build; remove/replace the promoted IAP image (unique, legible, no icon/screenshot/price); set Age Assurance to None unless truly present; confirm product/localization images, privacy label and screenshots. |
| Live legal pages and production | `https://tryrook.app/privacy`, `/terms`, and `/support` returned HTTP 200 during the previous audit. | Live privacy wording differed from current server source; publish and verify the intended server/policy version before quoting it to Apple. Validate stored-face-data/deletion wording against implementation. |

## Reviewer-access lifecycle

The review entry is not shown on the ordinary sign-in screen, but its code is
necessarily present in the submitted binary so Apple can use it. A long press
on the Rook logo opens the protected review form. Knowledge of this gesture
is **not security**; the server must also require the exact configured Clerk
identity and the access code, and rate-limit attempts. Keep it enabled for
Apple's review and any appeal; afterward, rotate/remove the protected access
code in the production environment and remove the account's reviewer
designation when no further review is expected. Verify the API returns
unavailable afterward. Any future Apple update may need reviewer access
restored for that review; never break access mid-review.

## Draft for the next build's protected App Review notes — not yet paste-ready

> Please install the **new build attached to this version**. At the sign-in
> screen, press and hold the Rook logo for about one second. The App Review
> access form will appear. Enter the exact reviewer identifier from the
> protected App Review Information username field in Email, and the access
> code from its password field in App Review Access Code. Tap Enter App
> Review. If asked to accept the current Terms and confirm you are 17 or
> older, complete that in-app step before entering the dashboard. This does
> not require access to a private inbox or email OTP.
> The account is in a free/expired state for reviewing Premium subscriptions
> and Restore Purchases under Profile → Subscription.
>
> Dashboard, Alerts → threat detail, Scan, Profile → Settings → Photo Monitor,
> Profile → Settings → Privacy & Data, and Profile → Settings → Legal &
> Privacy contain the other review flows. The seeded examples demonstrate
> the interface; they do not represent a live Facebook, Instagram, or X
> authorization. Separate photo-processing consent is required for photo
> monitoring. Privacy: https://tryrook.app/privacy.

Before pasting, replace “new build” with the **actual processed version and
build number**, then confirm every navigation step on that exact build. Keep
credentials only in protected App Store Connect fields. The Apple rejection
reply in `docs/build-15-apple-review.md` is conditional and must likewise be
rewritten with verified outcomes from the new build and live policy.