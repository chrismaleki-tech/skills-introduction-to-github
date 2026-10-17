import { db } from "./db";
import { ingestCall } from "./pipeline";

export type ChannelKind = "EMAIL" | "PHONE";

export const EMAIL_PROVIDERS = [
  { key: "demo_email", label: "Demo inbox (no OAuth)" },
  { key: "gmail", label: "Gmail / Google Workspace" },
  { key: "outlook", label: "Outlook / Microsoft 365" },
  { key: "work_smtp", label: "Work email (SMTP/IMAP)" },
] as const;

export const PHONE_PROVIDERS = [
  { key: "demo_phone", label: "Demo dialer (no carrier)" },
  { key: "twilio", label: "Twilio" },
  { key: "aircall", label: "Aircall" },
  { key: "ringcentral", label: "RingCentral" },
] as const;

export async function getUserConnections(userId: string) {
  return db.channelConnection.findMany({
    where: { userId },
    orderBy: { channel: "asc" },
  });
}

export async function requireConnection(userId: string, channel: ChannelKind) {
  const conn = await db.channelConnection.findUnique({
    where: { userId_channel: { userId, channel } },
  });
  if (!conn || conn.status !== "CONNECTED") {
    throw new Error(
      channel === "EMAIL"
        ? "Connect your work email in Channels before emailing prospects."
        : "Connect your phone in Channels before calling prospects.",
    );
  }
  return conn;
}

