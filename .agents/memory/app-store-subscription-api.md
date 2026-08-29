---
name: App Store subscription API quirks
description: Non-obvious App Store Connect API requirements for creating new auto-renewable subscriptions.
---

For a newly created subscription, set the initial price through the subscription's inline price relationship in a PATCH request. The standalone subscription-price POST endpoint is for later price changes and returns a generic pricing error when used for the initial price.

Availability belongs in a separate subscription-availability resource. Introductory free trials must be created once per territory; a global trial request without a territory is rejected. Large territory rollouts should use conservative batching and retry HTTP 429 responses.

**Why:** Apple's current API rejects older or seemingly valid payloads with generic relationship/state errors, and fast all-territory trial creation triggers rate limits.

**How to apply:** Use read-back checks after each stage, make the process idempotent, and resume missing territory records rather than deleting or recreating products.