#!/usr/bin/env tsx
/**
 * Background job worker for SalesCoach.
 *
 * Usage:
 *   npm run jobs:worker
 *
 * Polls the durable Job table and runs PROCESS_CALL / GRADE_* / RETENTION_SWEEP.
 * In production, run as a separate process (or swap for BullMQ/SQS consumers
 * using the same job type names).
 *
 * Env:
 *   JOB_POLL_MS=2000          poll interval (default 2000)
 *   JOB_BATCH_SIZE=10         jobs per tick
 *   RETENTION_CRON_HOURS=24   enqueue retention sweeps this often (0 = off)
 */

import { db } from "../src/lib/db";
import { processPendingJobs, enqueueJob } from "../src/lib/queue";

if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL?.trim()) {
  console.error("DATABASE_URL is required in production");
  process.exit(1);
}

const pollMs = Math.max(500, Number(process.env.JOB_POLL_MS ?? 2000));
const batchSize = Math.max(1, Number(process.env.JOB_BATCH_SIZE ?? 10));
const retentionEveryHours = Math.max(0, Number(process.env.RETENTION_CRON_HOURS ?? 24));

let lastRetentionEnqueue = 0;
let stopping = false;

async function maybeEnqueueRetention() {
  if (!retentionEveryHours) return;
  const now = Date.now();
  if (now - lastRetentionEnqueue < retentionEveryHours * 3600_000) return;
  lastRetentionEnqueue = now;
  const orgs = await db.org.findMany({ select: { id: true } });
  for (const org of orgs) {
    await enqueueJob({
      orgId: org.id,
      type: "RETENTION_SWEEP",
      payload: { orgId: org.id },
    });
  }
  console.log(`[worker] enqueued retention sweep for ${orgs.length} org(s)`);
}

async function tick() {
  await maybeEnqueueRetention();
  const n = await processPendingJobs(batchSize);
  if (n > 0) console.log(`[worker] processed ${n} job(s)`);
}

async function main() {
  console.log(
    `[worker] starting poll=${pollMs}ms batch=${batchSize} retentionEvery=${retentionEveryHours}h`,
  );
  while (!stopping) {
    try {
      await tick();
    } catch (err) {
      console.error("[worker] tick failed", err);
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
