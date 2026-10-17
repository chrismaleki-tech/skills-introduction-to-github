import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestCall } from "@/lib/pipeline";
import { currentUser, isManagerRole } from "@/lib/session";

/**
 * CRM → SalesCoach bridge.
 *
 * Log a call against a deal (or contact/account) from the CRM side. The call
 * is ingested through the same grading pipeline as uploads/webhooks, so
 * coaching feedback lands on the deal timeline automatically.
 *
 * Auth: session cookie (in-app) OR org webhook secret in the body (external).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    secret?: string;
    repEmail?: string;
    dealId?: string;
    contactId?: string;
    accountId?: string;
    externalId?: string;
    durationSec?: number;
    direction?: string;
    callType?: string;
    prospectName?: string;
    callDate?: string;
    transcript?: string | unknown[];
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let orgId: string;
  let repId: string;

  if (body.secret) {
    const org = await db.org.findFirst({ where: { webhookSecret: body.secret } });
    if (!org) {
      return NextResponse.json({ error: "Unknown webhook secret." }, { status: 401 });
    }
    if (!body.repEmail) {
      return NextResponse.json({ error: "repEmail is required with secret auth." }, { status: 400 });
    }
    const rep = await db.user.findFirst({ where: { orgId: org.id, email: body.repEmail } });
    if (!rep) {
      return NextResponse.json(
        { error: `No rep with email "${body.repEmail}" in this organization.` },
        { status: 422 },
      );
    }
    orgId = org.id;
    repId = rep.id;
  } else {
    const user = await currentUser();
    orgId = user.orgId;
    repId = user.id;
  }

  const durationSec = Math.round(Number(body.durationSec ?? 0));
  if (!Number.isFinite(durationSec) || durationSec < 0) {
    return NextResponse.json({ error: "durationSec must be a non-negative number." }, { status: 400 });
  }

  let dealId = body.dealId || undefined;
  let contactId = body.contactId || undefined;
  let accountId = body.accountId || undefined;
  let prospectName = body.prospectName ?? "";

  if (dealId) {
    const deal = await db.deal.findFirst({
      where: { id: dealId, orgId },
      include: { contact: true, account: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    }
    if (!body.secret) {
      const sessionUser = await currentUser();
      if (!isManagerRole(sessionUser.role) && deal.ownerId && deal.ownerId !== sessionUser.id) {
        return NextResponse.json({ error: "Deal not found." }, { status: 404 });
      }
    }
    accountId = accountId ?? deal.accountId ?? undefined;
    contactId = contactId ?? deal.contactId ?? undefined;
    if (!prospectName) {
      prospectName = deal.contact?.name || deal.account?.name || deal.name;
    }
  }

  const providedTranscript =
    typeof body.transcript === "string"
      ? body.transcript
      : Array.isArray(body.transcript)
        ? JSON.stringify(body.transcript)
        : undefined;

  const externalId =
    body.externalId ||
    `crm-${dealId ?? contactId ?? accountId ?? "none"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { call, deduped } = await ingestCall({
      orgId,
      repId,
      source: "CRM",
      direction: body.direction,
      callType: body.callType,
      durationSec,
      externalId,
      prospectName,
      callDate: body.callDate ? new Date(body.callDate) : undefined,
      providedTranscript,
      accountId,
      contactId,
      dealId,
    });
    return NextResponse.json({
      callId: call.id,
      status: call.status,
      samplingStatus: call.samplingStatus,
      dealId: call.dealId,
      deduped,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingestion failed." },
      { status: 500 },
    );
  }
}
