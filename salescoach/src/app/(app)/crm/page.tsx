import Link from "next/link";
import { db } from "@/lib/db";
import { DEAL_STAGES, fmtMoney, OPEN_STAGES } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { NewDealForm } from "@/components/crm/forms";

export default async function CrmPipelinePage() {
  const user = await currentUser();
  const manager = isManagerRole(user.role);
  const dealWhere = manager ? { orgId: user.orgId } : { orgId: user.orgId, ownerId: user.id };

  const [deals, accounts, contacts, owners] = await Promise.all([
    db.deal.findMany({
      where: dealWhere,
      include: {
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
        _count: { select: { calls: true } },
        activities: {
          where: { type: "COACHING" },
          orderBy: { occurredAt: "desc" },
          take: 1,
          select: { score: true, band: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.account.findMany({
      where: { orgId: user.orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.contact.findMany({
      where: { orgId: user.orgId },
      select: { id: true, name: true, accountId: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { orgId: user.orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const openDeals = deals.filter((d) => OPEN_STAGES.includes(d.stage as (typeof OPEN_STAGES)[number]));
  const pipelineValue = openDeals.reduce((s, d) => s + d.amount, 0);
  const weighted = openDeals.reduce((s, d) => s + (d.amount * d.probability) / 100, 0);
  const coached = deals.filter((d) => d.activities.length > 0).length;

  const byStage = DEAL_STAGES.map((stage) => ({
    ...stage,
    deals: deals.filter((d) => d.stage === stage.key),
  }));

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle="CRM deals connected to SalesCoach — graded calls write coaching scorecards onto each deal timeline."
        actions={<NewDealForm accounts={accounts} contacts={contacts} owners={owners} defaultOwnerId={user.id} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Stat label="Open deals" value={openDeals.length} />
        <Stat label="Pipeline" value={fmtMoney(pipelineValue)} />
        <Stat label="Weighted" value={fmtMoney(Math.round(weighted))} sub="× probability" />
        <Stat label="With coaching" value={coached} sub="deals with a graded call" />
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {byStage.map((col) => (
          <div key={col.key} className="w-64 shrink-0">
            <div className="flex items-center justify-between mb-2 px-1">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted">{col.label}</h2>
              <span className="text-xs text-muted tabular-nums">
                {col.deals.length}
                {col.deals.length > 0 && (
                  <span className="ml-1 opacity-70">
                    · {fmtMoney(col.deals.reduce((s, d) => s + d.amount, 0))}
                  </span>
                )}
              </span>
            </div>
            <div className="space-y-2 min-h-[120px] rounded-xl bg-surface-2/40 border border-line/60 p-2">
              {col.deals.length === 0 && (
                <p className="text-[11px] text-muted px-2 py-6 text-center">Empty</p>
              )}
              {col.deals.map((deal) => {
                const lastScore = deal.activities[0]?.score;
                return (
                  <Link
                    key={deal.id}
                    href={`/crm/deals/${deal.id}`}
                    className="block rounded-lg border border-line bg-surface p-3 hover:border-accent/40 transition-colors"
                  >
                    <div className="text-sm font-medium leading-snug">{deal.name}</div>
                    <div className="text-xs text-muted mt-1">
                      {deal.account?.name ?? "No account"}
                      {deal.owner ? ` · ${deal.owner.name}` : ""}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm tabular-nums font-medium">{fmtMoney(deal.amount)}</span>
                      {lastScore != null ? (
                        <span className="text-[11px] rounded-md border border-accent/30 bg-accent/10 text-accent-hover px-1.5 py-0.5 tabular-nums">
                          Coach {lastScore}
                        </span>
                      ) : deal._count.calls > 0 ? (
                        <span className="text-[11px] text-muted">{deal._count.calls} calls</span>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {deals.length === 0 && (
        <Card className="mt-4">
          <EmptyState
            title="No deals yet"
            hint="Create a deal to start the pipeline. Link SalesCoach calls to write coaching scorecards back here."
          />
        </Card>
      )}
    </div>
  );
}
