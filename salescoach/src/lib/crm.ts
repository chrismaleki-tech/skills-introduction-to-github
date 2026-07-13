import { db } from "./db";
import { BAND_LABELS } from "./scoring";
import type { ScoreBand } from "./types";

// Pipeline stages for the built-in CRM. Order matters for the board and for
// mapping call types → expected stage when auto-linking.
export const DEAL_STAGES = [
  { key: "lead", label: "Lead", probability: 10 },
  { key: "qualified", label: "Qualified", probability: 20 },
  { key: "discovery", label: "Discovery", probability: 35 },
  { key: "demo", label: "Demo", probability: 50 },
  { key: "proposal", label: "Proposal", probability: 65 },
  { key: "negotiation", label: "Negotiation", probability: 80 },
  { key: "closed_won", label: "Closed won", probability: 100 },
  { key: "closed_lost", label: "Closed lost", probability: 0 },
] as const;

export type DealStage = (typeof DEAL_STAGES)[number]["key"];

export const OPEN_STAGES: DealStage[] = DEAL_STAGES.filter(
  (s) => s.key !== "closed_won" && s.key !== "closed_lost",
).map((s) => s.key);

export function stageLabel(stage: string): string {
  return DEAL_STAGES.find((s) => s.key === stage)?.label ?? stage;
}

export function stageMeta(stage: string) {
  return DEAL_STAGES.find((s) => s.key === stage) ?? DEAL_STAGES[0];
}

export function fmtMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Human-readable deal context string injected into the grading prompt. */
export function formatDealContext(deal: {
  name: string;
  stage: string;
  amount: number;
  product: string;
  probability: number;
  nextStep: string;
  account?: { name: string; industry: string; size: string } | null;
  contact?: { name: string; title: string } | null;
}): string {
  const bits = [
    `CRM deal "${deal.name}" is in ${stageLabel(deal.stage)}` +
      (deal.amount ? ` ($${deal.amount.toLocaleString()}, ${deal.probability}% likely)` : ""),
  ];
  if (deal.product) bits.push(`Product line: ${deal.product}.`);
  if (deal.account) {
    bits.push(
      `Account: ${deal.account.name}` +
        (deal.account.industry ? ` (${deal.account.industry}` : "") +
        (deal.account.size ? `${deal.account.industry ? ", " : " ("}${deal.account.size}` : "") +
        (deal.account.industry || deal.account.size ? ")" : "") +
        ".",
    );
  }
  if (deal.contact) {
    bits.push(
      `Primary contact: ${deal.contact.name}` +
        (deal.contact.title ? `, ${deal.contact.title}` : "") +
        ".",
    );
  }
  if (deal.nextStep) bits.push(`Stated next step: ${deal.nextStep}.`);
  bits.push("Ground coaching feedback in this deal stage and account context.");
  return bits.join(" ");
}

/**
 * After a call is graded, write (or refresh) a COACHING activity on the linked
 * deal/contact/account timeline. Idempotent via externalRef = grade:<id>.
 */
export async function writeBackGradeToCrm(callId: string) {
  const call = await db.call.findUnique({
    where: { id: callId },
    include: { grade: true, rep: true },
  });
  if (!call?.grade) return null;
  if (!call.dealId && !call.accountId && !call.contactId) return null;

  const grade = call.grade;
  const band = grade.band as ScoreBand;
  const subject = `Coaching scorecard · ${grade.overallScore}/100 (${BAND_LABELS[band] ?? grade.band})`;
  const body = [
    grade.summary,
    "",
    grade.managerOverrideScore != null
      ? `Manager override: ${grade.managerOverrideScore}/100${grade.managerComment ? ` — ${grade.managerComment}` : ""}`
      : null,
    `Rep: ${call.rep.name}`,
    `Call type: ${call.callType.replaceAll("_", " ")}`,
    `View in SalesCoach: /calls/${call.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  const externalRef = `grade:${grade.id}`;
  return db.activity.upsert({
    where: { orgId_externalRef: { orgId: call.orgId, externalRef } },
    create: {
      orgId: call.orgId,
      accountId: call.accountId,
      contactId: call.contactId,
      dealId: call.dealId,
      ownerId: call.repId,
      callId: call.id,
      type: "COACHING",
      subject,
      body,
      score: grade.overallScore,
      band: grade.band,
      externalRef,
      occurredAt: call.callDate,
    },
    update: {
      subject,
      body,
      score: grade.overallScore,
      band: grade.band,
      accountId: call.accountId,
      contactId: call.contactId,
      dealId: call.dealId,
    },
  });
}

/** Link a call to CRM records and optionally refresh the coaching write-back. */
export async function linkCallToCrm(
  callId: string,
  orgId: string,
  links: { dealId?: string | null; contactId?: string | null; accountId?: string | null },
) {
  const data: {
    dealId: string | null;
    contactId: string | null;
    accountId: string | null;
    prospectName?: string;
  } = {
    dealId: links.dealId ?? null,
    contactId: links.contactId ?? null,
    accountId: links.accountId ?? null,
  };

  // When a deal is chosen, inherit account/contact from it if not provided.
  if (links.dealId) {
    const deal = await db.deal.findFirst({
      where: { id: links.dealId, orgId },
      include: { contact: true, account: true },
    });
    if (!deal) throw new Error("Deal not found.");
    if (links.accountId === undefined) data.accountId = deal.accountId;
    if (links.contactId === undefined) data.contactId = deal.contactId;
    if (deal.contact?.name) data.prospectName = deal.contact.name;
    else if (deal.account?.name) data.prospectName = deal.account.name;
  }

  const call = await db.call.update({
    where: { id: callId },
    data,
    include: { grade: true },
  });

  if (call.grade) await writeBackGradeToCrm(call.id);
  return call;
}
