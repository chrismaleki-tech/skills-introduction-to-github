import { NextResponse } from "next/server";
import { copyFileSync, existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const root = process.cwd();
  const info: Record<string, unknown> = {
    ok: false,
    databaseUrl: process.env.DATABASE_URL,
    vercelRegion: process.env.VERCEL_REGION ?? null,
    cwd: root,
    tmpExists: existsSync("/tmp/salescoach.db"),
    demoCandidates: {} as Record<string, boolean>,
  };

  const candidates = [
    path.join(root, "prisma", "demo.db"),
    path.join(root, "prisma", "dev.db"),
    path.join(root, "demo.db"),
  ];
  for (const p of candidates) {
    (info.demoCandidates as Record<string, boolean>)[p] = existsSync(p);
  }

  try {
    const prismaDir = path.join(root, "prisma");
    info.prismaDir = existsSync(prismaDir)
      ? readdirSync(prismaDir).filter((f) => !f.startsWith("."))
      : null;
  } catch (e) {
    info.prismaDirError = e instanceof Error ? e.message : String(e);
  }

  try {
    const users = await db.user.count();
    const calls = await db.call.count();
    info.ok = true;
    info.users = users;
    info.calls = calls;
  } catch (e) {
    info.error = e instanceof Error ? e.message : String(e);
    // Last-ditch: if seeded file exists but /tmp copy failed earlier, try again.
    const src = candidates.find((p) => existsSync(p));
    if (src && !existsSync("/tmp/salescoach.db")) {
      try {
        copyFileSync(src, "/tmp/salescoach.db");
        info.retriedCopy = true;
        info.tmpSize = statSync("/tmp/salescoach.db").size;
      } catch (copyErr) {
        info.copyError = copyErr instanceof Error ? copyErr.message : String(copyErr);
      }
    }
  }

  return NextResponse.json(info, { status: info.ok ? 200 : 503 });
}
