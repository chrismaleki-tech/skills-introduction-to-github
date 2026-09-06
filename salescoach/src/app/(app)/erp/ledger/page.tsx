import Link from "next/link";
import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/crm";
import { ensureChartOfAccounts, glTrialBalance } from "@/lib/erp-deep";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, LinkButton, PageHeader, Stat, fmtDate } from "@/components/ui";

export default async function LedgerPage() {
  const user = await currentUser();
  await ensureChartOfAccounts(user.orgId);
  const manager = isManagerRole(user.role);

  const [trialBalance, entries, vendorBills] = await Promise.all([
    glTrialBalance(user.orgId),
    db.journalEntry.findMany({
      where: { orgId: user.orgId },
      include: {
        lines: { include: { account: true } },
        postedBy: { select: { name: true } },
      },
      orderBy: { postedAt: "desc" },
      take: 25,
    }),
    db.vendorBill.findMany({
      where: { orgId: user.orgId },
      include: { vendor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const debits = trialBalance.reduce((s, a) => s + a.debit, 0);
  const credits = trialBalance.reduce((s, a) => s + a.credit, 0);

  return (
    <div>
      <PageHeader
        title="General ledger"
        subtitle="Chart of accounts, journal entries from invoices/payments/bills/payroll, and CSV export."
        actions={
          manager ? (
            <LinkButton href="/api/erp/gl?format=csv">Export CSV</LinkButton>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Stat label="Accounts" value={trialBalance.length} />
        <Stat label="Total debits" value={fmtMoney(debits)} />
        <Stat label="Total credits" value={fmtMoney(credits)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card title="Trial balance">
          <ul className="divide-y divide-line text-sm">
            {trialBalance.map((a) => (
              <li key={a.id} className="py-2 flex justify-between gap-3">
                <span>
                  <span className="font-mono text-xs text-muted">{a.code}</span> {a.name}
                  <span className="block text-xs text-muted">{a.type}</span>
                </span>
                <span className="tabular-nums text-right">
                  <span className="block">{fmtMoney(a.debit)}</span>
                  <span className="block text-xs text-muted">{fmtMoney(a.credit)} cr</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Vendor bills (AP)">
          {vendorBills.length === 0 ? (
            <EmptyState title="No vendor bills" hint="Receive a PO to create a matched bill." />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {vendorBills.map((b) => (
                <li key={b.id} className="py-2 flex justify-between gap-3">
                  <span>
                    {b.number} · {b.vendor.name}
                    <span className="block text-xs text-muted">{b.status}</span>
                  </span>
                  <span className="tabular-nums">{fmtMoney(b.total, b.currency)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/erp/purchasing" className="text-sm text-accent-hover hover:underline mt-3 inline-block">
            Purchasing →
          </Link>
        </Card>
      </div>

      <Card title="Journal entries">
        {entries.length === 0 ? (
          <EmptyState title="No journals yet" hint="Send an invoice or record a payment to post GL." />
        ) : (
          <ul className="divide-y divide-line">
            {entries.map((e) => (
              <li key={e.id} className="py-4">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <div>
                    <div className="font-medium">
                      {e.number} · {e.memo}
                    </div>
                    <div className="text-xs text-muted">
                      {fmtDate(e.postedAt)} · {e.sourceType}
                      {e.postedBy?.name ? ` · ${e.postedBy.name}` : ""}
                    </div>
                  </div>
                </div>
                <ul className="mt-2 text-xs text-muted space-y-1">
                  {e.lines.map((l) => (
                    <li key={l.id} className="flex justify-between gap-3">
                      <span>
                        {l.account.code} {l.account.name}
                      </span>
                      <span className="tabular-nums">
                        {l.debit > 0 ? `Dr ${fmtMoney(l.debit)}` : `Cr ${fmtMoney(l.credit)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
