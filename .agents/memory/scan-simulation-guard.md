---
name: Scan simulation guard
description: The scan orchestrator generates simulated/fake threat candidates when no real API candidates are found — but this must be gated on the user having connected accounts.
---

**Rule:** In `scanOrchestrator.ts`, the simulation fallback must check `connectedAccounts.length > 0` in addition to `allCandidates.length === 0`.

**Why:** Without the account guard, every scan run by a real user with 0 connected accounts produces 2 fabricated threats (e.g. "Impersonator on Instagram", "Stolen Photos Detected on Tiktok"). These look real, appear in the DB, and break the demo data vs real data boundary.

**How to apply:** The guard is at the "Simulation for accounts with no real candidates" comment block in `scanOrchestrator.ts`. Keep it as `allCandidates.length === 0 && connectedAccounts.length > 0`.
