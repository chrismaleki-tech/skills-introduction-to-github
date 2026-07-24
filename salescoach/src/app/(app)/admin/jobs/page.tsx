import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader, Card, StatusPill, EmptyState, fmtDateTime } from "@/components/ui";
import { RetryJobButton, RunPendingButton } from "@/components/admin/job-actions";
import { consoleActor } from "@/lib/platform-admin";

const FILTERS = ["ALL", "PENDING", "RUNNING", "DONE", "FAILED"];

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = FILTERS.includes(status?.toUpperCase() ?? "") ? status!.toUpperCase() : "ALL";
  const actor = await consoleActor();
  const canManage = actor?.role === "ADMIN";

  const jobs = await db.job.findMany({
    where: filter === "ALL" ? undefined : { status: filter },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { org: { select: { name: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Background jobs"
        subtitle="Grading, transcription, and retention work items. Retry failures or drain the pending queue."
        actions={canManage ? <RunPendingButton /> : undefined}
      />

      <div className="flex gap-1.5 mb-4">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "ALL" ? "/admin/jobs" : `/admin/jobs?status=${f}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === f
                ? "border-accent text-accent-hover bg-accent/10"
                : "border-line text-muted hover:text-foreground"
            }`}
          >
            {f}
          </Link>
        ))}
      </div>

      <Card>
        {jobs.length === 0 ? (
          <EmptyState title="No jobs match this filter" />
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{job.type.replaceAll("_", " ")}</span>
                    <StatusPill status={job.status} />
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {job.org.name} · created {fmtDateTime(job.createdAt)} · attempts {job.attempts}
                    {job.finishedAt && ` · finished ${fmtDateTime(job.finishedAt)}`}
                  </div>
                  {job.lastError && (
                    <div className="text-xs text-rose-300/90 mt-1 max-w-2xl truncate" title={job.lastError}>
                      {job.lastError}
                    </div>
                  )}
                </div>
                {canManage && job.status === "FAILED" && <RetryJobButton id={job.id} />}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
