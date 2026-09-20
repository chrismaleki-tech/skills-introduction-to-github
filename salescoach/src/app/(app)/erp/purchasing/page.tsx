import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader, StatusPill, fmtDate } from "@/components/ui";
import { NewPoForm, NewVendorForm } from "@/components/erp/forms";
import { PoActions } from "@/components/erp/po-actions";

export default async function PurchasingPage() {
  const user = await currentUser();
  if (!isManagerRole(user.role)) notFound();

  const [vendors, purchaseOrders, products, vendorBills, receipts] = await Promise.all([
    db.vendor.findMany({ where: { orgId: user.orgId }, orderBy: { name: "asc" } }),
    db.purchaseOrder.findMany({
      where: { orgId: user.orgId },
      include: { vendor: true, lines: true, warehouse: { select: { code: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.product.findMany({
      where: { orgId: user.orgId, active: true },
      select: { id: true, name: true, sku: true, listPrice: true, unit: true },
      orderBy: { name: "asc" },
    }),
    db.vendorBill.findMany({
      where: { orgId: user.orgId },
      include: { vendor: true, purchaseOrder: { select: { number: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.goodsReceipt.findMany({
      where: { orgId: user.orgId },
      include: {
        warehouse: { select: { code: true } },
        purchaseOrder: { select: { number: true } },
        lines: true,
      },
      orderBy: { receivedAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Purchasing"
        subtitle="Vendors, PO approval, partial receives into warehouses, and matched vendor bills."
      />

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card title="Vendors">
          <div className="mb-4">
            <NewVendorForm />
          </div>
          {vendors.length === 0 ? (
            <EmptyState title="No vendors" />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {vendors.map((v) => (
                <li key={v.id} className="py-2">
                  <div className="font-medium">{v.name}</div>
                  <div className="text-xs text-muted">{[v.email, v.phone].filter(Boolean).join(" · ") || "No contact"}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="New purchase order">
          <NewPoForm vendors={vendors.map((v) => ({ id: v.id, name: v.name }))} products={products} />
        </Card>
      </div>

      <Card title="Purchase orders" className="mb-8">
        {purchaseOrders.length === 0 ? (
          <EmptyState title="No POs yet" />
        ) : (
          <ul className="divide-y divide-line">
            {purchaseOrders.map((po) => (
              <li key={po.id} className="py-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-medium">
                    {po.number} · {po.vendor.name}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {po.lines.length} lines · {fmtDate(po.orderedAt)} · {fmtMoney(po.total, po.currency)}
                    {po.warehouse ? ` · ${po.warehouse.code}` : ""}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {po.lines
                      .map((l) => `${l.qtyReceived}/${l.quantity} received`)
                      .join(" · ")}
                  </div>
                  <div className="mt-2">
                    <StatusPill status={po.status} />
                  </div>
                </div>
                <PoActions
                  poId={po.id}
                  status={po.status}
                  lines={po.lines.map((l) => ({
                    productId: l.productId,
                    description: l.description,
                    quantity: l.quantity,
                    qtyReceived: l.qtyReceived,
                  }))}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Goods receipts">
          {receipts.length === 0 ? (
            <EmptyState title="No receipts" />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {receipts.map((r) => (
                <li key={r.id} className="py-2 flex justify-between gap-3">
                  <span>
                    {r.number} · {r.purchaseOrder.number}
                    <span className="block text-xs text-muted">
                      {r.warehouse.code} · {r.lines.reduce((s, l) => s + l.quantity, 0)} units
                    </span>
                  </span>
                  <StatusPill status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Vendor bills">
          {vendorBills.length === 0 ? (
            <EmptyState title="No bills" />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {vendorBills.map((b) => (
                <li key={b.id} className="py-2 flex justify-between gap-3">
                  <span>
                    {b.number} · {b.vendor.name}
                    <span className="block text-xs text-muted">
                      {b.purchaseOrder?.number ?? "No PO"} · {b.status}
                    </span>
                  </span>
                  <span className="tabular-nums">{fmtMoney(b.total, b.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
