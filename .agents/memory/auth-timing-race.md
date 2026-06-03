---
name: Auth timing race — isInitializing guard
description: Why tabs layout must not redirect until both Clerk and AsyncStorage have loaded.
---

## The rule
`(tabs)/_layout.tsx` must return `null` (not `<Redirect>`) while either `!isLoaded` (Clerk) or `isInitializing` (AppContext AsyncStorage) are true. Only AFTER both resolve should it render `<Redirect href="/auth">` or `<Redirect href="/onboarding">`.

## Why
`isSignedIn` is `undefined`/falsy before Clerk loads → premature redirect to `/auth`.  
`hasSeenOnboarding` is `false` (default) before AsyncStorage loads → premature redirect to `/onboarding`.  
These flash-redirects navigate away from the tabs route, preventing the `useEffect` that calls `setApiAuthToken()` + `login()` from ever firing with the correct state — so every API request goes out with no Bearer token and hits the demo-user fallback (`getOrCreateDemoUser()`).

## How to apply
- `AppContext` exports `isInitializing: boolean` — starts `true`, set to `false` inside the `Promise.all([AsyncStorage.getItem(...)])` initializer.
- In `(tabs)/_layout.tsx`: `if (!isLoaded || isInitializing) return null;` before any `<Redirect>`.
- The auth useEffect also guards: `if (!isLoaded || isInitializing) return;`.
- `getToken` from Clerk must be accessed via a `useRef` (not in the deps array) to prevent the effect re-firing on every render due to Clerk returning a new function reference.
