---
name: App review production parity
description: Why signed mobile builds and live API/legal pages must be audited together.
---

Before claiming a review issue is resolved, compare the signed store build, the live production API, and the live privacy page against the reviewer response. A successful mobile upload and clean source checks do not prove that production is serving the same backend or policy version.

**Why:** A signed review build was uploaded while the published Privacy Policy still served older wording than the workspace API. Code-level fixes to OAuth/media handling could therefore be absent from the live server that the signed app calls. Replit's web/API Publish step is separate from starting an iOS Expo Launch session; a healthy web deployment does not mean a new TestFlight build was initiated.

**How to apply:** Quote the policy actually served publicly; verify production behavior and the exact reviewer credentials on the signed build. Treat App Store Connect metadata and native-device issues as unresolved until checked externally; do not use workspace source as evidence of console or production state. For a new iOS build, the user must separately start the App Store Launch wizard in Publishing after publishing the web/API, preferably choosing the existing Expo project. If no Expo Launch session exists, do not say that a TestFlight build has started. Replit Support confirmed managed Launch chooses its build number independently of app.json and eas.json; see ios-build-number-drift.md for the user-confirmed app-version workaround.

Do not assume workspace administrative access also authorizes production fixture repairs.

**Why:** Production can reject the workspace's administrative credential even while public assets are reachable. A correct public image does not prove the persisted reviewer evidence references it.

**How to apply:** Check live evidence with read-only production queries. Use authorized repair endpoints only; if access is rejected, stop rather than weakening authentication or claiming the live records were updated.