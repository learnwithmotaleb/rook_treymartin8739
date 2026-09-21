---
name: Onboarding paywall effect separation
description: Keep subscription hydration independent from optional threat-preview loading on the onboarding paywall.
---

The onboarding paywall must always hydrate the server subscription, including when onboarding found zero threats. A zero-threat early return may suppress only the optional threat-preview request; it must never gate plan hydration.

**Why:** These effects have similar mount-time structure. Putting the zero-threat guard in plan hydration prevented the billing request from ever starting and left users indefinitely on “Checking your Rook plan…”.

**How to apply:** Treat plan state and threat-preview state as independent responsibilities. Keep a bounded plan-check fallback so an auth or network promise cannot strand the screen, and verify the zero-threat route both emits the subscription request and omits the threat request.