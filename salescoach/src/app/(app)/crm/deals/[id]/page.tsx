import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtMoney, stageLabel } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import {
  BandPill,
  Card,
  EmptyState,
  PageHeader,
  ScoreBadge,
  StatusPill,
  fmtDate,
  fmtDateTime,
} from "@/components/ui";
import { DealStageSelect } from "@/components/crm/forms";
import { LogCallFromDealButton } from "@/components/crm/link-call";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  const manager = isManagerRole(user.role);

  const deal = await db.deal.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      account: true,
      contact: true,
      owner: { select: { id: true, name: true, email: true } },
      calls: {
        include: {
          grade: true,
          rep: { select: { id: true, name: true } },
        },
        orderBy: { callDate: "desc" },
        take: 25,
      },
      activities: {
        include: { owner: { select: { id: true, name: true } } },
        orderBy: { occurredAt: "desc" },
        take: 40,
      },
    },
  });
  if (!deal || (!manager && deal.ownerId !== user.id)) notFound();

  return (
    <div>
      <PageHeader
        title={deal.name}
        subtitle={`${stageLabel(deal.stage)} · ${fmtMoney(deal.amount)} · ${deal.probability}% · ${deal.product || "No product"}`}
        actions={<LogCallFromDealButton dealId={deal.id} callType={deal.stage === "demo" ? "demo" : "discovery"} />}
      />

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card title="Deal" className="lg:col-span-2">
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Stage</dt>
              <dd className="mt-1">
                <DealStageSelect dealId={deal.id} stage={deal.stage} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Owner</dt>
              <dd className="mt-1">{deal.owner?.name ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Account</dt>
              <dd className="mt-1">
                {deal.account ? (
                  <Link href={`/crm/accounts/${deal.account.id}`} className="text-accent-hover hover:underline">
                    {deal.account.name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Contact</dt>
              <dd className="mt-1">
                {deal.contact ? (
                  <>
                    {deal.contact.name}
                    {deal.contact.title ? <span className="text-muted"> · {deal.contact.title}</span> : null}
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Close date</dt>
              <dd className="mt-1">{deal.closeDate ? fmtDate(deal.closeDate) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Next step</dt>
              <dd className="mt-1">{deal.nextStep || "—"}</dd>
            </div>
          </dl>
          {deal.notes && (
            <p className="mt-4 text-sm text-muted border-t border-line pt-4 whitespace-pre-wrap">{deal.notes}</p>
          )}
        </Card>

        <Card title="SalesCoach connection">
          <p className="text-sm text-muted mb-3">
            Calls linked to this deal are graded by SalesCoach. Scorecards write back here as coaching
            activities, and deal stage context grounds the feedback.
          </p>
          <div className="text-sm space-y-1">
            <div>
              Linked calls: <span className="font-medium tabular-nums">{deal.calls.length}</span>
            </div>
            <div>
              Coaching notes:{" "}
              <span className="font-medium tabular-nums">
                {deal.activities.filter((a) => a.type === "COACHING").length}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2 items-start">
        <Card title="Linked calls">
          {deal.calls.length === 0 ? (
            <EmptyState
              title="No linked calls yet"
              hint="Use “Log call → SalesCoach” or link an existing call from the call review page."
            />
          ) : (
            <ul className="divide-y divide-line -mx-1">
              {deal.calls.map((call) => (
                <li key={call.id}>
                  <Link
                    href={`/calls/${call.id}`}
                    className="flex items-center gap-3 px-1 py-3 hover:bg-surface-2/50 rounded-lg transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {call.prospectName || "Call"} · {call.callType.replaceAll("_", " ")}
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        {call.rep.name} · {fmtDateTime(call.callDate)}
                      </div>
                    </div>
                    <StatusPill status={call.status} />
                    {call.grade && <ScoreBadge score={call.grade.overallScore} size="sm" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Timeline">
          {deal.activities.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ul className="space-y-4">
              {deal.activities.map((act) => (
                <li key={act.id} className="border-l-2 border-line pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-muted">{act.type}</span>
                    <span className="text-xs text-muted">{fmtDateTime(act.occurredAt)}</span>
                    {act.score != null && (
                      <>
                        <ScoreBadge score={act.score} size="sm" />
                        <BandPill score={act.score} />
                      </>
                    )}
                  </div>
                  <div className="text-sm font-medium mt-0.5">{act.subject}</div>
                  {act.body && (
                    <p className="text-sm text-muted mt-1 whitespace-pre-wrap line-clamp-4">{act.body}</p>
                  )}
                  {act.callId && (
                    <Link href={`/calls/${act.callId}`} className="text-xs text-accent-hover hover:underline mt-1 inline-block">
                      Open call review →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
