import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { confirmOrder, createInvoiceFromOrder, fulfillOrder } from "@/lib/erp";
import { currentUser } from "@/lib/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  const { id } = await params;
  const order = await db.salesOrder.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      lines: { include: { product: true }, orderBy: { sortOrder: "asc" } },
      account: true,
      contact: true,
      deal: true,
      quote: true,
      invoices: { select: { id: true, number: true, status: true, total: true, amountPaid: true } },
      owner: { select: { id: true, name: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ order });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { action?: string } | null;

  try {
    if (body?.action === "confirm") {
      const order = await confirmOrder(id, user.orgId, user.id);
      return NextResponse.json({ order });
    }
    if (body?.action === "fulfill") {
      const order = await fulfillOrder(id, user.orgId, user.id);
      return NextResponse.json({ order });
    }
    if (body?.action === "invoice") {
      const invoice = await createInvoiceFromOrder(id, user.orgId, user.id);
      return NextResponse.json({ invoice });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 400 });
  }
}
