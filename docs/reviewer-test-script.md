# Rook — Build 14 App Review Instructions

**App:** Rook — Identity Protection  
**Platform:** iOS, build 14
**Canonical source:** This is the only reviewer walkthrough to provide to Apple.
**Support:** `support@getrook.app`
**Privacy:** `https://tryrook.app/privacy`
**Terms:** `https://tryrook.app/terms`

## Reviewer access

Enter the current reviewer identifier and access code only in App Store
Connect's protected **App Review Information** fields. Do not put credentials
in source control or in these instructions.

The configured review endpoint provisions the protected review identity and
seeds its review fixture. The access-code flow is intended to avoid requiring
Apple to read a private email inbox or receive an OTP. If the supplied access
details do not work, contact `support@getrook.app`; do not substitute a
different account.

The fixture is the source of truth for score, threat count, evidence,
connected-account state, photo count, and entitlement. These instructions
intentionally do not publish exact values that can become stale.

## Review walkthrough

1. Install build 14 on a clean supported iPhone and launch Rook.
2. Use only the credentials/access code in App Store Connect.
3. Confirm authentication reaches **Dashboard** without private inbox access.
4. Confirm Dashboard loads and shows the review fixture's current score,
   alerts, connected accounts, monitored photos, and plan.
5. Open a recent alert, then open its threat detail. Verify the displayed
   evidence, match information, severity, explanation, and official reporting
   guidance belong to that threat.
6. Open **Alerts**. Test All, High, Medium, and Low filters when those
   severities are present. Open an alert and cancel, then complete, the
   Resolve action.
7. Open **Scan**. Review the current account/photo context, start one scan,
   wait for honest progress and completion, and verify the result is scoped to
   the review identity.
8. Open **Connect Account**. Verify Instagram, Facebook, and X are supported;
   verify TikTok, LinkedIn, YouTube, and Snapchat are visibly unavailable or
   marked Coming Soon. Cancel the picker.
9. If live OAuth is part of the submission, test the relevant provider using
   the test identity documented in the provider's protected review form.
   Instagram requests `instagram_business_basic`; Facebook requests
   `public_profile`; X uses its current PKCE scopes. Otherwise verify the
   entry point and cancel safely.
10. Open **Photo Monitor** and verify its current monitoring state. Test the
    permission explanation, allow/deny/cancel paths, and recovery after a
    denial.
11. Open the subscription screen from a free/expired review state when that
    state is supplied. Verify products, localized prices, terms/privacy links,
    auto-renewal disclosure, and **Restore Purchases**. Do not assume the
    review fixture is Premium unless the protected review notes say so.
12. Open **Profile**, then Support, Terms, Privacy, Notification Settings, and
    Privacy & Data. Confirm each page is reachable. Open data export and
    cancel any destructive action.
13. Sign out, confirm protected content is not visible, and sign back in.
14. Confirm there are no crashes, blank screens, infinite spinners,
    inaccessible controls, fabricated findings, or wrong-user data.

## Important scope notes

- Build 14 has no Tools tab or AI Scam Analyzer. Do not look for or mention
  either feature.
- Rook assists with detection and links to official platform reporting. It
  does not submit reports, guarantee removal, or determine that a person
  committed a crime.
- Facebook build-14 OAuth requests `public_profile` only. `user_photos` is
  not a current permission and must not be presented as live functionality.
- A supplemental recording may illustrate a flow, but it never replaces live
  reviewer access or live Sign in with Apple testing.

For review support, email `support@getrook.app`.