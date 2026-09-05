import { copyFileSync, existsSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

/**
 * Resolve a writable SQLite path on Vercel.
 *
 * The Next.js deployment filesystem is read-only. We ship a seeded demo DB
 * (`prisma/demo.db`, created at build time) and copy it to `/tmp` on first
 * cold start so Prisma can open/write it. Non-file DATABASE_URLs (Postgres)
 * are left untouched.
 */
function resolveDatabaseUrl(): string {
  const configured = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!configured.startsWith("file:")) return configured;

  // VERCEL_REGION is set only in serverless runtimes, not during `next build`.
  const isVercelRuntime = Boolean(process.env.VERCEL_REGION);
  if (!isVercelRuntime) return configured;

  const tmpPath = "/tmp/salescoach.db";
  if (!existsSync(tmpPath)) {
    // cwd is the salescoach project root on Vercel (Root Directory = salescoach).
    const root = /* turbopackIgnore: true */ process.cwd();
    const candidates = [
      path.join(root, "prisma", "demo.db"),
      path.join(root, "prisma", "dev.db"),
    ];
    const src = candidates.find((p) => existsSync(p));
    if (src) {
      copyFileSync(src, tmpPath);
    }
  }
  return `file:${tmpPath}`;
}

const databaseUrl = resolveDatabaseUrl();
// Keep Prisma and any child imports aligned with the resolved path.
process.env.DATABASE_URL = databaseUrl;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
