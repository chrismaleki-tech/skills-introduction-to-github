import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, PageHeader, StatusPill, fmtDate } from "@/components/ui";
import { OrderActions } from "@/components/erp/forms";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  const manager = isManagerRole(user.role);
  const order = await db.salesOrder.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      lines: { include: { product: true }, orderBy: { sortOrder: "asc" } },
      account: true,
      contact: true,
      deal: true,
      quote: true,
      invoices: true,
      owner: { select: { name: true } },
    },
  });
  if (!order || (!manager && order.ownerId !== user.id)) notFound();

  return (
    <div>
      <PageHeader
        title={order.number}
        subtitle={`${fmtMoney(order.total)} · ordered ${fmtDate(order.orderedAt)}`}
        actions={
          <OrderActions orderId={order.id} status={order.status} hasInvoice={order.invoices.length > 0} />
        }
      />

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card title="Details" className="lg:col-span-2">
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Status</dt>
              <dd className="mt-1">
                <StatusPill status={order.status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Quote</dt>
              <dd className="mt-1">
                {order.quote ? (
                  <Link href={`/erp/quotes/${order.quote.id}`} className="text-accent-hover hover:underline">
                    {order.quote.number}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Deal</dt>
              <dd className="mt-1">
                {order.deal ? (
                  <Link href={`/crm/deals/${order.deal.id}`} className="text-accent-hover hover:underline">
                    {order.deal.name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Account</dt>
              <dd className="mt-1">{order.account?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Invoices</dt>
              <dd className="mt-1 space-y-1">
                {order.invoices.length === 0
                  ? "—"
                  : order.invoices.map((inv) => (
                      <Link key={inv.id} href={`/erp/invoices/${inv.id}`} className="text-accent-hover hover:underline block">
                        {inv.number} ({inv.status})
                      </Link>
                    ))}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Fulfilled</dt>
              <dd className="mt-1">{order.fulfilledAt ? fmtDate(order.fulfilledAt) : "—"}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Totals">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums">{fmtMoney(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Tax</dt>
              <dd className="tabular-nums">{fmtMoney(order.taxAmount)}</dd>
            </div>
            <div className="flex justify-between font-medium border-t border-line pt-2">
              <dt>Total</dt>
              <dd className="tabular-nums">{fmtMoney(order.total)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card title="Line items">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted uppercase tracking-wider border-b border-line">
              <th className="pb-2">Description</th>
              <th className="pb-2">Qty</th>
              <th className="pb-2">Unit</th>
              <th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {order.lines.map((l) => (
              <tr key={l.id}>
                <td className="py-2">{l.description}</td>
                <td className="py-2 tabular-nums">{l.quantity}</td>
                <td className="py-2 tabular-nums">{fmtMoney(l.unitPrice)}</td>
                <td className="py-2 tabular-nums text-right">{fmtMoney(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
