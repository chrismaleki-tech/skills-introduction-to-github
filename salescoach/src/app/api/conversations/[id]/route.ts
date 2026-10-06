import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  const conversation = await db.conversation.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      contact: true,
      deal: { select: { id: true, name: true, stage: true } },
      account: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { occurredAt: "asc" },
        include: {
          sender: { select: { id: true, name: true } },
          call: { select: { id: true, status: true, grade: { select: { overallScore: true } } } },
        },
      },
    },
  });
  if (!conversation || (!isManagerRole(user.role) && conversation.ownerId !== user.id)) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  return NextResponse.json({ conversation });
}
