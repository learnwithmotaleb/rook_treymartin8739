---
name: iOS build-number drift
description: Managed Launch controls build numbers; support recommends a new app version when its counter trails Apple's accepted build.
---

Replit's managed Expo Launch chooses its own iOS build number and does not read the build-number/version-source settings in app.json or eas.json, as confirmed by Replit Support. A signed build can fail upload when this counter trails Apple's accepted build for the same app version. An unchanged TestFlight listing does not prove Launch was never run; check its failure log first.

**Why:** Support confirmed that managed Launch kept assigning lower build numbers despite source being changed to local versioning with a higher number. The accepted build and failed runs were under the same Expo account/project and targeted the same Apple app. Support advised using a new app version because Apple's iOS build-number ordering requirement applies within that version, rather than repeatedly editing source build-number settings or changing app identities.

**How to apply:** For this failure, follow support's new-app-version workaround without changing the bundle ID or other app settings. Match the version prepared in App Store Connect, publish the web app, then start managed App Store publishing once. Confirm the actual app version and successful upload in the new Launch record before declaring the workaround verified. The workaround is support-recommended, not yet verified by a successful upload. If it fails, provide support the new workflow link and attempt time. Do not recommend repeated failed uploads merely to increment the counter one at a time, or claim a project-side build-number edit fixes managed Launch.