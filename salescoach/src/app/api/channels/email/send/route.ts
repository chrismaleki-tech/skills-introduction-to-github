import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendCrmEmail } from "@/lib/channels";
import { currentUser, isManagerRole } from "@/lib/session";

export async function POST(req: Request) {
  const user = await currentUser();
  const body = (await req.json().catch(() => null)) as {
    to?: string;
    subject?: string;
    body?: string;
    dealId?: string | null;
    contactId?: string | null;
    accountId?: string | null;
    conversationId?: string | null;
    simulateReply?: boolean;
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
    const result = await sendCrmEmail({
      orgId: user.orgId,
      userId: user.id,
      to: body.to ?? "",
      subject: body.subject ?? "",
      body: body.body ?? "",
      dealId: body.dealId,
      contactId: body.contactId,
      accountId: body.accountId,
      conversationId: body.conversationId,
      simulateReply: body.simulateReply,
    });
    return NextResponse.json({
      conversationId: result.conversation.id,
      messageId: result.outbound.id,
      replyId: result.inbound?.id ?? null,
      from: result.from,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send email." },
      { status: 400 },
    );
  }
}