export async function connectChannel(input: {
  orgId: string;
  userId: string;
  channel: ChannelKind;
  provider: string;
  address: string;
}) {
  const address = input.address.trim();
  if (!address) throw new Error("Address is required.");
  if (input.channel === "EMAIL" && !address.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  return db.channelConnection.upsert({
    where: { userId_channel: { userId: input.userId, channel: input.channel } },
    create: {
      orgId: input.orgId,
      userId: input.userId,
      channel: input.channel,
      provider: input.provider,
      address,
      status: "CONNECTED",
      credentialsJson: JSON.stringify({ demo: true, connectedVia: "ui" }),
    },
    update: {
      provider: input.provider,
      address,
      status: "CONNECTED",
      lastError: "",
      connectedAt: new Date(),
    },
  });
}

export async function disconnectChannel(userId: string, channel: ChannelKind) {
  const existing = await db.channelConnection.findUnique({
    where: { userId_channel: { userId, channel } },
  });
  if (!existing) return null;
  return db.channelConnection.update({
    where: { id: existing.id },
    data: { status: "DISCONNECTED" },
  });
}

/** Find or open an email/phone conversation for this CRM context. */
export async function findOrCreateConversation(input: {
  orgId: string;
  ownerId: string;
  channel: ChannelKind;
  subject?: string;
  prospectAddress: string;
  dealId?: string | null;
  contactId?: string | null;
  accountId?: string | null;
}) {
  const existing = await db.conversation.findFirst({
    where: {
      orgId: input.orgId,
      ownerId: input.ownerId,
      channel: input.channel,
      prospectAddress: input.prospectAddress,
      dealId: input.dealId ?? null,
      contactId: input.contactId ?? null,
      status: "OPEN",
    },
    orderBy: { lastMessageAt: "desc" },
  });
  if (existing) return existing;

  return db.conversation.create({
    data: {
      orgId: input.orgId,
      ownerId: input.ownerId,
      channel: input.channel,
      subject: input.subject?.trim() || (input.channel === "EMAIL" ? "(no subject)" : "Phone conversation"),
      prospectAddress: input.prospectAddress,
      dealId: input.dealId ?? null,
      contactId: input.contactId ?? null,
      accountId: input.accountId ?? null,
    },
  });
}

function demoProspectEmailReply(outboundBody: string, contactName: string): string {
  const lower = outboundBody.toLowerCase();
  if (lower.includes("thursday") || lower.includes("meeting") || lower.includes("calendar")) {
    return `Hi — Thursday afternoon works on my side. Please send a calendar invite and include a one-page agenda for my CFO.\n\nThanks,\n${contactName}`;
  }
  if (lower.includes("pricing") || lower.includes("cost") || lower.includes("proposal")) {
    return `Thanks for sending this over. Can you include implementation fees and a payback model against our chargebacks before we loop in finance?\n\n${contactName}`;
  }
  return `Thanks for the note — I've read it and will circle back after I check with ops. Feel free to call if anything is time-sensitive.\n\n${contactName}`;
}

function demoProspectCallReply(repNotes: string): string {
  if (repNotes.toLowerCase().includes("cfo") || repNotes.toLowerCase().includes("next step")) {
    return "Prospect agreed to a follow-up with the CFO and asked for a written payback model.";
  }
  return "Prospect acknowledged the inventory pain, asked about rollout risk, and requested a follow-up email.";
}

/**
 * Send an email from the employee's connected inbox to a prospect.
 * Demo providers record the outbound message and auto-append a realistic reply
 * so the CRM conversation history is immediately usable.
 */
export async function sendCrmEmail(input: {
  orgId: string;
  userId: string;
  to: string;
  subject: string;
  body: string;
  dealId?: string | null;
  contactId?: string | null;
  accountId?: string | null;
  conversationId?: string | null;
  simulateReply?: boolean;
}) {
  const conn = await requireConnection(input.userId, "EMAIL");
  const to = input.to.trim();
  const subject = input.subject.trim() || "(no subject)";
  const body = input.body.trim();
  if (!to || !to.includes("@")) throw new Error("Prospect email is required.");
  if (!body) throw new Error("Email body is required.");

  // Inherit CRM links from an existing conversation when replying in-thread.
  let dealId = input.dealId ?? null;
  let contactId = input.contactId ?? null;
  let accountId = input.accountId ?? null;
  let conversation =
    input.conversationId
      ? await db.conversation.findFirst({
          where: { id: input.conversationId, orgId: input.orgId, ownerId: input.userId },
        })
      : null;
  if (conversation) {
    dealId = dealId ?? conversation.dealId;
    contactId = contactId ?? conversation.contactId;
    accountId = accountId ?? conversation.accountId;
  } else {
    conversation = await findOrCreateConversation({
      orgId: input.orgId,
      ownerId: input.userId,
      channel: "EMAIL",
      subject,
      prospectAddress: to,
      dealId,
      contactId,
      accountId,
    });
  }

  if (!conversation.subject || conversation.subject === "(no subject)") {
    await db.conversation.update({
      where: { id: conversation.id },
      data: { subject },
    });
  }

  const now = new Date();
  const outbound = await db.message.create({
    data: {
      orgId: input.orgId,
      conversationId: conversation.id,
      senderId: input.userId,
      direction: "OUTBOUND",
      subject,
      body,
      status: conn.provider.startsWith("demo") ? "sent" : "queued",
      fromAddress: conn.address,
      toAddress: to,
      externalId: `email-out-${Date.now()}`,
      occurredAt: now,
    },
  });

  await db.activity.create({
    data: {
      orgId: input.orgId,
      dealId,
      contactId,
      accountId,
      ownerId: input.userId,
      type: "EMAIL",
      subject: `Email → ${to}: ${subject}`,
      body,
      externalRef: `msg:${outbound.id}`,
      occurredAt: now,
    },
  });

  let inbound = null;
  const simulate = input.simulateReply !== false && conn.provider.startsWith("demo");
  if (simulate) {
    const contact = contactId
      ? await db.contact.findUnique({ where: { id: contactId } })
      : null;
    const replyBody = demoProspectEmailReply(body, contact?.name ?? "there");
    const replyAt = new Date(now.getTime() + 90_000);
    inbound = await db.message.create({
      data: {
        orgId: input.orgId,
        conversationId: conversation.id,
        direction: "INBOUND",
        subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
        body: replyBody,
        status: "received",
        fromAddress: to,
        toAddress: conn.address,
        externalId: `email-in-${Date.now()}`,
        occurredAt: replyAt,
      },
    });
    await db.activity.create({
      data: {
        orgId: input.orgId,
        dealId,
        contactId,
        accountId,
        ownerId: input.userId,
        type: "EMAIL",
        subject: `Email ← ${to}: ${inbound.subject}`,
        body: replyBody,
        externalRef: `msg:${inbound.id}`,
        occurredAt: replyAt,
      },
    });
    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: replyAt },
    });
  } else {
    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now },
    });
  }

  return { conversation, outbound, inbound, from: conn.address };
}

/**
 * Place (or log) a phone call from the employee's connected dialer.
 * Creates/updates a PHONE conversation, optionally runs SalesCoach grading.
 */
