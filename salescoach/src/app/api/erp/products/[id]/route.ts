import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }
  const { id } = await params;
  const existing = await db.product.findFirst({ where: { id, orgId: user.orgId } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const data: Record<string, unknown> = {};
  for (const key of ["name", "description", "category", "unit", "sku"] as const) {
    if (typeof body[key] === "string") data[key] = (body[key] as string).trim();
  }
  for (const key of ["listPrice", "cost", "qtyOnHand", "qtyReserved", "reorderPoint"] as const) {
    if (body[key] != null) data[key] = Math.max(0, Math.round(Number(body[key])) || 0);
  }
  if (typeof body.trackInventory === "boolean") data.trackInventory = body.trackInventory;
  if (typeof body.active === "boolean") data.active = body.active;

  try {
    const product = await db.product.update({ where: { id }, data });
    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ error: "Update failed (SKU conflict?)." }, { status: 409 });
  }
}
