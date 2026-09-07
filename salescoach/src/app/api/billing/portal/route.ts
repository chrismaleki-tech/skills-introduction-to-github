import { NextResponse } from "next/server";
import { currentUser, isManagerRole } from "@/lib/session";
import { appUrl, getStripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Only an organization admin can manage billing." }, { status: 403 });
  }
  if (!process.env.STRIPE_SECRET_KEY || !user.org.stripeCustomerId) {
    return NextResponse.json({ error: "No Stripe customer exists for this organization." }, { status: 400 });
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: user.org.stripeCustomerId,
    configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID || undefined,
    return_url: `${appUrl(req)}/billing`,
  });
  return NextResponse.redirect(session.url, 303);
}
