import { NextResponse } from "next/server";
import { isClerkEnabled } from "@/lib/auth-mode";
import { JOIN_COOKIE, resolveJoinToken } from "@/lib/invites";
import { currentUser } from "@/lib/session";

// GET /join/:token — the link in every invite email and the team join link.
//
// Signed out: remember the token in a cookie and send them to sign-up (or
// sign-in when Clerk says the address already has an account). Provisioning
// reads the cookie (and the invite email) on first login and places them on
// the team instead of creating a solo workspace.
//
// Signed in: a brand-new account was just placed by provisioning, so go to
// the app. An existing account in another workspace gets a confirmation page.

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = new URL(req.url);
  const confirmUrl = new URL(`/join/${encodeURIComponent(token)}/confirm`, url.origin);

  const target = await resolveJoinToken(token);
  if (!target) return NextResponse.redirect(confirmUrl);

  let signedIn = true;
  if (isClerkEnabled()) {
    const { auth } = await import("@clerk/nextjs/server");
    signedIn = Boolean((await auth()).userId);
  }

  if (!signedIn) {
    const status = url.searchParams.get("__clerk_status");
    const ticket = url.searchParams.get("__clerk_ticket");
    const dest = new URL(status === "sign_in" ? "/sign-in" : "/sign-up", url.origin);
    if (ticket) dest.searchParams.set("__clerk_ticket", ticket);
    if (status) dest.searchParams.set("__clerk_status", status);
    dest.searchParams.set("redirect_url", `/join/${encodeURIComponent(token)}`);
    const res = NextResponse.redirect(dest);
    res.cookies.set(JOIN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
    return res;
  }

  const user = await currentUser();
  if (user.orgId === target.orgId) {
    const res = NextResponse.redirect(new URL("/getting-started?joined=1", url.origin));
    res.cookies.delete(JOIN_COOKIE);
    return res;
  }
  return NextResponse.redirect(confirmUrl);
}
