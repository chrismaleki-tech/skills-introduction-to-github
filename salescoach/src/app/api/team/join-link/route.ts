import { NextResponse } from "next/server";
import { currentUser, isManagerRole } from "@/lib/session";
import { inviteLink, setJoinLink } from "@/lib/invites";

// POST /api/team/join-link { enabled } — turn the shareable team link on/off.
// Anyone with the link joins as a rep while seats remain; turning it off
// invalidates the old link immediately.

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { enabled?: unknown } | null;
  const org = await setJoinLink(user.orgId, Boolean(body?.enabled));
  return NextResponse.json({ ok: true, link: org.joinCode ? inviteLink(org.joinCode) : null });
}
