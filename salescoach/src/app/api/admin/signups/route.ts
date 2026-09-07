import { NextResponse } from "next/server";
import { isClerkEnabled } from "@/lib/auth-mode";
import { isAdminEmail, listSignups } from "@/lib/signups";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isClerkEnabled()) {
    return NextResponse.json({ error: "Admin requires Clerk auth." }, { status: 503 });
  }
  if (!process.env.ADMIN_EMAILS) {
    return NextResponse.json(
      { error: "Set ADMIN_EMAILS (comma-separated) to enable the signup admin API." },
      { status: 503 },
    );
  }

  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress;
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const signups = await listSignups(200);
  return NextResponse.json({
    count: signups.length,
    signups: signups.map((s) => ({
      id: s.id,
      email: s.email,
      name: s.name,
      status: s.status,
      source: s.source,
      utmSource: s.utmSource,
      utmMedium: s.utmMedium,
      utmCampaign: s.utmCampaign,
      referrer: s.referrer,
      landingPath: s.landingPath,
      org: s.org,
      signedUpAt: s.signedUpAt,
      provisionedAt: s.provisionedAt,
      activatedAt: s.activatedAt,
      leadId: s.leadId,
    })),
  });
}
