import Link from "next/link";
import { db } from "@/lib/db";
import { backofficeActor } from "@/lib/backoffice";
import { planFor, buildStatement, currentPeriodStart, fmtUsd } from "@/lib/billing";
import { usageSummary } from "@/lib/metering";
import { PageHeader, Card, Stat, fmtDateTime } from "@/components/ui";

export default async function BackofficeOverviewPage() {
  const actor = (await backofficeActor())!;
  const orgId = actor.user.orgId;

  const [org, activeSeats, deactivatedSeats, periodUsage, recentAudit] = await Promise.all([
    db.org.findUniqueOrThrow({ where: { id: orgId } }),
    db.user.count({ where: { orgId, disabledAt: null } }),
    db.user.count({ where: { orgId, disabledAt: { not: null } } }),
    usageSummary(orgId, currentPeriodStart()),
    db.auditEvent.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const plan = planFor(org.plan);
  const statement = buildStatement({
    plan,
    activeSeats,
    usage: periodUsage,
    periodStart: currentPeriodStart(),
    periodEnd: new Date(),
  });
  const gradedThisPeriod = periodUsage
    .filter((row) => ["CALL_GRADED", "ROLEPLAY_GRADED", "EMAIL_GRADED"].includes(row.type))
    .reduce((sum, row) => sum + row.count, 0);

  return (
    <div>
      <PageHeader
        title={`${org.name} — Back Office`}
        subtitle="Run the business side of the workspace: seats, plan, spend, audit history, and data exports."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <Stat
            label="Active seats"
            value={plan.seatLimit != null ? `${activeSeats} / ${plan.seatLimit}` : String(activeSeats)}
            sub={deactivatedSeats > 0 ? `${deactivatedSeats} deactivated` : "all seats active"}
          />
        </Card>
        <Card>
          <Stat label="Plan" value={plan.name} sub={`${fmtUsd(plan.seatPriceMonthly)} per seat / month`} />
        </Card>
        <Card>
          <Stat
            label="Month-to-date charges"
            value={fmtUsd(statement.total)}
            sub={`since ${statement.periodStart.toLocaleDateString()}`}
          />
        </Card>
        <Card>
          <Stat label="Graded activities (month)" value={String(gradedThisPeriod)} sub="calls, role-plays, emails" />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Where things live" >
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/backoffice/team" className="text-accent-hover hover:underline">Team</Link>
              <span className="text-muted"> — invite seats, change roles, reset passwords, deactivate leavers.</span>
            </li>
            <li>
              <Link href="/backoffice/billing" className="text-accent-hover hover:underline">Plan &amp; Billing</Link>
              <span className="text-muted"> — current statement preview, plan changes, billing contact.</span>
            </li>
            <li>
              <Link href="/backoffice/audit" className="text-accent-hover hover:underline">Audit</Link>
              <span className="text-muted"> — every administrative action in this org, including vendor staff access.</span>
            </li>
            <li>
              <Link href="/backoffice/exports" className="text-accent-hover hover:underline">Exports</Link>
              <span className="text-muted"> — CSV downloads of your business data. Exports are audited.</span>
            </li>
            <li>
              <Link href="/settings" className="text-accent-hover hover:underline">Settings</Link>
              <span className="text-muted"> — operational knobs: ingestion policy, retention, webhooks.</span>
            </li>
          </ul>
        </Card>

        <Card title="Recent administrative activity" action={<Link href="/backoffice/audit" className="text-xs text-accent-hover hover:underline">View all</Link>}>
          {recentAudit.length === 0 ? (
            <p className="text-sm text-muted">No administrative actions recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentAudit.map((event) => (
                <li key={event.id} className="text-sm flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{event.action.replaceAll("_", " ")}</span>
                  <span className="text-xs text-muted">
                    {event.actorEmail} · {fmtDateTime(event.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
