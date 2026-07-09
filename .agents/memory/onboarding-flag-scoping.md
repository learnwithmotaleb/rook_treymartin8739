---
name: Per-account onboarding flag scoping
description: hasSeenOnboarding must be scoped per auth-provider user id, not a single global AsyncStorage key, when the app supports switching accounts on the same device.
---

A "has completed onboarding" flag stored under one global AsyncStorage key breaks in two opposite directions the moment the app supports sign-out/sign-in with a different account:

- If the flag is never cleared on logout, a second/new account on the same device inherits the first account's completed state and skips onboarding.
- If the flag is cleared on every logout, the SAME account signing out and back in re-triggers onboarding — also wrong.

**Why:** the flag is really a property of the (account, not device) pair. A single unscoped key conflates both cases and only one fix direction is ever tried, causing the bug to resurface in the opposite form after a naive patch.

**How to apply:** key the storage entry by the auth provider's stable user id (e.g. `hasSeenOnboarding:${clerkUserId}`), set/read it inside the login flow once the id is known (not in the generic "restore AsyncStorage on mount" effect), and reset only the in-memory/ref state (not the per-user persisted value) on logout. Add an explicit "ready" flag gating any redirect decision that depends on the scoped value, since loading it is now async relative to app init.
