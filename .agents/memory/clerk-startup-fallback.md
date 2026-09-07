---
name: Clerk startup fallback
description: Prevent a blank post-splash screen while Clerk initializes in a native release build.
---

# Clerk Startup Fallback

Keep the native startup fallback outside `ClerkProvider`, reveal the authenticated app only after a `ClerkLoaded` readiness signal, include a JavaScript timeout that advances past the animated splash, and retain the native Clerk Expo plugin plus production proxy wiring.

**Why:** On a standalone iOS build, Clerk can suppress provider descendants while initializing and a Reanimated completion callback can be skipped. A missing native Clerk plugin, publishable key, or proxy URL can also leave its loaded state pending indefinitely, even though browser preview works. EAS cloud builds do not inherit Replit-managed production variables automatically. Supplying these values through the EAS production environment was confirmed to restore startup on a physical TestFlight device.

**How to apply:** Mount the visible loader/retry screen as a sibling of `ClerkProvider`; use a tiny component inside `ClerkLoaded` to signal readiness and dismiss it. Preserve a hard splash timeout as a final handoff safeguard. Register Clerk's Expo plugin in the static app config, pass the managed production publishable key and absolute `/api/__clerk` proxy URL through the EAS production environment, and pass both to `ClerkProvider`. Confirm the EAS build log lists those variables before distributing the binary. For standalone production requests, prefer the injected absolute API URL over a relative `/api` path.