---
name: Dual-score detection engine
description: Architecture of the two-dimensional impersonator scoring system and its classification gates.
---

## The model

**Combined Threat Score** (0-100, stored as threatScore):
  profilePhoto(25) + mediaOverlap(35) + contentReuse(15) + bioSimilarity(10) + usernameSimilarity(10) + behavioral(5)

**Identity Match Score** (0-100, stored as identityMatchScore):
  (profileSimilarity + bioSimilarity + usernameSimilarity) / 45 × 100

**Impersonation Confidence Score** (0-100, stored as impersonationConfidenceScore):
  (mediaSimilarity + contentReuse + behavioral) / 55 × 100

All weights and thresholds live in `scanConfig.ts`. Do not hardcode them.

## High severity gates (classifyThreatSeverity)

Three gates must all pass for High — any failure → Medium:
1. Profile photo ≥50% similarity
2. matchedMediaCount ≥2 (profile + at least 1 additional image)
3. Both sub-scores ≥50/100

Profile photo absolute floor (<20% → Low, <35% → max Medium) applies regardless of combined score.

## Actor corpus bypass

**Why:** Collective intelligence (3+ confirmed victims) is more trustworthy than any single-scan signal.
`hasActorMatch = true` bypasses `classifyThreatSeverity` entirely — severity forced to High, score floor 75.
The temporal, cross-user escalation, and platform-weight modifiers still apply on top.

## Platform priority

Scan order and score multipliers both defined in `scanConfig.platformPriority` and `scanConfig.platformWeightMultiplier`.
Instagram 1.05×, Facebook 1.04×, X 1.02×, others 1.00×.
connectedAccounts and allCandidates are sorted by priority before the scoring loop.
