import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable } from "@workspace/db";
import { resolveUserId } from "../lib/demoUser";
import { PLAN_CONFIG } from "../lib/planConfig";
import {
  getSubscription,
  updateSubscriptionCustomer,
  upsertSubscriptionFromStripe,
  type StripeSubData,
} from "../services/subscriptionService";
import Stripe from "stripe";

const router: IRouter = Router();

function getStripe(): Stripe {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

function getPriceId(tier: "pro" | "premium", cycle: "monthly" | "yearly"): string {
  const key = `STRIPE_${tier.toUpperCase()}_${cycle.toUpperCase()}_PRICE_ID`;
  const val = process.env[key];
  if (!val) throw new Error(`${key} environment variable not set`);
  return val;
}

function tierFromPriceId(priceId: string): "pro" | "premium" {
  const proMonthly = process.env["STRIPE_PRO_MONTHLY_PRICE_ID"];
  const proYearly = process.env["STRIPE_PRO_YEARLY_PRICE_ID"];
  if (priceId === proMonthly || priceId === proYearly) return "pro";
  return "premium";
}

function cycleFromPriceId(priceId: string): "monthly" | "yearly" {
  const monthly = [
    process.env["STRIPE_PRO_MONTHLY_PRICE_ID"],
    process.env["STRIPE_PREMIUM_MONTHLY_PRICE_ID"],
  ];
  return monthly.includes(priceId) ? "monthly" : "yearly";
}

router.get("/billing/subscription", async (req, res): Promise<void> => {
  const userId = await resolveUserId(req.headers["x-user-id"]);
  const sub = await getSubscription(userId);
  const limits = PLAN_CONFIG[sub.tier];
  res.json({ ...sub, limits });
});

router.post("/billing/checkout", async (req, res): Promise<void> => {
  const userId = await resolveUserId(req.headers["x-user-id"]);
  const { tier, billingCycle } = req.body as {
    tier?: string;
    billingCycle?: string;
  };

  if (!tier || !["pro", "premium"].includes(tier)) {
    res.status(400).json({ error: "tier must be 'pro' or 'premium'" });
    return;
  }
  if (!billingCycle || !["monthly", "yearly"].includes(billingCycle)) {
    res.status(400).json({ error: "billingCycle must be 'monthly' or 'yearly'" });
    return;
  }

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch {
    res.status(503).json({
      error: "stripe_not_configured",
      message: "Stripe is not configured yet. Add STRIPE_SECRET_KEY to enable payments.",
    });
    return;
  }

  let priceId: string;
  try {
    priceId = getPriceId(tier as "pro" | "premium", billingCycle as "monthly" | "yearly");
  } catch {
    res.status(503).json({
      error: "price_not_configured",
      message: `Stripe Price ID not configured. Set STRIPE_${tier.toUpperCase()}_${billingCycle.toUpperCase()}_PRICE_ID.`,
    });
    return;
  }

  const sub = await getSubscription(userId);
  let customerId = sub.stripeCustomerId ?? undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({ metadata: { userId } });
    customerId = customer.id;
    await updateSubscriptionCustomer(userId, customerId);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      metadata: { userId, tier, billingCycle },
    },
    success_url: "https://shieldid.app/billing/success",
    cancel_url: "https://shieldid.app/billing/cancel",
    metadata: { userId, tier, billingCycle },
  });

  res.json({ url: session.url, sessionId: session.id });
});

router.post("/billing/portal", async (req, res): Promise<void> => {
  const userId = await resolveUserId(req.headers["x-user-id"]);
  const sub = await getSubscription(userId);

  if (!sub.stripeCustomerId) {
    res.status(400).json({ error: "No active subscription to manage" });
    return;
  }

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch {
    res.status(503).json({ error: "stripe_not_configured" });
    return;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: "https://shieldid.app/profile",
  });

  res.json({ url: session.url });
});

router.post("/billing/cancel", async (req, res): Promise<void> => {
  const userId = await resolveUserId(req.headers["x-user-id"]);
  const sub = await getSubscription(userId);

  if (!sub.stripeSubscriptionId) {
    res.status(400).json({ error: "No active subscription to cancel" });
    return;
  }

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch {
    res.status(503).json({ error: "stripe_not_configured" });
    return;
  }

  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  res.json({ cancelAtPeriodEnd: true });
});

router.post("/billing/webhook", async (req, res): Promise<void> => {
  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!webhookSecret) {
    res.status(500).json({ error: "Webhook secret not configured" });
    return;
  }

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch {
    res.status(500).json({ error: "Stripe not configured" });
    return;
  }

  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      webhookSecret
    );
  } catch {
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription && session.customer) {
        const stripeSub = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        const tier = (session.metadata?.["tier"] ?? "pro") as "pro" | "premium";
        const billingCycle = (session.metadata?.["billingCycle"] ?? "monthly") as "monthly" | "yearly";
        const data: StripeSubData = {
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: stripeSub.id,
          tier,
          status: stripeSub.status === "trialing" ? "trialing" : "active",
          billingCycle,
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
          trialEnd: stripeSub.trial_end
            ? new Date(stripeSub.trial_end * 1000)
            : null,
        };
        await upsertSubscriptionFromStripe(data);
      }
    } else if (event.type === "customer.subscription.updated") {
      const stripeSub = event.data.object as Stripe.Subscription;
      const priceId = stripeSub.items.data[0]?.price?.id ?? "";
      const tier = tierFromPriceId(priceId);
      const billingCycle = cycleFromPriceId(priceId);
      const data: StripeSubData = {
        stripeCustomerId: stripeSub.customer as string,
        stripeSubscriptionId: stripeSub.id,
        tier,
        status: stripeSub.cancel_at_period_end
          ? "canceled"
          : (stripeSub.status as "active" | "trialing" | "past_due"),
        billingCycle,
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        trialEnd: stripeSub.trial_end
          ? new Date(stripeSub.trial_end * 1000)
          : null,
      };
      await upsertSubscriptionFromStripe(data);
    } else if (event.type === "customer.subscription.deleted") {
      const stripeSub = event.data.object as Stripe.Subscription;
      const data: StripeSubData = {
        stripeCustomerId: stripeSub.customer as string,
        stripeSubscriptionId: stripeSub.id,
        tier: "free",
        status: "canceled",
        billingCycle: "monthly",
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: false,
      };
      await upsertSubscriptionFromStripe(data);
    }
  } catch (err) {
    req.log?.error({ err }, "Webhook handler error");
  }

  res.json({ received: true });
});

export default router;
