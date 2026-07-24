import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader, Card, Stat, StatusPill, EmptyState, fmtDateTime } from "@/components/ui";
import { aiAvailable } from "@/lib/ai";
import { vapiConfigured } from "@/lib/vapi";
import { objectStorageConfigured, isProduction } from "@/lib/config";
import { demoSwitcherAllowed } from "@/lib/session";
import { sinceDaysAgo } from "@/lib/metering";

function CheckPill({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {detail && <div className="text-xs text-muted">{detail}</div>}
      </div>
      <span
        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
          ok
            ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30"
            : "text-amber-400 bg-amber-400/10 border-amber-400/30"
        }`}
      >
        {ok ? "OK" : "Off"}
      </span>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const [orgCount, userCount, callCount, gradeCount, dealCount, jobsByStatus, usageByType, failedJobs] =
    await Promise.all([
      db.org.count(),
      db.user.count(),
      db.call.count(),
      db.grade.count(),
      db.deal.count(),
      db.job.groupBy({ by: ["status"], _count: true }),
      db.usageEvent.groupBy({
        by: ["type"],
        where: { createdAt: { gte: sinceDaysAgo(30) } },
        _sum: { quantity: true },
      }),
      db.job.findMany({
        where: { status: "FAILED" },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { org: { select: { name: true } } },
      }),
    ]);

  const jobs = Object.fromEntries(jobsByStatus.map((j) => [j.status, j._count])) as Record<string, number>;

  return (
    <div>
      <PageHeader
        title="Platform Admin"
        subtitle="Cross-tenant maintenance: environment status, tenants, background jobs, and the global preset library."
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <Stat label="Organizations" value={orgCount} />
        <Stat label="Users" value={userCount} />
        <Stat label="Calls" value={callCount} />
        <Stat label="Grades" value={gradeCount} />
        <Stat label="Deals" value={dealCount} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Environment">
          <div className="space-y-2">
            <CheckPill ok={isProduction()} label="Production mode" detail={process.env.NODE_ENV || "development"} />
            <CheckPill
              ok={!demoSwitcherAllowed()}
              label="Demo switcher disabled"
              detail="Must be off in production"
            />
            <CheckPill ok={aiAvailable()} label="OpenAI" detail="Real grading, role-play, and Ask" />
            <CheckPill ok={Boolean(process.env.DEEPGRAM_API_KEY?.trim())} label="Deepgram" detail="Audio transcription" />
            <CheckPill ok={vapiConfigured()} label="Vapi" detail="Voice role-play" />
            <CheckPill ok={objectStorageConfigured()} label="Object storage" detail="S3-compatible uploads" />
          </div>
        </Card>

        <div className="space-y-6">
          <Card
            title="Job queue"
            action={
              <Link href="/admin/jobs" className="text-xs text-accent-hover hover:underline">
                View all →
              </Link>
            }
          >
            <div className="grid grid-cols-4 gap-3">
              {["PENDING", "RUNNING", "DONE", "FAILED"].map((s) => (
                <div key={s} className="text-center">
                  <div className="text-2xl font-semibold tabular-nums">{jobs[s] ?? 0}</div>
                  <div className="mt-1">
                    <StatusPill status={s} />
                  </div>
                </div>
              ))}
            </div>
            {failedJobs.length > 0 && (
              <div className="mt-4 space-y-2">
                {failedJobs.map((job) => (
                  <div key={job.id} className="rounded-lg border border-rose-400/20 bg-rose-400/5 px-3 py-2 text-xs">
                    <span className="font-medium">{job.type}</span>
                    <span className="text-muted"> · {job.org.name} · {fmtDateTime(job.createdAt)}</span>
                    {job.lastError && <div className="text-rose-300/90 mt-0.5 truncate">{job.lastError}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Usage · last 30 days (all tenants)">
            {usageByType.length === 0 ? (
              <EmptyState title="No usage events yet" />
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {usageByType.map((u) => (
                    <tr key={u.type} className="border-b border-line last:border-0">
                      <td className="py-1.5">{u.type.replaceAll("_", " ")}</td>
                      <td className="py-1.5 text-right tabular-nums">{u._sum.quantity ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Observability">
            <p className="text-xs text-muted mb-3">
              This console owns business objects (tenants, users, jobs). Metrics, logs, and alerts belong in
              your monitoring stack.
            </p>
            {observabilityLinks().length ? (
              <div className="flex flex-wrap gap-2">
                {observabilityLinks().map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm hover:bg-line transition-colors"
                  >
                    {link.label} ↗
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">
                Set <code className="bg-surface-2 rounded px-1">OBSERVABILITY_LINKS</code> (e.g.{" "}
                <code className="bg-surface-2 rounded px-1">Grafana=https://…,Sentry=https://…</code>) to link
                your dashboards here.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Parse OBSERVABILITY_LINKS="Label=https://…,Label2=https://…" into links. */
function observabilityLinks(): { label: string; href: string }[] {
  return (process.env.OBSERVABILITY_LINKS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const eq = entry.indexOf("=");
      if (eq <= 0) return null;
      const label = entry.slice(0, eq).trim();
      const href = entry.slice(eq + 1).trim();
      return label && href.startsWith("http") ? { label, href } : null;
    })
    .filter((link): link is { label: string; href: string } => Boolean(link));
}
