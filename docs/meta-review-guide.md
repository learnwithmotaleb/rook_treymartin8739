# Rook — Meta App Review Guide

**App:** Rook — Identity Protection  
**Bundle ID:** `com.getrook.app`
**Live domain:** `https://tryrook.app`
**Support:** `support@getrook.app`

## Current review-build permissions

Only describe permissions actually requested by the review build:

| Platform | Current scope | Purpose |
|---|---|---|
| Instagram | `instagram_business_basic` | Connect an Instagram Business or Creator account and read the profile/basic media metadata needed for identity monitoring. |
| Facebook | `public_profile` | Display the connected user's public name and profile image and confirm which account was connected. |
| Facebook | `user_photos` | Let the user select their own uploaded Facebook photos as identity-monitoring references after separate photo-processing consent. |

The Instagram and Facebook permissions belong to separate Meta developer apps.
The Facebook app must have Advanced Access for `user_photos`.

## Reviewer test identity

Store Meta test-user credentials only in Meta's protected reviewer form. The
identity must be assigned the appropriate app role and, for Instagram, be
linked to an Instagram Business or Creator account. Do not put credentials,
private email addresses, or fabricated fixture counts in this document.

## Live test steps

1. Create or sign into the Rook account using the protected reviewer
   instructions.
2. Open **Profile → Connected Accounts → Connect Account → Instagram**.
3. Complete the Meta authorization. Confirm the consent request contains
   `instagram_business_basic` and no unapproved scope.
4. Return to Rook and confirm the connected account displays the returned
   identity.
5. Repeat with **Facebook**. Confirm the consent request includes
   `public_profile` and `user_photos`.
6. Return to Rook and confirm the Facebook identity displays as connected.
7. Open the connected Facebook account's media picker, show multiple uploaded
   photos returned by `/me/photos`, and select one reference photo after
   granting Rook's separate photo-processing consent.
8. Start a scan and confirm the connected-account context is visible and the
   result is honest.
9. Disconnect each test account and confirm the app removes the connection and
   handles derived data according to the current Privacy Policy.

## Production callback configuration

These values must match the Meta dashboard and production environment:

```text
https://tryrook.app/api/oauth/instagram/callback
https://tryrook.app/api/oauth/facebook/callback
com.getrook.app://oauth
```

Verify them in the provider console before submission; this document is not
evidence that the console configuration is correct.

## Data and privacy explanation

Rook uses connected-account data for identity monitoring, evidence, and
account-specific scan results. Explain only data handling confirmed by the
current Privacy Policy and production implementation. Do not promise that
original photos are never transmitted, that only 64-bit hashes are retained,
unless those statements have been re-verified against the current
implementation and Meta approval status.

Current legal pages:

- Privacy Policy: `https://tryrook.app/privacy`
- Terms of Service: `https://tryrook.app/terms`
- Support: `https://tryrook.app/support`

## Out of scope

This guide does not instruct reviewers to test unavailable permissions,
development builds, screen recordings in place of live access, or obsolete
Tools/Photo Monitor paths. Any older Meta reviewer guide containing those
claims is superseded by this document.