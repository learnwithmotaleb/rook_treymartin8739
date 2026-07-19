/**
 * Shared OAuth constants for the Rook mobile app.
 *
 * App IDs are public values (visible in every OAuth authorization URL the app
 * opens). They are hardcoded here instead of reading EXPO_PUBLIC_* env vars to
 * avoid stale values due to Replit env-var propagation delays — EXPO_PUBLIC_*
 * vars require a full Metro restart to refresh.
 *
 * Single source of truth: update here and both connect-account.tsx and
 * onboarding.tsx automatically pick up the new values.
 */

/** Instagram Business Login App ID (separate from the Meta/Facebook App ID). */
export const INSTAGRAM_APP_ID = "27463822659936313";

/** Meta / Facebook App ID. */
export const FACEBOOK_APP_ID = "1042769471484001";

/**
 * Custom URI scheme registered in app.json ("scheme": "com.getrook.app").
 * ASWebAuthenticationSession (iOS) and Chrome Custom Tabs (Android) intercept
 * redirects to this scheme and close the browser automatically.
 * Must also be registered as a Valid OAuth Redirect URI in Meta for Developers.
 */
export const OAUTH_APP_SCHEME = "com.getrook.app://oauth";
