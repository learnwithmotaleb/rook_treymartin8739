---
name: Native social sign-in account creation
description: App Review and compliance behavior for first-time identities using native Apple or Google sign-in.
---

## Rule

Treat a successful native Apple or Google identity transfer as both sign-in and account creation. Activate the newly created session and continue to onboarding; never show an “account not found” error after the provider has authenticated and created the user.

**Why:** App Review tests Sign in with Apple using an Apple ID that has never used the app. Rejecting that new identity after Apple succeeds makes a correctly configured native provider appear broken and causes a login rejection.

**How to apply:** Put the legal and minimum-age disclosure next to the social buttons, record the required acknowledgments for newly created social users after session activation, and preserve the frictionless path for returning social users.