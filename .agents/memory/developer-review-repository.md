---
name: Developer review repository
description: Why external developer review uses a separate sanitized repository and how to preserve the separation.
---

ROOK remains the authoritative source repository. ROOK-developer-review is a separate private, sanitized source snapshot, not a fork that inherits the original history.

**Why:** The user requested a clean developer-review copy and both repositories up to date with current application source. The original repository contains internal review correspondence and historical uploads unnecessary for code review.

**How to apply:** When asked to refresh the review copy, preserve application source, manifests, lockfiles, and required bundled assets byte-for-byte. Exclude agent memory, local environment configuration, private historical uploads, and internal review correspondence. Do not merge original Git history into the review repository. Review-copy credentials must be provisioned separately for isolated development, never copied from production.

Updating either source repository does not publish the backend or create a signed native build.

**Why:** A source snapshot cannot establish production API parity or the behavior of the App Store-attached binary.

**How to apply:** Describe source synchronization separately from publishing and native-device verification; do not call a developer handoff proof of release readiness.