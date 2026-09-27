# Rook — next signed iOS release audit

**Release decision: NO-GO.** Workspace code has changed since signed build 15.
The next distribution build must use a number greater than 15, finish
processing, and be tested before these instructions replace build-15 notes.
Do not submit or reply to Apple on the basis of source inspection alone.

## Checklist (checked means verified in the stated environment)

The last iOS Launch built Rook `com.getrook.app` for App Store Connect app 6804614269, but Apple rejected build 10 because build 15 was already uploaded. The production iOS build is now pinned to 16 in `app.json` with local EAS versioning and no automatic increment. Confirm the next signed IPA actually reports build 16 before treating the upload as fixed. Bump `ios.buildNumber` manually before every later production upload.

| Flow | Checked / completed in workspace | Still needs work or evidence |
|---|---|---|
| Reviewer sign-in security | The ordinary **Sign In** form also accepts a protected App Review username in the format `review:<reviewer email>` and an access code in Password. There is no reviewer-only link, gesture, or public form. Ordinary email addresses still use Clerk password sign-in, including new-device email verification. When `APP_REVIEW_EMAIL` is configured, the API requires an exact email and access-code match, then reuses or provisions only that email in the active Clerk tenant; the older exact-ID setting remains a fallback when email is absent. | Set `APP_REVIEW_EMAIL` for the intended production reviewer and keep the protected code active for the review window. Publish the updated API, then use a **new signed mobile build** (old TestFlight builds still use the old sign-in UI) with the exact protected App Store Connect fields. Verify ticket issuance and sign-in on that build. Revoke the code and reviewer designation after approval. This special credential path does not disable Clerk's new-device verification for ordinary logins. |
| Signup agreements | Terms/privacy and separate 17+ acknowledgment now appear at the end of the form, directly above **Create Account**; SSO actions follow below. Registration requires both boxes. | Verify small-screen/keyboard/VoiceOver layout and a complete fresh signup in the new signed build. A checkbox is an account eligibility declaration, **not** Apple Age Assurance. |
| Apple/Google SSO | A new provider-created identity is asked for explicit Terms and 17+ acknowledgment before its session is activated. The API blocks normal authenticated requests without current, timestamped acknowledgments; the tabs show a recovery screen for cancelled or failed attempts and returning users with missing records. | Verify sign-out failure/recovery and first-time/returning Apple IDs on clean iPhone **and iPad if installable**. The new server gate and app must ship together: publishing it alone would lock older clients out of normal API calls. No native pass is recorded. |
| Facebook/Instagram photos | Onboarding now requests separate photo consent before fetching account media, handles a failed fetch with Retry/Continue, and submits full image URLs while showing thumbnails. | Live provider approval, actual production API parity, permissions, full-photo readability by reverse-image search, and new-build native test. A consented but empty media response must be described honestly. |
| Photo consent, deletion, export | Code exposes consent withdrawal and data export. | Verify active-system deletion and backup/processor retention against the **live** policy. Prior audits found possible orphan photo data and unverified 24-hour cleanup; do not claim those passed. Verify Meta deauthorization/data-deletion callback cleanup independently. |
| Scans, alerts, reports, push | App has these entry points in code and a seeded reviewer fixture. | Signed-build walkthrough: honest scan progress/results, own-user evidence, resolve/share/report links, background notification/deep-link safety. A seeded fixture is not a live OAuth or discovery pass. |
| Subscription and restore | Reviewer fixture code seeds free/canceled/expired state, and paywall includes StoreKit/restore logic. | Confirm RevenueCat offerings, actual StoreKit purchase/restore/expired flow, prices, disclosure, production entitlement sync, and reviewer access on the signed build. |
| Store metadata | Proposed reviewer wording below avoids hard-coded fixture counts and unverified live Meta claims. | App Store Connect: attach new processed build; remove/replace the promoted IAP image (unique, legible, no icon/screenshot/price); set Age Assurance to None unless truly present; confirm product/localization images, privacy label and screenshots. |
| Live legal pages and production | `https://tryrook.app/privacy`, `/terms`, and `/support` returned HTTP 200 during the previous audit. | Live privacy wording differed from current server source; publish and verify the intended server/policy version before quoting it to Apple. Validate stored-face-data/deletion wording against implementation. |

## Reviewer-access lifecycle

The reviewer uses the same Email and Password fields as everyone else, with
the username `review:<reviewer email>` and the protected access code as the
password. The prefix is not a valid ordinary email address, so other users
retain their normal Clerk login flow. The prefix is **not authorization**:
the server must still require the exact configured Clerk identity, matching
email and access code, and rate-limit attempts. Keep access enabled through
review and any appeal; afterward, rotate/remove the protected code in
production and remove the account's reviewer designation when no further
review is expected. Verify that the API refuses new review tickets afterward.
The Sign In UI needs no reviewer-only control or follow-up update to hide one.
Future reviews need valid access restored before submission.

## Draft for the next build's protected App Review notes — not yet paste-ready

> Please install the **new build attached to this version**. On the normal
> Sign In screen, enter the exact username from the protected App Review
> Information username field (including its `review:` prefix) in Email and
> the access code from the protected password field in Password. Tap Sign In.
> No reviewer-only link, mailbox access, or email OTP is needed for these
> credentials. If asked to accept the current Terms and confirm you are 17 or
> older, complete that in-app step before entering the dashboard.
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