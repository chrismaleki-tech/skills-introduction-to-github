import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { parsePersona, parseStringArray } from "@/lib/types";
import { Card, EmptyState, LinkButton, PageHeader, ScoreBadge, StatusPill, fmtDateTime } from "@/components/ui";
import { DeleteScenarioButton } from "@/components/roleplay/delete-scenario-button";
import { DuplicateScenarioButton } from "@/components/roleplay/duplicate-scenario-button";
import { DifficultyPill, fmtCallType } from "@/components/roleplay/difficulty-pill";
import { StartSessionButton } from "@/components/roleplay/start-session-button";
import { voiceAvailable } from "@/lib/roleplay";
import { startBlockReason } from "@/lib/usage";

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
  const block = await startBlockReason(user.org, user.id, "roleplay");

  const persona = parsePersona(scenario.personaJson);
  const winConditions = parseStringArray(scenario.winConditionsJson);

  return (
    <div>
      <PageHeader
        title={scenario.title}
        subtitle={`${fmtCallType(scenario.callType)} · graded with ${scenario.methodology?.name ?? "the team's active methodology"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DifficultyPill difficulty={scenario.difficulty} />
            {manager && <LinkButton href={`/scenarios/${scenario.id}/edit`} variant="secondary">Edit</LinkButton>}
            {manager && <DuplicateScenarioButton scenarioId={scenario.id} />}
            <StartSessionButton scenarioId={scenario.id} voiceEnabled={voiceAvailable()} compact blockedReason={block?.reason ?? null} manager={manager} />
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {(persona.situation || persona.objective || persona.offering) && (
            <Card title="The call">
              {persona.situation && <p className="text-sm">{persona.situation}</p>}
              {persona.objective && (
                <p className="text-sm mt-2">
                  <span className="text-muted">Your objective: </span>
                  {persona.objective}
                </p>
              )}
              {persona.offering && (
                <p className="text-sm mt-2">
                  <span className="text-muted">You sell: </span>
                  {persona.offering}
                </p>
              )}
            </Card>
          )}

          <Card title="Persona brief">
            <div className="font-medium text-lg">
              {persona.name}
              {persona.title && <span className="text-muted font-normal"> — {persona.title}</span>}
            </div>
            <div className="text-sm text-muted mt-0.5">
              {[persona.company, persona.industry].filter(Boolean).join(" · ")}
            </div>
            {(persona.attitude || persona.interest || persona.businessSize) && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {persona.attitude && <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 capitalize">{persona.attitude}</span>}
                {persona.interest && <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5">{persona.interest} starting interest</span>}
                {persona.businessSize && <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5">{persona.businessSize}</span>}
              </div>
            )}
            {persona.personality && (
              <p className="text-sm mt-3">
                <span className="text-muted">Personality: </span>
                {persona.personality}
              </p>
            )}
            {persona.authority && (
              <p className="text-sm mt-2">
                <span className="text-muted">Decision authority: </span>
                {persona.authority}
              </p>
            )}
            {persona.priorities && persona.priorities.length > 0 && (
              <p className="text-sm mt-2">
                <span className="text-muted">Measured on: </span>
                {persona.priorities.join(" · ")}
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

          {((persona.facts && persona.facts.length > 0) || (persona.assumptions && persona.assumptions.length > 0)) && (
            <Card title="About the business">
              {persona.sourceUrl && (
                <a href={persona.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-xs text-muted underline-offset-2 hover:underline break-all">
                  {persona.sourceUrl}
                </a>
              )}
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                {persona.facts && persona.facts.length > 0 && (
                  <div>
                    <div className="text-xs text-emerald-700 uppercase tracking-wider mb-1.5">Stated publicly</div>
                    <ul className="space-y-1 text-sm">
                      {persona.facts.map((f, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-emerald-700 shrink-0">•</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {persona.assumptions && persona.assumptions.length > 0 && (
                  <div>
                    <div className="text-xs text-amber-700 uppercase tracking-wider mb-1.5">Assumed for the simulation</div>
                    <ul className="space-y-1 text-sm">
                      {persona.assumptions.map((a, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-amber-700 shrink-0">•</span>
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          )}

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
