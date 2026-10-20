import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { appUrl, getStripe, stripePriceId } from "@/lib/stripe";
import { isCheckoutPlan, priceIdForPlan } from "@/lib/plans";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Only an organization admin can manage billing." }, { status: 403 });
  }

  const form = await req.formData().catch(() => new FormData());
  const requestedPlan = String(form.get("plan") || "pro");
  if (!isCheckoutPlan(requestedPlan)) {
    return NextResponse.json({ error: "Choose either the Pro or Max plan." }, { status: 400 });
  }

  const priceId = priceIdForPlan(requestedPlan);
  if (!process.env.STRIPE_SECRET_KEY || !priceId) {
    return NextResponse.json({ error: "Stripe billing is not configured." }, { status: 503 });
  }

  const stripe = getStripe();
  const teamSize = await db.user.count({ where: { orgId: user.orgId } });
  const requestedSeats = Number(form.get("seats"));
  const seats = Math.min(
    500,
    Math.max(teamSize, Number.isFinite(requestedSeats) ? Math.floor(requestedSeats) : teamSize, 1),
  );
  let customerId = user.org.stripeCustomerId;
  if (customerId) {
    try {
      const existingCustomer = await stripe.customers.retrieve(customerId);
      if (existingCustomer.deleted) customerId = null;
    } catch (error) {
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number(error.statusCode)
          : 0;
      if (statusCode === 404) customerId = null;
      else throw error;
    }
  }
  if (!customerId) {
    const customer = await stripe.customers.create(
      {
        email: user.email,
        name: user.org.name,
        metadata: { orgId: user.orgId, ownerUserId: user.id, product: "erota-sales-intelligence" },
      },
      { idempotencyKey: `erota-sales-intelligence-org-${user.orgId}` },
    );
    customerId = customer.id;
    await db.org.update({
      where: { id: user.orgId },
      data: { stripeCustomerId: customer.id },
    });
  }

  const base = appUrl(req);
  const session = await stripe.checkout.sessions.create({
    ui_mode: "hosted_page",
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.orgId,
    line_items: [{ price: stripePriceId(requestedPlan), quantity: seats }],
    billing_address_collection: "auto",
    phone_number_collection: { enabled: false },
    automatic_tax: { enabled: false },
    allow_promotion_codes: false,
    payment_method_collection: "always",
    submit_type: "auto",
    integration_identifier: "hosted_web_0001",
    origin_context: "web",
    success_url: `${base}/billing?checkout=success`,
    cancel_url: `${base}/billing?checkout=canceled`,
    subscription_data: {
      metadata: { orgId: user.orgId, plan: requestedPlan, seats: String(seats) },
    },
    metadata: {
      orgId: user.orgId,
      ownerUserId: user.id,
      plan: requestedPlan,
      seats: String(seats),
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
  }
  return NextResponse.redirect(session.url, 303);
}
