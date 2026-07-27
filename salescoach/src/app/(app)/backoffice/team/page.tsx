import { db } from "@/lib/db";
import { backofficeActor } from "@/lib/backoffice";
import { planFor, seatLimitReached } from "@/lib/billing";
import { PageHeader, Card, fmtDateTime } from "@/components/ui";
import { MemberActions } from "@/components/backoffice/member-actions";
import { InviteForm } from "@/components/backoffice/invite-form";

export default async function BackofficeTeamPage() {
  const actor = (await backofficeActor())!;
  const orgId = actor.user.orgId;

  const [org, users] = await Promise.all([
    db.org.findUniqueOrThrow({ where: { id: orgId }, select: { plan: true } }),
    db.user.findMany({
      where: { orgId },
      orderBy: [{ disabledAt: "asc" }, { role: "asc" }, { name: "asc" }],
    }),
  ]);

  const plan = planFor(org.plan);
  const activeSeats = users.filter((u) => !u.disabledAt).length;
  const atLimit = seatLimitReached(plan, activeSeats);

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle={`Seat lifecycle for your workspace: invite, change roles, reset passwords, deactivate. ${
          plan.seatLimit != null ? `${activeSeats} of ${plan.seatLimit} ${plan.name} seats in use.` : ""
        }`}
      />

      {atLimit && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2.5 text-sm text-amber-300/90 mb-4">
          Seat limit reached for the {plan.name} plan. Deactivate a seat or upgrade under Plan &amp; Billing to
          invite more people.
        </div>
      )}

      <Card title={`Seats (${users.length})`} className="mb-4">
        <div className="space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 ${
                user.disabledAt ? "bg-surface opacity-70" : "bg-surface-2"
              }`}
            >
              <div className="min-w-0">
                <div className="font-medium text-sm">
                  {user.name}
                  <span className="text-muted font-normal"> · {user.title || user.role.toLowerCase()}</span>
                  {user.disabledAt && (
                    <span className="ml-2 rounded-full border border-rose-400/40 text-rose-300 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                      Deactivated
                    </span>
                  )}
                  {user.id === actor.user.id && (
                    <span className="ml-2 rounded-full border border-line text-muted px-2 py-0.5 text-[10px] uppercase tracking-wider">
                      You
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted truncate">
                  {user.email}
                  {" · "}
                  {user.lastLoginAt ? `last login ${fmtDateTime(user.lastLoginAt)}` : "never logged in"}
                  {!user.passwordHash && !user.disabledAt && (
                    <span className="text-amber-400"> · no password set — reset one to let them log in</span>
                  )}
                </div>
              </div>
              <MemberActions
                userId={user.id}
                role={user.role}
                disabled={Boolean(user.disabledAt)}
                isSelf={user.id === actor.user.id}
                canManageAdmins={actor.orgAdmin}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card title="Invite a teammate">
        <InviteForm canCreateAdmin={actor.orgAdmin} />
      </Card>
    </div>
  );
}
