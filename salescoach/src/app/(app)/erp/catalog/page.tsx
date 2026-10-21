import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { NewProductForm } from "@/components/erp/forms";

export default async function CatalogPage() {
  const user = await currentUser();
  const manager = isManagerRole(user.role);
  const products = await db.product.findMany({
    where: { orgId: user.orgId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="Product catalog"
        subtitle="SKUs that feed quotes, orders, inventory, and the company profile used in coaching."
        actions={manager ? <NewProductForm /> : undefined}
      />
      <Card>
        {products.length === 0 ? (
          <EmptyState title="No products yet" hint="Add Meridian Core / Forecast SKUs to start quoting." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted uppercase tracking-wider border-b border-line">
                  <th className="pb-2 pr-3">SKU</th>
                  <th className="pb-2 pr-3">Product</th>
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 pr-3">Price</th>
                  <th className="pb-2 pr-3">Stock</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 pr-3 font-mono text-xs">{p.sku}</td>
                    <td className="py-3 pr-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted line-clamp-1">{p.description}</div>
                    </td>
                    <td className="py-3 pr-3 text-muted">{p.category}</td>
                    <td className="py-3 pr-3 tabular-nums">
                      {fmtMoney(p.listPrice)}
                      <span className="text-xs text-muted"> / {p.unit}</span>
                    </td>
                    <td className="py-3 pr-3 tabular-nums text-muted">
                      {p.trackInventory ? `${p.qtyOnHand} (${p.qtyReserved} reserved)` : "—"}
                    </td>
                    <td className="py-3">
                      <StatusPill status={p.active ? "ACTIVE" : "SKIPPED"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
