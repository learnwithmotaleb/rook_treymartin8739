---
name: Clerk startup fallback
description: Prevent a blank post-splash screen while Clerk initializes in a native release build.
---

# Clerk Startup Fallback

When navigation depends on Clerk, pair `ClerkLoaded` with `ClerkLoading` that renders a branded loader and a timeout/retry state.

**Why:** In release-style startup, Clerk can take several seconds to initialize. A standalone `ClerkLoaded` gate renders no children during that interval, so the custom splash disappears into a blank screen even though the app has not crashed.

**How to apply:** Keep the auth-gated navigation inside `ClerkLoaded`, render the startup fallback as its sibling inside `ClerkProvider`, and retain the tab-level `isLoaded` guard for post-provider initialization.