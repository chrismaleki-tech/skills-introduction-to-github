import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestCall } from "@/lib/pipeline";

// Generic auto-ingestion front door for dialers / call providers. Authenticated
// by the org's webhook secret (shown in Settings). The pipeline runs inline in
// dev; in production this handler would enqueue the call and return
// immediately, with transcription + grading as queue jobs.

interface WebhookPayload {
  secret?: string;
  repEmail?: string;
  externalId?: string;
  durationSec?: number;
  direction?: string;
  callType?: string;
  prospectName?: string;
  callDate?: string;
  // Plain text in "REP:" / "PROSPECT:" line format, or a JSON segments array.
  transcript?: string | unknown[];
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as WebhookPayload | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { secret, repEmail, externalId } = body;
  const durationSec = Math.round(Number(body.durationSec));
  if (!secret || !repEmail || !externalId || !Number.isFinite(durationSec) || durationSec < 0) {
    return NextResponse.json(
      { error: "secret, repEmail, externalId and a numeric durationSec are required." },
      { status: 400 },
    );
  }

  const org = await db.org.findFirst({ where: { webhookSecret: secret } });
  if (!org) {
    return NextResponse.json({ error: "Unknown webhook secret." }, { status: 401 });
  }

  const rep = await db.user.findFirst({ where: { orgId: org.id, email: repEmail } });
  if (!rep) {
    // TODO: land unmatched calls in a review queue so an admin can map the
    // provider identity to a rep instead of dropping the call.
    return NextResponse.json(
      { error: `No rep with email "${repEmail}" in this organization. The call was not ingested.` },
      { status: 422 },
    );
  }

  const providedTranscript =
    typeof body.transcript === "string"
      ? body.transcript
      : Array.isArray(body.transcript)
        ? JSON.stringify(body.transcript)
        : undefined;

  const callDate = body.callDate ? new Date(body.callDate) : undefined;
  if (callDate && Number.isNaN(callDate.getTime())) {
    return NextResponse.json({ error: "callDate is not a valid date." }, { status: 400 });
  }

  try {
    const { call, deduped } = await ingestCall({
      orgId: org.id,
      repId: rep.id,
      source: "WEBHOOK",
      direction: body.direction,
      callType: body.callType,
      durationSec,
      externalId,
      prospectName: body.prospectName,
      callDate,
      providedTranscript,
    });
    return NextResponse.json({
      callId: call.id,
      status: call.status,
      samplingStatus: call.samplingStatus,
      deduped,
    });
  } catch (err) {
    // Grading failures mark the Call FAILED before rethrowing; report the row
    // if it exists so the integrator can retry from the review page.
    const failed = await db.call.findUnique({
      where: { orgId_externalId: { orgId: org.id, externalId } },
    });
    if (failed) {
      return NextResponse.json({
        callId: failed.id,
        status: failed.status,
        samplingStatus: failed.samplingStatus,
        deduped: false,
      });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingestion failed." },
      { status: 500 },
    );
  }
}
