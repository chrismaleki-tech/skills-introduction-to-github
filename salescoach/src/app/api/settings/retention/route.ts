import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { DEFAULT_RETENTION_POLICY, parseRetentionPolicy, type RetentionPolicy } from "@/lib/pii";
import { runRetentionSweep } from "@/lib/retention";
import { enqueueJob } from "@/lib/queue";

export async function GET() {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }
  const org = await db.org.findUniqueOrThrow({ where: { id: user.orgId } });
  return NextResponse.json({ policy: parseRetentionPolicy(org.retentionPolicyJson) });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as
    | (Partial<RetentionPolicy> & { runSweep?: boolean })
    | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });

  if (body.runSweep) {
    await enqueueJob({
      orgId: user.orgId,
      type: "RETENTION_SWEEP",
      payload: { orgId: user.orgId },
    });
    const result = await runRetentionSweep(user.orgId);
    return NextResponse.json({ ok: true, result });
  }

  const current = parseRetentionPolicy(
    (await db.org.findUniqueOrThrow({ where: { id: user.orgId } })).retentionPolicyJson,
  );
  const policy: RetentionPolicy = {
    ...DEFAULT_RETENTION_POLICY,
    ...current,
    redactPiiInTranscripts:
      typeof body.redactPiiInTranscripts === "boolean"
        ? body.redactPiiInTranscripts
        : current.redactPiiInTranscripts,
    retainCallDays:
      typeof body.retainCallDays === "number" ? Math.max(0, Math.round(body.retainCallDays)) : current.retainCallDays,
  };

  await db.org.update({
    where: { id: user.orgId },
    data: { retentionPolicyJson: JSON.stringify(policy) },
  });
  return NextResponse.json({ policy });
}
