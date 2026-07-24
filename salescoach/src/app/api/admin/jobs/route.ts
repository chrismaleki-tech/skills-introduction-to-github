import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireConsole } from "@/lib/platform-admin";
import { processPendingJobs } from "@/lib/queue";
import { recordAudit } from "@/lib/audit";

/** GET /api/admin/jobs?status=FAILED — job queue view (SUPPORT can read). */
export async function GET(req: Request) {
  const actor = await requireConsole("SUPPORT");
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const status = new URL(req.url).searchParams.get("status") ?? undefined;
  const jobs = await db.job.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { org: { select: { name: true } } },
  });
  return NextResponse.json({ jobs });
}

/**
 * POST /api/admin/jobs — queue maintenance (ADMIN console role only):
 *   { action: "retry", id }   — requeue a FAILED job (resets attempts)
 *   { action: "run-pending" } — drain up to 25 due PENDING jobs now
 */
export async function POST(req: Request) {
  const actor = await requireConsole("ADMIN");
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { action?: string; id?: string };

  if (body.action === "retry") {
    if (!body.id) return NextResponse.json({ error: "id is required." }, { status: 400 });
    const job = await db.job.findUnique({ where: { id: body.id }, select: { orgId: true, type: true } });
    const requeued = await db.job.updateMany({
      where: { id: body.id, status: "FAILED" },
      data: { status: "PENDING", attempts: 0, lastError: "", runAfter: new Date(), finishedAt: null },
    });
    if (!requeued.count) {
      return NextResponse.json({ error: "Job not found or not in FAILED state." }, { status: 404 });
    }
    await recordAudit({
      actor: actor.user,
      consoleRole: actor.role,
      action: "JOB_RETRIED",
      targetType: "JOB",
      targetId: body.id,
      orgId: job?.orgId,
      req,
      meta: { type: job?.type },
    });
    const ran = await processPendingJobs(5);
    return NextResponse.json({ ok: true, ran });
  }

  if (body.action === "run-pending") {
    const ran = await processPendingJobs(25);
    await recordAudit({
      actor: actor.user,
      consoleRole: actor.role,
      action: "JOBS_DRAINED",
      targetType: "JOB",
      req,
      meta: { ran },
    });
    return NextResponse.json({ ok: true, ran });
  }

  return NextResponse.json({ error: "Unknown action. Use retry or run-pending." }, { status: 400 });
}
