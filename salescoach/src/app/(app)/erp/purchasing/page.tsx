import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader, StatusPill, fmtDate } from "@/components/ui";
import { NewPoForm, NewVendorForm, PoActions } from "@/components/erp/forms";

export default async function PurchasingPage() {
  const user = await currentUser();
  if (!isManagerRole(user.role)) notFound();

  const [vendors, purchaseOrders, products] = await Promise.all([
    db.vendor.findMany({ where: { orgId: user.orgId }, orderBy: { name: "asc" } }),
    db.purchaseOrder.findMany({
      where: { orgId: user.orgId },
      include: { vendor: true, lines: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.product.findMany({
      where: { orgId: user.orgId, active: true },
      select: { id: true, name: true, sku: true, listPrice: true, unit: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Purchasing"
        subtitle="Vendors and purchase orders for inventory replenishment — receive stock into the catalog."
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

      <Card title="Purchase orders">
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
                    {po.lines.length} lines · {fmtDate(po.orderedAt)} · {fmtMoney(po.total)}
                  </div>
                  <div className="mt-2">
                    <StatusPill status={po.status} />
                  </div>
                </div>
                <PoActions poId={po.id} status={po.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
