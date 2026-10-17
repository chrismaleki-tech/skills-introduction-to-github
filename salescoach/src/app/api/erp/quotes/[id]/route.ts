import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { acceptQuote, rejectQuote, sendQuote } from "@/lib/erp";
import { currentUser } from "@/lib/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  const { id } = await params;
  const quote = await db.quote.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      lines: { include: { product: true }, orderBy: { sortOrder: "asc" } },
      account: true,
      contact: true,
      deal: true,
      owner: { select: { id: true, name: true } },
      orders: { select: { id: true, number: true, status: true } },
    },
  });
  if (!quote) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ quote });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  const action = body?.action;

  try {
    if (action === "send") {
      const quote = await sendQuote(id, user.orgId, user.id);
      return NextResponse.json({ quote });
    }
    if (action === "accept") {
      const result = await acceptQuote(id, user.orgId, user.id);
      return NextResponse.json(result);
    }
    if (action === "reject") {
      const quote = await rejectQuote(id, user.orgId, user.id);
      return NextResponse.json({ quote });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 400 });
  }
}
