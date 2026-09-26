# Rook — build 15 submission guide

This is the repository's operational guide for the iOS build-15
submission. Console state is not proven by this file; each unchecked console
item needs evidence in the final audit.

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

Do not use API-route placeholders, alternate subtitles/categories, or
credentials in source-controlled documents.

## Age eligibility versus store content rating

Rook's in-app signup, Terms, and Privacy notice require users to be at least
**17**. This is the product's minimum account eligibility and must be stated
consistently wherever eligibility is discussed.

Apple's Age Rating questionnaire and Google's Content Rating questionnaire are
separate descriptions of content exposure. They must be completed in their
respective consoles and must not be represented as the eligibility rule. Do
not describe Rook as 4+, Everyone, or child-directed for account eligibility.

For Apple's **Unrestricted Web Access** question, answer based on the actual
build: Rook does not provide a general-purpose browser. It opens limited
provider authorization pages and links to official guidance. Scanning public
sources does not itself provide unrestricted web browsing.

Record the questionnaire result separately after console completion. Do not
invent a resulting rating in repository documentation.

## Build and device checks

- [ ] Build 15 is processed and attached to the intended App Store version.
- [ ] Clean physical iPhone install and launch pass.
- [ ] First-time and returning Apple/Google/email authentication pass.
- [ ] OAuth cancellation and supported-provider callbacks pass.
- [ ] Photo permission, notification, subscription, restore, deletion, and
  deep-link flows pass on the signed build.
- [ ] Every blocker in `docs/build-15-apple-review.md` has recorded evidence.

## Review notes

Use the build-15 reviewer notes in `docs/build-15-apple-review.md`. Supply
reviewer credentials only through App Store Connect's protected review fields.
Build 15 supports Instagram, Facebook, and X connections; TikTok, LinkedIn,
YouTube, and Snapchat are non-actionable Coming Soon entries.

The review build does not contain a Tools tab or AI Scam Analyzer. Facebook
requests `public_profile` and `user_photos`; uploaded-photo retrieval is
consent-gated on the server and still needs a live TestFlight verification.
Rook
provides detection, evidence, explanations, and official guidance. It does
not submit platform reports or guarantee removal.

## Legal and privacy

- Privacy Policy: https://tryrook.app/privacy
- Terms of Service: https://tryrook.app/terms
- Support: https://tryrook.app/support

Verify the live pages, privacy disclosures, data deletion, consent withdrawal,
and export behavior before submission. Keep App Store Connect age-rating,
privacy-label, subscription, and screenshot confirmation open until verified
in the console.