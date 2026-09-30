import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader, Stat, StatusPill } from "@/components/ui";
import { LogTimeForm, NewProjectForm } from "@/components/erp/deep-forms";

export default async function ProjectsPage() {
  const user = await currentUser();
  const manager = isManagerRole(user.role);

  const [projects, deals, accounts, hours] = await Promise.all([
    db.project.findMany({
      where: { orgId: user.orgId },
      include: {
        tasks: { orderBy: { sortOrder: "asc" } },
        timeEntries: {
          orderBy: { workDate: "desc" },
          take: 4,
          include: { user: { select: { name: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.deal.findMany({
      where: { orgId: user.orgId },
      select: { id: true, name: true },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    db.account.findMany({
      where: { orgId: user.orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 40,
    }),
    db.timeEntry.groupBy({
      by: ["projectId"],
      where: { orgId: user.orgId },
      _sum: { hours: true },
    }),
  ]);

  const hoursByProject = Object.fromEntries(hours.map((h) => [h.projectId, h._sum.hours ?? 0]));
  const totalHours = hours.reduce((s, h) => s + (h._sum.hours ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Projects & time"
        subtitle="Implementation projects linked to CRM deals, with billable time tracking."
      />
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Stat label="Projects" value={projects.length} />
        <Stat label="Hours logged" value={totalHours} />
        <Stat
          label="Active"
          value={projects.filter((p) => p.status === "active").length}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {manager && (
          <Card title="New project">
            <NewProjectForm deals={deals} accounts={accounts} />
          </Card>
        )}
        <Card title="Log time">
          <LogTimeForm
            projects={projects.map((p) => ({
              id: p.id,
              code: p.code,
              name: p.name,
              tasks: p.tasks.map((t) => ({ id: t.id, title: t.title })),
            }))}
          />
        </Card>
      </div>

      <div className="space-y-4">
        {projects.length === 0 ? (
          <Card>
            <EmptyState title="No projects" hint="Create an implementation project from a won deal." />
          </Card>
        ) : (
          projects.map((p) => {
            const logged = hoursByProject[p.id] ?? 0;
            return (
              <Card key={p.id} title={`${p.code} · ${p.name}`}>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <StatusPill status={p.status} />
                  <span className="text-xs text-muted">
                    {logged}h / {p.budgetHours || "—"}h budget
                    {p.budgetAmount ? ` · ${fmtMoney(p.budgetAmount, p.currency)}` : ""}
                  </span>
                </div>
                {p.tasks.length > 0 && (
                  <ul className="text-sm mb-3 space-y-1">
                    {p.tasks.map((t) => (
                      <li key={t.id} className="flex justify-between gap-3">
                        <span>{t.title}</span>
                        <span className="text-xs text-muted">
                          {t.status} · {t.estimateHrs}h
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {p.timeEntries.length > 0 && (
                  <ul className="text-xs text-muted divide-y divide-line">
                    {p.timeEntries.map((t) => (
                      <li key={t.id} className="py-1.5 flex justify-between gap-3">
                        <span>
                          {t.hours}h · {t.user?.name ?? "Team"} · {t.notes || "Time"}
                        </span>
                        <span>{t.workDate.toISOString().slice(0, 10)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
