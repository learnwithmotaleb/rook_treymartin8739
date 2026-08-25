---
name: Expo Launch lockfile consistency
description: Frozen pnpm install requirement when Expo Launch detects the mobile app inside a workspace.
---

# Expo Launch Lockfile Consistency

Keep the mobile manifest’s Expo, React, and React Native declarations aligned with the workspace catalog and the root `pnpm-lock.yaml`.

**Why:** Expo Launch detects the full pnpm workspace and runs `pnpm install --frozen-lockfile` at its root. A duplicate direct dependency can disagree with the catalog-based lockfile importer and abort the build before native setup starts.

**How to apply:** Declare those build-time packages once in the mobile manifest’s established dependency section, use `catalog:` where the workspace convention does, and run a root frozen install before submitting an iOS build.