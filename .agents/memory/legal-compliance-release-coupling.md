---
name: Legal compliance release coupling
description: Why server-enforced Terms and age acknowledgments require a coordinated mobile rollout.
---

Require an explicit recovery path on every supported client before enabling a strict server-side Terms and age gate in production. A signed-out or interrupted social signup can leave a provider identity without acknowledgments; simply checking once at signup is insufficient.

**Why:** The API must deny normal access until acceptance is recorded, but an older mobile binary may not have the required recovery screen. Publishing only the new API would lock those users out. Store builds already uploaded do not include subsequent workspace edits.

**How to apply:** For each legal-version change, coordinate API rollout with a tested distribution build and confirm clean first-time, returning, interrupted social login, and reviewer-account paths. Do not mark review access or compliance complete based only on source/typechecks.