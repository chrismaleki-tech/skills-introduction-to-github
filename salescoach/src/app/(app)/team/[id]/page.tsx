import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { LinkButton, PageHeader } from "@/components/ui";
import { RepDetail } from "@/components/dashboard/rep-detail";

export default async function TeamRepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  // Reps only ever see their own data, and anyone viewing themself belongs on /me.
  if (!isManagerRole(user.role) || user.id === id) redirect("/me");

  const rep = await db.user.findFirst({ where: { id, orgId: user.orgId } });
  if (!rep) notFound();

  return (
    <div>
      <PageHeader
        title={rep.name}
        subtitle={`${rep.title || rep.role} · graded activity, skill breakdown, and assignments`}
        actions={<LinkButton href={`/assignments?rep=${rep.id}`}>Assign practice</LinkButton>}
      />
      <RepDetail repId={rep.id} orgId={user.orgId} selfView={false} showAssignments={true} />
    </div>
  );
}
