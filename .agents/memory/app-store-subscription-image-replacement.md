---
name: App Store subscription image replacement
description: State transitions required to replace locked subscription promotion images through App Store Connect API.
---

For a subscription promotion image already in `WAITING_FOR_REVIEW`, deleting the image or review item directly can fail because the subscription version was submitted. Mark the subscription-group and subscription-version review items `removed: true`; the image can then be deleted. Complete/cancel the unresolved submission, then create a new review submission containing the app version, subscription-group version, and subscription versions.

**Why:** App Store Connect rejects DELETE for an already-submitted review item and does not allow adding new items to an `UNRESOLVED_ISSUES` submission, even after its subscription items are marked removed.

**How to apply:** Use the review-item PATCH removal flow, preserve the app version and product configuration, delete or replace the unlocked images, and rebuild a draft submission before resubmitting. Removed items cannot be restored to the old submission.