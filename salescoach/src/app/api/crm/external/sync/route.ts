import { NextResponse } from "next/server";
import { currentUser, isManagerRole } from "@/lib/session";
import { externalCrmConfigured, syncDealToExternalCrm } from "@/lib/crm-external";

/** Push a deal to Salesforce/HubSpot when those integrations are configured. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    provider?: "salesforce" | "hubspot";
    dealId?: string;
  };
  if (!body.dealId || (body.provider !== "salesforce" && body.provider !== "hubspot")) {
    return NextResponse.json(
      { error: "provider (salesforce|hubspot) and dealId are required." },
      { status: 400 },
    );
  }
  if (!externalCrmConfigured(body.provider)) {
    return NextResponse.json(
      {
        error: `${body.provider} not configured`,
        salesforce: externalCrmConfigured("salesforce"),
        hubspot: externalCrmConfigured("hubspot"),
      },
      { status: 503 },
    );
  }
  const result = await syncDealToExternalCrm({
    provider: body.provider,
    orgId: user.orgId,
    dealId: body.dealId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 501 });
  }
  return NextResponse.json(result);
}
