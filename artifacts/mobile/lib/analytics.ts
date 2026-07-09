/**
 * Analytics abstraction layer for Rook.
 *
 * Dev:  logs all events to console.
 * Prod: no-op placeholder — swap the `trackEvent` implementation below to
 *       wire in Amplitude, Mixpanel, PostHog, or any other provider.
 *
 * Usage:
 *   import { analytics } from "@/lib/analytics";
 *   analytics.track("scan_started", { platform_count: 3 });
 */

export type AnalyticsEvent =
  | "onboarding_started"
  | "onboarding_step_completed"
  | "onboarding_completed"
  | "onboarding_skipped"
  | "account_connected"
  | "account_removed"
  | "scan_started"
  | "scan_completed"
  | "preview_viewed"
  | "paywall_viewed"
  | "scan_purchased"
  | "scan_unlocked_via_subscription"
  | "subscription_started"
  | "subscription_restored"
  | "threat_found"
  | "threat_resolved"
  | "threat_reported"
  | "upsell_dismissed"
  | "upsell_tapped";

export type EventProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

function trackEvent(event: AnalyticsEvent, properties?: EventProperties): void {
  if (__DEV__) {
    console.log(`[Analytics] ${event}`, properties ?? {});
  }
  // ─── Production provider (uncomment + install the SDK you choose) ────────
  // Amplitude.track(event, properties);
  // Mixpanel.track(event, properties);
  // PostHog.capture(event, properties);
  // ─────────────────────────────────────────────────────────────────────────
}

export const analytics = {
  track: trackEvent,
} as const;
