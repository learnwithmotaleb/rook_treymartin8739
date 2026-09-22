---
name: Meta app separation
description: Why Rook keeps Instagram Login and Facebook photo access in separate Meta developer apps.
---

Use separate Meta developer apps for Rook's Instagram and Facebook integrations. The Instagram app uses Instagram API with Instagram Login and `instagram_business_basic`; the Facebook app uses Facebook Login with `public_profile,user_photos`.

**Why:** `instagram_business_basic` grants access only to the authenticated Instagram professional account and its media. Facebook uploaded photos require `user_photos`, and Meta's Instagram login configurations cannot mix Instagram Login and Facebook Login in one app flow.

**How to apply:** Keep distinct app IDs, secrets, callbacks, review submissions, and screencasts. Changes to either permission set require a signed build and live test against the corresponding Meta app before review claims are updated.