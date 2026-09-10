import { NextResponse } from "next/server";
import { approvePurchaseOrder, receivePurchaseOrder, submitPurchaseOrder } from "@/lib/erp";
import { receivePurchaseOrderDeep } from "@/lib/erp-deep";
import { currentUser, isManagerRole } from "@/lib/session";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    action?: string;
    warehouseId?: string;
    lines?: Array<{ productId?: string | null; quantity: number; description?: string }>;
    createVendorBill?: boolean;
  } | null;

  try {
    if (body?.action === "submit") {
      const purchaseOrder = await submitPurchaseOrder(id, user.orgId, user.id);
      return NextResponse.json({ purchaseOrder });
    }
    if (body?.action === "approve") {
      const purchaseOrder = await approvePurchaseOrder(id, user.orgId, user.id);
      return NextResponse.json({ purchaseOrder });
    }
    if (body?.action === "receive_partial") {
      const result = await receivePurchaseOrderDeep({
        orgId: user.orgId,
        userId: user.id,
        poId: id,
        warehouseId: body.warehouseId,
        lines: body.lines,
        createVendorBill: body.createVendorBill !== false,
      });
      return NextResponse.json(result);
    }
    if (body?.action === "receive") {
      const purchaseOrder = await receivePurchaseOrder(id, user.orgId, user.id);
      return NextResponse.json({ purchaseOrder });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 400 });
  }
}
