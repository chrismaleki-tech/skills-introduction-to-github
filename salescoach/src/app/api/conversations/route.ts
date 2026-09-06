import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";

export async function GET(req: Request) {
  const user = await currentUser();
  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("dealId") || undefined;
  const contactId = searchParams.get("contactId") || undefined;
  const channel = searchParams.get("channel") || undefined;

  const where: {
    orgId: string;
    ownerId?: string;
    dealId?: string;
    contactId?: string;
    channel?: string;
  } = { orgId: user.orgId };

  if (!isManagerRole(user.role)) where.ownerId = user.id;
  if (dealId) where.dealId = dealId;
  if (contactId) where.contactId = contactId;
  if (channel === "EMAIL" || channel === "PHONE") where.channel = channel;

  const conversations = await db.conversation.findMany({
    where,
    include: {
      contact: { select: { id: true, name: true, email: true, phone: true } },
      deal: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      messages: {
        orderBy: { occurredAt: "asc" },
        take: 100,
        include: { sender: { select: { id: true, name: true } } },
      },
      _count: { select: { messages: true } },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ conversations });
}
