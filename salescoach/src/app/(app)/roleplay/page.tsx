import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { parsePersona } from "@/lib/types";
import { Card, EmptyState, PageHeader, ScoreBadge, StatusPill, fmtDateTime } from "@/components/ui";
import { DifficultyPill, fmtCallType } from "@/components/roleplay/difficulty-pill";
import { StartSessionButton } from "@/components/roleplay/start-session-button";

export default async function RoleplayPage() {
  const user = await currentUser();
  const manager = isManagerRole(user.role);

  const [scenarios, sessions] = await Promise.all([
    db.scenario.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: "desc" },
    }),
    db.roleplaySession.findMany({
      where: { orgId: user.orgId, ...(manager ? {} : { repId: user.id }) },
      include: {
        scenario: { select: { title: true } },
        rep: { select: { name: true } },
        grade: { select: { overallScore: true, managerOverrideScore: true } },
      },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Role-Play"
        subtitle="Practice live conversations against AI prospects built from your company's real personas and objections, then get graded on the same rubric as your calls."
      />

      <section className="mb-10">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">Start a role-play</h2>
        {scenarios.length === 0 ? (
          <Card>
            <EmptyState
              title="No scenarios yet"
              hint={
                manager
                  ? "Create one on the Scenarios page to give your team something to practice against."
                  : "Ask your manager to publish a scenario on the Scenarios page."
              }
            />
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenarios.map((s) => {
              const persona = parsePersona(s.personaJson);
              return (
                <div key={s.id} className="bg-surface border border-line rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/scenarios/${s.id}`} className="font-medium hover:text-accent-hover transition-colors">
                      {s.title}
                    </Link>
                    <DifficultyPill difficulty={s.difficulty} />
                  </div>
                  <div className="text-sm text-muted flex-1">
                    <div>
                      {persona.name}
                      {persona.title && ` — ${persona.title}`}
                    </div>
                    {persona.company && <div>{persona.company}</div>}
                    <div className="mt-1 text-xs capitalize">{fmtCallType(s.callType)} call</div>
                  </div>
                  <StartSessionButton scenarioId={s.id} />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
          {manager ? "Team sessions" : "Your sessions"}
        </h2>
        <Card className="overflow-hidden">
          {sessions.length === 0 ? (
            <EmptyState
              title="No sessions yet"
              hint="Start a role-play above — your graded sessions will show up here."
            />
          ) : (
            <div className="overflow-x-auto -m-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted uppercase tracking-wider border-b border-line">
                    <th className="px-5 py-3 font-medium">Date</th>
                    {manager && <th className="px-5 py-3 font-medium">Rep</th>}
                    <th className="px-5 py-3 font-medium">Scenario</th>
                    <th className="px-5 py-3 font-medium">Mode</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b border-line last:border-0 hover:bg-surface-2/50 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <Link href={`/roleplay/${s.id}`} className="hover:text-accent-hover transition-colors">
                          {fmtDateTime(s.startedAt)}
                        </Link>
                      </td>
                      {manager && <td className="px-5 py-3">{s.rep.name}</td>}
                      <td className="px-5 py-3">
                        <Link href={`/roleplay/${s.id}`} className="hover:text-accent-hover transition-colors">
                          {s.scenario.title}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted">{s.mode === "VOICE" ? "Voice" : "Text"}</td>
                      <td className="px-5 py-3">
                        <StatusPill status={s.status} />
                      </td>
                      <td className="px-5 py-3">
                        {s.grade ? (
                          <ScoreBadge score={s.grade.managerOverrideScore ?? s.grade.overallScore} size="sm" />
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
