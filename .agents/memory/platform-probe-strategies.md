---
name: Platform probe strategies
description: How Instagram, TikTok, X direct probes work (or don't) from data-center IPs, the CSE 403 root cause, and false-positive/fan-account filters.
---

## Text search backend (priority order)
1. **Serper.dev** — SERPER_API_KEY required; zero GCP setup; working ✓
2. **Google CSE** — GOOGLE_CSE_API_KEY + GOOGLE_SEARCH_CX; still 403 pending GCP fix; kept as fallback

## TikTok oEmbed probe (Strategy 1e) — WORKS
- Endpoint: `GET https://www.tiktok.com/oembed?url=https://www.tiktok.com/@{username}`
- 200 + JSON (`author_name`, `author_url`) = account exists; 400 = does not exist
- Reliable from Replit DC IPs; no auth required; concurrency 5, 400ms batch delay

## Instagram web profile JSON probe (Strategy 1d) — PARTIAL
- Endpoint: `GET https://www.instagram.com/api/v1/users/web_profile_info/?username={username}`
- Works for isolated checks; 429s on bulk variant scanning from DC IPs — gracefully skipped

## X direct HTML probe (fallback) — WORKS
- Only activates when cseEnabled=false OR cseFailing=true
- Checks SSR `<title>` for @handle presence; covers 100 variants

## Google CSE 403 root cause
- Error: `"This project does not have the access to Custom Search JSON API."`
- Fix: GCP Console → APIs & Services → Library → "Custom Search JSON API" → Enable on the project owning GOOGLE_CSE_API_KEY
- Different error messages: "blocked" = key API restriction; "no access" = project-level not enabled

## Fan account filtering (isFanAccountSignal)
Applied in Strategy 1a, 1b, and 1e before pushing any candidate.
- **Username tokens**: `fan`, `fans`, `fanpage`, `fc`, `stan`, `stans`, `tribute`, `supporters`, `unofficial`, etc.
- **Snippet phrases**: "fan account", "fan page", "not affiliated", "not the real", "parody", "unofficial fan", etc.
- Self-declared fan accounts are suppressed permanently, NOT flagged as threats.

**Why:** Fan accounts explicitly declare they are not the real person — they are supporters, not impostors. Treating them as threats creates noise and erodes trust in the scan results.

## Display-name search false-positive guard (Strategy 1b)
Candidates with `similarity < 0.50` are skipped (similarity 0.40 = zero username overlap).

**Why:** Serper returns TikTok/Instagram profiles for anyone who mentioned the target in a video title (e.g. TMZ, Lil Tay). Requiring username overlap prevents media/commentary accounts from flooding the threat feed.

## Strategy numbering in webSearchService.ts
- 1a: CSE/Serper username variant search (OR direct X probe if cseEnabled=false)
- 1b: Display name + handle search (similarity ≥ 0.50 required, fan filter applied)
- 1c: X API v2 variant lookup (PKCE flow, fails gracefully without app-only token)
- 1d: Instagram web profile JSON probe (always runs, skips on 429)
- 1e: TikTok oEmbed probe (always runs, reliable from DC IPs, fan filter applied)
- 2: Cloud Vision reverse image search
- 3: Caption text CSE/Serper search
