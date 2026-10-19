import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteCall } from "@/lib/retention";
import { currentUser, isManagerRole } from "@/lib/session";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await currentUser();
  const call = await db.call.findFirst({
    where: { id, orgId: user.orgId },
    select: { repId: true },
  });
  if (!call || (call.repId !== user.id && !isManagerRole(user.role))) {
    return NextResponse.json({ error: "Call not found." }, { status: 404 });
  }

  await deleteCall(id, user.orgId);
  return NextResponse.json({ ok: true });
}
