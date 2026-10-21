import Link from "next/link";
import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { AdjustStockForm } from "@/components/erp/forms";

export default async function InventoryPage() {
  const user = await currentUser();
  const manager = isManagerRole(user.role);
  const [products, balances, warehouses] = await Promise.all([
    db.product.findMany({
      where: { orgId: user.orgId, trackInventory: true },
      orderBy: { name: "asc" },
    }),
    db.inventoryBalance.findMany({
      where: { orgId: user.orgId },
      include: {
        warehouse: { select: { code: true, name: true } },
        product: { select: { id: true } },
      },
    }),
    db.warehouse.count({ where: { orgId: user.orgId, active: true } }),
  ]);
  const low = products.filter((p) => p.qtyOnHand - p.qtyReserved <= p.reorderPoint);
  const onHandValue = products.reduce((s, p) => s + p.qtyOnHand * p.cost, 0);
  const byProduct = balances.reduce<Record<string, typeof balances>>((acc, b) => {
    (acc[b.productId] ||= []).push(b);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="On-hand and reserved stock across warehouses. Sales orders reserve; fulfillment decrements; POs replenish."
        actions={
          <Link href="/erp/warehouses" className="text-sm text-accent-hover hover:underline">
            Warehouses →
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <Stat label="Tracked SKUs" value={products.length} />
        <Stat label="Warehouses" value={warehouses} />
        <Stat label="Low stock" value={low.length} sub="At or below reorder point" />
        <Stat label="Inventory cost" value={fmtMoney(onHandValue)} />
      </div>
      <Card>
        {products.length === 0 ? (
          <EmptyState title="No tracked inventory" hint="Enable Track inventory on a catalog product." />
        ) : (
          <ul className="divide-y divide-line">
            {products.map((p) => {
              const available = p.qtyOnHand - p.qtyReserved;
              const isLow = available <= p.reorderPoint;
              const locs = byProduct[p.id] ?? [];
              return (
                <li key={p.id} className="py-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {p.name}{" "}
                        <span className="font-mono text-xs text-muted">{p.sku}</span>
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        On hand {p.qtyOnHand} · reserved {p.qtyReserved} · available {available}
                        {isLow ? " · needs reorder" : ""}
                      </div>
                      {locs.length > 0 && (
                        <div className="text-xs text-muted mt-1">
                          {locs
                            .map((l) => `${l.warehouse.code}: ${l.qtyOnHand}`)
                            .join(" · ")}
                        </div>
                      )}
                    </div>
                    <div className="text-sm tabular-nums text-muted">cost {fmtMoney(p.cost)}</div>
                  </div>
                  {manager && (
                    <AdjustStockForm productId={p.id} qtyOnHand={p.qtyOnHand} reorderPoint={p.reorderPoint} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
