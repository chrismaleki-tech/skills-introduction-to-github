import { NextResponse } from "next/server";
import { objectStorageConfigured, isProduction } from "@/lib/config";
import { vapiConfigured } from "@/lib/vapi";
import { aiAvailable } from "@/lib/ai";

/** Liveness / readiness for load balancers. No auth required. */
export async function GET() {
  const checks = {
    ok: true,
    env: process.env.NODE_ENV || "development",
    production: isProduction(),
    sessionSecret: Boolean(process.env.SESSION_SECRET?.trim()) || !isProduction(),
    database: Boolean(process.env.DATABASE_URL?.trim()),
    openai: aiAvailable(),
    deepgram: Boolean(process.env.DEEPGRAM_API_KEY?.trim()),
    vapi: vapiConfigured(),
    objectStorage: objectStorageConfigured(),
    demoSwitcher:
      process.env.ALLOW_DEMO_SWITCHER === "true" ||
      process.env.ALLOW_DEMO_SWITCHER === "1" ||
      (process.env.ALLOW_DEMO_SWITCHER == null && !isProduction()),
  };

  if (isProduction() && !process.env.SESSION_SECRET?.trim()) {
    return NextResponse.json({ ...checks, ok: false, error: "SESSION_SECRET missing" }, { status: 503 });
  }

  return NextResponse.json(checks);
}
