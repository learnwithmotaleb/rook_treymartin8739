---
name: App review production parity
description: Why signed mobile builds and live API/legal pages must be audited together.
---

Before claiming a review issue is resolved, compare the signed store build, the live production API, and the live privacy page against the reviewer response. A successful mobile upload and clean source checks do not prove that production is serving the same backend or policy version.

**Why:** A signed review build was uploaded while the published Privacy Policy still served older wording than the workspace API. Code-level fixes to OAuth/media handling could therefore be absent from the live server that the signed app calls.

**How to apply:** Quote the policy actually served publicly; verify production behavior and the exact reviewer credentials on the signed build. Treat App Store Connect metadata and native-device issues as unresolved until checked externally; do not use workspace source as evidence of console or production state.