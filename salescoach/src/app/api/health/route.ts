import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isClerkEnabled } from "@/lib/auth-mode";
import { storageBackend } from "@/lib/storage";
import { stripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET() {
  const info: Record<string, unknown> = {
    ok: false,
    auth: isClerkEnabled() ? "clerk" : "demo",
    storage: storageBackend(),
    billing: stripeConfigured() ? "stripe" : "not_configured",
    databaseUrlScheme: (process.env.DATABASE_URL || "").split(":")[0] || null,
  };

  try {
    const users = await db.user.count();
    const orgs = await db.org.count();
    const calls = await db.call.count();
    info.ok = true;
    info.users = users;
    info.orgs = orgs;
    info.calls = calls;
  } catch (e) {
    info.error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(info, { status: info.ok ? 200 : 503 });
}
