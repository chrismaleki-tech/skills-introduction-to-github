import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { stageLabel } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import { parseSegments } from "@/lib/types";
import { GradeView } from "@/components/grade-view";
import { TranscriptView } from "@/components/transcript-view";
import { GradeNowButton } from "@/components/calls/grade-now-button";
import { OverrideForm } from "@/components/calls/override-form";
import { LinkCallToCrmForm } from "@/components/crm/link-call";
import {
  Card,
  EmptyState,
  PageHeader,
  SamplingPill,
  StatusPill,
  fmtDateTime,
  fmtDuration,
} from "@/components/ui";

export default async function CallReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  const manager = isManagerRole(user.role);

  const call = await db.call.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      rep: true,
      transcript: true,
      grade: true,
      deal: { select: { id: true, name: true, stage: true } },
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
    },
  });
  if (!call || (!manager && call.repId !== user.id)) notFound();

  const [deals, contacts, accounts] = await Promise.all([
    db.deal.findMany({
      where: manager ? { orgId: user.orgId } : { orgId: user.orgId, ownerId: user.id },
      select: { id: true, name: true, stage: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.contact.findMany({
      where: { orgId: user.orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    db.account.findMany({
      where: { orgId: user.orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
  ]);

  const segments = call.transcript ? parseSegments(call.transcript.segmentsJson) : [];
  const canGradeNow = !call.grade && (call.status === "INGESTED" || call.status === "SKIPPED");

  return (
    <div>
      <PageHeader
        title={call.prospectName || "Unknown prospect"}
        subtitle={`${call.rep.name} · ${fmtDateTime(call.callDate)} · ${call.callType.replaceAll("_", " ")} · ${call.direction} · ${fmtDuration(call.durationSec)} · via ${call.source.toLowerCase()}`}
        actions={
          <div className="flex items-center gap-3">
            <SamplingPill status={call.samplingStatus} />
            <StatusPill status={call.status} />
          </div>
        }
      />

      {call.deal && (
        <div className="mb-6 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-sm flex flex-wrap items-center gap-2">
          <span className="text-muted">CRM deal:</span>
          <Link href={`/crm/deals/${call.deal.id}`} className="font-medium text-accent-hover hover:underline">
            {call.deal.name}
          </Link>
          <span className="text-muted">· {stageLabel(call.deal.stage)}</span>
          {call.account && (
            <>
              <span className="text-muted">·</span>
              <Link href={`/crm/accounts/${call.account.id}`} className="text-accent-hover hover:underline">
                {call.account.name}
              </Link>
            </>
          )}
        </div>
      )}

      {call.status === "FAILED" && (
        <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-400/5 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-rose-400">Processing failed</p>
            <p className="text-sm text-muted mt-0.5">
              {call.failReason ?? "The pipeline reported an error without details."}
            </p>
          </div>
          <GradeNowButton callId={call.id} label="Retry grading" variant="secondary" />
        </div>
      )}

      {call.audioPath && (
        <Card title="Recording" className="mb-6">
          <audio controls preload="none" src={`/api/calls/${call.id}/audio`} className="w-full" />
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2 items-start">
        <div className="xl:sticky xl:top-8 space-y-6">
          {segments.length > 0 ? (
            <TranscriptView
              segments={segments}
              repName={call.rep.name}
              prospectName={call.prospectName || undefined}
            />
          ) : (
            <Card title="Transcript">
              <EmptyState
                title="No transcript yet"
                hint="A transcript is produced when the call is graded."
              />
            </Card>
          )}
          <Card title="CRM link">
            <LinkCallToCrmForm
              callId={call.id}
              deals={deals}
              contacts={contacts}
              accounts={accounts}
              initial={{
                dealId: call.dealId,
                contactId: call.contactId,
                accountId: call.accountId,
              }}
            />
          </Card>
        </div>

        <div className="space-y-6">
          {call.grade ? (
            <>
              <GradeView grade={call.grade} />
              {manager && (
                <Card title="Manager override">
                  <OverrideForm
                    callId={call.id}
                    initialScore={call.grade.managerOverrideScore}
                    initialComment={call.grade.managerComment}
                  />
                </Card>
              )}
            </>
          ) : (
            <Card title="Grade">
              <div className="text-center py-10 space-y-4">
                <div>
                  <p className="font-medium text-foreground/70">This call has not been graded</p>
                  <p className="text-sm text-muted mt-1">
                    {call.status === "SKIPPED"
                      ? "It was skipped by the sampling policy for being below the minimum duration."
                      : call.status === "INGESTED"
                        ? "It was ingested but not selected by the sampling policy."
                        : call.status === "FAILED"
                          ? "Grading failed — retry it from the banner above."
                          : "Grading is in progress."}
                  </p>
                </div>
                {canGradeNow && (
                  <div className="flex flex-col items-center gap-1">
                    <GradeNowButton callId={call.id} label="Grade this call now" />
                    <p className="text-xs text-muted">
                      {manager
                        ? "Recorded as a manager-requested grade; it does not consume the sampling budget."
                        : "Flags the call for grading; it does not count against your team's sampling budget."}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
