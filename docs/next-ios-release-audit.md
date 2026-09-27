# Rook — next signed iOS release audit

**Release decision: NO-GO.** Workspace code has changed since signed build 15.
The next distribution build must use a number greater than 15, finish
processing, and be tested before these instructions replace build-15 notes.
Do not submit or reply to Apple on the basis of source inspection alone.

## Checklist (checked means verified in the stated environment)

| Flow | Checked / completed in workspace | Still needs work or evidence |
|---|---|---|
| Reviewer sign-in security | A visible **App Review access** link below the Sign In button opens a separate email/access-code form; normal social sign-in options are hidden while it is open. The API looks up only the configured Clerk user ID; it does not create or mark an identity from a supplied email. | Confirm that **production** has the correct reviewer ID in its production Clerk tenant and that the protected code is active for the review window. Use a clean signed install and the exact protected App Store Connect fields. Do not let an old development ID cause a 502. Revoke the code and reviewer designation after approval; removing the visible link requires a subsequent app update. Review requests for later updates require restoring valid access. |
| Signup agreements | Terms/privacy and separate 17+ acknowledgment now appear at the end of the form, directly above **Create Account**; SSO actions follow below. Registration requires both boxes. | Verify small-screen/keyboard/VoiceOver layout and a complete fresh signup in the new signed build. A checkbox is an account eligibility declaration, **not** Apple Age Assurance. |
| Apple/Google SSO | A new provider-created identity is asked for explicit Terms and 17+ acknowledgment before its session is activated. The API blocks normal authenticated requests without current, timestamped acknowledgments; the tabs show a recovery screen for cancelled or failed attempts and returning users with missing records. | Verify sign-out failure/recovery and first-time/returning Apple IDs on clean iPhone **and iPad if installable**. The new server gate and app must ship together: publishing it alone would lock older clients out of normal API calls. No native pass is recorded. |
| Facebook/Instagram photos | Onboarding now requests separate photo consent before fetching account media, handles a failed fetch with Retry/Continue, and submits full image URLs while showing thumbnails. | Live provider approval, actual production API parity, permissions, full-photo readability by reverse-image search, and new-build native test. A consented but empty media response must be described honestly. |
| Photo consent, deletion, export | Code exposes consent withdrawal and data export. | Verify active-system deletion and backup/processor retention against the **live** policy. Prior audits found possible orphan photo data and unverified 24-hour cleanup; do not claim those passed. Verify Meta deauthorization/data-deletion callback cleanup independently. |
| Scans, alerts, reports, push | App has these entry points in code and a seeded reviewer fixture. | Signed-build walkthrough: honest scan progress/results, own-user evidence, resolve/share/report links, background notification/deep-link safety. A seeded fixture is not a live OAuth or discovery pass. |
| Subscription and restore | Reviewer fixture code seeds free/canceled/expired state, and paywall includes StoreKit/restore logic. | Confirm RevenueCat offerings, actual StoreKit purchase/restore/expired flow, prices, disclosure, production entitlement sync, and reviewer access on the signed build. |
| Store metadata | Proposed reviewer wording below avoids hard-coded fixture counts and unverified live Meta claims. | App Store Connect: attach new processed build; remove/replace the promoted IAP image (unique, legible, no icon/screenshot/price); set Age Assurance to None unless truly present; confirm product/localization images, privacy label and screenshots. |
| Live legal pages and production | `https://tryrook.app/privacy`, `/terms`, and `/support` returned HTTP 200 during the previous audit. | Live privacy wording differed from current server source; publish and verify the intended server/policy version before quoting it to Apple. Validate stored-face-data/deletion wording against implementation. |

## Reviewer-access lifecycle

The reviewer entry is deliberately visible on the Sign In screen so Apple can
find it without a hidden gesture. Visibility is **not authorization**: the
server must still require the exact configured Clerk identity and access
code and rate-limit attempts. Keep it enabled through review and any appeal;
afterward, rotate/remove the protected code in production and remove the
account's reviewer designation when no further review is expected. Verify
that the API refuses new review tickets afterward. The visible entry remains
in that signed binary until a later app update removes it; it should then
show an unavailable response, not grant access. A future review may need
access restored; never disable it mid-review.

## Draft for the next build's protected App Review notes — not yet paste-ready

> Please install the **new build attached to this version**. At the sign-in
> screen, tap **App Review access** beneath the Sign In button. Enter the
> reviewer identifier from the protected App Review Information username
> field in Email, and the access
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