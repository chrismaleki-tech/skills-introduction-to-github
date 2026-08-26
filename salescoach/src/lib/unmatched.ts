import { db } from "./db";
import { ingestCall } from "./pipeline";

export async function parkUnmatchedIngest(input: {
  orgId: string;
  source: "WEBHOOK";
  repEmail: string;
  externalId?: string;
  payload: Record<string, unknown>;
}) {
  const externalId = input.externalId || `unmatched-${input.repEmail}-${Date.now()}`;
  const existing = await db.unmatchedIngest.findFirst({
    where: { orgId: input.orgId, source: input.source, externalId },
  });
  if (existing) {
    return db.unmatchedIngest.update({
      where: { id: existing.id },
      data: {
        payloadJson: JSON.stringify(input.payload),
        repEmail: input.repEmail,
        status: "PENDING",
        note: "",
        resolvedAt: null,
        resolvedRepId: null,
        resolvedCallId: null,
      },
    });
  }
  return db.unmatchedIngest.create({
    data: {
      orgId: input.orgId,
      source: input.source,
      repEmail: input.repEmail,
      externalId,
      payloadJson: JSON.stringify(input.payload),
      status: "PENDING",
    },
  });
}

export async function resolveUnmatchedIngest(input: {
  id: string;
  orgId: string;
  repId: string;
  resolverUserId: string;
}) {
  const row = await db.unmatchedIngest.findFirst({
    where: { id: input.id, orgId: input.orgId, status: "PENDING" },
  });
  if (!row) throw new Error("Unmatched ingest not found.");

  const payload = JSON.parse(row.payloadJson) as {
    durationSec?: number;
    direction?: string;
    callType?: string;
    prospectName?: string;
    prospectEmail?: string;
    prospectPhone?: string;
    callDate?: string;
    transcript?: string | unknown[];
    externalId?: string;
  };

  const providedTranscript =
    typeof payload.transcript === "string"
      ? payload.transcript
      : Array.isArray(payload.transcript)
        ? JSON.stringify(payload.transcript)
        : undefined;

  const { call } = await ingestCall({
    orgId: input.orgId,
    repId: input.repId,
    source: "WEBHOOK",
    direction: payload.direction,
    callType: payload.callType,
    durationSec: Math.round(Number(payload.durationSec ?? 0)),
    externalId: payload.externalId ?? row.externalId ?? undefined,
    prospectName: payload.prospectName,
    callDate: payload.callDate ? new Date(payload.callDate) : undefined,
    providedTranscript,
    prospectEmail: payload.prospectEmail,
    prospectPhone: payload.prospectPhone,
  });

  return db.unmatchedIngest.update({
    where: { id: row.id },
    data: {
      status: "RESOLVED",
      resolvedRepId: input.resolverUserId,
      resolvedCallId: call.id,
      resolvedAt: new Date(),
      note: `Mapped to rep ${input.repId}`,
    },
  });
}
