---
name: Scan simulation guard
description: How the scan pipeline determines real vs demo mode and suppresses fake threats for real users.
---

## Rule
`isDemoUser = !user.clerkId` in `runScanPipeline` (scanOrchestrator.ts).
Simulation candidates and breach simulation are both gated on `isDemoUser`.

**Why:** Facebook's Graph API can't do public username search, and `user_photos` permission requires App Review — so real Facebook scans produce 0 API candidates. Without this guard, `allCandidates.length === 0 && connectedAccounts.length > 0` caused the simulation to fire for real users, generating fake threats on platforms they don't have connected.

**How to apply:**
- Any future "fallback" logic (breach simulation, simulated dark web hits, etc.) MUST be wrapped in `if (isDemoUser)`.
- Real users should NEVER see fabricated threats; an empty result is correct.
- Demo user (clerkId IS NULL): simulation runs normally for the onboarding/demo experience.

## Breach check
`hibpConfigured = !!process.env["HIBP_API_KEY"]`
`runBreachCheck = hibpConfigured || isDemoUser`
— real users skip breach check entirely if no HIBP key is set.
