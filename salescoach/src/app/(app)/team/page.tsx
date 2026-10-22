import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { seatSummary } from "@/lib/seats";
import { inviteLink } from "@/lib/invites";
import { PageHeader } from "@/components/ui";
import { TeamManager } from "@/components/team/team-manager";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await currentUser();
  if (!isManagerRole(user.role)) redirect("/me");

  const [summary, members, invites] = await Promise.all([
    seatSummary(user.org),
    db.user.findMany({
      where: { orgId: user.orgId, removedAt: null },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, role: true, title: true, createdAt: true },
    }),
    db.invite.findMany({
      where: { orgId: user.orgId, status: "pending", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, token: true, expiresAt: true, clerkInvitationId: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Invite reps and managers, manage roles, and keep seats in line with your plan."
      />
      <TeamManager
        me={{ id: user.id, role: user.role }}
        seats={summary}
        hasSubscription={Boolean(user.org.stripeSubscriptionId)}
        paidSeats={user.org.stripeSeatCount}
        members={members.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
        invites={invites.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          link: inviteLink(i.token),
          expiresAt: i.expiresAt.toISOString(),
          emailed: Boolean(i.clerkInvitationId),
        }))}
        joinLink={user.org.joinCode ? inviteLink(user.org.joinCode) : null}
      />
    </div>
  );
}
