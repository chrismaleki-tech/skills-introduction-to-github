import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { parsePersona, parseStringArray } from "@/lib/types";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { DifficultyPill, fmtCallType } from "@/components/roleplay/difficulty-pill";
import { ScenarioForm } from "@/components/roleplay/scenario-form";

export default async function ScenariosPage() {
  const user = await currentUser();
  const manager = isManagerRole(user.role);

  const scenarios = await db.scenario.findMany({
    where: { orgId: user.orgId },
    include: { _count: { select: { roleplays: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Scenarios"
        subtitle={
          manager
            ? "The practice library your reps role-play against. Build personas by hand or generate them from the company profile."
            : "The practice library. Open a scenario to read the persona brief and start a session."
        }
      />

      {manager && (
        <div className="mb-8">
          <ScenarioForm />
        </div>
      )}

      {scenarios.length === 0 ? (
        <Card>
          <EmptyState
            title="No scenarios yet"
            hint={
              manager
                ? "Create your first scenario above — or generate one from the company profile in a single click."
                : "Your manager has not published any scenarios yet."
            }
          />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {scenarios.map((s) => {
            const persona = parsePersona(s.personaJson);
            const winCount = parseStringArray(s.winConditionsJson).length;
            return (
              <Link
                key={s.id}
                href={`/scenarios/${s.id}`}
                className="bg-surface border border-line rounded-xl p-5 hover:border-accent/50 transition-colors block"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{s.title}</div>
                  <DifficultyPill difficulty={s.difficulty} />
                </div>
                <div className="text-sm text-muted mt-2">
                  {persona.name}
                  {persona.title && ` — ${persona.title}`}
                  {persona.company && ` at ${persona.company}`}
                </div>
                {persona.personality && (
                  <p className="text-sm text-muted mt-1 line-clamp-2">{persona.personality}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-muted">
                  <span className="capitalize">{fmtCallType(s.callType)} call</span>
                  <span>
                    {persona.objections.length} {persona.objections.length === 1 ? "objection" : "objections"}
                  </span>
                  <span>
                    {winCount} win {winCount === 1 ? "condition" : "conditions"}
                  </span>
                  <span>
                    {s._count.roleplays} {s._count.roleplays === 1 ? "session" : "sessions"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
