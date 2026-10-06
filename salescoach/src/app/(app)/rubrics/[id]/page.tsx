import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { parseDimensions, type RubricDimension } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";
import { CloneRubricButton } from "@/components/settings/rubric-actions";
import { RubricEditor } from "@/components/settings/rubric-editor";

// Rubric detail: read-only for presets (clone to edit), full editor for
// org-owned rubrics.

function ReadOnlyDimensions({ dims }: { dims: RubricDimension[] }) {
  const totalWeight = dims.reduce((s, d) => s + d.weight, 0);
  return (
    <Card
      title="Dimensions"
      action={
        <span className="text-xs text-muted tabular-nums">
          {dims.length} dimensions · total weight {totalWeight % 1 === 0 ? totalWeight : totalWeight.toFixed(1)}
        </span>
      }
    >
      <div className="space-y-3">
        {dims.map((d) => (
          <div key={d.key} className="border border-line rounded-lg p-4 bg-surface-2/40">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{d.name}</span>
              <code className="text-[11px] text-muted bg-surface-2 border border-line rounded px-1.5 py-0.5">
                {d.key}
              </code>
              {d.companySpecific && (
                <span className="inline-flex rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent-hover">
                  Company-specific
                </span>
              )}
              <span className="ml-auto text-xs text-muted tabular-nums">
                weight {d.weight} · {totalWeight > 0 ? Math.round((d.weight / totalWeight) * 100) : 0}% of
                score
              </span>
            </div>
            {d.description && <p className="text-sm text-muted mt-2">{d.description}</p>}
            <ol className="mt-3 space-y-1">
              {d.levels.map((l) => (
                <li key={l.score} className="flex gap-2 text-xs text-muted">
                  <span className="w-3 shrink-0 font-medium text-foreground/70 tabular-nums">{l.score}</span>
                  <span>{l.description}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default async function RubricDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!isManagerRole(user.role)) redirect("/me");

  const rubric = await db.methodology.findUnique({ where: { id } });
  if (!rubric || (!rubric.isPreset && rubric.orgId !== user.orgId)) notFound();

  const dims = parseDimensions(rubric.dimensionsJson);
  const isActive = rubric.id === user.org.activeMethodologyId;

  if (rubric.isPreset) {
    return (
      <div>
        <PageHeader
          title={rubric.name}
          subtitle={rubric.description}
          actions={<CloneRubricButton id={rubric.id} label="Clone to edit" />}
        />
        <p className="text-sm text-muted mb-6 -mt-4">
          This is a read-only preset. Clone it to get an editable copy owned by your team.
        </p>
        <ReadOnlyDimensions dims={dims} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={rubric.name}
        subtitle={rubric.description}
        actions={
          isActive ? (
            <span className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              Active
            </span>
          ) : undefined
        }
      />
      <RubricEditor
        id={rubric.id}
        name={rubric.name}
        description={rubric.description}
        dimensions={dims}
      />
    </div>
  );
}
