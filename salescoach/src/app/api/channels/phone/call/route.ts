import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { placeCrmCall } from "@/lib/channels";
import { currentUser, isManagerRole } from "@/lib/session";

export async function POST(req: Request) {
  const user = await currentUser();
  const body = (await req.json().catch(() => null)) as {
    to?: string;
    notes?: string;
    transcript?: string;
    durationSec?: number;
    callType?: string;
    dealId?: string | null;
    contactId?: string | null;
    accountId?: string | null;
    conversationId?: string | null;
    gradeWithSalesCoach?: boolean;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.dealId) {
    const deal = await db.deal.findFirst({ where: { id: body.dealId, orgId: user.orgId } });
    if (!deal || (!isManagerRole(user.role) && deal.ownerId !== user.id)) {
      return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    }
  }

  try {
    const result = await placeCrmCall({
      orgId: user.orgId,
      userId: user.id,
      to: body.to ?? "",
      notes: body.notes,
      transcript: body.transcript,
      durationSec: body.durationSec,
      callType: body.callType,
      dealId: body.dealId,
      contactId: body.contactId,
      accountId: body.accountId,
      conversationId: body.conversationId,
      gradeWithSalesCoach: body.gradeWithSalesCoach,
    });
    return NextResponse.json({
      conversationId: result.conversation.id,
      messageId: result.outbound.id,
      callId: result.callId,
      gradeScore: result.gradeScore,
      from: result.from,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to place call." },
      { status: 400 },
    );
  }
}
