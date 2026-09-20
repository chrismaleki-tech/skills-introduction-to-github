import { db } from "@/lib/db";
import { fmtMoney, OPEN_STAGES } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { NewDealForm } from "@/components/crm/forms";
import { PipelineBoard } from "@/components/crm/pipeline-board";

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

  const boardDeals = deals.map((d) => ({
    id: d.id,
    name: d.name,
    stage: d.stage,
    amount: d.amount,
    accountName: d.account?.name,
    ownerName: d.owner?.name,
    coachScore: d.activities[0]?.score ?? null,
    callCount: d._count.calls,
  }));

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle="Drag deals across stages. Graded calls write coaching scorecards onto each deal timeline."
        actions={<NewDealForm accounts={accounts} contacts={contacts} owners={owners} defaultOwnerId={user.id} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Stat label="Open deals" value={openDeals.length} />
        <Stat label="Pipeline" value={fmtMoney(pipelineValue)} />
        <Stat label="Weighted" value={fmtMoney(Math.round(weighted))} sub="× probability" />
        <Stat label="With coaching" value={coached} sub="deals with a graded call" />
      </div>

      <PipelineBoard initialDeals={boardDeals} />

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
