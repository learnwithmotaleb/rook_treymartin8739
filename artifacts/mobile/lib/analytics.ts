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
  | "subscription_started"
  | "subscription_restored"
  | "threat_found"
  | "threat_resolved"
  | "threat_reported"
  ;

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
  /** Generic tracker — use typed helpers below when available. */
  track: trackEvent,

  // ─── Typed convenience helpers ────────────────────────────────────────────
  onboardingStarted: () =>
    trackEvent("onboarding_started"),

  onboardingCompleted: (props: { user_type?: string; platform_count?: number; attribution?: string }) =>
    trackEvent("onboarding_completed", props),

  onboardingSkipped: (props: { at_step?: number; reason?: string }) =>
    trackEvent("onboarding_skipped", props),

  onboardingStepCompleted: (props: { step: number; question: string; answer?: string | number }) =>
    trackEvent("onboarding_step_completed", props),

  scanStarted: (props?: { platform_count?: number }) =>
    trackEvent("scan_started", props),

  scanCompleted: (props?: { threat_count?: number; high?: number; medium?: number; low?: number }) =>
    trackEvent("scan_completed", props),

  paywallViewed: (props?: { source?: string; tier?: string; option?: string }) =>
    trackEvent("paywall_viewed", props),

  previewViewed: (props?: { threat_count?: number; high?: number }) =>
    trackEvent("preview_viewed", props),

  subscriptionStarted: (props?: { tier?: string; source?: string }) =>
    trackEvent("subscription_started", props),

  subscriptionRestored: (props?: { source?: string }) =>
    trackEvent("subscription_restored", props),

} as const;
