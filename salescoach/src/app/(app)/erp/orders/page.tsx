import Link from "next/link";
import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader, StatusPill, fmtDate } from "@/components/ui";

export default async function OrdersPage() {
  const user = await currentUser();
  const manager = isManagerRole(user.role);
  const where = manager ? { orgId: user.orgId } : { orgId: user.orgId, ownerId: user.id };
  const orders = await db.salesOrder.findMany({
    where,
    include: {
      account: { select: { name: true } },
      deal: { select: { id: true, name: true } },
      quote: { select: { id: true, number: true } },
      owner: { select: { name: true } },
      _count: { select: { invoices: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Sales orders"
        subtitle="Confirmed commercial commitments. Confirm to close-won the CRM deal; invoice to start AR."
      />
      <Card>
        {orders.length === 0 ? (
          <EmptyState title="No orders yet" hint="Accept a quote to create the first sales order." />
        ) : (
          <ul className="divide-y divide-line">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/erp/orders/${o.id}`}
                  className="flex flex-wrap items-center gap-3 py-3 hover:bg-surface-2/40 rounded-lg px-1"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{o.number}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {o.deal?.name ?? "No deal"} · {o.account?.name ?? "No account"}
                      {o.quote ? ` · from ${o.quote.number}` : ""} · {fmtDate(o.orderedAt)}
                    </div>
                  </div>
                  <StatusPill status={o.status} />
                  <span className="text-xs text-muted">{o._count.invoices} inv</span>
                  <span className="tabular-nums text-sm">{fmtMoney(o.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
