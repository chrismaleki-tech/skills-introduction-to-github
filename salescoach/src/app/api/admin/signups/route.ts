import { NextResponse } from "next/server";
import { requirePlatformOwnerApi } from "@/lib/platform-admin";
import { listSignups } from "@/lib/signups";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePlatformOwnerApi();
  if (gate.response) return gate.response;

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
