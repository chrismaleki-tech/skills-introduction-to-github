import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPurchaseOrder } from "@/lib/erp";
import { currentUser, isManagerRole } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }
  const [vendors, purchaseOrders] = await Promise.all([
    db.vendor.findMany({ where: { orgId: user.orgId }, orderBy: { name: "asc" } }),
    db.purchaseOrder.findMany({
      where: { orgId: user.orgId },
      include: { vendor: true, _count: { select: { lines: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return NextResponse.json({ vendors, purchaseOrders });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as {
    kind?: "vendor" | "po";
    name?: string;
    email?: string;
    phone?: string;
    website?: string;
    notes?: string;
    vendorId?: string;
    lines?: Array<{ productId?: string | null; description: string; quantity: number; unitCost: number }>;
  } | null;

  try {
    if (body?.kind === "vendor") {
      const name = body.name?.trim();
      if (!name) return NextResponse.json({ error: "name required." }, { status: 400 });
      const vendor = await db.vendor.create({
        data: {
          orgId: user.orgId,
          name,
          email: body.email?.trim() ?? "",
          phone: body.phone?.trim() ?? "",
          website: body.website?.trim() ?? "",
          notes: body.notes?.trim() ?? "",
        },
      });
      return NextResponse.json({ vendor });
    }

    if (!body?.vendorId || !body.lines?.length) {
      return NextResponse.json({ error: "vendorId and lines required." }, { status: 400 });
    }
    const po = await createPurchaseOrder({
      orgId: user.orgId,
      ownerId: user.id,
      vendorId: body.vendorId,
      notes: body.notes,
      lines: body.lines,
    });
    return NextResponse.json({ purchaseOrder: po });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 400 });
  }
}
