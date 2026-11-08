import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { parsePersona, parseStringArray } from "@/lib/types";
import { voiceAvailable } from "@/lib/roleplay";
import { PageHeader } from "@/components/ui";
import { ScenarioEditor } from "@/components/roleplay/scenario-editor";

export default async function EditScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!isManagerRole(user.role)) redirect(`/scenarios/${id}`);

  const scenario = await db.scenario.findUnique({ where: { id } });
  if (!scenario || scenario.orgId !== user.orgId) notFound();

  const draft = {
    title: scenario.title,
    callType: scenario.callType,
    difficulty: scenario.difficulty,
    persona: parsePersona(scenario.personaJson),
    winConditions: parseStringArray(scenario.winConditionsJson),
  };

  return (
    <div>
      <PageHeader
        title={`Edit: ${scenario.title}`}
        subtitle="Changes apply to future sessions. Past sessions keep their transcripts and grades."
        actions={
          <Link href={`/scenarios/${id}`} className="text-sm text-muted hover:text-foreground transition-colors">
            Cancel
          </Link>
        }
      />
      <ScenarioEditor draft={draft} mode="edit" scenarioId={id} voiceEnabled={voiceAvailable()} />
    </div>
  );
}
