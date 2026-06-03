---
name: Photo fingerprinting architecture
description: Two-layer photo matching system — dHash for exact copies, AI embeddings for filtered/re-uploaded versions.
---

## The rule
Photo matching uses two layers in sequence:
1. **dHash (photoHashService.ts)** — fast perceptual hash, catches exact/near-exact copies. Stored in `visual_fingerprints.style_embedding_json` as a JSON array of hex strings.
2. **AI embeddings (fingerprintService.ts)** — GPT-4o describes the image, `text-embedding-3-small` embeds the description, cosine similarity catches cropped/filtered/re-uploaded versions. Stored in `visual_fingerprints.color_palette_json` as `{ embeddings: [{url, vector}], generatedAt }`.

Layer 2 only runs if layer 1 similarity is < 0.85 (avoids redundant API calls when dHash already confirmed a match).

**Why:** dHash is cheap and fast but fails on any edit (crop, filter, color shift). AI embeddings describe composition and style rather than pixels, so they survive moderate edits. Running both in order keeps cost low.

**How to apply:**
- Don't put embeddings in `style_embedding_json` — that column holds the dHash string array.
- `color_palette_json` is the AI embedding store — no DB migration needed since it was previously unused.
- `buildUserPhotoEmbeddings` fires in the background (non-blocking, non-fatal) during Step 3 of the scan.
- `comparePhotoWithEmbeddings` fires per-candidate in Step 6, only when user embeddings exist and dHash score < 0.85.
- Match threshold for embeddings: 0.82 cosine similarity (descriptions are fuzzy, so set lower than you'd expect).
- Max 20 user photos embedded per scan; profile photos always prioritized first.
