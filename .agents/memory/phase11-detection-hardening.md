---
name: Phase 11 Detection Hardening
description: Relationship context classifier, tightened High severity gates, accountMeta storage — all implemented in Phase 11.
---

## What changed in Phase 11

### Relationship Context Classifier (webSearchService.ts)
New `PageRelationshipContext` type + `classifyPageRelationshipContext()` function:
- Detects **credit** (photo/video credit lines: "📸 @victim", "shot by @victim") → disqualify candidate
- Detects **collaboration** (collab/duet/feat: "feat. @victim", "collab with @victim") → cap at Low
- Detects **mention** (tagged/reposted: "my friend @victim", "reposted from @victim") → cap at Low
- Detects **fan** (combined with existing isFanAccountSignal) → cap at Low
- Applied in `searchByUsernameVariants` AND display-name normalization search

**Why:** Users complained about false detections from mentions, collaborations, fan pages, friends posting about them.

### Severity Gate Tightening (scanConfig.ts)
- `highSeverityGate.optionA.minProfileSimilarity`: 0.80 → **0.90** (near-exact pHash required)
- `highSeverityGate.optionB.minCombinedScore`: 70 → **75**
- `dualScoreGate.minIdentityMatchForHigh`: 50 → **58**
- `dualScoreGate.minImpersonationConfForHigh`: 50 → **58**
- `firstScan.minProfileImageSimilarity`: 0.40 → **0.50**
- `profilePhoto.mediumCapThreshold`: 0.25 → **0.30** (pure username/bio matches stay Low)

### Signal Penalties in webCandidateToImpersonator (scanOrchestrator.ts)
When `wc.relationshipContext` is "mention" or "fan":
- `profileImageSimilarity` capped at 0.28
- `mediaOverlapRatio` capped at 0.20
- `captionOverlapRatio` capped at 0.20

When "collaboration":
- All three capped at 0.25–0.32

When "credit": all signals zeroed (defense-in-depth; should be filtered before this point).

### Severity Cap in Scoring Loop (scanOrchestrator.ts)
After `scoredSeverity` computed, before cross-user escalation:
- `isNonImpersonatorContext` check on `candidate.relationshipContext`
- Non-impersonator contexts force severity to "low" and block cross-user escalation
- Adds `relationshipContextCap: capped at Low — relationship context "${ctx}" is not impersonation` to detectedSignals

### accountMeta Storage (scanOrchestrator.ts → threats.ts → api.ts)
`scoreBreakdownJson` now includes `{ ...breakdown, accountMeta: candidate.accountQuality }`.
`parseThreat` in threats.ts extracts `accountMeta` separately and exposes it in the API response.
`ThreatDetail` in api.ts has `accountMeta?: { followers, following?, totalPosts?, accountAgeDays?, engagementRate? } | null`.
Null for threats scanned before Phase 11 — no backfill.

**Why:** Mobile UI needed followers/posts/age to replace the quick-actions row with real impersonator account details.

## Mobile UI Changes (threat/[id].tsx)
- Visual Evidence section moved **above** "What to do right now"
- "Why Rook flagged this" (AI Analysis) now **collapsible**, default collapsed
- "Evidence Details" (detected signals) now **collapsible**, default collapsed
- "Score Breakdown" was already collapsible — unchanged
- Quick actions row (Copy/Open Profile/Alert Others) **replaced** with account stat chips (followers, posts, age) when `accountMeta` is present; falls back to Copy/Open Profile when null
- `formatFollowers()` and `formatAccountAge()` helpers added

## ImpersonatorCandidate type
Added `relationshipContext?: "impersonator" | "mention" | "collaboration" | "credit" | "fan" | "unknown"` field. Set by `webCandidateToImpersonator` from `wc.relationshipContext`. Undefined for API-discovered candidates (no web context).
