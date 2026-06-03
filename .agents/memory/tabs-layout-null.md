---
name: tabs layout null return
description: Returning null from an expo-router layout component breaks web rendering.
---

Returning `null` from `_layout.tsx` while Clerk/AsyncStorage are loading prevents flash-redirects on native (good), but on Expo web it corrupts expo-router's component tree registration and causes "Invalid hook call" errors in any child screen that calls hooks.

**Fix:** Return `<View style={{ flex: 1, backgroundColor: colors.background }} />` instead of `null` during the loading phase. This keeps the component mounted with a blank dark screen while preserving the expected component tree structure.

**Why:** expo-router's web renderer expects layouts to always return a renderable node; null breaks the slot/outlet mechanism used for nested routes.
