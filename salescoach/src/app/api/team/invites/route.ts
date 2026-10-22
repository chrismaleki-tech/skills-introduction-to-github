import { NextResponse } from "next/server";
import { currentUser, isManagerRole } from "@/lib/session";
import { createInvites, inviteLink, isRole, parseEmailList } from "@/lib/invites";
import { MAX_SEATS } from "@/lib/seats";

// POST /api/team/invites { emails: string, role } — invite a batch of teammates.
// Emails go out through Clerk when configured; the response always includes a
// link per invite so the admin can share it directly.

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { emails?: unknown; role?: unknown } | null;
  const raw = typeof body?.emails === "string" ? body.emails : Array.isArray(body?.emails) ? body.emails.join("\n") : "";
  const role = isRole(body?.role) ? body.role : "REP";
  const { valid, invalid } = parseEmailList(raw);

  if (valid.length === 0) {
    return NextResponse.json(
      { error: invalid.length ? `No valid email addresses found (${invalid.slice(0, 3).join(", ")}).` : "Enter at least one email address." },
      { status: 400 },
    );
  }
  if (valid.length > MAX_SEATS) {
    return NextResponse.json({ error: `Invite up to ${MAX_SEATS} people at a time.` }, { status: 400 });
  }

  try {
    const result = await createInvites({
      actor: { id: user.id, role: user.role, orgId: user.orgId, name: user.name },
      org: user.org,
      emails: valid,
      role,
    });
    if (result.seatError) {
      return NextResponse.json({ error: result.seatError, seatLimited: true, skipped: result.skipped }, { status: 409 });
    }
    return NextResponse.json({
      ok: true,
      created: result.created.map((c) => ({ ...c, link: inviteLink(c.token) })),
      skipped: result.skipped,
      invalid,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create invites.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
