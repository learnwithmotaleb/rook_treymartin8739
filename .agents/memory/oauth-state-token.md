---
name: OAuth state token expiry
description: Clerk JWTs used as OAuth state expire in ~60s, causing the callback to fall through to demo user. Use server-issued HMAC-signed tokens instead.
---

**Rule:** Never pass a Clerk JWT as the OAuth `state` parameter. Always call `POST /api/oauth/state` (authenticated) to get a server-issued HMAC-signed token with a 15-minute window.

**Why:** Clerk short-lived JWTs expire in ~60 seconds. A user who takes longer than that on the Facebook/Instagram consent screen (entering credentials, 2FA, etc.) will have their OAuth callback fall through to the demo user because `verifyToken` throws. The account then saves to the demo user, the real user's account list never changes, and the app's 304 ETag cache perpetuates the stale state indefinitely.

**How to apply:**
- Server: `POST /api/oauth/state` (protected by `requireAuth`) returns `{ state }` — an HMAC-signed token containing the real DB `userId` and issue timestamp.
- Server callback: `parseOAuthState(state)` verifies HMAC and checks <15min age. Falls back to Clerk JWT verification for backward compat, then demo.
- Mobile: call `getOAuthState()` from `lib/api.ts` before `WebBrowser.openAuthSessionAsync`, use returned token as the `state` URL param.
- Also use `getAccounts({ bustCache: true })` in the post-OAuth poll to add `?_t=timestamp` and bypass the iOS URLCache (which otherwise serves 304 for unchanged ETags).
