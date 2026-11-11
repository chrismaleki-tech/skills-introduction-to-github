import { NextResponse } from "next/server";
import { JOIN_COOKIE, joinOrgAsExistingUser, resolveJoinToken } from "@/lib/invites";
import { currentUser } from "@/lib/session";

// POST /api/join/accept { token } — move the signed-in account onto the team
// behind an invite or join link.

export async function POST(req: Request) {
  const user = await currentUser();
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const target = await resolveJoinToken(token);
  if (!target) {
    return NextResponse.json({ error: "This invite link is no longer valid." }, { status: 404 });
  }
  try {
    const result = await joinOrgAsExistingUser(user.id, target);
    const res = NextResponse.json({ ok: true, ...result });
    res.cookies.delete(JOIN_COOKIE);
    return res;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not join." }, { status: 400 });
  }
}
