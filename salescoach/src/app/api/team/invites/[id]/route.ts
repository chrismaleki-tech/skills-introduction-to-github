import { NextResponse } from "next/server";
import { currentUser, isManagerRole } from "@/lib/session";
import { inviteLink, resendInvite, revokeInvite } from "@/lib/invites";

// POST /api/team/invites/:id { action: "resend" } — extend and re-send.
// DELETE /api/team/invites/:id — revoke a pending invite.

type Ctx = { params: Promise<{ id: string }> };

function actorOf(user: Awaited<ReturnType<typeof currentUser>>) {
  return { id: user.id, role: user.role, orgId: user.orgId, name: user.name };
}

export async function POST(req: Request, { params }: Ctx) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
  if (body?.action !== "resend") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  try {
    const invite = await resendInvite(actorOf(user), id);
    return NextResponse.json({ ok: true, link: inviteLink(invite.token), expiresAt: invite.expiresAt });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Resend failed." }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const { id } = await params;
  try {
    await revokeInvite(actorOf(user), id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Revoke failed." }, { status: 400 });
  }
}
