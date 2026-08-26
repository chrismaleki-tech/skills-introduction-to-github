import { db } from "./db";

export type JobType = "PROCESS_CALL" | "GRADE_ROLEPLAY" | "RETENTION_SWEEP";

/** When true, jobs run synchronously inside enqueue (tests / simple deploys). */
export function inlineJobs() {
  if (process.env.INLINE_JOBS != null) {
    return process.env.INLINE_JOBS === "true" || process.env.INLINE_JOBS === "1";
  }
  // Prefer sync during seed / scripts; async in the Next server.
  return process.env.NODE_ENV === "test" || process.env.SEEDING === "1";
}

export async function enqueueJob(input: {
  orgId: string;
  type: JobType;
  payload: Record<string, unknown>;
  runAfter?: Date;
}) {
  const job = await db.job.create({
    data: {
      orgId: input.orgId,
      type: input.type,
      payloadJson: JSON.stringify(input.payload),
      runAfter: input.runAfter ?? new Date(),
      status: "PENDING",
    },
  });

  if (inlineJobs()) {
    await runJob(job.id);
  } else {
    queueMicrotask(() => {
      void processPendingJobs(5).catch(() => undefined);
    });
  }
  return job;
}

export async function enqueueProcessCall(
  orgId: string,
  callId: string,
  extra?: Record<string, unknown>,
) {
  return enqueueJob({
    orgId,
    type: "PROCESS_CALL",
    payload: { callId, ...extra },
  });
}

export async function processPendingJobs(limit = 10) {
  const now = new Date();
  const pending = await db.job.findMany({
    where: { status: "PENDING", runAfter: { lte: now } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  for (const job of pending) {
    await runJob(job.id);
  }
  return pending.length;
}

async function runJob(jobId: string) {
  const claimed = await db.job.updateMany({
    where: { id: jobId, status: "PENDING" },
    data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } },
  });
  if (!claimed.count) return;

  const job = await db.job.findUniqueOrThrow({ where: { id: jobId } });
  const payload = JSON.parse(job.payloadJson || "{}") as Record<string, unknown>;

  try {
    if (job.type === "PROCESS_CALL") {
      const { processCall } = await import("./pipeline");
      await processCall(String(payload.callId), {
        providedTranscript:
          typeof payload.providedTranscript === "string" ? payload.providedTranscript : undefined,
      });
    } else if (job.type === "GRADE_ROLEPLAY") {
      const { gradeRoleplay } = await import("./pipeline");
      await gradeRoleplay(String(payload.roleplayId));
    } else if (job.type === "RETENTION_SWEEP") {
      const { runRetentionSweep } = await import("./retention");
      await runRetentionSweep(typeof payload.orgId === "string" ? payload.orgId : undefined);
    } else {
      throw new Error(`Unknown job type ${job.type}`);
    }
    await db.job.update({
      where: { id: jobId },
      data: { status: "DONE", finishedAt: new Date(), lastError: "" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const attempts = job.attempts + 1;
    await db.job.update({
      where: { id: jobId },
      data: {
        status: attempts >= 5 ? "FAILED" : "PENDING",
        lastError: message,
        runAfter: new Date(Date.now() + Math.min(60_000, 2 ** attempts * 1000)),
        finishedAt: attempts >= 5 ? new Date() : null,
      },
    });
  }
}
