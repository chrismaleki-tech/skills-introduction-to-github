import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  const where = isManagerRole(user.role)
    ? { orgId: user.orgId }
    : { orgId: user.orgId, ownerId: user.id };
  const invoices = await db.invoice.findMany({
    where,
    include: {
      account: { select: { id: true, name: true } },
      deal: { select: { id: true, name: true } },
      order: { select: { id: true, number: true } },
      owner: { select: { id: true, name: true } },
      _count: { select: { payments: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ invoices });
}
