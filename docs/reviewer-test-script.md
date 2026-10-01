# Rook — App Review walkthrough

**App:** Rook — Identity Protection
**Platform:** iOS

This script describes the reviewer demo behavior; it is not evidence that a particular signed build or production service was tested. Record the exact App Store Connect build attached to review and report observed results only. Do not put usernames, passwords, access codes, tokens, or other credentials in this document. If App Store Connect supplies protected review credentials, use those fields only.

## Reviewer demo authorization

- Reviewer demo mode is enabled only when the server authorizes the signed-in reviewer account. There is no client email flag. A visible **Reviewer Demo** banner indicates the server-authorized mode; do not infer demo authorization from an email address or a local setting.
- Sign-in is real authentication. Reviewer mode is not a legal or onboarding bypass: complete the actual minimum-age and Terms acknowledgements and the existing onboarding flow normally before using product screens.
- OAuth/provider authorization shown as a preview is **not authorized**. Do not connect a personal or third-party social account during this walkthrough.
- Demo profile, connected-account, scan, alert, photo-consent, notification, and other product data are demo data. Sample scans have **no discoveries**. A sample row or review image is not a live finding, evidence of impersonation, or proof that Rook scanned an external account.

## Walkthrough

1. Install the exact processed build attached to App Review on a supported iPhone. Sign in through the supported review flow using credentials supplied separately in protected App Store Connect fields, if provided. Never copy credentials into this script.
2. Complete any required live age and Terms acknowledgements and the existing onboarding flow. Confirm that the **Reviewer Demo** banner appears only after server authorization.
3. Visit **Dashboard**, **Alerts**, and **Scan**. Inspect the existing empty/sample states. Treat sample records as illustrative demo content only; sample scans report no discoveries. Do not report, block, or contact support about a fictitious threat.
4. From **Profile**, inspect connected accounts, **Edit Profile**, and each existing settings destination. Editing profile fields or choosing an avatar is a local preview only; the avatar selector uses reviewer-demo fixture photos without requesting camera-roll permission, and nothing updates Clerk or uploads an avatar.
5. In **Notifications**, exercise the existing toggles and frequency controls. They are session-only previews; the demo must not request OS notification permission, register a device, or send/deliver notifications.
6. In **Security**, inspect the existing controls. Biometric and activity toggles are preview-only; displayed 2FA and session rows are explicitly labeled sample viewmodels, not live account or Clerk session data. A session-revocation preview must not revoke a Clerk session. Do not interpret a preview as a successful security change.
7. In **Privacy & Data**, the downloadable file must be labeled as a demo export and contain only the demo payload. Consent and photo-data controls preview local demo state only; they do not withdraw real account consent or delete real account/photo data.
8. Open **Legal & Privacy** and follow the actual Privacy Policy and Terms links. These remain the real legal content. Support contact details remain real; do not contact support using a demo or invented threat.
9. In **Subscription**, preserve the reviewer account's actual entitlement/tier, including an expired/free state. Demo product context does not grant Premium. Pricing, purchase, and Restore use actual StoreKit/RevenueCat behavior; use the TestFlight build and the App Store sandbox to review billing. Do not claim a purchase or restore succeeded unless the store confirms it.
10. Sign out using the existing sign-out control if testing session end. Sign-out is real and ends the authenticated review session. The **Delete Account** confirmation is only a demo preview and must not delete the account, log out RevenueCat, or sign out of Clerk.

## Safety and evidence notes

- The authenticated `GET /api/reviewer/demo` fixture is read-only and contains marked sample data; it does not bypass the app's actual legal-age, Terms, or onboarding requirements. All product actions and product mutations in reviewer demo mode stay within demo/local state. The exceptions are real authentication and session sign-out, required legal-age/Terms/onboarding completion, actual legal links/content, and real StoreKit sandbox billing operations.
- OAuth/provider previews do not authorize a connection or prove provider access, account import, monitoring, or discovery.
- Never treat sample alerts, sample photos, or empty scan results as live detections. Do not claim a scan discovered an impersonator or copied photo.
- Do not claim notification delivery, 2FA changes, biometric setup, session revocation, profile persistence, consent withdrawal, data deletion, or export of actual account data from a demo preview.
- Verify the current build, server authorization, legal links, and StoreKit behavior on the actual review build before recording them as tested. Workspace source or demo fixtures alone are not proof of native-device or production behavior.