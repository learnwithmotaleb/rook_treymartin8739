---
name: Clerk session types
description: useSessionList() returns SessionResource[] not SessionWithActivities[]; latestActivity and revoke are not on the TypeScript type in @clerk/expo v5
---

# Clerk Session Types — @clerk/expo

## Rule
When using `useSessionList()`, the returned sessions are typed as `SessionResource[]`. The TypeScript type **does not** expose `latestActivity` or `revoke()`, even though the runtime objects have them.

**Why:** `@clerk/expo` re-exports `useSessionList` from `@clerk/react`, which uses `SessionResource`. The richer `SessionWithActivities` type (with `latestActivity` and `revoke`) is not surfaced in the type declarations of this package version.

**How to apply:**
- Cast to `any` (aliased as a named type like `AnySession`) when accessing `latestActivity` or calling `revoke()`
- Use `(session as AnySession).revoke?.()` with optional chaining so it silently no-ops if the method isn't present at runtime
- Use `useSession()` (singular) to get the current session ID for "current device" comparison
