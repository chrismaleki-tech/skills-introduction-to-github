import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isClerkEnabled } from "@/lib/auth-mode";
import { startFreshWorkspace } from "@/lib/provision";

// POST /api/account/start-fresh — a removed teammate spins up a personal
// workspace. Deliberately bypasses currentUser(), which redirects removed
// accounts to /removed.

export async function POST() {
  if (!isClerkEnabled()) return NextResponse.json({ error: "Not available in demo mode." }, { status: 400 });
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (!user.removedAt) {
    return NextResponse.json({ error: "You already have an active workspace." }, { status: 409 });
  }

  const updated = await startFreshWorkspace(user.id);
  return NextResponse.json({ ok: true, orgName: updated.org.name });
}
