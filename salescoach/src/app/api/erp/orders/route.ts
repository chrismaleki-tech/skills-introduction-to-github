import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createOrder } from "@/lib/erp";
import { currentUser, isManagerRole } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  const where = isManagerRole(user.role)
    ? { orgId: user.orgId }
    : { orgId: user.orgId, ownerId: user.id };
  const orders = await db.salesOrder.findMany({
    where,
    include: {
      account: { select: { id: true, name: true } },
      deal: { select: { id: true, name: true } },
      quote: { select: { id: true, number: true } },
      owner: { select: { id: true, name: true } },
      _count: { select: { lines: true, invoices: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ orders });
}

export async function POST(req: Request) {
  const user = await currentUser();
  const body = (await req.json().catch(() => null)) as {
    dealId?: string | null;
    accountId?: string | null;
    contactId?: string | null;
    quoteId?: string | null;
    notes?: string;
    taxRate?: number;
    lines?: Array<{ productId?: string | null; description: string; quantity: number; unitPrice: number }>;
  } | null;

  try {
    const order = await createOrder({
      orgId: user.orgId,
      ownerId: user.id,
      dealId: body?.dealId,
      accountId: body?.accountId,
      contactId: body?.contactId,
      quoteId: body?.quoteId,
      notes: body?.notes,
      taxRate: body?.taxRate,
      lines: body?.lines ?? [],
    });
    return NextResponse.json({ order });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 400 });
  }
}
