import Stripe from "stripe";

let client: Stripe | undefined;

export function stripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_ID &&
      process.env.STRIPE_WEBHOOK_SECRET,
  );
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  client ??= new Stripe(key, {
    appInfo: { name: "SalesCoach AI", version: "1.0.0" },
  });
  return client;
}

export function stripePriceId() {
  const id = process.env.STRIPE_PRICE_ID;
  if (!id) throw new Error("STRIPE_PRICE_ID is not configured.");
  return id;
}

export function appUrl(req?: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (req) return new URL(req.url).origin;
  return "http://localhost:3000";
}
