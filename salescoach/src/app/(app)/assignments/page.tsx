import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader, StatusPill, fmtDate } from "@/components/ui";
import { NewAssignmentForm } from "@/components/dashboard/assignment-form";
import { CompleteButton } from "@/components/dashboard/complete-button";

// Assignment row shape after live-progress enrichment.
type EnrichedAssignment = Awaited<ReturnType<typeof loadAssignments>>[number];

async function loadAssignments(where: { orgId: string; assignedToId?: string }) {
  const assignments = await db.assignment.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, name: true } },
      assignedBy: { select: { name: true } },
      scenario: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Live progress: count qualifying activity created after the assignment,
  // and show the larger of stored vs computed (stored field stays untouched).
  return Promise.all(
    assignments.map(async (a) => {
      let computed = 0;
      if (a.type === "ROLEPLAY" && a.scenarioId) {
        computed = await db.roleplaySession.count({
          where: { repId: a.assignedToId, scenarioId: a.scenarioId, status: "GRADED", startedAt: { gte: a.createdAt } },
        });
      } else if (a.type === "UPLOAD_CALLS") {
        computed = await db.call.count({
          where: { repId: a.assignedToId, source: "UPLOAD", createdAt: { gte: a.createdAt } },
        });
      }
      return { ...a, done: Math.max(a.doneCount, computed) };
    }),
  );
}

function AssignmentRow({
  a,
  showRep,
  canComplete,
  now,
}: {
  a: EnrichedAssignment;
  showRep: boolean;
  canComplete: boolean;
  now: Date;
}) {
  const overdue = a.status !== "COMPLETED" && a.dueDate != null && a.dueDate < now;
  const pct = Math.min(100, Math.round((a.done / Math.max(a.targetCount, 1)) * 100));
  return (
    <li className="py-4 flex flex-wrap items-start gap-4">
      <div className="flex-1 min-w-56">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={a.status} />
          {showRep && (
            <Link href={`/team/${a.assignedTo.id}`} className="text-sm font-medium hover:text-brand transition-colors">
              {a.assignedTo.name}
            </Link>
          )}
          <span className="text-sm font-medium">
            {a.type === "ROLEPLAY" ? (
              <>
                Role-play:{" "}
                {a.scenario ? (
                  <Link href="/roleplay" className="text-brand hover:underline">
                    {a.scenario.title}
                  </Link>
                ) : (
                  "scenario removed"
                )}
              </>
            ) : (
              "Upload calls for review"
            )}
          </span>
        </div>
        <div className="text-xs text-muted mt-1.5">
          Assigned by {a.assignedBy.name} on {fmtDate(a.createdAt)}
          {a.status === "COMPLETED" && a.completedAt ? (
            <> · completed {fmtDate(a.completedAt)}</>
          ) : a.dueDate ? (
            <>
              {" "}· <span className={overdue ? "text-rose-700 font-medium" : ""}>due {fmtDate(a.dueDate)}{overdue ? " (overdue)" : ""}</span>
            </>
          ) : (
            <> · no due date</>
          )}
        </div>
        {a.note && <div className="text-xs text-muted mt-1">{a.note}</div>}
      </div>
      <div className="w-40 shrink-0">
        <div className="text-xs text-muted mb-1 tabular-nums">
          {a.done} of {a.targetCount} done
        </div>
        <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
          <div
            className={`h-full rounded-full ${a.status === "COMPLETED" || pct >= 100 ? "bg-emerald-400/80" : "bg-accent"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {canComplete && a.status !== "COMPLETED" && <CompleteButton id={a.id} done={a.done} target={a.targetCount} />}
    </li>
  );
}

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ rep?: string | string[] }>;
}) {
  const sp = await searchParams;
  const user = await currentUser();
  const manager = isManagerRole(user.role);
  const now = new Date();

  const assignments = await loadAssignments(
    manager ? { orgId: user.orgId } : { orgId: user.orgId, assignedToId: user.id },
  );

  const open = assignments
    .filter((a) => a.status !== "COMPLETED")
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));
  const completed = assignments
    .filter((a) => a.status === "COMPLETED")
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));

  let reps: { id: string; name: string; title: string }[] = [];
  let scenarios: { id: string; title: string }[] = [];
  if (manager) {
    [reps, scenarios] = await Promise.all([
      db.user.findMany({
        where: { orgId: user.orgId, role: "REP" },
        select: { id: true, name: true, title: true },
        orderBy: { name: "asc" },
      }),
      db.scenario.findMany({
        where: { orgId: user.orgId },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
      }),
    ]);
  }
  const repParam = Array.isArray(sp.rep) ? sp.rep[0] : sp.rep;
  const defaultRepId = reps.some((r) => r.id === repParam) ? repParam : undefined;

  const canComplete = (a: EnrichedAssignment) => manager || a.assignedTo.id === user.id;

  return (
    <div>
      <PageHeader
        title="Assignments"
        subtitle={
          manager
            ? "Practice work across the team. Progress counts graded role-plays and uploaded calls automatically."
            : "Practice work from your manager. Progress counts your graded role-plays and uploaded calls automatically."
        }
      />

      {manager && (
        <Card title="New assignment" className="mb-6">
          {reps.length === 0 ? (
            <EmptyState title="No reps to assign to" hint="Add reps to the team first." />
          ) : (
            <NewAssignmentForm reps={reps} scenarios={scenarios} defaultRepId={defaultRepId} />
          )}
        </Card>
      )}

      <Card title={`Open · ${open.length}`} className="mb-6">
        {open.length === 0 ? (
          <EmptyState
            title="No open assignments"
            hint={manager ? "Create one above to put practice on someone's plate." : "You are all caught up."}
          />
        ) : (
          <ul className="divide-y divide-line">
            {open.map((a) => (
              <AssignmentRow key={a.id} a={a} showRep={manager} canComplete={canComplete(a)} now={now} />
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Completed · ${completed.length}`}>
        {completed.length === 0 ? (
          <EmptyState title="Nothing completed yet" />
        ) : (
          <ul className="divide-y divide-line">
            {completed.map((a) => (
              <AssignmentRow key={a.id} a={a} showRep={manager} canComplete={false} now={now} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
