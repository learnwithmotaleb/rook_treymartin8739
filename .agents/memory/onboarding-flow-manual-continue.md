---
name: Onboarding multi-step flows need explicit continue, not auto-advance-on-return
description: Auto-advancing an onboarding step on useFocusEffect after a sub-flow (e.g. connect-account) breaks any "do this action multiple times" step; pair replace() navigations with an explicit params flag for back-button handling.
---

Two related onboarding navigation bugs traced to the same anti-pattern of inferring user intent from navigation focus events instead of explicit user action:

**Auto-advance on focus breaks repeatable sub-flows:** a `useFocusEffect` that advances the onboarding step as soon as the user returns from a pushed sub-screen (e.g. `/connect-account`) assumes the sub-flow was "one and done." If the sub-screen only lets the user act on one item per visit (e.g. connect one social account), the user has no way to loop back and repeat it — they get auto-advanced past the step. **Fix:** on return, only clear the "attempted" flag; render an explicit in-step "connect another" + "Continue" pair of buttons driven by real state (e.g. `connectedAccounts.length`), so advancing is a deliberate user action, not an inferred one.

**`router.replace()` before a screen that calls `router.back()` throws "GO_BACK not handled":** if a screen's back/close button conditionally branches on how it was reached (e.g. `isFromOnboarding` derived from a route param) but the caller never actually passes that param, the branch always takes the `router.back()` path — which fails silently/throws when there's no back history because the caller used `replace()` instead of `push()`. **Fix:** grep all callers of a shared screen for the param the screen's back-handler expects; a screen with conditional back-button logic is a strong signal that at least one caller is expected to pass a "came from X" param — verify every caller actually does.

**Fake/decorative progress animations for real async operations:** a scan/setup screen driven by `setTimeout` delays instead of the real `isScanning`/`scanProgress` state from context produces a screen that looks like it's doing work but isn't calling the real API. When wiring the real state in, add a safety-valve timeout independent of the "was scanning" transition (covers instant failures like quota errors where `isScanning` never flips true) so the user is never stranded.
