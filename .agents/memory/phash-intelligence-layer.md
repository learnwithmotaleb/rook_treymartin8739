---
name: pHash intelligence layer
description: Cross-user threat learning — how hashes accumulate, fast-path works, and threshold tuning flows.
---

## Architecture

Three tables drive the system:
1. `user_photo_hashes` — user's own photo hashes, unique on (userId, platformMediaId). Computed once; reused across all scans. No re-download.
2. `phash_feedback` — one row per resolve action. outcome values: `true_positive | false_positive | approved_contact | resolved_manually`.
3. `threats.impersonator_d_hash` — impersonator's dHash stored at threat-creation time so `linkThreatToActor` can enrich the actor's cluster immediately.
4. `threat_actors.pHashClusterJson` — JSON string[] of known-bad dHashes for that actor. Grows with every confirmed threat.

## Services

- `userPhotoHashService.ts` — `storeUserPhotoHashes` / `loadUserDHashes` / `getHashCount`
- `phashIntelligenceService.ts` — `enrichActorWithHash`, `findActorByHash` (fast path), `recordPhashFeedback`, `computeUserThreshold`, `getIntelligenceStats`
- `photoHashService.ts` now exports `compareHashToHashes(precomputedHash, storedHashes)` — avoids double-download.

## Scan pipeline integration (scanOrchestrator.ts)

Step order for visual comparison:
1. `computeDHash(candidateUrl)` — download candidate image ONCE
2. `findActorByHash(dHash, userHammingThreshold)` — zero-cost fast path; if matched, boost signals and skip AI
3. `compareHashToHashes(dHash, userHashes, userMatchThreshold)` — user photo comparison (no re-download)
4. `comparePhotoWithEmbeddings(url, userEmbeddings)` — AI embedding; only runs if similarity < 0.85

On threat creation: `impersonatorDHash` stored in the threats row, then passed to `linkThreatToActor` which calls `enrichActorWithHash` fire-and-forget.

## Feedback & threshold tuning

- `recordPhashFeedback` called from `PATCH /threats/:id/resolve` after every resolve
- Mapping: `reported_to_platform` → `true_positive`, `false_positive` → `false_positive`, `approved` → `approved_contact`, else `resolved_manually`
- `computeUserThreshold(userId)`: adjustment = (falsePositives × 2) − truePositives, clamped ±8 from DEFAULT (10). Range: 2–18.
- `userMatchThreshold = max(0, 1 - userHammingThreshold / 64)`

## API endpoints (all behind requireAuth)

- `GET /api/intelligence/stats` — platform-wide aggregate (actor count, hash count, victim total, top platforms)
- `GET /api/intelligence/actors?limit&offset&min_victims&platform&min_cluster_size` — paginated actor DB
- `GET /api/intelligence/actors/:id` — single actor detail with activeThreats count

## Why: network effect

First user to encounter an impersonator pays the GPT-4o cost and seeds the cluster.
Every subsequent user gets instant cluster-match detection at zero AI cost.
Detection accuracy compounds with user count; no photos ever stored.

**How to apply:** Any time you touch the scan pipeline's Step 6 or the threats resolve path, check that candidateDHash flows correctly through candidateDHashMap and into the returning clause.
