---
name: App Store subscription territory pricing
description: The review-readiness requirement for auto-renewable subscription price schedules across enabled territories.
---

Every enabled App Store territory needs its own `UPFRONT` subscription price row. A valid U.S. base price does not automatically make the other territories reviewable, even when availability, localization, trials, and review screenshots are complete.

**Why:** Apple can leave the parent subscription in `MISSING_METADATA` and reject the subscription version from a unified review submission with a missing-pricing-data state error. The exact missing territories are only exposed when attempting to add the subscription version.

**How to apply:** Start from the existing U.S. subscription price point, retrieve Apple's equalized price points, create only the missing territory rows, and confirm the subscription version advances to `READY_FOR_REVIEW` before submitting the review package.