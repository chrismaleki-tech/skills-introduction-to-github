import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  adjustWarehouseStock,
  createStockTransfer,
  ensureDefaultWarehouse,
  postStockTransfer,
} from "@/lib/erp-deep";
import { currentUser, isManagerRole } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  await ensureDefaultWarehouse(user.orgId);
  const warehouses = await db.warehouse.findMany({
    where: { orgId: user.orgId },
    include: {
      bins: true,
      balances: {
        include: { product: { select: { id: true, sku: true, name: true } } },
      },
      _count: { select: { balances: true } },
    },
    orderBy: [{ isDefault: "desc" }, { code: "asc" }],
  });
  const transfers = await db.stockTransfer.findMany({
    where: { orgId: user.orgId },
    include: {
      fromWarehouse: { select: { code: true, name: true } },
      toWarehouse: { select: { code: true, name: true } },
      lines: { include: { product: { select: { sku: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ warehouses, transfers });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as {
    kind?: "warehouse" | "bin" | "adjust" | "transfer" | "post_transfer";
    code?: string;
    name?: string;
    address?: string;
    isDefault?: boolean;
    warehouseId?: string;
    binCode?: string;
    binName?: string;
    productId?: string;
    deltaOnHand?: number;
    fromWarehouseId?: string;
    toWarehouseId?: string;
    notes?: string;
    lines?: Array<{ productId: string; quantity: number }>;
    transferId?: string;
  } | null;

  try {
    if (body?.kind === "warehouse") {
      const code = body.code?.trim().toUpperCase();
      const name = body.name?.trim();
      if (!code || !name) return NextResponse.json({ error: "code and name required." }, { status: 400 });
      if (body.isDefault) {
        await db.warehouse.updateMany({ where: { orgId: user.orgId }, data: { isDefault: false } });
      }
      const warehouse = await db.warehouse.create({
        data: {
          orgId: user.orgId,
          code,
          name,
          address: body.address?.trim() ?? "",
          isDefault: Boolean(body.isDefault),
          bins: { create: [{ code: "A-01", name: "Receiving" }] },
        },
        include: { bins: true },
      });
      return NextResponse.json({ warehouse });
    }

    if (body?.kind === "bin") {
      if (!body.warehouseId || !body.binCode?.trim()) {
        return NextResponse.json({ error: "warehouseId and binCode required." }, { status: 400 });
      }
      const bin = await db.warehouseBin.create({
        data: {
          warehouseId: body.warehouseId,
          code: body.binCode.trim().toUpperCase(),
          name: body.binName?.trim() ?? "",
        },
      });
      return NextResponse.json({ bin });
    }

    if (body?.kind === "adjust") {
      if (!body.warehouseId || !body.productId) {
        return NextResponse.json({ error: "warehouseId and productId required." }, { status: 400 });
      }
      await adjustWarehouseStock({
        orgId: user.orgId,
        warehouseId: body.warehouseId,
        productId: body.productId,
        deltaOnHand: body.deltaOnHand ?? 0,
      });
      return NextResponse.json({ ok: true });
    }

    if (body?.kind === "transfer") {
      if (!body.fromWarehouseId || !body.toWarehouseId || !body.lines?.length) {
        return NextResponse.json({ error: "from/to warehouses and lines required." }, { status: 400 });
      }
      const transfer = await createStockTransfer({
        orgId: user.orgId,
        userId: user.id,
        fromWarehouseId: body.fromWarehouseId,
        toWarehouseId: body.toWarehouseId,
        notes: body.notes,
        lines: body.lines,
      });
      return NextResponse.json({ transfer });
    }

    if (body?.kind === "post_transfer") {
      if (!body.transferId) return NextResponse.json({ error: "transferId required." }, { status: 400 });
      const transfer = await postStockTransfer(body.transferId, user.orgId);
      return NextResponse.json({ transfer });
    }

    return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 400 });
  }
}
