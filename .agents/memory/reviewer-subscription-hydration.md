---
name: Reviewer subscription hydration
description: How server-granted Premium access should bypass the mobile purchase flow for review and test accounts.
---

Server-granted reviewer subscriptions must be read directly from the authenticated subscription endpoint when the paywall opens. Do not rely only on the mobile subscription context or RevenueCat customer info to decide whether to show purchase UI.

**Why:** A reviewer account can have a valid Premium record on the server while the app context still contains its initial free-tier value during the onboarding-to-paywall transition. RevenueCat also cannot represent a manually granted reviewer entitlement before store purchasing is available.

**How to apply:** Keep RevenueCat authoritative for ordinary customer purchases, but let an authenticated active Premium server record immediately bypass the purchase flow. Wait for that server check before rendering a free-user paywall.