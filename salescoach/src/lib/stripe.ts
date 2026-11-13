import Stripe from "stripe";
import { priceIdForPlan, type CheckoutPlanKey } from "./plans";

let client: Stripe | undefined;

export function stripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      priceIdForPlan("pro") &&
      process.env.STRIPE_WEBHOOK_SECRET,
  );
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  client ??= new Stripe(key, {
    appInfo: { name: "Erota Sales Intelligence", version: "1.0.0" },
  });
  return client;
}

export function stripePriceId(plan: CheckoutPlanKey) {
  const id = priceIdForPlan(plan);
  if (!id) {
    const name = plan === "max" ? "STRIPE_MAX_PRICE_ID" : "STRIPE_PRO_PRICE_ID";
    throw new Error(`${name} is not configured.`);
  }
  return id;
}

export function appUrl(req?: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (req) return new URL(req.url).origin;
  return "http://localhost:3000";
}
