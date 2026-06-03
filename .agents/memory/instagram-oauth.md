---
name: Instagram OAuth domain mismatch
description: The OAuth redirect URI must exactly match Meta's console; Replit dev domain changes on restart, causing "invalid request" errors.
---

# Instagram OAuth Domain Mismatch

The mobile app now fetches the redirect URI from the API server (`GET /api/oauth/redirect-uris`) before initiating OAuth. This ensures both sides agree on the exact URI.

**Why:** Replit dev domain (`*.janeway.replit.dev`) changes on restart. If EXPO_PUBLIC_DOMAIN is stale or differs from the REPLIT_DOMAINS/REPLIT_DEV_DOMAIN the server uses, Instagram rejects the OAuth request with "invalid request: request parameters are invalid".

**How to apply:** For stable production OAuth, the app must be deployed. The production domain (from REPLIT_DOMAINS) is stable. Instruct user to visit `/api/oauth/setup` to get current URIs for registering in Meta Developer Console.

**Files:** `artifacts/mobile/app/connect-account.tsx`, `artifacts/api-server/src/routes/oauth.ts`, `artifacts/mobile/lib/api.ts`
