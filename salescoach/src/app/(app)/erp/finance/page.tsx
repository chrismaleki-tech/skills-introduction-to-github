import Link from "next/link";
import { db } from "@/lib/db";
import { financeSnapshot } from "@/lib/erp";
import { fmtMoney } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, LinkButton, PageHeader, Stat, StatusPill, fmtDate } from "@/components/ui";

export default async function FinancePage() {
  const user = await currentUser();
  const snap = await financeSnapshot(user.orgId);
  const manager = isManagerRole(user.role);

  const invoices = await db.invoice.findMany({
    where: { orgId: user.orgId, status: { in: ["sent", "partial", "paid"] } },
    include: { account: { select: { name: true } } },
    orderBy: { issuedAt: "desc" },
    take: 12,
  });
  const payments = await db.payment.findMany({
    where: { orgId: user.orgId },
    include: { invoice: { select: { number: true } }, recordedBy: { select: { name: true } } },
    orderBy: { receivedAt: "desc" },
    take: 12,
  });

  return (
    <div>
      <PageHeader
        title="Finance"
        subtitle="Cash collected, open receivables, booked orders — plus GL posting on invoices and payments."
        actions={<LinkButton href="/erp/ledger">Open ledger</LinkButton>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <Stat label="Revenue collected" value={fmtMoney(snap.revenue)} />
        <Stat label="AR outstanding" value={fmtMoney(snap.arBalance)} sub={`${snap.arCount} invoices`} />
        <Stat label="Open order book" value={fmtMoney(snap.openOrderValue)} sub={`${snap.openOrderCount} orders`} />
        <Stat label="Open quotes" value={fmtMoney(snap.openQuoteValue)} sub={`${snap.openQuoteCount} quotes`} />
      </div>

      {snap.lowStockCount > 0 && manager && (
        <Card title="Inventory alerts" className="mb-6">
          <ul className="text-sm space-y-2">
            {snap.lowStock.map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span>
                  {p.name} <span className="font-mono text-xs text-muted">{p.sku}</span>
                </span>
                <span className="text-amber-300 tabular-nums">
                  avail {p.qtyOnHand - p.qtyReserved} / reorder {p.reorderPoint}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/erp/purchasing" className="text-sm text-accent-hover hover:underline mt-3 inline-block">
            Replenish via purchasing →
          </Link>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Recent invoices">
          <ul className="divide-y divide-line">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <Link href={`/erp/invoices/${inv.id}`} className="flex items-center gap-3 py-2.5 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{inv.number}</div>
                    <div className="text-xs text-muted">
                      {inv.account?.name ?? "—"} · {fmtDate(inv.issuedAt)}
                    </div>
                  </div>
                  <StatusPill status={inv.status} />
                  <span className="tabular-nums">{fmtMoney(inv.total - inv.amountPaid)}</span>
                </Link>
              </li>
            ))}
            {invoices.length === 0 && <li className="text-sm text-muted py-4">No invoices yet.</li>}
          </ul>
        </Card>
        <Card title="Recent payments">
          <ul className="divide-y divide-line text-sm">
            {payments.map((p) => (
              <li key={p.id} className="py-2.5 flex justify-between gap-3">
                <div>
                  <div className="font-medium tabular-nums">{fmtMoney(p.amount)}</div>
                  <div className="text-xs text-muted">
                    {p.invoice.number} · {p.method} · {fmtDate(p.receivedAt)}
                  </div>
                </div>
                <span className="text-xs text-muted">{p.recordedBy?.name}</span>
              </li>
            ))}
            {payments.length === 0 && <li className="text-muted py-4">No payments yet.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
