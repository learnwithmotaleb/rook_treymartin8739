# Rook — Production Readiness Scorecard

**Date:** 2026-07-24  
**Compiled from:** Tasks #93–#98 (dead-code/API audit, OAuth hardening, DB & security, performance & E2E)  
**Target:** App Store submission readiness

---

## Subsystem Status

| Subsystem | Status | Notes |
|-----------|--------|-------|
| Auth | 🟢 Green | Clerk-managed, JIT provisioning, new-device verification handled |
| OAuth | 🟢 Green | HMAC state, one-time use, PKCE for X, per-IP rate limit, secrets redacted |
| Scan Pipeline | 🟡 Amber | Functional; no load tests; silent DB failure risk open (#100) |
| Billing | 🟢 Green | RevenueCat sync implemented; pro→premium normalization; tier enforced server-side |
| Notifications | 🟡 Amber | Scheduled notifications implemented; not E2E tested across clean install |
| Database | 🟡 Amber | FK indexes added; cascade FKs declared; end-to-end deletion not yet verified (#102) |
| Security | 🟢 Green | Helmet, CORS allowlist, 0 high vulns, log redaction, rate limiting |
| Performance | 🟡 Amber | Skeletons + dedup guard done; /me chatty (#103); no offline recovery banner (#105) |
| App Store Assets | 🟡 Amber | Icon/splash/privacy manifest exist; full asset pass still pending (open task). The next review build requires Meta approval for Facebook `user_photos`. |

**Legend:** 🟢 Green = no known blockers · 🟡 Amber = known issues, mitigated or tracked · 🔴 Red = blocks submission

---

## Critical (Blocks Submission)

_No critical blockers identified at this time._

All items that would block App Store submission have been resolved or downgraded based on audit findings. The remaining open items below are High/Medium severity.

---

## High (Must Fix Before Launch)

### H-1 — JSON body limit too permissive on non-avatar routes
**Source:** Task #98 audit / Task #101 (API hardening)  
**Finding:** `express.json({ limit: "20mb" })` is applied globally in `app.ts`. The 20 MB ceiling is appropriate for avatar upload endpoints but exposes all other JSON endpoints to intentionally oversized payloads that can stall the Node event loop.  
**Status:** Open — tracked as Task #101 (API hardening).  
**Fix outline:** Apply a tight 50 KB default limit globally; override to 20 MB only on `POST /api/users/avatar` and any other routes that legitimately accept large bodies.  
**Estimated timeline:** 1–2 hours.

### H-2 — /me endpoint makes 4+ DB queries per call
**Source:** Task #98 audit / Task #103  
**Finding:** Every screen load triggers a refresh that calls `GET /api/users/me`, which currently executes at least four sequential SQL queries (user row, subscription, connected accounts, usage quota). Under concurrent load this compounds into a significant tail-latency spike.  
**Status:** Open — tracked as Task #103 (/me caching).  
**Fix outline:** Add a 30-second server-side cache keyed by `userId`; invalidate on write mutations (avatar, subscription sync, account connect/disconnect).  
**Estimated timeline:** 2–3 hours.

### H-3 — No network-error recovery banner in the mobile app
**Source:** Task #98 / Task #105  
**Finding:** When `refreshData()` in `AppContext` exhausts retries after an API outage, the app shows stale data silently with no user-visible indication that the data may be outdated. The in-flight dedup guard was added in Task #98 but there is still no offline/error UI state surfaced to the user.  
**Status:** Open — tracked as Task #105 (network error recovery).  
**Fix outline:** Surface an amber banner ("Last synced X min ago — reconnecting…") from AppContext when `lastError` is set; clear on next successful refresh.  
**Estimated timeline:** 2–3 hours.

### H-4 — Cascade-delete correctness not verified end-to-end
**Source:** Task #97 audit / Task #102  
**Finding:** All FK references include `onDelete: "cascade"` and the Clerk user deletion call is wired into the account deletion flow. However, no automated check confirms that a full account delete leaves zero rows across all 15+ tables that reference `users.id`. One missed reference or missing cascade could leave orphaned data, which is both a privacy issue and an App Store guideline concern.  
**Status:** Open — tracked as Task #102 (cascade-delete verification).  
**Fix outline:** Write a test that creates a user, populates every downstream table, deletes the user, then asserts zero orphaned rows via a multi-table SQL query.  
**Estimated timeline:** 2–4 hours.

---

## Medium (Fix in First Patch)

### M-1 — Avatar stored as base64 data URL in the `users` table
**Source:** Memory / Task #104  
**Finding:** Profile photos are stored as base64-encoded 160×160 JPEG strings in the `avatarUrl` column (up to ~15 KB per row). This bloats every `/me` response and adds unnecessary read pressure on the users table.  
**Status:** Open — tracked as Task #104 (avatar object storage migration).  
**Fix outline:** Move avatar bytes to object storage; store only the public URL in `avatarUrl`.

### M-2 — Scan pipeline has no load tests; silent failure under DB pressure
**Source:** Task #97–#98 audit / Task #100  
**Finding:** The scan orchestrator (`scanOrchestrator.ts`) executes a multi-step pipeline (Vision, CSE, pHash, identity anchor, threat persistence) with no circuit-breaker or back-pressure mechanism. Under heavy index load the DB driver can time out silently, leaving a scan job stuck in `queued` status with no error surfaced to the user.  
**Status:** Open — tracked as Task #100 (prevent silent scan failures).  
**Fix outline:** Add explicit timeout wrapping per pipeline step; transition stuck jobs to `failed` with a readable error message; write a load test to validate behavior at 50 concurrent scans.

### M-3 — No E2E tests for core identity-protection flows
**Source:** Task #98 / open task  
**Finding:** There are no automated Playwright or Detox tests that exercise the sign-in → scan → view-threat → resolve-threat flow. Regressions are only caught manually.  
**Status:** Open — tracked as separate task (add live E2E tests).

### M-4 — Facebook photo permission awaiting live approval

**Source:** Task #99 audit of `artifacts/mobile/app/connect-account.tsx`  
**Finding:** The Facebook OAuth flow now requests `public_profile,user_photos`, and the adapter retrieves the user's own uploaded photos for consent-gated reference selection. Production access still depends on Meta granting Advanced Access to the separate Facebook developer app.
**Status:** Implementation complete; pending a signed TestFlight build, live OAuth verification, and Meta App Review approval.
**Fix outline:** Record the live permission flow with a role-authorized Facebook test account, submit `user_photos` for Advanced Access, and ship only the exact tested build.

---

### M-5 — X OAuth PKCE state token not in the shared one-time-use set
**Source:** Task #96 audit  
**Finding:** PKCE state tokens for X/Twitter are parsed by `parseXPkceState`, which validates the HMAC signature and 15-minute window but does not call `consumeStateToken`. An attacker who intercepts the callback URL could replay it within the validity window.  
**Status:** Should be fixed before launch. Low exploitability (requires network interception), but easy to close.  
**Fix outline:** Call `consumeStateToken(state)` inside `parseXPkceState` before returning the parsed payload.  
**Estimated timeline:** 30 minutes.

---

## Low (Nice to Have)

### L-1 — Share threat report feature not implemented
The product spec includes a one-tap share flow for threat reports. Not yet built — tracked as a separate task.

### L-2 — App icon/splash final design pass pending
Current icon and splash assets are placeholders. A dedicated task is open to produce final App Store–ready assets (1024×1024 App Store icon, 2048×2048 splash).

### L-3 — GPT-4o still in use; gpt-5 available
The AI analysis service uses `gpt-4o`. A task to upgrade is open. Upgrade may improve threat analysis quality but is not a submission blocker.

### L-4 — `/v1/docs` Swagger UI is auth-gated but still shipped
The OpenAPI documentation endpoint (`/v1/docs`) requires authentication as of Task #97. Consider removing it entirely from production builds or restricting to admin API keys to reduce attack surface.

---

## Security Risks

| Risk | Status | Details |
|------|--------|---------|
| OAuth state replay | 🟢 Mitigated | HMAC-signed tokens, 15-min window, one-time use (X PKCE path excepted — see M-4) |
| Client secret in logs | 🟢 Mitigated | `metaFetch` redacts secrets; pino serializer redacts `authorization` headers |
| Dependency CVEs | 🟢 Mitigated | 0 high/critical vulns; `ws` and `undici` overrides in `pnpm-workspace.yaml` |
| Oversized payloads | 🟡 Partial | 20 MB global limit is too permissive — see H-1 |
| OAuth rate abuse | 🟢 Mitigated | Per-IP 20 req/min sliding window on all OAuth callbacks |
| CORS leak | 🟢 Mitigated | Allowlist restricts to `getrook.app`, `tryrook.app`, and `*.replit.dev` |
| Security headers | 🟢 Mitigated | Helmet applied before all routes |
| Session hijack | 🟢 Mitigated | `SESSION_SECRET` validated at startup; server throws if missing |
| Data retention after delete | 🟡 Partial | Cascades declared but not verified end-to-end — see H-4 |
| Log PII | 🟢 Mitigated | pino redaction paths cover `authorization`, `access_token`, `client_secret` |

---

## Performance Risks

| Risk | Status | Details |
|------|--------|---------|
| AppContext double-refresh | 🟢 Mitigated | `isRefreshingRef` dedup guard added in Task #98 |
| Rapid tab-switch re-fetches | 🟢 Mitigated | 30-second cooldown on Alerts focus-refresh (Task #98) |
| Blank loading states | 🟢 Mitigated | Skeleton loaders on Scan and Profile tabs (Task #98) |
| /me DB fan-out | 🟡 Open | 4+ queries per call; no cache — Task #103 |
| Avatar payload size | 🟡 Open | Base64 in DB column bloats every /me response — Task #104 |
| Offline / stale data | 🟡 Open | No retry banner visible to user — Task #105 |
| Scan DB timeout | 🟡 Open | No circuit-breaker; stuck jobs possible under load — Task #100 |
| Large payload DoS | 🟡 Open | 20 MB JSON limit on all routes — Task #101 |

---

## Recommended Fix Order

Priority order for sprint before launch:

1. **M-4** — X PKCE state one-time-use guard (30 min, easy win)
2. **H-1** — Tighten JSON body limit (1–2 h)
3. **H-3** — Network error recovery banner (2–3 h)
4. **H-2** — Cache /me endpoint (2–3 h)
5. **H-4** — Cascade-delete verification test (2–4 h)
6. **M-1** — Avatar object storage migration (4–6 h, requires migration)
7. **M-2** — Scan load tests + silent failure fix (4–8 h)
8. **M-3** — E2E tests (ongoing)
9. **L-2** — Final icon/splash assets (design dependency)

---

## Completed Findings (Resolved in Tasks #93–#98)

| Item | Resolved in | Summary |
|------|------------|---------|
| HMAC-signed OAuth state tokens | Task #96 | 15-min window, one-time use, prevents Clerk JWT expiry problem |
| Per-IP OAuth rate limiting | Task #96 | 20 req/min sliding window on all callback routes |
| Facebook token exchange via POST | Task #96 | client_secret no longer appears in URL / logs |
| Facebook/Instagram long-lived token upgrade | Task #96 | Tokens upgraded to 60-day long-lived on connect |
| X PKCE code_verifier embedded in signed state | Task #96 | Verifier stored server-side, not client-side |
| metaFetch log redaction | Task #96 | client_secret, access_token, fb_exchange_token redacted |
| New-device Clerk verification handled | Task #96 | `needs_second_factor` flow surfaced to user in auth UI |
| Per-account onboarding flag | Task #95 | Keyed by auth user ID, not global AsyncStorage key |
| Account deletion also deletes Clerk user | Task #96 | Clerk deletion + DB cascade wired together |
| FK indexes on all reference columns | Task #97 | 15 indexes added in migration |
| Helmet security headers | Task #97 | Applied before all routes |
| Pino log redaction expanded | Task #97 | `authorization`, `access_token`, `client_secret` paths |
| 0 high/critical dependency CVEs | Task #97 | Was 14; fixed via `ws` and `undici` version overrides |
| `/v1/docs` auth-gated | Task #97 | Swagger UI now requires Clerk auth |
| refreshData in-flight dedup guard | Task #98 | `isRefreshingRef` prevents parallel overlapping fetches |
| Alerts 30s focus-refresh cooldown | Task #98 | Prevents hammering /me on every tab-switch |
| Scan tab skeleton loader | Task #98 | Replaces blank screen during initial data load |
| Profile tab skeleton loader | Task #98 | Replaces blank screen during initial data load |
