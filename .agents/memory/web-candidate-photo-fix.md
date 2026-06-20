---
name: Web candidate photo fix
description: webCandidateToImpersonator was missing suspiciousProfileImageUrl causing pHash to be skipped for all web/probe candidates; also evidence items lacked yourPhotoUrl causing blank photos on threat detail.
---

# Web Candidate Photo Fix

## Rule
`webCandidateToImpersonator()` in `scanOrchestrator.ts` must always populate two fields:

1. **`suspiciousProfileImageUrl: wc.imageUrl ?? undefined`** — in the return object. Without this, Step 6 (pHash comparison) filters out the candidate immediately (`candidatesWithImages = allCandidates.filter(c => c.suspiciousProfileImageUrl)`), meaning pHash is never run for ANY web or probe-sourced candidate.

2. **`yourPhotoUrl: bestIngested?.profileImageUrl ?? undefined`** — on every `evidence.push()` call (both the `isImageMatch` branch and the `username_search` branch, plus the `suspectedStolenCount > 0` branch). Without this, the threat detail screen shows blank "Your Photo" placeholders.

## Why
These were silent omissions — no error thrown, no log — so the pipeline appeared to work but pHash matching was completely bypassed for web candidates, and evidence photos were always empty.

## How to apply
When adding new candidate sources (e.g. new platform probe), always check the returned object includes `suspiciousProfileImageUrl` and that all evidence items include `yourPhotoUrl` (user's own photo) and `stolenPhotoUrl` (the detected candidate's photo URL).
