---
name: Stripe API version in billing.ts
description: Stripe SDK v17+ requires updated apiVersion string and current_period_end access pattern.
---

# Stripe Billing TypeScript Issues

**Why:** Stripe Node.js SDK v17+ updated the LatestApiVersion type to "2026-04-22.dahlia". Also, `current_period_end` on Stripe.Subscription is no longer a direct property in the type definitions in some SDK builds — must cast via `(stripeSub as any)["current_period_end"]`.

**How to apply:** When creating a Stripe instance: `new Stripe(key, { apiVersion: "2026-04-22.dahlia" })`. Access period_end via `(sub as any)["current_period_end"]`.

**Files:** `artifacts/api-server/src/routes/billing.ts`
