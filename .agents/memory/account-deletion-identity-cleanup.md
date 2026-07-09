---
name: Account deletion must remove the auth provider identity, not just the DB row
description: "Delete account" flows that only wipe app DB data while leaving the auth provider (Clerk/Auth0/etc) user intact cause the same identity to be treated as a returning user on re-signup.
---

If "Delete Account" only removes the app's own DB record (cascade-deleting related rows) but does not delete the user object in the external auth provider, signing up again with the same email/OAuth identity reuses the same provider user id and `createdAt`. Any "is this a new account" heuristic based on that id or its age (session flags scoped by user id, "new account" age checks, etc.) will incorrectly treat the recreated account as a returning user.

**Why:** app-level "delete" and identity-provider "delete" are two separate systems; deleting one without the other leaves a stale identity that outlives the data it was tied to.

**How to apply:** when implementing account deletion, call the auth provider's backend/admin API to delete the underlying user (e.g. Clerk: `DELETE https://api.clerk.com/v1/users/{id}` with the secret key) in addition to deleting local DB rows. Treat provider-delete failures as non-fatal/logged, not blocking, since the local data removal is the primary guarantee.
