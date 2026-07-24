import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { rawSessionUserOrNull, verifyPassword } from "@/lib/session";
import { consoleRoleForEmail, adminSessionMinutes } from "@/lib/config";
import { mintScopedToken } from "@/lib/session-token";
import { ELEVATION_COOKIE, ELEVATION_SCOPE } from "@/lib/platform-admin";
import { recordAudit } from "@/lib/audit";

/**
 * Step-up authentication for the platform console: re-enter your password to
 * mint a short-lived elevated session (separate cookie from the product
 * session). Deliberately not covered by the demo-switcher fallback.
 */
export async function POST(req: Request) {
  const user = await rawSessionUserOrNull();
  const role = user ? consoleRoleForEmail(user.email) : null;
  if (!user || !role) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const password = body.password ?? "";
  const valid = user.passwordHash ? await verifyPassword(password, user.passwordHash) : false;
  if (!valid) {
    await recordAudit({
      actor: user,
      consoleRole: role,
      action: "CONSOLE_ELEVATION_DENIED",
      req,
    });
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  const minutes = adminSessionMinutes();
  const store = await cookies();
  store.set(ELEVATION_COOKIE, mintScopedToken(ELEVATION_SCOPE, user.id, minutes), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: minutes * 60,
  });
  await recordAudit({
    actor: user,
    consoleRole: role,
    action: "CONSOLE_ELEVATED",
    req,
    meta: { minutes },
  });
  return NextResponse.json({ ok: true, minutes, role });
}

/** Drop elevation early. */
export async function DELETE() {
  const store = await cookies();
  store.delete(ELEVATION_COOKIE);
  return NextResponse.json({ ok: true });
}
