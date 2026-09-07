---
name: Subscription EULA metadata
description: App Store metadata requirement for apps offering auto-renewable subscriptions under Apple’s standard EULA.
---

When an app offers auto-renewable subscriptions and uses Apple’s standard Terms of Use, include the functional standard EULA URL in the App Store product description: `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`.

**Why:** A working in-app Terms page or a separate privacy-policy field does not satisfy this automated App Review check. Apple can reject the submission before human review if the standard EULA URL is absent from the product-page description.

**How to apply:** Keep the standard EULA link in every relevant App Store localization. A product-specific Terms link may be included alongside it, but does not replace Apple’s standard EULA URL unless a custom EULA is configured in App Store Connect.