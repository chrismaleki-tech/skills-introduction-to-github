import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runDiagnostics } from "@/lib/diagnostics";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const deep = new URL(req.url).searchParams.get("deep") === "1";
  if (deep) {
    const secret = process.env.OPS_SECRET;
    const supplied = req.headers.get("authorization");
    if (!secret || supplied !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const diagnostics = await runDiagnostics();
    return NextResponse.json(diagnostics, { status: diagnostics.ok ? 200 : 503 });
  }

  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
