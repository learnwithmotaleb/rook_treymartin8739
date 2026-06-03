---
name: Clerk name sync
description: How real user names get into the DB — JIT provisioning uses a "Shield User" fallback.
---

When a Clerk user signs in for the first time, `requireAuth.ts` runs `getOrCreateUserByClerkId()`. Session claims don't include the user's display name by default, so JIT-provisioned rows get `name = "Shield User"`.

**Fix:** `_layout.tsx` calls `useUser()` from `@clerk/expo` to get `clerkUser.fullName` and `clerkUser.primaryEmailAddress.emailAddress`, then passes them to `login(name, email)`. `AppContext.login()` calls `updateMe({ name, email })` before `refreshData()` so the DB row is patched on every app open. Subsequent opens are no-ops (same name/email).

**Why:** The Admin SDK isn't wired up on the server, so the client-side Clerk user object is the only reliable source of the real display name.
