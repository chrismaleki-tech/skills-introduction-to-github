import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC = [
  "/login",
  "/api/auth/login",
  "/api/ingest/webhook",
  "/api/vapi/webhook",
  "/api/crm/sync/call",
  "/api/health",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(png|jpg|svg|ico|css|js|map)$/)
  ) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (isPublic) return NextResponse.next();

  const session = req.cookies.get("sc_user")?.value;
  const allowDemo =
    process.env.ALLOW_DEMO_SWITCHER === "true" ||
    process.env.ALLOW_DEMO_SWITCHER === "1" ||
    (process.env.ALLOW_DEMO_SWITCHER == null && process.env.NODE_ENV !== "production");

  // Cookie must look like a signed token (userId.exp.sig) in production.
  const looksSigned = Boolean(session && session.split(".").length === 3);
  const hasSession = Boolean(session) && (allowDemo || looksSigned);

  if (!hasSession && !allowDemo && !pathname.startsWith("/api/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (!hasSession && !allowDemo && pathname.startsWith("/api/") && !isPublic) {
    return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
