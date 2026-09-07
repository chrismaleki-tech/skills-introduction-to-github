import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

function id(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function appStatus(status: Stripe.Subscription.Status) {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due") return "past_due";
  if (status === "unpaid" || status === "incomplete" || status === "incomplete_expired") return "unpaid";
  return "canceled";
}

function dateFromSeconds(value: number | null | undefined) {
  return value ? new Date(value * 1000) : null;
}

export async function POST(req: Request) {
  const signingSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signingSecret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), signature, signingSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  try {
    const duplicate = await db.billingEvent.findUnique({ where: { stripeEventId: event.id } });
    if (duplicate) return NextResponse.json({ received: true, duplicate: true });

    let orgId: string | null = null;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      orgId = session.metadata?.orgId || session.client_reference_id || null;
      if (orgId) {
        await db.org.update({
          where: { id: orgId },
          data: {
            stripeCustomerId: id(session.customer),
            stripeSubscriptionId: id(session.subscription),
            stripePriceId: process.env.STRIPE_PRICE_ID || undefined,
          },
        });
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = id(subscription.customer);
      orgId = subscription.metadata.orgId || null;
      if (!orgId && customerId) {
        orgId =
          (
            await db.org.findUnique({
              where: { stripeCustomerId: customerId },
              select: { id: true },
            })
          )?.id ?? null;
      }

      if (orgId) {
        const periodEnd = subscription.items.data[0]?.current_period_end;
        const status = appStatus(subscription.status);
        await db.org.update({
          where: { id: orgId },
          data: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            stripePriceId: subscription.items.data[0]?.price.id ?? undefined,
            planStatus: status,
            trialEndsAt: dateFromSeconds(subscription.trial_end),
            subscriptionEndsAt: dateFromSeconds(periodEnd),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          },
        });

        if (status === "active" || status === "trialing") {
          await db.signupEvent.updateMany({
            where: { orgId, status: { not: "converted" } },
            data: { status: "converted", convertedAt: new Date() },
          });
        }
      }
    }

    await db.billingEvent.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        orgId,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("Stripe webhook processing failed", event.id, error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
