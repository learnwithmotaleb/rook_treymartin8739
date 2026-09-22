# Rook — Meta App Review Guide (Build 14)

**App:** Rook — Identity Protection  
**Bundle ID:** `com.getrook.app`
**Live domain:** `https://tryrook.app`
**Support:** `support@getrook.app`

## Current build permissions

Only describe permissions actually requested by build 14:

| Platform | Current scope | Purpose |
|---|---|---|
| Instagram | `instagram_business_basic` | Connect an Instagram Business or Creator account and read the profile/basic media metadata needed for identity monitoring. |
| Facebook | `public_profile` | Display the connected user's public name and profile image and confirm which account was connected. |

`user_photos` is **not requested by build 14**. It is not part of this
submission, should not be granted or demonstrated to reviewers, and must not
appear in live-flow instructions.

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
5. Repeat with **Facebook**. Confirm the consent request contains
   `public_profile` only.
6. Return to Rook and confirm the Facebook identity displays as connected.
7. Start a scan and confirm the connected-account context is visible and the
   result is honest. Do not claim that the current build reads Facebook photo
   albums.
8. Disconnect each test account and confirm the app removes the connection and
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
or that `user_photos` will be added later unless those statements have been
re-verified against the current implementation and Meta approval status.

Current legal pages:

- Privacy Policy: `https://tryrook.app/privacy`
- Terms of Service: `https://tryrook.app/terms`
- Support: `https://tryrook.app/support`

## Out of scope

This guide does not instruct reviewers to test unavailable permissions,
development builds, screen recordings in place of live access, or obsolete
Tools/Photo Monitor paths. Any older Meta reviewer guide containing those
claims is superseded by this document.