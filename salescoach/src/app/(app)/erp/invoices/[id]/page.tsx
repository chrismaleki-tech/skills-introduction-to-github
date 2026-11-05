import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, PageHeader, StatusPill, fmtDate, fmtDateTime } from "@/components/ui";
import { InvoiceActions } from "@/components/erp/forms";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  const manager = isManagerRole(user.role);
  const invoice = await db.invoice.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      lines: { include: { product: true }, orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { receivedAt: "desc" }, include: { recordedBy: { select: { name: true } } } },
      account: true,
      contact: true,
      deal: true,
      order: true,
      owner: { select: { name: true } },
    },
  });
  if (!invoice || (!manager && invoice.ownerId !== user.id)) notFound();
  const balance = invoice.total - invoice.amountPaid;

  return (
    <div>
      <PageHeader
        title={invoice.number}
        subtitle={`${fmtMoney(invoice.total)} · balance ${fmtMoney(balance)}`}
        actions={
          <InvoiceActions invoiceId={invoice.id} status={invoice.status} balance={balance} />
        }
      />

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card title="Details" className="lg:col-span-2">
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Status</dt>
              <dd className="mt-1">
                <StatusPill status={invoice.status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Due</dt>
              <dd className="mt-1">{invoice.dueAt ? fmtDate(invoice.dueAt) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Order</dt>
              <dd className="mt-1">
                {invoice.order ? (
                  <Link href={`/erp/orders/${invoice.order.id}`} className="text-accent-hover hover:underline">
                    {invoice.order.number}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Deal</dt>
              <dd className="mt-1">
                {invoice.deal ? (
                  <Link href={`/crm/deals/${invoice.deal.id}`} className="text-accent-hover hover:underline">
                    {invoice.deal.name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Account</dt>
              <dd className="mt-1">{invoice.account?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Paid</dt>
              <dd className="mt-1 tabular-nums">{fmtMoney(invoice.amountPaid)}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Totals">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums">{fmtMoney(invoice.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Tax</dt>
              <dd className="tabular-nums">{fmtMoney(invoice.taxAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Paid</dt>
              <dd className="tabular-nums">{fmtMoney(invoice.amountPaid)}</dd>
            </div>
            <div className="flex justify-between font-medium border-t border-line pt-2">
              <dt>Balance</dt>
              <dd className="tabular-nums">{fmtMoney(balance)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Line items">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted uppercase tracking-wider border-b border-line">
                <th className="pb-2">Description</th>
                <th className="pb-2">Qty</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {invoice.lines.map((l) => (
                <tr key={l.id}>
                  <td className="py-2">{l.description}</td>
                  <td className="py-2 tabular-nums">{l.quantity}</td>
                  <td className="py-2 tabular-nums text-right">{fmtMoney(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Payments">
          {invoice.payments.length === 0 ? (
            <p className="text-sm text-muted">No payments recorded.</p>
          ) : (
            <ul className="space-y-3">
              {invoice.payments.map((p) => (
                <li key={p.id} className="text-sm border-l-2 border-line pl-3">
                  <div className="font-medium tabular-nums">{fmtMoney(p.amount)}</div>
                  <div className="text-xs text-muted">
                    {p.method} · {fmtDateTime(p.receivedAt)} · {p.recordedBy?.name ?? "system"}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
