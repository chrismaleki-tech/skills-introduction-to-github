import { NextResponse } from "next/server";
import { receivePurchaseOrder, submitPurchaseOrder } from "@/lib/erp";
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
  const body = (await req.json().catch(() => null)) as { action?: string } | null;

  try {
    if (body?.action === "submit") {
      const purchaseOrder = await submitPurchaseOrder(id, user.orgId, user.id);
      return NextResponse.json({ purchaseOrder });
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
