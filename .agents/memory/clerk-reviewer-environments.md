---
name: Clerk reviewer environments
description: Securely designating one App Review user across isolated Replit-managed Clerk environments.
---

Replit-managed Clerk has separate development and production user stores, so a development Clerk user ID cannot designate the production App Review user. The protected review-ticket exchange must resolve or create the matching account in the active tenant and mark it with server-only Clerk private metadata. Reviewer authorization accepts the configured development ID or this private metadata marker.

**Why:** Publishing swaps development Clerk keys for production keys automatically. Reusing the development user ID in production causes Clerk lookup failures, while email-only or client-supplied reviewer flags would allow unsafe reviewer entitlement spoofing.

**How to apply:** Keep the access-code exchange rate-limited, verify the protected reviewer email, set reviewer metadata only with the Clerk secret key, and never trust client headers or public/editable profile fields for reviewer privileges. Seed production fixtures from inside the deployed API using its own admin secret; development and production custom secret values may differ.