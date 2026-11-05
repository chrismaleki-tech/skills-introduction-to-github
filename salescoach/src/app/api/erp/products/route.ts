import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  const products = await db.product.findMany({
    where: { orgId: user.orgId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ products });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role) && user.role !== "REP") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    sku?: string;
    name?: string;
    description?: string;
    category?: string;
    listPrice?: number;
    cost?: number;
    unit?: string;
    trackInventory?: boolean;
    qtyOnHand?: number;
    reorderPoint?: number;
    active?: boolean;
  } | null;

  const sku = body?.sku?.trim();
  const name = body?.name?.trim();
  if (!sku || !name) {
    return NextResponse.json({ error: "sku and name are required." }, { status: 400 });
  }

  try {
    const product = await db.product.create({
      data: {
        orgId: user.orgId,
        sku,
        name,
        description: body?.description?.trim() ?? "",
        category: body?.category?.trim() || "Software",
        listPrice: Math.max(0, Math.round(Number(body?.listPrice ?? 0)) || 0),
        cost: Math.max(0, Math.round(Number(body?.cost ?? 0)) || 0),
        unit: body?.unit?.trim() || "seat",
        trackInventory: Boolean(body?.trackInventory),
        qtyOnHand: Math.max(0, Math.round(Number(body?.qtyOnHand ?? 0)) || 0),
        reorderPoint: Math.max(0, Math.round(Number(body?.reorderPoint ?? 0)) || 0),
        active: body?.active !== false,
      },
    });
    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ error: "SKU already exists." }, { status: 409 });
  }
}
