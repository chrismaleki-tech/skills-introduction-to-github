import { db } from "./db";
import { autoMatchCallToCrm } from "./crm-match";
import { formatDealContext, writeBackGradeToCrm } from "./crm";
import { formatErpDealContext } from "./erp";
import { gradeTranscript } from "./grading";
import { enqueueProcessCall, inlineJobs } from "./queue";
import { decideSampling, durationBand, type RepMonthStats } from "./sampling";
import { mockTranscript, parseProvidedTranscript, transcribeAudio } from "./transcription";
import { parseRetentionPolicy, redactPii, redactSegments } from "./pii";
import {
  parseCompanyProfile,
  parseDimensions,
  parseIngestionPolicy,
  parseMessages,
  parsePersona,
  parseSegments,
  type TranscriptSegment,
} from "./types";

// Processing pipeline for ingested calls. Grades are enqueued by default;
// set INLINE_JOBS=true to run synchronously (tests / simple deploys).

export interface IngestCallInput {
  orgId: string;
  repId: string;
  source: "UPLOAD" | "WEBHOOK" | "API" | "DIALER" | "CRM";
  direction?: string;
  callType?: string;
  durationSec: number;
  externalId?: string;
  prospectName?: string;
  prospectEmail?: string;
  prospectPhone?: string;
  callDate?: Date;
  audio?: { buffer: Buffer; mimeType: string; path?: string };
  providedTranscript?: string;
  repFlagged?: boolean;
  accountId?: string;
  contactId?: string;
  dealId?: string;
}

export async function ingestCall(input: IngestCallInput) {
  if (input.externalId) {
    const existing = await db.call.findUnique({
      where: { orgId_externalId: { orgId: input.orgId, externalId: input.externalId } },
    });
    if (existing) return { call: existing, deduped: true };
  }

  const org = await db.org.findUniqueOrThrow({ where: { id: input.orgId } });
  const policy = parseIngestionPolicy(org.ingestionPolicyJson);
  const retention = parseRetentionPolicy(org.retentionPolicyJson);
  const now = input.callDate ?? new Date();

  const stats = await repMonthStats(input.orgId, input.repId, now, input.durationSec);
  const decision = decideSampling(
    policy,
    { durationSec: input.durationSec, source: input.source, repFlagged: input.repFlagged },
    stats,
  );

  let providedTranscript = input.providedTranscript;
  if (providedTranscript && retention.redactPiiInTranscripts) {
    providedTranscript = redactPii(providedTranscript);
  }

  const call = await db.call.create({
    data: {
      orgId: input.orgId,
      repId: input.repId,
      source: input.source,
      direction: input.direction ?? "outbound",
      callType: input.callType ?? "unknown",
      durationSec: input.durationSec,
      externalId: input.externalId,
      prospectName: input.prospectName ?? "",
      audioPath: input.audio?.path,
      accountId: input.accountId,
      contactId: input.contactId,
      dealId: input.dealId,
      callDate: now,
      status: decision.grade ? "QUEUED" : decision.samplingStatus === "BELOW_MIN_DURATION" ? "SKIPPED" : "INGESTED",
      samplingStatus: decision.samplingStatus,
    },
  });

  if (policy.autoMatchCrm !== false) {
    await autoMatchCallToCrm({
      orgId: input.orgId,
      callId: call.id,
      prospectEmail: input.prospectEmail,
      prospectPhone: input.prospectPhone,
      prospectName: input.prospectName,
      callType: input.callType,
      preferOwnerId: input.repId,
    });
  }

  if (decision.grade) {
    if (inlineJobs() || input.audio) {
      // Audio buffers can't cross the job queue boundary; process inline.
      await processCall(call.id, { ...input, providedTranscript });
    } else {
      await enqueueProcessCall(input.orgId, call.id, { providedTranscript });
    }
  } else if (providedTranscript) {
    const segments = parseProvidedTranscript(providedTranscript);
    if (segments.length) {
      await storeTranscript(
        call.id,
        retention.redactPiiInTranscripts ? redactSegments(segments) : segments,
        "provided",
      );
    }
  }

  return { call: await db.call.findUniqueOrThrow({ where: { id: call.id } }), deduped: false };
}

