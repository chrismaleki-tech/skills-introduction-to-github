import { db } from "@/lib/db";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { METHODOLOGY_PRESETS } from "@/lib/presets";
import { InstallPresetsButton } from "@/components/admin/install-presets-button";

export default async function AdminPresetsPage() {
  const installed = await db.methodology.findMany({
    where: { isPreset: true, orgId: null },
    select: { id: true, name: true, description: true, dimensionsJson: true, _count: { select: { grades: true } } },
    orderBy: { name: "asc" },
  });
  const installedNames = new Set(installed.map((p) => p.name));
  const missing = METHODOLOGY_PRESETS.filter((p) => !installedNames.has(p.name));

  return (
    <div>
      <PageHeader
        title="Methodology presets"
        subtitle="The global rubric library every tenant clones from. On a fresh production database, install these before onboarding the first customer."
        actions={<InstallPresetsButton missingCount={missing.length} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title={`Installed (${installed.length})`}>
          {installed.length === 0 ? (
            <EmptyState
              title="No presets installed"
              hint="Tenants have nothing to clone — install the library with the button above."
            />
          ) : (
            <div className="space-y-3">
              {installed.map((p) => {
                let dims = 0;
                try {
                  dims = (JSON.parse(p.dimensionsJson) as unknown[]).length;
                } catch {
                  dims = 0;
                }
                return (
                  <div key={p.id} className="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted mt-0.5">{p.description}</div>
                    <div className="text-xs text-muted mt-1">
                      {dims} dimensions · used by {p._count.grades} grade{p._count.grades === 1 ? "" : "s"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title={`Missing from database (${missing.length})`}>
          {missing.length === 0 ? (
            <EmptyState title="All code presets are installed" />
          ) : (
            <div className="space-y-3">
              {missing.map((p) => (
                <div key={p.name} className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2.5">
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-xs text-muted mt-0.5">{p.description}</div>
                  <div className="text-xs text-muted mt-1">{p.dimensions.length} dimensions</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
