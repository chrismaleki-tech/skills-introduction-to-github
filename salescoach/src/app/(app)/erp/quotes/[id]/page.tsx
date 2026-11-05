import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, PageHeader, StatusPill, fmtDate } from "@/components/ui";
import { QuoteActions } from "@/components/erp/forms";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  const manager = isManagerRole(user.role);

  const quote = await db.quote.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      lines: { include: { product: true }, orderBy: { sortOrder: "asc" } },
      account: true,
      contact: true,
      deal: true,
      owner: { select: { name: true } },
      orders: { select: { id: true, number: true, status: true } },
    },
  });
  if (!quote || (!manager && quote.ownerId !== user.id)) notFound();

  return (
    <div>
      <PageHeader
        title={`${quote.number} · ${quote.title || "Quote"}`}
        subtitle={`${fmtMoney(quote.total)} · ${quote.owner?.name ?? "Unassigned"}`}
        actions={<QuoteActions quoteId={quote.id} status={quote.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card title="Details" className="lg:col-span-2">
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Status</dt>
              <dd className="mt-1">
                <StatusPill status={quote.status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Valid until</dt>
              <dd className="mt-1">{quote.validUntil ? fmtDate(quote.validUntil) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Deal</dt>
              <dd className="mt-1">
                {quote.deal ? (
                  <Link href={`/crm/deals/${quote.deal.id}`} className="text-accent-hover hover:underline">
                    {quote.deal.name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Account</dt>
              <dd className="mt-1">
                {quote.account ? (
                  <Link href={`/crm/accounts/${quote.account.id}`} className="text-accent-hover hover:underline">
                    {quote.account.name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Contact</dt>
              <dd className="mt-1">{quote.contact?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Orders</dt>
              <dd className="mt-1">
                {quote.orders.length === 0
                  ? "—"
                  : quote.orders.map((o) => (
                      <Link key={o.id} href={`/erp/orders/${o.id}`} className="text-accent-hover hover:underline block">
                        {o.number} ({o.status})
                      </Link>
                    ))}
              </dd>
            </div>
          </dl>
          {quote.notes && <p className="mt-4 text-sm text-muted border-t border-line pt-4 whitespace-pre-wrap">{quote.notes}</p>}
        </Card>
        <Card title="Totals">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums">{fmtMoney(quote.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Tax ({quote.taxRate}%)</dt>
              <dd className="tabular-nums">{fmtMoney(quote.taxAmount)}</dd>
            </div>
            <div className="flex justify-between font-medium border-t border-line pt-2">
              <dt>Total</dt>
              <dd className="tabular-nums">{fmtMoney(quote.total)}</dd>
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
            {quote.lines.map((l) => (
              <tr key={l.id}>
                <td className="py-2">
                  {l.description}
                  {l.product && <span className="block text-xs text-muted font-mono">{l.product.sku}</span>}
                </td>
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
