import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { parseDimensions } from "@/lib/types";
import { Card, EmptyState, PageHeader, ScoreBadge, Stat, fmtDate } from "@/components/ui";
import { ChartLegend, TrendArrow, WeeklyTrendChart, type WeekPoint } from "@/components/dashboard/charts";
import { SkillHeatmap, type HeatmapRow } from "@/components/dashboard/heatmap";
import {
  activityDate,
  avg,
  daysAgo,
  dimensionAverages,
  effectiveScore,
  monthStart,
  prevMonthStart,
  roundOrNull,
  weakestDimension,
  weekMonday,
} from "@/components/dashboard/insights";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!isManagerRole(user.role)) redirect("/me");

  const now = new Date();
  const mStart = monthStart(now);
  const pStart = prevMonthStart(now);
  const trendStart = daysAgo(weekMonday(now), 7 * 7); // Monday of the earliest of 8 weeks
  const last30 = daysAgo(now, 30);
  const last14 = daysAgo(now, 14);
  const earliest = new Date(Math.min(pStart.getTime(), trendStart.getTime(), last30.getTime()));

  const [reps, methodology, grades, monthCalls, activeAssignments] = await Promise.all([
    db.user.findMany({ where: { orgId: user.orgId, role: "REP" }, orderBy: { name: "asc" } }),
    user.org.activeMethodologyId
      ? db.methodology.findUnique({ where: { id: user.org.activeMethodologyId } })
      : Promise.resolve(null),
    // Time windows use the activity date (call date / role-play start), since
    // grade rows can be created later than the activity they score.
    db.grade.findMany({
      where: {
        orgId: user.orgId,
        OR: [{ call: { callDate: { gte: earliest } } }, { roleplay: { startedAt: { gte: earliest } } }],
      },
      include: {
        call: { select: { repId: true, prospectName: true, callDate: true } },
        roleplay: { select: { repId: true, startedAt: true, scenario: { select: { title: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.call.findMany({
      where: { orgId: user.orgId, callDate: { gte: mStart } },
      select: { repId: true, samplingStatus: true },
    }),
    db.assignment.findMany({
      where: { orgId: user.orgId, status: { not: "COMPLETED" } },
      select: { dueDate: true },
    }),
  ]);

  const repOf = (g: (typeof grades)[number]) => g.call?.repId ?? g.roleplay?.repId ?? null;
  const repById = new Map(reps.map((r) => [r.id, r]));

  // ----- Stat row -----
  const monthGrades = grades.filter((g) => activityDate(g) >= mStart);
  const prevGrades = grades.filter((g) => activityDate(g) >= pStart && activityDate(g) < mStart);
  const teamAvg = roundOrNull(avg(monthGrades.map(effectiveScore)));
  const prevAvg = roundOrNull(avg(prevGrades.map(effectiveScore)));
  const avgDelta =
    teamAvg != null && prevAvg != null ? `${teamAvg - prevAvg >= 0 ? "+" : ""}${teamAvg - prevAvg} vs last month` : "no grades last month";
  const monthCallGrades = monthGrades.filter((g) => g.subjectType === "CALL").length;
  const prevCallGrades = prevGrades.filter((g) => g.subjectType === "CALL").length;
  const monthRoleplayGrades = monthGrades.filter((g) => g.subjectType === "ROLEPLAY").length;
  const prevRoleplayGrades = prevGrades.filter((g) => g.subjectType === "ROLEPLAY").length;
  const overdue = activeAssignments.filter((a) => a.dueDate != null && a.dueDate < now).length;

  // ----- Weekly trend (last 8 ISO-ish weeks) -----
  const weeks: WeekPoint[] = [];
  for (let i = 7; i >= 0; i--) {
    const ws = daysAgo(weekMonday(now), i * 7);
    const we = new Date(ws.getTime() + 7 * 86400000);
    const inWeek = grades.filter((g) => activityDate(g) >= ws && activityDate(g) < we);
    weeks.push({
      label: fmtDate(ws),
      call: avg(inWeek.filter((g) => g.subjectType === "CALL").map(effectiveScore)),
      roleplay: avg(inWeek.filter((g) => g.subjectType === "ROLEPLAY").map(effectiveScore)),
    });
  }
  const trendHasData = weeks.some((w) => w.call != null || w.roleplay != null);

  // ----- Skill heatmap (last 30 days, active methodology dimensions) -----
  const dims = methodology ? parseDimensions(methodology.dimensionsJson) : [];
  const grades30 = grades.filter((g) => activityDate(g) >= last30);
  const heatmapRows: HeatmapRow[] = reps.map((rep) => {
    const repDims = dimensionAverages(grades30.filter((g) => repOf(g) === rep.id).map((g) => g.dimensionScoresJson));
    return {
      name: rep.name,
      sub: rep.title,
      href: `/team/${rep.id}`,
      cells: dims.map((d) => repDims.get(d.key) ?? null),
    };
  });
  const teamDims = dimensionAverages(grades30.filter((g) => repOf(g) != null).map((g) => g.dimensionScoresJson));
  heatmapRows.push({
    name: "Team average",
    isAverage: true,
    cells: dims.map((d) => teamDims.get(d.key) ?? null),
  });

  // ----- Leaderboard (this month, trend vs prior month) -----
  const leaderboard = reps
    .map((rep) => {
      const mine = monthGrades.filter((g) => repOf(g) === rep.id);
      const prior = prevGrades.filter((g) => repOf(g) === rep.id);
      const score = roundOrNull(avg(mine.map(effectiveScore)));
      const priorScore = roundOrNull(avg(prior.map(effectiveScore)));
      return {
        rep,
        score,
        count: mine.length,
        delta: score != null && priorScore != null ? score - priorScore : null,
      };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  // ----- Coverage strip (sampling transparency, this month) -----
  const GRADED_STATUSES = ["SAMPLED", "WITHIN_THRESHOLD", "MANUAL_UPLOAD", "MANAGER_REQUESTED"];
  const coverage = reps.map((rep) => {
    const mine = monthCalls.filter((c) => c.repId === rep.id);
    return {
      rep,
      ingested: mine.length,
      graded: mine.filter((c) => GRADED_STATUSES.includes(c.samplingStatus)).length,
      flagged: mine.filter((c) => c.samplingStatus === "REP_FLAGGED").length,
      skipped: mine.filter((c) => c.samplingStatus === "BELOW_MIN_DURATION").length,
    };
  });

  // ----- Needs coaching (last 14 days, effective score < 60) -----
  const needsCoachingAll = grades
    .filter((g) => activityDate(g) >= last14 && effectiveScore(g) < 60 && repOf(g) != null)
    .sort((a, b) => activityDate(b).getTime() - activityDate(a).getTime());
  const NEEDS_COACHING_LIMIT = 15;
  const needsCoaching = needsCoachingAll.slice(0, NEEDS_COACHING_LIMIT);

  return (
    <div>
      <PageHeader
        title="Team Dashboard"
        subtitle={`Grading activity and skill coverage for ${user.org.name}. Scores reflect manager overrides where present.`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat
          label="Team avg this month"
          value={teamAvg != null ? <ScoreBadge score={teamAvg} size="lg" /> : "–"}
          sub={teamAvg != null ? avgDelta : "no grades yet this month"}
        />
        <Stat label="Graded calls" value={monthCallGrades} sub={`this month · ${prevCallGrades} last month`} />
        <Stat label="Graded role-plays" value={monthRoleplayGrades} sub={`this month · ${prevRoleplayGrades} last month`} />
        <Stat
          label="Active assignments"
          value={activeAssignments.length}
          sub={overdue > 0 ? `${overdue} overdue` : "none overdue"}
        />
      </div>

      <Card title="Score trend · last 8 weeks" action={<ChartLegend />} className="mb-6">
        {trendHasData ? (
          <WeeklyTrendChart weeks={weeks} />
        ) : (
          <EmptyState title="No graded activity in the last 8 weeks" hint="Grades appear here as calls and role-plays are scored." />
        )}
      </Card>

      <Card title="Skill heatmap · last 30 days" className="mb-6">
        {dims.length === 0 ? (
          <EmptyState title="No active methodology" hint="Pick an active rubric in Rubrics to unlock the per-dimension heatmap." />
        ) : reps.length === 0 ? (
          <EmptyState title="No reps on the team yet" />
        ) : (
          <SkillHeatmap dimensions={dims.map((d) => ({ key: d.key, name: d.name }))} rows={heatmapRows} />
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card title="Leaderboard · this month">
          {leaderboard.every((r) => r.score == null) ? (
            <EmptyState title="No graded activity this month yet" />
          ) : (
            <ul className="divide-y divide-line">
              {leaderboard.map((entry, i) => (
                <li key={entry.rep.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-5 text-sm text-muted tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <Link href={`/team/${entry.rep.id}`} className="text-sm font-medium hover:text-brand transition-colors">
                      {entry.rep.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {entry.count} graded {entry.count === 1 ? "activity" : "activities"}
                    </div>
                  </div>
                  <TrendArrow delta={entry.delta} />
                  {entry.score != null ? <ScoreBadge score={entry.score} size="sm" /> : <span className="text-sm text-muted">–</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Call coverage · this month">
          {coverage.every((c) => c.ingested === 0) ? (
            <EmptyState title="No calls ingested this month" hint="Coverage shows how the sampling policy treated each rep's calls." />
          ) : (
            <ul className="divide-y divide-line">
              {coverage.map((c) => (
                <li key={c.rep.id} className="flex items-center gap-3 py-2.5">
                  <Link
                    href={`/team/${c.rep.id}`}
                    className="w-32 shrink-0 text-sm font-medium truncate hover:text-brand transition-colors"
                  >
                    {c.rep.name}
                  </Link>
                  <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden flex">
                    {c.ingested > 0 && (
                      <>
                        <div className="h-full bg-emerald-500" style={{ width: `${(c.graded / c.ingested) * 100}%` }} />
                        <div className="h-full bg-brand" style={{ width: `${(c.flagged / c.ingested) * 100}%` }} />
                        <div className="h-full bg-slate-500/70" style={{ width: `${(c.skipped / c.ingested) * 100}%` }} />
                      </>
                    )}
                  </div>
                  <span className="text-xs text-muted tabular-nums whitespace-nowrap">
                    {c.ingested} ingested · {c.graded} graded · {c.flagged} flagged · {c.skipped} skipped
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Needs coaching · last 14 days">
        {needsCoaching.length === 0 ? (
          <EmptyState title="Nobody scored below 60 in the last 14 days" hint="Low-scoring calls and role-plays land here for follow-up." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted uppercase tracking-wider">
                <th className="pb-2 font-medium">Rep</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Score</th>
                <th className="pb-2 font-medium">Weakest dimension</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {needsCoaching.map((g) => {
                const rep = repById.get(repOf(g) ?? "");
                const weakest = weakestDimension(g.dimensionScoresJson);
                const href = g.callId ? `/calls/${g.callId}` : `/roleplay/${g.roleplayId}`;
                return (
                  <tr key={g.id}>
                    <td className="py-2.5 font-medium">{rep?.name ?? "Unknown rep"}</td>
                    <td className="py-2.5 text-muted">{fmtDate(activityDate(g))}</td>
                    <td className="py-2.5 text-muted">{g.subjectType === "CALL" ? "Call" : "Role-play"}</td>
                    <td className="py-2.5">
                      <ScoreBadge score={effectiveScore(g)} size="sm" />
                    </td>
                    <td className="py-2.5 text-muted">
                      {weakest ? `${weakest.name} (${weakest.score}/5)` : "–"}
                    </td>
                    <td className="py-2.5 text-right">
                      <Link href={href} className="text-brand hover:underline text-xs font-medium">
                        Review
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {needsCoachingAll.length > NEEDS_COACHING_LIMIT && (
          <div className="text-xs text-muted mt-3">
            Showing the {NEEDS_COACHING_LIMIT} most recent of {needsCoachingAll.length} below-60 grades in the last 14 days.
          </div>
        )}
      </Card>
    </div>
  );
}