export async function processCall(callId: string, input?: Partial<IngestCallInput>) {
  const call = await db.call.findUniqueOrThrow({
    where: { id: callId },
    include: { transcript: true, org: { include: { companyContext: true } } },
  });
  const retention = parseRetentionPolicy(call.org.retentionPolicyJson);

  try {
    let segments: TranscriptSegment[];
    let engine: string;

    if (call.transcript) {
      segments = parseSegments(call.transcript.segmentsJson);
      engine = call.transcript.engine;
    } else if (input?.providedTranscript) {
      segments = parseProvidedTranscript(input.providedTranscript);
      engine = "provided";
    } else if (input?.audio) {
      await db.call.update({ where: { id: callId }, data: { status: "TRANSCRIBING" } });
      const result = await transcribeAudio(input.audio.buffer, input.audio.mimeType);
      segments = result.segments;
      engine = result.engine;
    } else {
      segments = mockTranscript(hashId(callId));
      engine = "mock";
    }

    if (retention.redactPiiInTranscripts) segments = redactSegments(segments);
    if (!segments.length) throw new Error("Empty transcript — check the transcript format or audio file.");
    if (!call.transcript) await storeTranscript(callId, segments, engine);

    await db.call.update({ where: { id: callId }, data: { status: "GRADING" } });
    await gradeSubject({
      orgId: call.orgId,
      subjectType: "CALL",
      callId,
      segments,
      callType: call.callType,
    });
    await db.call.update({ where: { id: callId }, data: { status: "GRADED" } });
    await writeBackGradeToCrm(callId);
  } catch (err) {
    await db.call.update({
      where: { id: callId },
      data: { status: "FAILED", failReason: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }
}

export async function gradeRoleplay(sessionId: string) {
  const session = await db.roleplaySession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { scenario: true },
  });
  const messages = parseMessages(session.messagesJson);
  const segments: TranscriptSegment[] = messages.map((m) => ({
    speaker: m.role,
    startSec: m.atMs / 1000,
    endSec: m.atMs / 1000 + Math.max(2, m.text.split(/\s+/).length * 0.45),
    text: m.text,
  }));
  if (!segments.length) throw new Error("Role-play has no transcript to grade.");

  const persona = parsePersona(session.scenario.personaJson);
  const winConditions = JSON.parse(session.scenario.winConditionsJson || "[]") as string[];
  const scenarioContext =
    `The rep was practicing against: ${persona.name}, ${persona.title} at ${persona.company} (${persona.industry}). ` +
    `Persona: ${persona.personality}. Scripted objections: ${persona.objections.join("; ")}. ` +
    (winConditions.length ? `A winning conversation: ${winConditions.join("; ")}.` : "");

  await gradeSubject({
    orgId: session.orgId,
    subjectType: "ROLEPLAY",
    roleplayId: sessionId,
    segments,
    callType: session.scenario.callType,
    scenarioContext,
    methodologyId: session.scenario.methodologyId ?? undefined,
  });
  await db.roleplaySession.update({ where: { id: sessionId }, data: { status: "GRADED" } });
}

async function gradeSubject(args: {
  orgId: string;
  subjectType: "CALL" | "ROLEPLAY";
  callId?: string;
  roleplayId?: string;
  segments: TranscriptSegment[];
  callType?: string;
  scenarioContext?: string;
  methodologyId?: string;
}) {
  const org = await db.org.findUniqueOrThrow({
    where: { id: args.orgId },
    include: { companyContext: true },
  });
  const methodologyId = args.methodologyId ?? org.activeMethodologyId;
  if (!methodologyId) throw new Error("No active methodology configured for this team.");
  const methodology = await db.methodology.findUniqueOrThrow({ where: { id: methodologyId } });

  // Enrich call grades with CRM deal stage / account context when linked,
  // plus live ERP quote/order/invoice state on that deal.
  let scenarioContext = args.scenarioContext ?? "";
  if (args.callId) {
    const linked = await db.call.findUnique({
      where: { id: args.callId },
      include: {
        deal: {
          include: {
            account: true,
            contact: true,
            quotes: { select: { number: true, status: true, total: true }, orderBy: { updatedAt: "desc" }, take: 5 },
            salesOrders: { select: { number: true, status: true, total: true }, orderBy: { updatedAt: "desc" }, take: 5 },
            invoices: {
              select: { number: true, status: true, total: true, amountPaid: true },
              orderBy: { updatedAt: "desc" },
              take: 5,
            },
          },
        },
      },
    });
    if (linked?.deal) {
      const dealCtx = formatDealContext(linked.deal);
      const erpCtx = formatErpDealContext({
        quotes: linked.deal.quotes,
        orders: linked.deal.salesOrders,
        invoices: linked.deal.invoices,
      });
      const combined = [dealCtx, erpCtx].filter(Boolean).join("\n");
      scenarioContext = scenarioContext ? `${scenarioContext}\n${combined}` : combined;
    }
  }

  const result = await gradeTranscript({
    segments: args.segments,
    dimensions: parseDimensions(methodology.dimensionsJson),
    company: parseCompanyProfile(org.companyContext?.profileJson ?? "{}"),
    subjectType: args.subjectType,
    callType: args.callType,
    scenarioContext: scenarioContext || undefined,
  });

  const data = {
    orgId: args.orgId,
    subjectType: args.subjectType,
    methodologyId,
    dimensionScoresJson: JSON.stringify(result.dimensionScores),
    overallScore: result.overallScore,
    band: result.band,
    strengthsJson: JSON.stringify(result.strengths),
    improvementsJson: JSON.stringify(result.improvements),
    summary: result.summary,
    mechanicsJson: JSON.stringify(result.mechanics),
    gradedBy: result.gradedBy,
  };

  if (args.callId) {
    await db.grade.upsert({
      where: { callId: args.callId },
      create: { ...data, callId: args.callId },
      update: data,
    });
  } else if (args.roleplayId) {
    await db.grade.upsert({
      where: { roleplayId: args.roleplayId },
      create: { ...data, roleplayId: args.roleplayId },
      update: data,
    });
  }
  return result;
}

async function storeTranscript(callId: string, segments: TranscriptSegment[], engine: string) {
  await db.transcript.create({
    data: {
      callId,
      segmentsJson: JSON.stringify(segments),
      fullText: segments.map((s) => `${s.speaker.toUpperCase()}: ${s.text}`).join("\n"),
      engine,
    },
  });
}

async function repMonthStats(
  orgId: string,
  repId: string,
  now: Date,
  currentDurationSec: number,
): Promise<RepMonthStats> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const monthCalls = await db.call.findMany({
    where: {
      orgId,
      repId,
      callDate: { gte: monthStart },
      source: { not: "UPLOAD" },
      samplingStatus: { not: "BELOW_MIN_DURATION" },
    },
    select: { durationSec: true, samplingStatus: true },
  });

  const band = durationBand(currentDurationSec);
  const auto = monthCalls.filter(
    (c) => c.samplingStatus === "SAMPLED" || c.samplingStatus === "WITHIN_THRESHOLD",
  );
  return {
    eligibleCallsThisMonth: monthCalls.length + 1,
    autoGradedThisMonth: auto.length,
    sampledInSameDurationBand: auto.filter((c) => durationBand(c.durationSec) === band).length,
    dayOfMonth: now.getDate(),
    daysInMonth,
  };
}

function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
