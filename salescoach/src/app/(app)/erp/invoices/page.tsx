import Link from "next/link";
import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader, StatusPill, fmtDate } from "@/components/ui";

export default async function InvoicesPage() {
  const user = await currentUser();
  const manager = isManagerRole(user.role);
  const where = manager ? { orgId: user.orgId } : { orgId: user.orgId, ownerId: user.id };
  const invoices = await db.invoice.findMany({
    where,
    include: {
      account: { select: { name: true } },
      deal: { select: { name: true } },
      order: { select: { number: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Accounts receivable — send invoices from fulfilled/confirmed orders and record payments."
      />
      <Card>
        {invoices.length === 0 ? (
          <EmptyState title="No invoices yet" hint="Open a sales order and click Create invoice." />
        ) : (
          <ul className="divide-y divide-line">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/erp/invoices/${inv.id}`}
                  className="flex flex-wrap items-center gap-3 py-3 hover:bg-surface-2/40 rounded-lg px-1"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{inv.number}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {inv.account?.name ?? "No account"} · {inv.order?.number ?? "No order"} · due{" "}
                      {inv.dueAt ? fmtDate(inv.dueAt) : "—"}
                    </div>
                  </div>
                  <StatusPill status={inv.status} />
                  <span className="text-xs text-muted tabular-nums">
                    paid {fmtMoney(inv.amountPaid)}
                  </span>
                  <span className="tabular-nums text-sm">{fmtMoney(inv.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
