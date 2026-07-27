import { db } from "@/lib/db";
import { backofficeActor } from "@/lib/backoffice";
import { PLANS, PLAN_ORDER, planFor, buildStatement, currentPeriodStart, fmtUsd } from "@/lib/billing";
import { usageSummary } from "@/lib/metering";
import { PageHeader, Card } from "@/components/ui";
import { PlanPicker, BillingEmailForm } from "@/components/backoffice/plan-forms";

export default async function BackofficeBillingPage() {
  const actor = (await backofficeActor())!;
  const orgId = actor.user.orgId;

  const [org, activeSeats, periodUsage] = await Promise.all([
    db.org.findUniqueOrThrow({ where: { id: orgId } }),
    db.user.count({ where: { orgId, disabledAt: null } }),
    usageSummary(orgId, currentPeriodStart()),
  ]);

  const plan = planFor(org.plan);
  const statement = buildStatement({
    plan,
    activeSeats,
    usage: periodUsage,
    periodStart: currentPeriodStart(),
    periodEnd: new Date(),
  });

  return (
    <div>
      <PageHeader
        title="Plan & Billing"
        subtitle="Current statement preview and plan management. Charges are metered from usage events; payment collection (Stripe) is wired out of band."
      />

      <Card title={`Statement preview — ${statement.periodStart.toLocaleDateString()} to today`} className="mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-line">
              <th className="py-2 pr-3 font-medium">Item</th>
              <th className="py-2 pr-3 font-medium">Detail</th>
              <th className="py-2 pr-3 font-medium text-right">Billable qty</th>
              <th className="py-2 pr-3 font-medium text-right">Unit price</th>
              <th className="py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {statement.lines.map((line) => (
              <tr key={line.item} className="border-b border-line/50">
                <td className="py-2 pr-3">{line.item}</td>
                <td className="py-2 pr-3 text-muted text-xs">{line.detail}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{line.quantity}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{fmtUsd(line.unitPrice)}</td>
                <td className="py-2 text-right tabular-nums">{fmtUsd(line.amount)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} className="py-2.5 pr-3 text-right font-medium">
                Month-to-date total
              </td>
              <td className="py-2.5 text-right font-semibold tabular-nums">{fmtUsd(statement.total)}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card title="Plan" className="mb-4">
        <PlanPicker
          plans={PLAN_ORDER.map((id) => ({
            id,
            name: PLANS[id].name,
            blurb: PLANS[id].blurb,
            seatLimit: PLANS[id].seatLimit,
            seatPriceMonthly: PLANS[id].seatPriceMonthly,
          }))}
          currentPlan={plan.id}
        />
      </Card>

      <Card title="Billing contact">
        <p className="text-xs text-muted mb-3">
          Statements and dunning notices go here. Leave empty to use the org admin&apos;s email.
        </p>
        <BillingEmailForm billingEmail={org.billingEmail} />
      </Card>
    </div>
  );
}
