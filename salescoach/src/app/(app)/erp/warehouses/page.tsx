import { db } from "@/lib/db";
import { ensureDefaultWarehouse } from "@/lib/erp-deep";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader, Stat, StatusPill } from "@/components/ui";
import { NewWarehouseForm, TransferForm } from "@/components/erp/deep-forms";

export default async function WarehousesPage() {
  const user = await currentUser();
  const manager = isManagerRole(user.role);
  await ensureDefaultWarehouse(user.orgId);

  const [warehouses, transfers, products] = await Promise.all([
    db.warehouse.findMany({
      where: { orgId: user.orgId },
      include: {
        bins: true,
        balances: {
          include: { product: { select: { sku: true, name: true } } },
          orderBy: { qtyOnHand: "desc" },
        },
      },
      orderBy: [{ isDefault: "desc" }, { code: "asc" }],
    }),
    db.stockTransfer.findMany({
      where: { orgId: user.orgId },
      include: {
        fromWarehouse: { select: { code: true } },
        toWarehouse: { select: { code: true } },
        lines: { include: { product: { select: { sku: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    db.product.findMany({
      where: { orgId: user.orgId, trackInventory: true, active: true },
      select: { id: true, sku: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const skuLocations = warehouses.reduce((s, w) => s + w.balances.length, 0);

  return (
    <div>
      <PageHeader
        title="Warehouses"
        subtitle="Multi-location inventory with bins and inter-warehouse transfers."
      />
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Stat label="Warehouses" value={warehouses.length} />
        <Stat label="SKU locations" value={skuLocations} />
        <Stat label="Transfers" value={transfers.length} />
      </div>

      {manager && (
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <Card title="Add warehouse">
            <NewWarehouseForm />
          </Card>
          <Card title="Transfer stock">
            <TransferForm
              warehouses={warehouses.map((w) => ({ id: w.id, code: w.code, name: w.name }))}
              products={products}
            />
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {warehouses.map((w) => (
          <Card
            key={w.id}
            title={`${w.code} · ${w.name}${w.isDefault ? " (default)" : ""}`}
          >
            <div className="text-xs text-muted mb-3">
              {[w.address, w.bins.map((b) => b.code).join(", ")].filter(Boolean).join(" · ") || "No address"}
            </div>
            {w.balances.length === 0 ? (
              <EmptyState title="No balances" />
            ) : (
              <ul className="divide-y divide-line text-sm">
                {w.balances.map((b) => (
                  <li key={b.id} className="py-2 flex justify-between gap-3">
                    <span>
                      {b.product.name}{" "}
                      <span className="font-mono text-xs text-muted">{b.product.sku}</span>
                    </span>
                    <span className="tabular-nums text-muted">
                      {b.qtyOnHand} on hand · {b.qtyReserved} reserved
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      <Card title="Recent transfers">
        {transfers.length === 0 ? (
          <EmptyState title="No transfers yet" />
        ) : (
          <ul className="divide-y divide-line text-sm">
            {transfers.map((t) => (
              <li key={t.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {t.number} · {t.fromWarehouse.code} → {t.toWarehouse.code}
                  </div>
                  <div className="text-xs text-muted">
                    {t.lines.map((l) => `${l.product.sku}×${l.quantity}`).join(", ")}
                  </div>
                </div>
                <StatusPill status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
