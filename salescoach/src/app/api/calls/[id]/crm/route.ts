import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { linkCallToCrm } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";

// Attach (or clear) CRM account / contact / deal links on a SalesCoach call.
// Linking a graded call refreshes the coaching activity on the deal timeline.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  const body = (await req.json().catch(() => null)) as {
    dealId?: string | null;
    contactId?: string | null;
    accountId?: string | null;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const call = await db.call.findFirst({ where: { id, orgId: user.orgId } });
  if (!call || (!isManagerRole(user.role) && call.repId !== user.id)) {
    return NextResponse.json({ error: "Call not found." }, { status: 404 });
  }

  try {
    const updated = await linkCallToCrm(call.id, user.orgId, body);
    return NextResponse.json({
      callId: updated.id,
      dealId: updated.dealId,
      contactId: updated.contactId,
      accountId: updated.accountId,
      prospectName: updated.prospectName,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to link call." },
      { status: 400 },
    );
  }
}
