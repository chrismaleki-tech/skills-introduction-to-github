import Link from "next/link";
import { db } from "@/lib/db";
import { parseDimensions } from "@/lib/types";
import { Card, EmptyState, ScoreBadge, StatusPill, fmtDate } from "@/components/ui";
import { ChartLegend, PairedBars, ScoreTimeline, type TimelinePoint } from "@/components/dashboard/charts";
import {
  activityDate,
  avg,
  daysAgo,
  dimensionAverages,
  effectiveScore,
  monthStart,
  roundOrNull,
} from "@/components/dashboard/insights";

// Shared drill-down body for /team/[id] (manager view) and /me (self view):
// month summary, 60-day score history, dimension breakdown vs team, recent
// graded activity, and (optionally) the rep's assignment list.

export async function RepDetail({
  repId,
  orgId,
  selfView,
  showAssignments,
}: {
  repId: string;
  orgId: string;
  selfView: boolean;
  showAssignments: boolean;
}) {
  const now = new Date();
  const mStart = monthStart(now);
  const since60 = daysAgo(now, 60);
  const earliest = new Date(Math.min(mStart.getTime(), since60.getTime()));

  const org = await db.org.findUniqueOrThrow({ where: { id: orgId } });
  const [methodology, orgGrades, assignments] = await Promise.all([
    org.activeMethodologyId
      ? db.methodology.findUnique({ where: { id: org.activeMethodologyId } })
      : Promise.resolve(null),
    // Windows keyed on activity date (call date / role-play start), since
    // grades can be created later than the activity they score.
    db.grade.findMany({
      where: {
        orgId,
        OR: [{ call: { callDate: { gte: earliest } } }, { roleplay: { startedAt: { gte: earliest } } }],
      },
      include: {
        call: { select: { repId: true, prospectName: true, callType: true, callDate: true } },
        roleplay: { select: { repId: true, startedAt: true, scenario: { select: { title: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    showAssignments
      ? db.assignment.findMany({
          where: { orgId, assignedToId: repId },
          include: { scenario: { select: { title: true } }, assignedBy: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const repOf = (g: (typeof orgGrades)[number]) => g.call?.repId ?? g.roleplay?.repId ?? null;
  const repGrades = orgGrades.filter((g) => repOf(g) === repId);
  const whose = selfView ? "your" : "this rep's";

  // Month summary vs team
  const repMonth = repGrades.filter((g) => activityDate(g) >= mStart);
  const teamMonth = orgGrades.filter((g) => activityDate(g) >= mStart);
  const repAvg = roundOrNull(avg(repMonth.map(effectiveScore)));
  const teamAvg = roundOrNull(avg(teamMonth.map(effectiveScore)));

  // 60-day score history
  const repGrades60 = repGrades.filter((g) => activityDate(g) >= since60);
  const points: TimelinePoint[] = repGrades60.map((g) => ({
    t: activityDate(g).getTime(),
    score: effectiveScore(g),
    type: g.subjectType,
    label: `${g.subjectType === "CALL" ? `Call · ${g.call?.prospectName || "Unknown prospect"}` : `Role-play · ${g.roleplay?.scenario.title ?? ""}`} — ${effectiveScore(g)} on ${fmtDate(activityDate(g))}`,
  }));

  // Dimension breakdown vs team (60 days)
  const dims = methodology ? parseDimensions(methodology.dimensionsJson) : [];
  const repDims = dimensionAverages(repGrades60.map((g) => g.dimensionScoresJson));
  const teamDims = dimensionAverages(
    orgGrades.filter((g) => activityDate(g) >= since60 && repOf(g) != null).map((g) => g.dimensionScoresJson),
  );

  const recent = [...repGrades].sort((a, b) => activityDate(b).getTime() - activityDate(a).getTime()).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-xs text-muted uppercase tracking-wider">{selfView ? "Your avg this month" : "Avg this month"}</div>
          <div className="mt-2">{repAvg != null ? <ScoreBadge score={repAvg} size="lg" /> : <span className="text-2xl font-semibold text-muted">–</span>}</div>
          <div className="text-xs text-muted mt-2">
            {repMonth.length} graded {repMonth.length === 1 ? "activity" : "activities"} this month
          </div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-xs text-muted uppercase tracking-wider">Team avg this month</div>
          <div className="mt-2">{teamAvg != null ? <ScoreBadge score={teamAvg} size="lg" /> : <span className="text-2xl font-semibold text-muted">–</span>}</div>
          <div className="text-xs text-muted mt-2">across all graded calls and role-plays</div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-xs text-muted uppercase tracking-wider">Last 60 days</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{repGrades60.length}</div>
          <div className="text-xs text-muted mt-2">
            {repGrades60.filter((g) => g.subjectType === "CALL").length} calls ·{" "}
            {repGrades60.filter((g) => g.subjectType === "ROLEPLAY").length} role-plays graded
          </div>
        </div>
      </div>

      <Card title="Score history · last 60 days" action={<ChartLegend />}>
        {points.length === 0 ? (
          <EmptyState
            title="No graded activity in the last 60 days"
            hint={selfView ? "Run a role-play or upload a call to get scored." : "Graded calls and role-plays will chart here."}
          />
        ) : (
          <ScoreTimeline points={points} start={since60.getTime()} end={now.getTime()} />
        )}
      </Card>

      <Card title="Dimension breakdown · last 60 days">
        {dims.length === 0 ? (
          <EmptyState title="No active methodology" hint="Per-dimension comparison needs an active rubric." />
        ) : repGrades60.length === 0 ? (
          <EmptyState title="No dimension data yet" hint={`Averages appear once ${whose} calls or role-plays are graded.`} />
        ) : (
          <PairedBars
            rows={dims.map((d) => ({
              name: d.name,
              primary: repDims.get(d.key) ?? null,
              secondary: teamDims.get(d.key) ?? null,
            }))}
            primaryLabel={selfView ? "You" : "Rep"}
            secondaryLabel="Team"
          />
        )}
      </Card>

      <Card title="Recent graded activity">
        {recent.length === 0 ? (
          <EmptyState title="Nothing graded yet" hint={`${selfView ? "Your" : "This rep's"} most recent scored calls and role-plays will list here.`} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted uppercase tracking-wider">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Prospect / scenario</th>
                <th className="pb-2 font-medium">Score</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recent.map((g) => {
                const href = g.callId ? `/calls/${g.callId}` : `/roleplay/${g.roleplayId}`;
                return (
                  <tr key={g.id}>
                    <td className="py-2.5 text-muted whitespace-nowrap">{fmtDate(activityDate(g))}</td>
                    <td className="py-2.5 text-muted">{g.subjectType === "CALL" ? "Call" : "Role-play"}</td>
                    <td className="py-2.5">
                      {g.subjectType === "CALL" ? g.call?.prospectName || "Unknown prospect" : g.roleplay?.scenario.title ?? "–"}
                    </td>
                    <td className="py-2.5">
                      <ScoreBadge score={effectiveScore(g)} size="sm" />
                    </td>
                    <td className="py-2.5 text-right">
                      <Link href={href} className="text-accent-hover hover:underline text-xs font-medium">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {showAssignments && (
        <Card title="Assignments">
          {assignments.length === 0 ? (
            <EmptyState title="No assignments" hint="Practice assignments for this rep will show here." />
          ) : (
            <ul className="divide-y divide-line">
              {assignments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <StatusPill status={a.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {a.type === "ROLEPLAY" ? `Role-play: ${a.scenario?.title ?? "scenario removed"}` : "Upload calls for review"}
                    </div>
                    <div className="text-xs text-muted">
                      {a.doneCount} of {a.targetCount} done · assigned by {a.assignedBy.name}
                      {a.note ? ` · ${a.note}` : ""}
                    </div>
                  </div>
                  <span className="text-xs text-muted whitespace-nowrap">
                    {a.status === "COMPLETED" && a.completedAt
                      ? `completed ${fmtDate(a.completedAt)}`
                      : a.dueDate
                        ? `due ${fmtDate(a.dueDate)}`
                        : "no due date"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
