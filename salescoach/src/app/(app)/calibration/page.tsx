import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader, ScoreBadge, fmtDateTime } from "@/components/ui";

export default async function CalibrationPage() {
  const user = await currentUser();
  if (!isManagerRole(user.role)) redirect("/me");

  const overrides = await db.grade.findMany({
    where: {
      orgId: user.orgId,
      managerOverrideScore: { not: null },
    },
    include: {
      call: { include: { rep: { select: { name: true } } } },
      methodology: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const deltas = overrides.map((g) => (g.managerOverrideScore ?? g.overallScore) - g.overallScore);
  const avgDelta = deltas.length
    ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length)
    : 0;
  const within5 = deltas.filter((d) => Math.abs(d) <= 5).length;
  const agreement = overrides.length ? Math.round((within5 / overrides.length) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Grading calibration"
        subtitle="Compare AI scores to manager overrides so you can tune rubrics and trust the coach over time."
      />

      <div className="grid gap-3 sm:grid-cols-3 mb-8">
        <Card>
          <div className="text-xs text-muted uppercase tracking-wider">Overrides</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{overrides.length}</div>
        </Card>
        <Card>
          <div className="text-xs text-muted uppercase tracking-wider">Avg delta (manager − AI)</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">
            {avgDelta > 0 ? `+${avgDelta}` : avgDelta}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-muted uppercase tracking-wider">Within ±5 points</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{agreement}%</div>
        </Card>
      </div>

      {overrides.length === 0 ? (
        <Card>
          <EmptyState
            title="No manager overrides yet"
            hint="Override a score on a call review page — those pairs show up here for calibration."
          />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="text-left font-medium px-4 py-3">Call</th>
                <th className="text-left font-medium px-4 py-3">Rep</th>
                <th className="text-left font-medium px-4 py-3">Rubric</th>
                <th className="text-right font-medium px-4 py-3">AI</th>
                <th className="text-right font-medium px-4 py-3">Manager</th>
                <th className="text-right font-medium px-4 py-3">Delta</th>
                <th className="text-left font-medium px-4 py-3">Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {overrides.map((g) => {
                const delta = (g.managerOverrideScore ?? 0) - g.overallScore;
                return (
                  <tr key={g.id} className="hover:bg-surface-2/40">
                    <td className="px-4 py-3">
                      {g.call ? (
                        <Link href={`/calls/${g.call.id}`} className="text-accent-hover hover:underline">
                          {g.call.prospectName || "Call"} · {fmtDateTime(g.createdAt)}
                        </Link>
                      ) : (
                        fmtDateTime(g.createdAt)
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{g.call?.rep.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{g.methodology.name}</td>
                    <td className="px-4 py-3 text-right">
                      <ScoreBadge score={g.overallScore} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ScoreBadge score={g.managerOverrideScore ?? 0} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {delta > 0 ? `+${delta}` : delta}
                    </td>
                    <td className="px-4 py-3 text-muted max-w-xs truncate">{g.managerComment || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
