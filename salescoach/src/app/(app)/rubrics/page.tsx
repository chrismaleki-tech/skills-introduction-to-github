import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { parseDimensions } from "@/lib/types";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ActivateRubricButton, CloneRubricButton } from "@/components/settings/rubric-actions";

function fmtWeight(total: number): string {
  return total % 1 === 0 ? String(total) : total.toFixed(1);
}

export default async function RubricsPage() {
  const user = await currentUser();
  if (!isManagerRole(user.role)) redirect("/me");

  const [orgRubrics, presets] = await Promise.all([
    db.methodology.findMany({
      where: { orgId: user.orgId, isPreset: false },
      orderBy: { createdAt: "asc" },
    }),
    db.methodology.findMany({ where: { isPreset: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const activeId = user.org.activeMethodologyId;

  return (
    <div>
      <PageHeader
        title="Rubrics"
        subtitle="One rubric is active per team at a time; every call and role-play is graded against it. Scenarios pinned to a specific methodology are the exception."
      />

      <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">Your rubrics</h2>
      {orgRubrics.length === 0 ? (
        <Card>
          <EmptyState
            title="No rubrics yet"
            hint="Clone a preset from the library below to create an editable copy for your team."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {orgRubrics.map((rubric) => {
            const dims = parseDimensions(rubric.dimensionsJson);
            const totalWeight = dims.reduce((s, d) => s + d.weight, 0);
            const isActive = rubric.id === activeId;
            return (
              <Card key={rubric.id}>
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/rubrics/${rubric.id}`}
                    className="font-medium hover:text-accent-hover transition-colors"
                  >
                    {rubric.name}
                  </Link>
                  {isActive && (
                    <span className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 shrink-0">
                      Active
                    </span>
                  )}
                </div>
                {rubric.description && <p className="text-sm text-muted mt-1.5">{rubric.description}</p>}
                <p className="text-xs text-muted mt-3 tabular-nums">
                  {dims.length} dimensions · total weight {fmtWeight(totalWeight)}
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <Link
                    href={`/rubrics/${rubric.id}`}
                    className="inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-white transition-colors"
                  >
                    Edit
                  </Link>
                  {!isActive && <ActivateRubricButton id={rubric.id} />}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3 mt-10">Preset library</h2>
      <p className="text-sm text-muted mb-4">
        Presets are read-only starting points. Cloning creates an editable copy owned by your team.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {presets.map((preset) => {
          const dims = parseDimensions(preset.dimensionsJson);
          return (
            <Card key={preset.id}>
              <Link
                href={`/rubrics/${preset.id}`}
                className="font-medium hover:text-accent-hover transition-colors"
              >
                {preset.name}
              </Link>
              {preset.description && <p className="text-sm text-muted mt-1.5">{preset.description}</p>}
              <p className="text-xs text-muted mt-3 tabular-nums">{dims.length} dimensions</p>
              <div className="mt-4">
                <CloneRubricButton id={preset.id} variant="secondary" />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
