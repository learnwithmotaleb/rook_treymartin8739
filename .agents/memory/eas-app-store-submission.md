---
name: EAS App Store submission
description: Non-interactive TestFlight submission requirements and local-key limitations.
---

## Rule

Configure an App Store Connect API key in EAS remote credentials before relying on non-interactive `eas submit`.

**Why:** A valid signed EAS build and a configured App Store numeric ID are not sufficient. Non-interactive submission stops before upload when EAS has no remote ASC key. Supplying a local key through a temporary project also requires the complete Expo project, including every referenced config plugin.

**How to apply:** Set up the ASC API key in EAS credentials once, keep only the public `ascAppId` in `eas.json`, and then submit an existing finished build by build ID. Never commit the `.p8` file or private-key fields.