export async function placeCrmCall(input: {
  orgId: string;
  userId: string;
  to: string;
  notes?: string;
  transcript?: string;
  durationSec?: number;
  callType?: string;
  dealId?: string | null;
  contactId?: string | null;
  accountId?: string | null;
  conversationId?: string | null;
  gradeWithSalesCoach?: boolean;
  simulateProspectSummary?: boolean;
}) {
  const conn = await requireConnection(input.userId, "PHONE");
  const to = input.to.trim();
  if (!to) throw new Error("Prospect phone number is required.");

  let dealId = input.dealId ?? null;
  let contactId = input.contactId ?? null;
  let accountId = input.accountId ?? null;
  let conversation =
    input.conversationId
      ? await db.conversation.findFirst({
          where: { id: input.conversationId, orgId: input.orgId, ownerId: input.userId },
        })
      : null;
  if (conversation) {
    dealId = dealId ?? conversation.dealId;
    contactId = contactId ?? conversation.contactId;
    accountId = accountId ?? conversation.accountId;
  } else {
    conversation = await findOrCreateConversation({
      orgId: input.orgId,
      ownerId: input.userId,
      channel: "PHONE",
      subject: `Calls with ${to}`,
      prospectAddress: to,
      dealId,
      contactId,
      accountId,
    });
  }

  const contact = contactId ? await db.contact.findUnique({ where: { id: contactId } }) : null;
  const durationSec = Math.max(0, Math.round(Number(input.durationSec ?? 180)));
  const notes = (input.notes ?? "").trim();
  const now = new Date();

  const defaultTranscript =
    input.transcript?.trim() ||
    `REP: Hi${contact?.name ? ` ${contact.name.split(" ")[0]}` : ""}, calling from Meridian — do you have a couple minutes?
PROSPECT: Sure, what's up?
REP: ${notes || "Wanted to follow up on inventory accuracy across your warehouses and see if a short discovery would help."}
PROSPECT: ${demoProspectCallReply(notes)}
REP: Great — I'll send a recap and proposed next step by email.`;

  let callId: string | null = null;
  let gradeScore: number | null = null;

  if (input.gradeWithSalesCoach !== false) {
    const { call } = await ingestCall({
      orgId: input.orgId,
      repId: input.userId,
      source: "CRM",
      direction: "outbound",
      callType: input.callType ?? "discovery",
      durationSec,
      externalId: `crm-phone-${conversation.id}-${Date.now()}`,
      prospectName: contact?.name ?? to,
      providedTranscript: defaultTranscript,
      accountId: accountId ?? undefined,
      contactId: contactId ?? undefined,
      dealId: dealId ?? undefined,
    });
    callId = call.id;
    const grade = await db.grade.findUnique({ where: { callId: call.id } });
    gradeScore = grade?.overallScore ?? null;
  }

  const outbound = await db.message.create({
    data: {
      orgId: input.orgId,
      conversationId: conversation.id,
      senderId: input.userId,
      callId,
      direction: "OUTBOUND",
      subject: `Outbound call · ${durationSec}s`,
      body: notes || "Outbound call logged from CRM dialer.",
      status: "completed",
      fromAddress: conn.address,
      toAddress: to,
      durationSec,
      externalId: `phone-out-${Date.now()}`,
      occurredAt: now,
    },
  });

  await db.activity.create({
    data: {
      orgId: input.orgId,
      dealId,
      contactId,
      accountId,
      ownerId: input.userId,
      callId,
      type: "CALL",
      subject: `Call → ${contact?.name || to}${gradeScore != null ? ` · Coach ${gradeScore}` : ""}`,
      body: notes || defaultTranscript.slice(0, 500),
      score: gradeScore,
      externalRef: `msg:${outbound.id}`,
      occurredAt: now,
    },
  });

  let inbound = null;
  if (input.simulateProspectSummary !== false && conn.provider.startsWith("demo")) {
    const summary = demoProspectCallReply(notes);
    const replyAt = new Date(now.getTime() + 5_000);
    inbound = await db.message.create({
      data: {
        orgId: input.orgId,
        conversationId: conversation.id,
        direction: "INBOUND",
        subject: "Prospect call summary",
        body: summary,
        status: "received",
        fromAddress: to,
        toAddress: conn.address,
        durationSec: Math.max(20, Math.round(durationSec * 0.35)),
        externalId: `phone-in-${Date.now()}`,
        occurredAt: replyAt,
      },
    });
  }

  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: inbound?.occurredAt ?? now },
  });

  return {
    conversation,
    outbound,
    inbound,
    callId,
    gradeScore,
    from: conn.address,
  };
}
