---
name: Reviewer subscription hydration
description: Keep App Review purchase access truthful while preserving real entitlements across repeat sign-in.
---

The designated App Review account should start Free with an expired subscription so Apple can inspect purchases. Provision this state once, not on every sign-in. If the reviewer purchases or restores a real sandbox entitlement, a later sign-in must not downgrade it. Read authenticated server subscription state before choosing paywall UI; do not rely only on the mobile context or RevenueCat customer info.

**Why:** Apple explicitly requested an expired-subscription account to inspect purchasing. A repeated login that rewrites billing to Free would invalidate a purchase/restore walkthrough. Separately, the app context can briefly contain an initial Free value even when the server has a valid Premium record.

**How to apply:** Keep RevenueCat authoritative for ordinary customer purchases and the server authoritative for quota. Initial reviewer provisioning must not replace an existing entitlement; prepare an expired account deliberately before handing credentials to Apple. Let an authenticated active Premium server record bypass the purchase flow, and wait for that check before rendering a free-user paywall.