---
name: Clerk reviewer environments
description: Securely designating one App Review user across isolated Replit-managed Clerk environments.
---

Replit-managed Clerk has separate development and production user stores, so a development Clerk user ID cannot designate the production App Review user. Reviewer-ticket issuance and reviewer entitlements both require exact equality to the configured Clerk user ID in the active tenant. Do not recreate a reviewer from a supplied email or trust legacy private-metadata markers.

**Why:** Publishing swaps development Clerk keys for production keys automatically. Reusing the development user ID in production causes lookup failures; falling back to email-based account creation or a legacy marker can grant reviewer privileges to the wrong identity.

**How to apply:** Keep the access-code exchange rate-limited and verify the email belongs to the configured reviewer ID in that tenant. Fail closed when the ID is stale or missing; verify the production identity and exact protected reviewer credentials on a signed build before submission. Seed production fixtures from inside the deployed API using its own admin secret; development and production custom secret values may differ. Keep the public sign-in interface identical for reviewers and customers rather than adding a reviewer-only button: Clerk's new-device email gate makes true password login unreliable for reviewers without inbox access, but a protected, non-email username convention can use the server ticket path without changing the customer-facing form. Restore access for each review window.