/**
 * Request-rate limiters for expensive authenticated endpoints.
 *
 * These supplement the per-user scan-quota system. Their job is to prevent
 * denial-of-wallet attacks from compromised tokens or scripted abuse — they
 * do NOT enforce business-logic quotas (that remains in rateLimitService.ts).
 */
import { rateLimit } from "express-rate-limit";

/**
 * Build a rate-limit key from the authenticated user's DB UUID.
 * These limiters always sit after requireAuth so userId is guaranteed to exist.
 * Using userId (not IP) correctly handles users behind NAT/shared IPs and avoids
 * the IPv6 normalization issue that express-rate-limit warns about.
 */
function userIdKey(req: Parameters<typeof rateLimit>[0] extends infer R ? R extends { keyGenerator?: any } ? Parameters<NonNullable<R["keyGenerator"]>>[0] : never : never): string {
  return (req as any).userId ?? "unauthenticated";
}

/** 20 scan initiations per authenticated user per 10 minutes.
 * Active jobs are deduplicated and plan quotas remain the actual scan guard;
 * this leaves room for a reviewer retrying a transient request. */
export const scanLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).userId ?? "unauthenticated",
  validate: { xForwardedForHeader: false }, // userId key — IP header not used
  message: { error: "Too many scan requests — please wait before starting another scan." },
});

/** 30 photo-search calls per user per 10 minutes. */
export const photoSearchLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).userId ?? "unauthenticated",
  validate: { xForwardedForHeader: false },
  message: { error: "Too many photo search requests — please try again later." },
});

/** 20 AI analysis calls per user per 10 minutes. */
export const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).userId ?? "unauthenticated",
  validate: { xForwardedForHeader: false },
  message: { error: "Too many AI requests — please try again later." },
});
