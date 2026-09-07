import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { provisionOrgForUser } from "@/lib/provision";
import { db } from "@/lib/db";
import { recordSignup } from "@/lib/signups";

export const dynamic = "force-dynamic";

/**
 * Clerk → SalesCoach signup capture.
 * Configure in Clerk Dashboard → Webhooks → endpoint:
 *   https://erota.io/api/webhooks/clerk
 * Subscribe to: user.created (and optionally user.updated)
 * Set signing secret as CLERK_WEBHOOK_SECRET in Vercel.
 */
export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CLERK_WEBHOOK_SECRET not configured" }, { status: 503 });
  }

  const payload = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  let evt: { type: string; data: Record<string, unknown> };
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as unknown as { type: string; data: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (evt.type === "user.created" || evt.type === "user.updated") {
    const data = evt.data;
    const clerkUserId = String(data.id || "");
    const emailAddresses = (data.email_addresses as { email_address?: string }[] | undefined) || [];
    const primaryId = data.primary_email_address_id as string | undefined;
    const primary =
      emailAddresses.find((e) => (e as { id?: string }).id === primaryId)?.email_address ||
      emailAddresses[0]?.email_address;
    if (!clerkUserId || !primary) {
      return NextResponse.json({ ok: true, skipped: "no email" });
    }

    const firstName = (data.first_name as string) || "";
    const lastName = (data.last_name as string) || "";
    const name = [firstName, lastName].filter(Boolean).join(" ") || primary.split("@")[0];

    // Attribution may arrive later via first-login cookie; webhook records the identity ASAP.
    await recordSignup({
      clerkUserId,
      email: primary,
      name,
      source: "clerk_webhook",
    });

    // Provision tenant immediately so signup is complete even before they hit /dashboard.
    const existing = await db.user.findUnique({ where: { clerkId: clerkUserId } });
    if (!existing && evt.type === "user.created") {
      await provisionOrgForUser({
        clerkId: clerkUserId,
        email: primary,
        name,
        source: "clerk_webhook",
      });
    }
  }

  return NextResponse.json({ ok: true });
}
