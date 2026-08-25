---
name: Clerk startup fallback
description: Prevent a blank post-splash screen while Clerk initializes in a native release build.
---

# Clerk Startup Fallback

Keep the native startup fallback outside `ClerkProvider`, reveal the authenticated app only after a `ClerkLoaded` readiness signal, and include a JavaScript timeout that advances past the animated splash.

**Why:** On a standalone iOS build, Clerk can suppress provider descendants while initializing and a Reanimated completion callback can be skipped. Either behavior can turn a completed custom splash into an empty screen even when the app has not crashed.

**How to apply:** Mount the visible loader/retry screen as a sibling of `ClerkProvider`; use a tiny component inside `ClerkLoaded` to signal readiness and dismiss it. Preserve a hard splash timeout as a final handoff safeguard. For standalone production requests, prefer the injected absolute API URL over a relative `/api` path.