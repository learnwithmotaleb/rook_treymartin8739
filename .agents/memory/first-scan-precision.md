---
name: First-scan precision mode
description: How scan #1 uses stricter thresholds and signal filtering to avoid false positives before the user's photo fingerprint is established.
---

# First-scan precision mode

## The rule
`isFirstScan = user.scanCount === 0`. When true, the entire scan pipeline tightens.

**Why:** New users have no photo-feedback history so the default Hamming threshold (10) and username/bio scoring can surface false positives. Scan #1 acts as a high-precision pass; subsequent scans progressively relax.

## How to apply

### Hamming threshold — `phashIntelligenceService.ts > computeUserThreshold()`
`isFirstScan` is the second param (default false). Returns `Math.min(computed, 6)` on first scan.

### Profile-photo hard filter — `impersonatorDetectionService.ts > calculateThreatScore()`
`isFirstScan` is the second param. If both `profileImageSimilarity < 0.40` AND `mediaOverlapRatio < 0.40`, the returned `total` is forced to 0 — the candidate is excluded in the orchestrator loop before insertion.

### Signal tagging — `scanOrchestrator.ts` (newThreats building loop)
- Candidates with `total === 0` on isFirstScan are skipped (`continue`).
- "Known threat actor:…" signal → push `"sharedThreatActor"` machine-readable marker.
- First-scan score ≥ 75 → push `"firstScanHighConfidence"`.
- Low severity on first scan → `hiddenUntilScan = true` (stored, hidden from feed).

### scanCount increment — `scanOrchestrator.ts` (after Step 8)
Fire-and-forget `db.update(usersTable).set({ scanCount: user.scanCount + 1 })`.

### Threats API — `routes/threats.ts`
GET /api/threats always includes `eq(threatsTable.hiddenUntilScan, false)` condition.
`parseThreatSummary` derives `highConfidence: boolean` from signals array presence.

### Mobile badge — `ThreatCard.tsx`
Renders a small green "Verified" shield-check badge when `threat.highConfidence === true`.
`AppContext Threat` interface has `highConfidence?: boolean`.
