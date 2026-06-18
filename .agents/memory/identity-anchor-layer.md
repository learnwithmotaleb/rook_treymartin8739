---
name: Identity anchor service
description: Cross-platform identity verification — tables, algorithm, B2B API, dual-auth middleware.
---

## Tables

- `user_identity_profiles` — unique on userId; stores canonicalHashClusterJson, overallConfidence (0-100), confidenceTier, verifiedPlatformCount, anchorHashCount, lastComputedAt
- `platform_verifications` — unique on (userId, platform); visualMatchScore, metadataMatchScore, hashCount, verificationMethod

## Algorithm (identityAnchorService.ts)

1. Load user_photo_hashes grouped by platform (via connected_accounts JOIN)
2. For each platform pair (A, B): count A-hashes with Hamming distance ≤12 to any B-hash → `anchorSet`
3. Confidence = `avgConsistency × 70 + min(20, (platforms-1)×8) + min(10, anchorCount)`
4. Single-platform cap: max 25 (LOW tier ceiling — can't prove cross-platform identity)
5. Per-platform visualMatchScore = % of that platform's hashes in anchorSet

## Confidence tiers

| Score | Tier |
|-------|------|
| 0-4 | UNVERIFIED |
| 5-29 | LOW |
| 30-59 | MEDIUM |
| 60-79 | HIGH |
| 80-100 | STRONG |

## Scan pipeline hook

`recomputeIdentityAnchor(userId).catch(() => {})` fires fire-and-forget in scanOrchestrator.ts
after `storeUserPhotoHashes` completes (line ~631). Every scan improves the anchor.

## Dual-auth middleware (requireApiKeyOrAuth.ts)

Checks Clerk session first, then Bearer `sid_live_xxx`. Sets `req.userId` from either path.
Used on all `/api/identity/*` routes. Does NOT rate-limit (unlike v1 apiKeyMiddleware).

## B2B endpoints

- `GET /api/identity/profile` — full profile with per-platform scores
- `GET /api/identity/badge` — lightweight tier summary + badge color/label
- `POST /api/identity/verify-account` — body: `{platform, username, photoUrls[]}`;
  downloads + hashes provided URLs, cross-matches vs anchor, returns `{confidence (0-1), tier, recommendation}`

## Recommendations from verify-account

| confidence | recommendation |
|-----------|----------------|
| ≥0.80 | approve |
| ≥0.60 | approve_with_review |
| ≥0.40 | manual_review |
| ≥0.20 | high_risk_review |
| <0.20 | reject |

**Why:** B2B customers can directly map recommendation → onboarding decision without parsing confidence numbers.

**How to apply:** Any time the identity endpoints are extended, keep `requireApiKeyOrAuth` (not `requireAuth`) so API-key callers continue to work. The `metadataMatchScore` is currently hardcoded to 50 — it's a placeholder for future bio/link cross-reference scoring.
