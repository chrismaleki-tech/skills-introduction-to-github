import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import {
  EmptyState,
  LinkButton,
  PageHeader,
  SamplingPill,
  ScoreBadge,
  StatusPill,
  fmtDateTime,
  fmtDuration,
} from "@/components/ui";

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ rep?: string }>;
}) {
  const { rep: repParam } = await searchParams;
  const user = await currentUser();
  const manager = isManagerRole(user.role);

  // Reps are hard-scoped to their own calls; managers see the org and can
  // narrow to one rep via ?rep=<id>.
  const repFilter = manager ? repParam || undefined : user.id;
  const scope = { orgId: user.orgId, ...(repFilter ? { repId: repFilter } : {}) };

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [reps, calls, monthCalls] = await Promise.all([
    manager
      ? db.user.findMany({
          where: { orgId: user.orgId, role: "REP" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    db.call.findMany({
      where: scope,
      include: {
        rep: { select: { name: true } },
        grade: { select: { overallScore: true, managerOverrideScore: true } },
      },
      orderBy: { callDate: "desc" },
      take: 100,
    }),
    db.call.findMany({
      where: { ...scope, callDate: { gte: monthStart } },
      select: { status: true, samplingStatus: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Calls"
        subtitle={
          manager
            ? `Every call ingested across ${user.org.name}, with sampling decisions and grades.`
            : "Your recorded calls, with sampling decisions and grades."
        }
        actions={<LinkButton href="/calls/upload">Upload call</LinkButton>}
      />

      {manager && reps.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted text-xs uppercase tracking-wider mr-1">Rep</span>
          <FilterLink href="/calls" active={!repFilter}>
            All reps
          </FilterLink>
          {reps.map((r) => (
            <FilterLink key={r.id} href={`/calls?rep=${r.id}`} active={repFilter === r.id}>
              {r.name}
            </FilterLink>
          ))}
        </div>
      )}

      <CoverageStrip monthCalls={monthCalls} />

      {calls.length === 0 ? (
        <div className="bg-surface border border-line rounded-xl">
          <EmptyState
            title="No calls yet"
            hint="Upload a recording or transcript, or point your dialer at the ingestion webhook."
          />
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="hidden md:flex items-center gap-3 px-4 py-2.5 border-b border-line text-[11px] text-muted uppercase tracking-wider">
            <span className="w-28 shrink-0">Date</span>
            {manager && <span className="w-24 shrink-0">Rep</span>}
            <span className="flex-1 min-w-0">Prospect</span>
            <span className="w-16 shrink-0">Length</span>
            <span className="w-16 shrink-0">Source</span>
            <span className="w-24 shrink-0">Status</span>
            <span className="w-40 shrink-0">Sampling</span>
            <span className="w-10 shrink-0 text-right">Score</span>
          </div>
          <div className="divide-y divide-line">
            {calls.map((c) => (
              <Link
                key={c.id}
                href={`/calls/${c.id}`}
                className="flex flex-wrap md:flex-nowrap items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
              >
                <span className="w-28 shrink-0 text-sm text-muted tabular-nums">
                  {fmtDateTime(c.callDate)}
                </span>
                {manager && (
                  <span className="w-24 shrink-0 text-sm truncate">{c.rep.name}</span>
                )}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">
                    {c.prospectName || "Unknown prospect"}
                  </span>
                  <span className="block text-xs text-muted">
                    {c.callType.replaceAll("_", " ")} · {c.direction}
                  </span>
                </span>
                <span className="w-16 shrink-0 text-sm text-muted tabular-nums">
                  {fmtDuration(c.durationSec)}
                </span>
                <span className="w-16 shrink-0 text-xs text-muted">{c.source.toLowerCase()}</span>
                <span className="w-24 shrink-0">
                  <StatusPill status={c.status} />
                </span>
                <span className="w-40 shrink-0">
                  <SamplingPill status={c.samplingStatus} />
                </span>
                <span className="w-10 shrink-0 text-right">
                  {c.grade ? (
                    <ScoreBadge
                      score={c.grade.managerOverrideScore ?? c.grade.overallScore}
                      size="sm"
                    />
                  ) : (
                    <span className="text-muted text-sm">—</span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
      {calls.length === 100 && (
        <p className="text-xs text-muted mt-3">Showing the 100 most recent calls.</p>
      )}
    </div>
  );
}

// Locked product requirement: managers always see what fraction of this
// month's call volume was graded, and why the rest was not.
function CoverageStrip({
  monthCalls,
}: {
  monthCalls: { status: string; samplingStatus: string }[];
}) {
  const graded = monthCalls.filter((c) => c.status === "GRADED");
  const count = (statuses: string[]) =>
    graded.filter((c) => statuses.includes(c.samplingStatus)).length;

  const sampled = count(["SAMPLED", "WITHIN_THRESHOLD"]);
  const flagged = count(["REP_FLAGGED", "MANAGER_REQUESTED"]);
  const manual = count(["MANUAL_UPLOAD"]);
  const skipped = monthCalls.filter((c) => c.status === "SKIPPED").length;
  const failed = monthCalls.filter((c) => c.status === "FAILED").length;

  const gradedDetail = [
    sampled > 0 ? `${sampled} sampled` : null,
    flagged > 0 ? `${flagged} flagged` : null,
    manual > 0 ? `${manual} manual` : null,
  ]
    .filter(Boolean)
    .join(" + ");

  const parts = [
    `${monthCalls.length} ingested`,
    `${graded.length} graded${gradedDetail ? ` (${gradedDetail})` : ""}`,
    `${skipped} skipped (too short)`,
    ...(failed > 0 ? [`${failed} failed`] : []),
  ];

  return (
    <div className="mb-6 rounded-xl border border-line bg-surface px-5 py-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-xs text-muted uppercase tracking-wider">Coverage this month</span>
      <span className="text-sm tabular-nums">{parts.join(" · ")}</span>
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-accent border-accent text-white"
          : "bg-surface-2 border-line text-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
