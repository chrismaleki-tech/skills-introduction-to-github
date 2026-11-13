import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isClerkEnabled } from "@/lib/auth-mode";
import { CALL_TYPE_VALUES } from "@/lib/scenario-options";

// Landing-page entry point for "Try a voice role-play" and the scenario
// chips. Signed-in users land directly in the scenario creator with their
// choice preselected; visitors go through sign-up and are returned to the
// same destination afterwards (Clerk honours redirect_url).
// Behind Vercel's proxy nextUrl.origin can be the internal host; prefer the
// forwarded public host so redirects land on the visitor's domain.
function publicOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return req.nextUrl.origin;
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  const template = req.nextUrl.searchParams.get("template") ?? "";
  const path = req.nextUrl.searchParams.get("path") ?? "";
  const dest = new URL("/scenarios/new", origin);
  if (path === "build" || path === "website") dest.searchParams.set("path", path);
  if (CALL_TYPE_VALUES.includes(template)) {
    dest.searchParams.set("path", "quick");
    dest.searchParams.set("template", template);
  }
  const destPath = dest.pathname + dest.search;

  if (!isClerkEnabled()) return NextResponse.redirect(new URL(destPath, origin));

  const { userId } = await auth();
  if (userId) return NextResponse.redirect(new URL(destPath, origin));

  const signUp = new URL("/sign-up", origin);
  signUp.searchParams.set("redirect_url", destPath);
  return NextResponse.redirect(signUp);
}
