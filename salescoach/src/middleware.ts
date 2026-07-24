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

/** Paths that belong to the platform-console control plane. */
function isConsolePath(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/") ||
    pathname === "/elevate"
  );
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "";
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(png|jpg|svg|ico|css|js|map)$/)
  ) {
    return NextResponse.next();
  }

  // --- Control-plane split -------------------------------------------------
  // ADMIN_HOST: serve the console only on a dedicated hostname (and nothing
  // else there), so the cross-tenant plane can sit behind its own DNS/WAF.
  const adminHost = process.env.ADMIN_HOST?.trim().toLowerCase();
  if (adminHost) {
    const host = (req.headers.get("host") ?? "").toLowerCase();
    const onAdminHost = host === adminHost;
    const consoleBound = isConsolePath(pathname);
    const authPath =
      pathname === "/login" || pathname.startsWith("/api/auth/") || pathname === "/api/health";
    if (onAdminHost && !consoleBound && !authPath) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
    if (!onAdminHost && consoleBound) {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  // ADMIN_IP_ALLOWLIST: network-restrict the console (exact IPs or prefixes
  // ending in "." — e.g. "203.0.113.7,10.").
  const ipAllowlist = process.env.ADMIN_IP_ALLOWLIST?.trim();
  if (ipAllowlist && isConsolePath(pathname)) {
    const ip = clientIp(req);
    const allowed = ipAllowlist
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .some((entry) => (entry.endsWith(".") ? ip.startsWith(entry) : ip === entry));
    if (!allowed) {
      return pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Forbidden." }, { status: 403 })
        : new NextResponse("Not found", { status: 404 });
    }
  }

  // --- Impersonation is read-only ------------------------------------------
  // While a staff "view as customer" session is active, block all product
  // mutations at the edge. Only ending the impersonation is allowed.
  const impersonating = Boolean(req.cookies.get("sc_imp")?.value);
  const isWrite = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (impersonating && isWrite && pathname.startsWith("/api/")) {
    const allowedDuringImpersonation =
      pathname === "/api/admin/impersonate/exit" || pathname === "/api/auth/logout";
    if (!allowedDuringImpersonation) {
      return NextResponse.json(
        { error: "Read-only impersonation session: mutations are disabled while viewing as a customer." },
        { status: 403 },
      );
    }
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
