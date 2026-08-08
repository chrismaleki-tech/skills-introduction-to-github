import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader, Card, Stat, EmptyState } from "@/components/ui";
import { planFor, buildStatement, currentPeriodStart, monthlyRunRate, fmtUsd } from "@/lib/billing";
import { usageSummary } from "@/lib/metering";

/**
 * Cross-tenant billing engine view: every paying customer's edition, seats,
 * committed MRR, and month-to-date metered charges in one place. Vendor and
 * sandbox workspaces are excluded — they don't bill.
 */
export default async function AdminBillingPage() {
  const orgs = await db.org.findMany({
    where: { kind: "customer" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, plan: true },
  });

  const periodStart = currentPeriodStart();
  const rows = await Promise.all(
    orgs.map(async (org) => {
      const plan = planFor(org.plan);
      const [activeSeats, usage] = await Promise.all([
        db.user.count({ where: { orgId: org.id, disabledAt: null } }),
        usageSummary(org.id, periodStart),
      ]);
      const statement = buildStatement({
        plan,
        activeSeats,
        usage,
        periodStart,
        periodEnd: new Date(),
      });
      return {
        id: org.id,
        name: org.name,
        plan,
        activeSeats,
        mrr: monthlyRunRate(plan, activeSeats),
        monthToDate: statement.total,
      };
    }),
  );

  const totalMrr = rows.reduce((sum, row) => sum + row.mrr, 0);
  const totalMtd = rows.reduce((sum, row) => sum + row.monthToDate, 0);
  const totalSeats = rows.reduce((sum, row) => sum + row.activeSeats, 0);

  return (
    <div>
      <PageHeader
        title="Billing"
        subtitle={`Provisioning & billing engine across all customers — statement period since ${periodStart.toLocaleDateString()}. Payment collection (Stripe) stays out of band.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <Stat label="Paying customers" value={String(rows.length)} sub="vendor & sandboxes excluded" />
        </Card>
        <Card>
          <Stat label="Committed MRR" value={fmtUsd(totalMrr)} sub="seat revenue at current editions" />
        </Card>
        <Card>
          <Stat label="Month-to-date billed" value={fmtUsd(totalMtd)} sub="seats + metered overage" />
        </Card>
        <Card>
          <Stat label="Active seats" value={String(totalSeats)} sub="across all customers" />
        </Card>
      </div>

      <Card title="Customers">
        {rows.length === 0 ? (
          <EmptyState title="No paying customers yet" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted uppercase tracking-wider border-b border-line">
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium">Edition</th>
                <th className="pb-2 font-medium text-right">Active seats</th>
                <th className="pb-2 font-medium text-right">Committed MRR</th>
                <th className="pb-2 font-medium text-right">Month-to-date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="py-2.5">
                    <Link href={`/admin/orgs/${row.id}`} className="font-medium text-accent-hover hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="py-2.5 text-muted">{row.plan.name}</td>
                  <td className="py-2.5 text-right tabular-nums">
                    {row.activeSeats}
                    {row.plan.seatLimit != null && <span className="text-muted"> / {row.plan.seatLimit}</span>}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{fmtUsd(row.mrr)}</td>
                  <td className="py-2.5 text-right tabular-nums">{fmtUsd(row.monthToDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
