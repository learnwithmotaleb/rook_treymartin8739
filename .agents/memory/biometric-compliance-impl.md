---
name: Biometric Compliance Implementation
description: BIPA / GDPR Art. 9 / Texas CUBI compliance engineering — what was built and the non-obvious constraints.
---

## What was implemented

### Legal documents (all three locations)
- `artifacts/api-server/src/routes/legal.ts` — LAST_UPDATED "August 10, 2026", version "2026-08-10-v2"; full Section 2 "Biometric and Image-Derived Data" with BIPA § 15(a)/(b) written notice, Texas CUBI, GDPR Art. 9 explicit consent basis, SCC language for EU→US transfers, US state rights section (BIPA, CUBI, CCPA/CPRA, VA/CO/CT), no-affiliation disclaimer, age minimum 17+, deletion timing unified to "within 30 days"
- `artifacts/landing/src/pages/privacy.tsx` — mirrors legal.ts exactly, React/Tailwind format
- `artifacts/landing/src/pages/terms.tsx` — Section 3 "Written Release" with BIPA § 15(b) required language, revocable license, withdrawal path, no-sale clause

### DB schema (applied via SQL + Drizzle schema)
- `photo_processing_consents` table: id, userId (FK cascade), consentedAt, consentVersion, withdrawnAt (null=active), ipCountry, createdAt
- `users.age_confirmed_at` (TIMESTAMPTZ) — records user's 17+ declaration
- `users.minimum_age_version` (TEXT) — version of age prompt accepted

### API endpoints added to `artifacts/api-server/src/routes/users.ts`
- `GET /me/photo-consent` — returns { hasConsent, consentedAt, consentVersion }
- `POST /me/photo-consent` — grants consent (re-consent: withdraws old first)
- `DELETE /me/photo-consent` — withdraws consent + immediately deletes all photo-derived data
- `DELETE /me/photo-data` — deletes photo data without withdrawing consent
- `GET /me/export` — GDPR Art. 20 portability export (JSON download)
- `POST /me/age-confirm` — records 17+ age declaration

### Scan orchestrator gate (`scanOrchestrator.ts`)
- Checks `photo_processing_consents` for active consent AFTER user fetch and BEFORE photo hash inputs are built
- `hasPhotoConsent = false` → skips ALL of: storeUserPhotoHashes, buildUserPhotoEmbeddings, Google Vision API calls
- Demo users (no clerkId) always pass the gate
- `allUserHashes` declared outside the gate block as `[]` so downstream code still compiles

### Mobile API (`artifacts/mobile/lib/api.ts`)
- `CURRENT_TERMS_VERSION` bumped to "2026-08-10-v2"
- New exports: `recordAgeConfirmation()`, `getPhotoConsent()`, `recordPhotoConsent()`, `withdrawPhotoConsent()`, `deletePhotoData()`, `downloadMyData()`

### Mobile components
- `artifacts/mobile/components/PhotoConsentModal.tsx` — bottom sheet explaining dHash + AI vectors + Google Vision + OpenAI + retention + withdrawal path; "I Understand & Agree" calls `recordPhotoConsent()`
- `artifacts/mobile/components/TermsUpdateModal.tsx` — shown on startup when stored termsVersion < CURRENT_TERMS_VERSION; Review → Accept flow; "delete account" escape hatch
- `artifacts/mobile/app/privacy-settings.tsx` — Privacy & Data screen: data export, photo consent status badge, withdraw consent, delete photo data only, retention summary

### Mobile auth (`artifacts/mobile/app/auth.tsx`)
- Added `AgeCheckbox` component below `TermsCheckbox` at registration
- `handleSubmit` gates on both `termsAccepted && ageConfirmed`
- After verify: calls `recordAgeConfirmation()` fire-and-forget alongside existing `recordTermsAcceptance()`
- SSO handlers (Google + Apple): both now call `recordTermsAcceptance()` + `recordAgeConfirmation()` after `setActive()`

### Mobile profile (`artifacts/mobile/app/(tabs)/profile.tsx`)
- Added "Privacy & Data" settings row above "Legal & Privacy" → navigates to `/privacy-settings`

### App layout (`artifacts/mobile/app/_layout.tsx`)
- Added `privacy-settings` to the Stack navigator

### Tabs layout (`artifacts/mobile/app/(tabs)/_layout.tsx`)
- Imports `TermsUpdateModal` and `CURRENT_TERMS_VERSION`
- On mount after sign-in: fetches `getMe()` and checks `profile.termsVersion !== CURRENT_TERMS_VERSION`; shows modal if stale
- `TermsUpdateModal` mounted alongside `CancellationSurveyModal`

## Non-obvious constraints

**Consent checks must guard writes, not only scan startup.**

**Why:** A user can withdraw consent while a long scan or background embedding task is still running. A startup-only check allows that work to recreate hashes, embeddings, media URLs, identity anchors, or alert evidence after deletion returns.

**How to apply:** Require the current consent version at scan entry and immediately before photo-derived persistence. Re-check after long image operations and remove their output if consent changed. New photo-processing jobs must follow the same rule.

**Why `lib/db/dist` must be rebuilt after schema changes:** The api-server uses TypeScript project references (`tsconfig.json` references `../../lib/db`). The type checker reads compiled `.d.ts` files from `lib/db/dist`, not source. After any schema change, run `cd lib/db && pnpm tsc --build` or zero TS errors will appear misleadingly.

**Why esbuild builds work despite tsc errors:** The API server build uses `esbuild` (via `build.mjs`), not `tsc`. So the server bundles and runs even if `tsc --noEmit` shows errors. Fix tsc errors for code quality but don't rely on them to confirm runtime behavior.

**Why photo hash inputs are inside the gate block:** The orchestrator originally referenced a local `photoHashInputs` variable for both `storeUserPhotoHashes` and the embedding URL list. After gating, the embedding URL list must be derived from `ingestedAccounts` directly (not from `photoHashInputs`) to avoid a reference error.

**BIPA written notice requirements (for future policy changes):**
1. Purpose of collection (must be specific — "identity impersonation detection")
2. Length of term (must state max retention — "active account + 30 days after deletion, never beyond 3 years")
3. Must state no sale/profit from biometric data
4. Must state the standard of care applied to the data
5. Must obtain written release BEFORE collection (the modal + terms checkbox constitutes this)

**Consent withdrawal vs. data deletion distinction:**
- `DELETE /me/photo-consent` = withdraw consent + delete all photo data (GDPR Art. 7(3) + BIPA)
- `DELETE /me/photo-data` = delete current data but keep consent (user wants clean slate before next scan)
These are separate endpoints with separate mobile UI affordances.
