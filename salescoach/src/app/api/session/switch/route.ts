import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { demoSwitcherAllowed, setSessionUser } from "@/lib/session";

export async function POST(req: Request) {
  if (!demoSwitcherAllowed()) {
    return NextResponse.json(
      { error: "Demo user switcher is disabled in this environment." },
      { status: 403 },
    );
  }
  const { userId } = (await req.json()) as { userId?: string };
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "unknown user" }, { status: 404 });
  await setSessionUser(userId);
  return NextResponse.json({ ok: true });
}
