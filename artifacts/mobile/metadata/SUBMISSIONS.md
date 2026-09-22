# Rook — store metadata handoff (build 14)

Use these values in the store consoles and keep them synchronized with
`artifacts/mobile/store-metadata/app-store-metadata.md`.

## iOS

| Field | Value |
|---|---|
| Name | Rook: Impersonation Protection |
| Subtitle | AI Guard for Your Online Identity |
| Primary category | Utilities |
| Secondary category | Social Networking |
| Privacy Policy URL | https://tryrook.app/privacy |
| Support URL | https://tryrook.app/support |
| Marketing URL | https://tryrook.app |
| Account eligibility | Users must be at least 17 |

Use the text files in `ios/en-US/` for the name, subtitle, description,
keywords, promotional text, release notes, privacy URL, and support URL.

## Age/content questionnaires

The iOS Age Rating questionnaire and Google Play Content Rating questionnaire
describe content exposure; neither replaces Rook's minimum account eligibility.
The in-app signup, Terms, and Privacy notice require users to be at least
**17**. Do not describe the app as 4+, Everyone, or child-directed for
eligibility.

For iOS **Unrestricted Web Access**, build 14 does not provide a
general-purpose browser. It opens limited OAuth provider pages and links to
official guidance; scanning public sources does not make the app an unrestricted
browser. Complete and record the actual questionnaire result in App Store
Connect rather than predicting it here.

## Android

Use the Android text files in `android/en-US/`. Keep the same product claims,
17+ account eligibility, support URL, privacy URL, and supported-platform
scope. Complete Google's audience and content questionnaire in the console
without inferring its result from the eligibility rule.

## Screenshot and review constraints

- Capture only from the signed release candidate or a production-equivalent
  fixture.
- Do not publish fabricated scores, counts, names, match percentages, or
  unavailable screens.
- Do not include a Tools tab, AI Scam Analyzer, or `user_photos` flow.
- Build 14 is portrait iPhone-only (`supportsTablet: false`); verify current
  App Store Connect dimensions at upload time.
- Use `docs/reviewer-test-script.md` as the only reviewer walkthrough.