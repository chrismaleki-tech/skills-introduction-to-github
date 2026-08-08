import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import { parseCustomization, industryConfigOf } from "@/lib/customization";
import { isClosedStage } from "@/lib/industry";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { NewDealForm } from "@/components/crm/forms";
import { PipelineBoard } from "@/components/crm/pipeline-board";

export default async function CrmPipelinePage() {
  const user = await currentUser();
  const manager = isManagerRole(user.role);
  const industry = industryConfigOf(parseCustomization(user.org.customizationJson));
  const t = industry.terms;
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

  const openDeals = deals.filter((d) => !isClosedStage(d.stage));
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
        title={t.pipeline}
        subtitle={`Drag ${t.deals.toLowerCase()} across stages. Graded calls write coaching scorecards onto each ${t.deal.toLowerCase()} timeline.`}
        actions={
          <NewDealForm
            accounts={accounts}
            contacts={contacts}
            owners={owners}
            defaultOwnerId={user.id}
            stages={industry.stages}
            dealNoun={t.deal}
            accountNoun={t.account}
            contactNoun={t.contact}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Stat label={`Open ${t.deals.toLowerCase()}`} value={openDeals.length} />
        <Stat label="Pipeline value" value={fmtMoney(pipelineValue)} />
        <Stat label="Weighted" value={fmtMoney(Math.round(weighted))} sub="× probability" />
        <Stat label="With coaching" value={coached} sub={`${t.deals.toLowerCase()} with a graded call`} />
      </div>

      <PipelineBoard initialDeals={boardDeals} stages={industry.stages} />

      {deals.length === 0 && (
        <Card className="mt-4">
          <EmptyState
            title={`No ${t.deals.toLowerCase()} yet`}
            hint={`Create a ${t.deal.toLowerCase()} to start the ${t.pipeline.toLowerCase()}. Link SalesCoach calls to write coaching scorecards back here.`}
          />
        </Card>
      )}
    </div>
  );
}
