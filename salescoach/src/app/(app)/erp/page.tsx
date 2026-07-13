import Link from "next/link";
import { db } from "@/lib/db";
import { financeSnapshot } from "@/lib/erp";
import { fmtMoney } from "@/lib/crm";
import { currentUser } from "@/lib/session";
import { Card, LinkButton, PageHeader, Stat } from "@/components/ui";

export default async function ErpHubPage() {
  const user = await currentUser();
  const snap = await financeSnapshot(user.orgId);
  const recentQuotes = await db.quote.findMany({
    where: { orgId: user.orgId },
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: { account: { select: { name: true } }, deal: { select: { name: true } } },
  });
  const recentOrders = await db.salesOrder.findMany({
    where: { orgId: user.orgId },
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: { account: { select: { name: true } } },
  });

  const modules = [
    { href: "/erp/catalog", label: "Catalog", hint: "SKUs, pricing, active products" },
    { href: "/erp/quotes", label: "Quotes", hint: "Proposal documents tied to deals" },
    { href: "/erp/orders", label: "Orders", hint: "Accepted quotes → fulfillment" },
    { href: "/erp/invoices", label: "Invoices", hint: "AR, payments, cash collection" },
    { href: "/erp/inventory", label: "Inventory", hint: "On-hand, reserved, reorder" },
    { href: "/erp/purchasing", label: "Purchasing", hint: "Vendors and replenishment POs" },
    { href: "/erp/finance", label: "Finance", hint: "Revenue and receivables snapshot" },
  ];

  return (
    <div>
      <PageHeader
        title="ERP"
        subtitle="Sales-ops ERP inside SalesCoach — catalog through cash, linked to CRM deals and coaching scorecards."
        actions={<LinkButton href="/erp/quotes">New quote</LinkButton>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <Stat label="Open quotes" value={snap.openQuoteCount} sub={fmtMoney(snap.openQuoteValue)} />
        <Stat label="Open orders" value={snap.openOrderCount} sub={fmtMoney(snap.openOrderValue)} />
        <Stat label="AR balance" value={fmtMoney(snap.arBalance)} sub={`${snap.arCount} open invoices`} />
        <Stat label="Cash collected" value={fmtMoney(snap.revenue)} sub={`${snap.products} active products`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-xl border border-line bg-surface p-4 hover:border-accent/40 transition-colors"
          >
            <div className="font-medium">{m.label}</div>
            <div className="text-sm text-muted mt-1">{m.hint}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Recent quotes">
          <ul className="divide-y divide-line">
            {recentQuotes.map((q) => (
              <li key={q.id}>
                <Link href={`/erp/quotes/${q.id}`} className="flex justify-between gap-3 py-2.5 text-sm hover:text-accent-hover">
                  <span>
                    {q.number} · {q.title || q.deal?.name || "Quote"}
                    <span className="block text-xs text-muted">{q.account?.name ?? "No account"}</span>
                  </span>
                  <span className="tabular-nums text-muted">{fmtMoney(q.total)}</span>
                </Link>
              </li>
            ))}
            {recentQuotes.length === 0 && <li className="text-sm text-muted py-4">No quotes yet.</li>}
          </ul>
        </Card>
        <Card title="Recent orders">
          <ul className="divide-y divide-line">
            {recentOrders.map((o) => (
              <li key={o.id}>
                <Link href={`/erp/orders/${o.id}`} className="flex justify-between gap-3 py-2.5 text-sm hover:text-accent-hover">
                  <span>
                    {o.number}
                    <span className="block text-xs text-muted">{o.account?.name ?? "No account"} · {o.status}</span>
                  </span>
                  <span className="tabular-nums text-muted">{fmtMoney(o.total)}</span>
                </Link>
              </li>
            ))}
            {recentOrders.length === 0 && <li className="text-sm text-muted py-4">No orders yet.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
