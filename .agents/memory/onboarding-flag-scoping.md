---
name: Per-account onboarding flag scoping
description: hasSeenOnboarding must be scoped per auth-provider user id, not a single global AsyncStorage key, when the app supports switching accounts on the same device.
---

A "has completed onboarding" flag stored under one global AsyncStorage key breaks in two opposite directions the moment the app supports sign-out/sign-in with a different account:

- If the flag is never cleared on logout, a second/new account on the same device inherits the first account's completed state and skips onboarding.
- If the flag is cleared on every logout, the SAME account signing out and back in re-triggers onboarding — also wrong.

**Why:** the flag is really a property of the (account, not device) pair. A single unscoped key conflates both cases and only one fix direction is ever tried, causing the bug to resurface in the opposite form after a naive patch.

**How to apply:** key the storage entry by the auth provider's stable user id (e.g. `hasSeenOnboarding:${clerkUserId}`), set/read it inside the login flow once the id is known (not in the generic "restore AsyncStorage on mount" effect), and reset only the in-memory/ref state (not the per-user persisted value) on logout. Add an explicit "ready" flag gating any redirect decision that depends on the scoped value, since loading it is now async relative to app init.

**Follow-up — server truth beats device/time heuristics:** the per-user AsyncStorage key alone is still not enough — it's lost on reinstall and stale after account deletion/recreation, and a supplementary "Clerk account age < N minutes = new" heuristic is also just a proxy (it wrongly skips onboarding for someone who abandoned the flow and returns after the window). Rook now exposes a durable `onboardingCompleted` field from the server (`onboardingAnswers IS NOT NULL` on the users table) via `GET /me`, and the client treats a `true` from the server as authoritative, syncing it into the local cache but never letting a stale local `false` override it. Don't gate onboarding redirects on auth-provider account age.
