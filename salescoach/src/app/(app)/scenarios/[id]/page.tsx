import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { parsePersona, parseStringArray } from "@/lib/types";
import { Card, EmptyState, PageHeader, ScoreBadge, StatusPill, fmtDateTime } from "@/components/ui";
import { DeleteScenarioButton } from "@/components/roleplay/delete-scenario-button";
import { DifficultyPill, fmtCallType } from "@/components/roleplay/difficulty-pill";
import { StartSessionButton } from "@/components/roleplay/start-session-button";

export default async function ScenarioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  const manager = isManagerRole(user.role);

  const scenario = await db.scenario.findUnique({
    where: { id },
    include: {
      methodology: { select: { name: true } },
      roleplays: {
        where: manager ? {} : { repId: user.id },
        include: {
          rep: { select: { name: true } },
          grade: { select: { overallScore: true, managerOverrideScore: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 10,
      },
      _count: { select: { roleplays: true } },
    },
  });
  if (!scenario || scenario.orgId !== user.orgId) notFound();

  const persona = parsePersona(scenario.personaJson);
  const winConditions = parseStringArray(scenario.winConditionsJson);

  return (
    <div>
      <PageHeader
        title={scenario.title}
        subtitle={`${fmtCallType(scenario.callType).replace(/^\w/, (c) => c.toUpperCase())} scenario · graded with ${scenario.methodology?.name ?? "the team's active methodology"}`}
        actions={
          <div className="flex items-center gap-2">
            <DifficultyPill difficulty={scenario.difficulty} />
            <StartSessionButton scenarioId={scenario.id} />
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Persona brief">
            <div className="font-medium text-lg">
              {persona.name}
              {persona.title && <span className="text-muted font-normal"> — {persona.title}</span>}
            </div>
            <div className="text-sm text-muted mt-0.5">
              {[persona.company, persona.industry].filter(Boolean).join(" · ")}
            </div>
            {persona.personality && (
              <p className="text-sm mt-3">
                <span className="text-muted">Personality: </span>
                {persona.personality}
              </p>
            )}
            {persona.budget && (
              <p className="text-sm mt-2">
                <span className="text-muted">Budget posture: </span>
                {persona.budget}
              </p>
            )}
            {persona.notes && (
              <p className="text-sm mt-2">
                <span className="text-muted">Notes: </span>
                {persona.notes}
              </p>
            )}
            {persona.painPoints.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-muted uppercase tracking-wider mb-1.5">
                  Pain points (revealed through good discovery)
                </div>
                <ul className="space-y-1 text-sm">
                  {persona.painPoints.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-amber-700 shrink-0">•</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card title="Objections this persona will raise">
            {persona.objections.length === 0 ? (
              <p className="text-sm text-muted">No scripted objections — the persona improvises.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {persona.objections.map((o, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-rose-700 shrink-0">!</span>
                    {o}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Win conditions">
            {winConditions.length === 0 ? (
              <p className="text-sm text-muted">No explicit win conditions — grading falls back to the rubric alone.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {winConditions.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-emerald-700 shrink-0">✓</span>
                    {w}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={manager ? "Recent sessions" : "Your sessions"}>
            {scenario.roleplays.length === 0 ? (
              <EmptyState
                title="No sessions yet"
                hint="Start one to be the first to practice against this persona."
              />
            ) : (
              <ul className="space-y-3">
                {scenario.roleplays.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/roleplay/${s.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg -mx-2 px-2 py-1.5 hover:bg-surface-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm truncate">{s.rep.name}</div>
                        <div className="text-xs text-muted">{fmtDateTime(s.startedAt)}</div>
                      </div>
                      {s.grade ? (
                        <ScoreBadge score={s.grade.managerOverrideScore ?? s.grade.overallScore} size="sm" />
                      ) : (
                        <StatusPill status={s.status} />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {manager && scenario._count.roleplays === 0 && (
            <Card title="Danger zone">
              <p className="text-sm text-muted mb-3">
                No sessions reference this scenario yet, so it can be removed.
              </p>
              <DeleteScenarioButton scenarioId={scenario.id} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
