---
name: Twitter/X credentials type
description: TWITTER_CLIENT_ID/SECRET are OAuth 2.0 PKCE app credentials — NOT app-only bearer token credentials
---

# Twitter/X credentials type

## Rule
`TWITTER_CLIENT_ID` + `TWITTER_CLIENT_SECRET` are **OAuth 2.0 user-context credentials** (PKCE flow), NOT the v1.1 Consumer Key + Consumer Secret needed for app-only bearer token auth.

## Why
Attempting `POST /oauth2/token grant_type=client_credentials` returns error code 99 "Unable to verify your credentials" with these credentials. This means the X API strategy in webSearchService.ts will always fail its bearer token fetch and set `_xBearerTokenFailing = true`, gracefully disabling itself.

## How to apply
- If implementing X API server-to-server calls: need Consumer Key + Consumer Secret from the Twitter Developer Portal "Keys and tokens" tab — these are different from the OAuth 2.0 Client ID/Secret
- The `externalApi__x` Replit proxy DOES work (code_execution only) — uses managed credentials
- Workaround: extend direct HTTP probe (already works for X) + expand mutation engine variants
