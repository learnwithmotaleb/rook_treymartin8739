---
name: Platform probe strategies
description: How Instagram, TikTok, X direct probes work (or don't) from data-center IPs — and the CSE 403 root cause.
---

## TikTok oEmbed probe (Strategy 1e) — WORKS
- Endpoint: `GET https://www.tiktok.com/oembed?url=https://www.tiktok.com/@{username}`
- 200 + JSON (`author_name`, `author_url`) = account exists
- 400 + `{"code":400}` = account does not exist
- Reliable from Replit DC IPs; no auth required
- Concurrency 5, 400ms batch delay to avoid rate limits
- Found 6 real impersonators for @sophieraiin in first test run

## Instagram web profile JSON probe (Strategy 1d) — PARTIAL
- Endpoint: `GET https://www.instagram.com/api/v1/users/web_profile_info/?username={username}`
- Headers: `User-Agent: iPhone UA` + `X-IG-App-ID: 936619743392459`
- Works for isolated single checks (confirmed returns `data.user` for real accounts)
- Returns 429 from DC IPs on bulk variant scanning (7+ rapid requests blocked)
- Gracefully skips 429 responses — scan won't crash, just won't find Instagram accounts via this path
- Instagram coverage requires CSE (when GCP API enabled) or residential proxies

## X direct HTML probe (Strategy 1a-probe / fallback) — WORKS
- Only activates when `cseEnabled=false` (env var absent) OR via the cseFailing fallback at line ~1650
- Checks SSR-rendered `<title>` — real profiles include the @handle; 404/generic don't
- Extended from 30 → 100 variants

## Google CSE 403 root cause
- Error: `"This project does not have the access to Custom Search JSON API."`
- Cause: The GCP project has Vision API enabled but NOT Custom Search JSON API — separate toggle
- The `GOOGLE_SEARCH_API_KEY` works for Vision (different API) but fails for CSE
- Fix: GCP Console → APIs & Services → Library → search "Custom Search JSON API" → Enable
- `cseFailing` flag is set on first 403; X fallback probe auto-activates; logged at WARN level
- User's key prefix: AIzaSy...hxdw; CX prefix: f36b25ef88...

## Strategy numbering in webSearchService.ts
- 1a: CSE username variant search (OR direct X probe if cseEnabled=false)
- 1b: Display name + handle CSE search
- 1c: X API v2 variant lookup (TWITTER_CLIENT_ID/SECRET = PKCE, not app-only — fails gracefully)
- 1d: Instagram web profile JSON probe (always runs, skips on 429)
- 1e: TikTok oEmbed probe (always runs, reliable from DC IPs)
- 2: Cloud Vision reverse image search
- 3: Caption text CSE search
