import Link from "next/link";
import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader, StatusPill, fmtDate } from "@/components/ui";
import { NewQuoteForm } from "@/components/erp/forms";

export default async function QuotesPage() {
  const user = await currentUser();
  const manager = isManagerRole(user.role);
  const where = manager ? { orgId: user.orgId } : { orgId: user.orgId, ownerId: user.id };

  const [quotes, products, deals, accounts] = await Promise.all([
    db.quote.findMany({
      where,
      include: {
        account: { select: { id: true, name: true } },
        deal: { select: { id: true, name: true } },
        owner: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.product.findMany({
      where: { orgId: user.orgId, active: true },
      select: { id: true, name: true, sku: true, listPrice: true, unit: true },
      orderBy: { name: "asc" },
    }),
    db.deal.findMany({
      where: manager ? { orgId: user.orgId } : { orgId: user.orgId, ownerId: user.id },
      select: { id: true, name: true, accountId: true, contactId: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.account.findMany({
      where: { orgId: user.orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Quotes"
        subtitle="Build proposals from the catalog, attach them to CRM deals, then accept to create sales orders."
      />
      <div className="mb-6">
        <NewQuoteForm products={products} deals={deals} accounts={accounts} />
      </div>
      <Card>
        {quotes.length === 0 ? (
          <EmptyState title="No quotes yet" hint="Create a quote from a deal in proposal stage." />
        ) : (
          <ul className="divide-y divide-line">
            {quotes.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/erp/quotes/${q.id}`}
                  className="flex flex-wrap items-center gap-3 py-3 hover:bg-surface-2/40 rounded-lg px-1 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {q.number} · {q.title || "Untitled"}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {q.deal?.name ?? "No deal"} · {q.account?.name ?? "No account"} · {q.owner?.name} ·{" "}
                      {fmtDate(q.updatedAt)}
                    </div>
                  </div>
                  <StatusPill status={q.status} />
                  <span className="tabular-nums text-sm">{fmtMoney(q.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
