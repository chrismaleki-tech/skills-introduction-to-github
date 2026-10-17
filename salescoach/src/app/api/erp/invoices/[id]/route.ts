import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordPayment, sendInvoice } from "@/lib/erp";
import { currentUser } from "@/lib/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  const { id } = await params;
  const invoice = await db.invoice.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      lines: { include: { product: true }, orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { receivedAt: "desc" }, include: { recordedBy: { select: { name: true } } } },
      account: true,
      contact: true,
      deal: true,
      order: true,
      owner: { select: { id: true, name: true } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ invoice });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    action?: string;
    amount?: number;
    method?: string;
    reference?: string;
    notes?: string;
  } | null;

  try {
    if (body?.action === "send") {
      const invoice = await sendInvoice(id, user.orgId, user.id);
      return NextResponse.json({ invoice });
    }
    if (body?.action === "pay") {
      const result = await recordPayment({
        orgId: user.orgId,
        userId: user.id,
        invoiceId: id,
        amount: body.amount ?? 0,
        method: body.method,
        reference: body.reference,
        notes: body.notes,
      });
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 400 });
  }
}
