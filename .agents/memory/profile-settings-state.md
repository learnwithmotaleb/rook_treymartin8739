---
name: Profile tab settings state
description: How the profile tab reads live notification/security pref values from AsyncStorage.
---

## The rule
The profile tab (app/(tabs)/profile.tsx) shows live preference values — "On"/"Off" for Push Alerts, Email Alerts, Two-Factor Auth, and Biometric Login — by reading from AsyncStorage at mount via the `useStoredPrefs()` hook.

**Why:** The values were hardcoded ("On", "Set Up", "Configure") which felt stale and broke trust. Reading from the same AsyncStorage keys as the settings screens keeps them in sync without a shared context or re-architecture.

**How to apply:**
- Storage keys: `shieldid:notification_prefs` (pushAlerts, emailAlerts) and `shieldid:security_prefs` (biometricLogin, twoFactorEnabled).
- These match the keys used by notification-settings.tsx and security-settings.tsx respectively.
- If you add new storage-backed settings, add their keys here so the profile tab can surface them.
- The hook is local to profile.tsx — if settings screens gain real-time sync needs, consider lifting to AppContext.
