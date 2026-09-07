import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { appUrl, getStripe, stripePriceId } from "@/lib/stripe";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Only an organization admin can manage billing." }, { status: 403 });
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    return NextResponse.json({ error: "Stripe billing is not configured." }, { status: 503 });
  }

  const stripe = getStripe();
  let customerId = user.org.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create(
      {
        email: user.email,
        name: user.org.name,
        metadata: { orgId: user.orgId, ownerUserId: user.id },
      },
      { idempotencyKey: `salescoach-org-${user.orgId}` },
    );
    customerId = customer.id;
    await db.org.update({
      where: { id: user.orgId },
      data: { stripeCustomerId: customer.id },
    });
  }

  const base = appUrl(req);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.orgId,
    line_items: [{ price: stripePriceId(), quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${base}/billing?checkout=success`,
    cancel_url: `${base}/billing?checkout=canceled`,
    subscription_data: {
      metadata: { orgId: user.orgId },
    },
    metadata: { orgId: user.orgId, ownerUserId: user.id },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
  }
  return NextResponse.redirect(session.url, 303);
}
