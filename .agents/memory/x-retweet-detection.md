---
name: X retweet false-positive guard
description: How to detect and skip X/Twitter retweets in image/caption search results to avoid flagging innocent retweeters as impersonators.
---

## Rule
When Google Vision returns pagesWithMatchingImages for platform `x`, check the page title for the pattern `/\bRT @(\w+)/i` before treating the result as an impersonation signal. If the page is a retweet:
- **Skip the retweeter entirely** — do not add them as a threat candidate.
- **Pivot to the original poster**: extract the username from the RT mention and add `https://x.com/{originalPoster}` as a candidate with `postContext: "original_post"`.

Apply the same filter in `searchByCaptions` — skip any X result whose title or snippet matches `RT @`.

**Why:** Google indexes retweet pages under the retweeter's profile URL but the page title starts with "RT @originaluser:". Without this guard, anyone who retweeted your photo is incorrectly flagged as a photo thief.

**How to apply:** The `detectXPostContext()` helper in `webSearchService.ts` encapsulates the detection logic. Call it any time you have an X page title + snippet before deciding whether to push a candidate.

**Key fields added:**
- `WebSearchCandidate.postContext` — `"original_post" | "retweet" | "share" | "unknown"`
- `WebSearchCandidate.originalPoster` — username string if pivot target detected
- `DetectedEvidence.postContext` / `.stolenPageUrl` / `.originalPoster` — passed through to the mobile UI
- `MatchedEvidence` in AppContext also carries `postContext` / `originalPoster`
