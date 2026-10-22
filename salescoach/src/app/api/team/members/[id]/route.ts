import { NextResponse } from "next/server";
import { currentUser, isManagerRole } from "@/lib/session";
import { changeMemberRole, isRole, removeMember } from "@/lib/invites";

// PATCH /api/team/members/:id { role } — change a teammate's role.
// DELETE /api/team/members/:id — remove a teammate (soft; history is kept).

type Ctx = { params: Promise<{ id: string }> };

function actorOf(user: Awaited<ReturnType<typeof currentUser>>) {
  return { id: user.id, role: user.role, orgId: user.orgId, name: user.name };
}

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { role?: unknown } | null;
  if (!isRole(body?.role)) return NextResponse.json({ error: "Choose a valid role." }, { status: 400 });
  try {
    const member = await changeMemberRole(actorOf(user), id, body.role);
    return NextResponse.json({ ok: true, role: member.role });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed." }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const { id } = await params;
  try {
    await removeMember(actorOf(user), id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Remove failed." }, { status: 400 });
  }
}
