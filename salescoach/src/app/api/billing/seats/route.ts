import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import { MAX_SEATS, seatSummary } from "@/lib/seats";

// POST /api/billing/seats { seats } — change the paid seat quantity on the
// active Stripe subscription. Prorated immediately; the webhook re-syncs too.

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Only an organization admin can manage seats." }, { status: 403 });
  }
  const org = user.org;
  if (!org.stripeSubscriptionId || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Subscribe to a plan before changing seats.", billingUrl: "/billing" },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => null)) as { seats?: unknown } | null;
  const seats = Math.floor(Number(body?.seats));
  if (!Number.isFinite(seats) || seats < 1 || seats > MAX_SEATS) {
    return NextResponse.json({ error: `Seats must be between 1 and ${MAX_SEATS}.` }, { status: 400 });
  }

  const summary = await seatSummary(org);
  if (seats < summary.used) {
    return NextResponse.json(
      {
        error: `You have ${summary.members} members and ${summary.pendingInvites} pending invites. Remove people or revoke invites before reducing below ${summary.used} seats.`,
      },
      { status: 400 },
    );
  }
  if (seats === org.stripeSeatCount) {
    return NextResponse.json({ ok: true, seats });
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
  if (subscription.status === "canceled" || subscription.cancel_at_period_end) {
    return NextResponse.json(
      { error: "This subscription is scheduled to end. Resume it from the billing portal before adding seats.", billingUrl: "/billing" },
      { status: 409 },
    );
  }
  const item = subscription.items.data[0];
  if (!item) {
    return NextResponse.json({ error: "Subscription has no seat item." }, { status: 500 });
  }

  await stripe.subscriptions.update(
    subscription.id,
    {
      items: [{ id: item.id, quantity: seats }],
      proration_behavior: "create_prorations",
      metadata: { ...subscription.metadata, seats: String(seats) },
    },
    { idempotencyKey: `erota-seats-${org.id}-${seats}-${Math.floor(Date.now() / 60_000)}` },
  );

  await db.org.update({ where: { id: org.id }, data: { stripeSeatCount: seats } });
  return NextResponse.json({ ok: true, seats });
}
