import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adjustWarehouseStock, ensureDefaultWarehouse } from "@/lib/erp-deep";
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
  for (const key of ["listPrice", "cost", "qtyReserved", "reorderPoint"] as const) {
    if (body[key] != null) data[key] = Math.max(0, Math.round(Number(body[key])) || 0);
  }
  if (typeof body.trackInventory === "boolean") data.trackInventory = body.trackInventory;
  if (typeof body.active === "boolean") data.active = body.active;

  try {
    if (body.qtyOnHand != null && existing.trackInventory) {
      const target = Math.max(0, Math.round(Number(body.qtyOnHand)) || 0);
      const warehouse = await ensureDefaultWarehouse(user.orgId);
      const balance = await db.inventoryBalance.findUnique({
        where: {
          warehouseId_productId: { warehouseId: warehouse.id, productId: id },
        },
      });
      const current = balance?.qtyOnHand ?? 0;
      await adjustWarehouseStock({
        orgId: user.orgId,
        productId: id,
        warehouseId: warehouse.id,
        deltaOnHand: target - current,
      });
    }

    const product = await db.product.update({ where: { id }, data });
    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ error: "Update failed (SKU conflict?)." }, { status: 409 });
  }
}
