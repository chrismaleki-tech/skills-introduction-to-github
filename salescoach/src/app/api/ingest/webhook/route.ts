import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestCall } from "@/lib/pipeline";
import { parkUnmatchedIngest } from "@/lib/unmatched";

interface WebhookPayload {
  secret?: string;
  repEmail?: string;
  externalId?: string;
  durationSec?: number;
  direction?: string;
  callType?: string;
  prospectName?: string;
  prospectEmail?: string;
  prospectPhone?: string;
  callDate?: string;
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

  const rep = await db.user.findFirst({
    where: { orgId: org.id, email: { equals: repEmail } },
  });
  // Case-insensitive fallback for SQLite
  const resolvedRep =
    rep ??
    (await db.user.findMany({ where: { orgId: org.id } })).find(
      (u) => u.email.toLowerCase() === repEmail.toLowerCase(),
    );

  if (!resolvedRep) {
    const parked = await parkUnmatchedIngest({
      orgId: org.id,
      source: "WEBHOOK",
      repEmail,
      externalId,
      payload: body as unknown as Record<string, unknown>,
    });
    return NextResponse.json(
      {
        error: `No rep with email "${repEmail}". Call parked in unmatched queue.`,
        unmatchedId: parked.id,
        status: "UNMATCHED",
      },
      { status: 202 },
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
      repId: resolvedRep.id,
      source: "WEBHOOK",
      direction: body.direction,
      callType: body.callType,
      durationSec,
      externalId,
      prospectName: body.prospectName,
      prospectEmail: body.prospectEmail,
      prospectPhone: body.prospectPhone,
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
