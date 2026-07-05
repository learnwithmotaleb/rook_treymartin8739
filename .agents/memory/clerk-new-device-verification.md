---
name: Clerk new-device verification (client trust)
description: Password sign-in from any brand-new device/browser on Replit-managed Clerk triggers a mandatory one-time email code step; the custom auth UI must handle it or sign-in silently hangs.
---

Clerk's Frontend API returns `signIn.status === "needs_second_factor"` (sometimes `"needs_client_trust"`) whenever a password sign-in comes from a client Clerk hasn't seen before (`client_trust_state: "new"`), even for accounts with no user-configured MFA (`two_factor_enabled: false`). It requires one `email_code` verification via `signIn.mfa.sendEmailCode()` / `signIn.mfa.verifyEmailCode({ code })`.

**Why:** This is Clerk-internal fraud/device-trust protection, not a per-user setting. On Replit-managed Clerk there is no dashboard access, so it cannot be toggled off or disabled instance-wide. A custom auth UI that only checks for `status === "complete"` after `signIn.password()` will silently do nothing (no error, no redirect) when this status is returned — confirmed via e2e test and matches the exact "stuck on /auth with no visible error" symptom.

Also confirmed: signing in via `email_code` as the **first** factor (passwordless) does NOT trigger a second-factor gate (`supported_second_factors: null`), but obviously still requires access to the inbox to get that code.

**How to apply:** Any custom Clerk sign-in flow (`signIn.password(...)`) must branch on `signIn.status` and handle `needs_second_factor`/`needs_client_trust` by showing a code-entry screen (see `artifacts/mobile/app/auth.tsx`'s `needsSigninCode` flow for the reference implementation). For demo/reviewer accounts (e.g. App Store review) that a third party will sign into from a device we don't control, this is a real blocker unless the reviewer/tester has access to the account's inbox — flag this explicitly in reviewer instructions, since Apple requires demo accounts not need out-of-band codes reviewers can't access.
