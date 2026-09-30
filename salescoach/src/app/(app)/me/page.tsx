import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { Card, EmptyState, LinkButton, PageHeader, StatusPill, fmtDate } from "@/components/ui";
import { RepDetail } from "@/components/dashboard/rep-detail";
import { monthStart } from "@/components/dashboard/insights";

export default async function MePage() {
  const user = await currentUser();
  const now = new Date();

  const [openAssignments, gradedCallsThisMonth] = await Promise.all([
    db.assignment.findMany({
      where: { orgId: user.orgId, assignedToId: user.id, status: { not: "COMPLETED" } },
      include: { scenario: { select: { id: true, title: true } }, assignedBy: { select: { name: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
    db.grade.count({
      where: {
        orgId: user.orgId,
        subjectType: "CALL",
        call: { repId: user.id, callDate: { gte: monthStart(now) } },
      },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="My Performance"
        subtitle="Your scores, skill breakdown, and open practice assignments."
      />

      <div className="space-y-6 mb-6">
        <Card
          title="Open assignments"
          action={
            <Link href="/assignments" className="text-xs font-medium text-accent-hover hover:underline">
              View all
            </Link>
          }
        >
          {openAssignments.length === 0 ? (
            <EmptyState title="No open assignments" hint="Assignments from your manager will show up here." />
          ) : (
            <ul className="divide-y divide-line">
              {openAssignments.map((a) => {
                const overdue = a.dueDate != null && a.dueDate < now;
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                    <StatusPill status={a.status} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {a.type === "ROLEPLAY"
                          ? `Role-play: ${a.scenario?.title ?? "scenario removed"}`
                          : "Upload calls for review"}
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        {a.doneCount} of {a.targetCount} done · assigned by {a.assignedBy.name}
                        {a.dueDate && (
                          <span className={overdue ? "text-rose-400" : ""}>
                            {" "}· due {fmtDate(a.dueDate)}{overdue ? " (overdue)" : ""}
                          </span>
                        )}
                      </div>
                      {a.note && <div className="text-xs text-muted mt-0.5">{a.note}</div>}
                    </div>
                    <LinkButton href={a.type === "ROLEPLAY" ? "/roleplay" : "/calls/upload"} variant="secondary">
                      {a.type === "ROLEPLAY" ? "Start role-play" : "Upload a call"}
                    </LinkButton>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {gradedCallsThisMonth === 0 && (
          <div className="rounded-xl border border-sky-400/30 bg-sky-400/5 px-4 py-3 text-sm text-sky-300/90">
            None of your calls have been graded this month. Flag an important call for feedback or{" "}
            <Link href="/calls/upload" className="font-medium underline underline-offset-2 hover:text-sky-200">
              upload one directly
            </Link>{" "}
            — flagged and uploaded calls are always graded, regardless of sampling.
          </div>
        )}
      </div>

      <RepDetail repId={user.id} orgId={user.orgId} selfView={true} showAssignments={false} />
    </div>
  );
}
