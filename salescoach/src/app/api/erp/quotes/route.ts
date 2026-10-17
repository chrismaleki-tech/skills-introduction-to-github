import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createQuote } from "@/lib/erp";
import { currentUser, isManagerRole } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  const where = isManagerRole(user.role)
    ? { orgId: user.orgId }
    : { orgId: user.orgId, ownerId: user.id };
  const quotes = await db.quote.findMany({
    where,
    include: {
      account: { select: { id: true, name: true } },
      deal: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ quotes });
}

export async function POST(req: Request) {
  const user = await currentUser();
  const body = (await req.json().catch(() => null)) as {
    dealId?: string | null;
    accountId?: string | null;
    contactId?: string | null;
    title?: string;
    notes?: string;
    taxRate?: number;
    validUntil?: string | null;
    lines?: Array<{ productId?: string | null; description: string; quantity: number; unitPrice: number }>;
  } | null;

  if (!body?.lines?.length) {
    return NextResponse.json({ error: "lines are required." }, { status: 400 });
  }

  try {
    const quote = await createQuote({
      orgId: user.orgId,
      ownerId: user.id,
      dealId: body.dealId,
      accountId: body.accountId,
      contactId: body.contactId,
      title: body.title,
      notes: body.notes,
      taxRate: body.taxRate,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      lines: body.lines,
    });
    return NextResponse.json({ quote });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 400 });
  }
}
