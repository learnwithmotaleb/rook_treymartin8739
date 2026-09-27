---
name: Clerk reviewer environments
description: Securely designating one App Review user across isolated Replit-managed Clerk environments.
---

Replit-managed Clerk has separate development and production user stores, so a development Clerk user ID cannot designate the production App Review user. Prefer a fixed, server-configured reviewer email with the protected access code: only that exact email may be resolved or provisioned in the active Clerk tenant. Never resolve or create from an arbitrary request email, and do not trust legacy private-metadata markers. The exact-ID configuration remains a fail-closed fallback for environments that have not adopted the fixed-email mode.

**Why:** Publishing swaps development Clerk keys for production keys automatically. Reusing the development user ID in production caused real 404 lookup failures. A fixed server-owned email avoids tenant-specific IDs without letting an access-code holder select any user by typing a different address.

**How to apply:** Keep the exchange rate-limited and require both the access code and an exact match to the configured email before any Clerk lookup or account creation. If email mode is absent, the configured ID must still fail closed when stale. Seed fixtures from inside the deployed API using its own admin secret; development and production custom secret values may differ. Verify production API ticket issuance and the exact protected credentials on a newly signed build before submission. Old signed builds using Clerk's ordinary password flow cannot be repaired by backend-only changes or different input formats. Keep the public sign-in interface identical for reviewers and customers rather than adding a reviewer-only button. Restore access for each review window.