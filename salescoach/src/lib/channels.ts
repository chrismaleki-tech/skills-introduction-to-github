import { db } from "./db";
import { ingestCall } from "./pipeline";
import { parseIngestionPolicy } from "./types";
import { EMAIL_PROVIDERS, PHONE_PROVIDERS, providerReady } from "./channels-ready";

export type ChannelKind = "EMAIL" | "PHONE";
export { EMAIL_PROVIDERS, PHONE_PROVIDERS, providerReady };

function isDemoProvider(provider: string) {
  return provider.startsWith("demo");
}

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
  /** OAuth / API tokens for live providers (never store demo:true for live). */
  credentials?: Record<string, unknown>;
}) {
  const address = input.address.trim();
  if (!address) throw new Error("Address is required.");
  if (input.channel === "EMAIL" && !address.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  const ready = providerReady(input.provider);
  if (!ready.ok) {
    throw new Error(ready.reason || "Provider is not configured.");
  }

  // OAuth providers need a completed token exchange before CONNECTED.
  const needsOAuth = input.provider === "gmail" || input.provider === "outlook" || input.provider === "ringcentral";
  const hasToken =
    Boolean(input.credentials?.accessToken) ||
    Boolean(input.credentials?.refreshToken) ||
    Boolean(input.credentials?.apiToken);

  if (needsOAuth && !hasToken && process.env.NODE_ENV === "production") {
    throw new Error(
      `Complete OAuth for ${input.provider} before connecting. Open the provider authorize URL from Channels.`,
    );
  }

  const credentialsJson = JSON.stringify(
    isDemoProvider(input.provider)
      ? { demo: true, connectedVia: "ui" }
      : {
          demo: false,
          connectedVia: hasToken ? "oauth" : "env",
          ...(input.credentials ?? {}),
          // Mark env-backed providers as ready when org-level secrets exist.
          envBacked: !needsOAuth,
        },
  );

  return db.channelConnection.upsert({
    where: { userId_channel: { userId: input.userId, channel: input.channel } },
    create: {
      orgId: input.orgId,
      userId: input.userId,
      channel: input.channel,
      provider: input.provider,
      address,
      status: "CONNECTED",
      credentialsJson,
    },
    update: {
      provider: input.provider,
      address,
      status: "CONNECTED",
      lastError: "",
      credentialsJson,
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
    data: { status: "DISCONNECTED", credentialsJson: "{}" },
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

async function deliverOutboundEmail(input: {
  provider: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}): Promise<{ status: "sent" | "queued" | "failed"; externalId?: string; error?: string }> {
  if (isDemoProvider(input.provider)) {
    return { status: "sent", externalId: `demo-email-${Date.now()}` };
  }

  if (input.provider === "work_smtp") {
    // Prefer SMTP via raw TCP is heavy; use a webhook relay if SMTP_RELAY_URL is set,
    // otherwise mark queued for the worker / external MTA.
    const relay = process.env.SMTP_RELAY_URL?.trim();
    if (relay) {
      const res = await fetch(relay, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.SMTP_RELAY_TOKEN
            ? { Authorization: `Bearer ${process.env.SMTP_RELAY_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          from: input.from,
          to: input.to,
          subject: input.subject,
          text: input.body,
        }),
      });
      if (!res.ok) {
        return { status: "failed", error: `SMTP relay failed (${res.status})` };
      }
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      return { status: "sent", externalId: data.id || `smtp-${Date.now()}` };
    }
    return { status: "queued", externalId: `smtp-queue-${Date.now()}` };
  }

  if (input.provider === "gmail" || input.provider === "outlook") {
    // Tokens would be used here; without a send API call we queue for the sync worker.
    return { status: "queued", externalId: `${input.provider}-queue-${Date.now()}` };
  }

  return { status: "queued", externalId: `email-queue-${Date.now()}` };
}

async function placeLivePhoneCall(input: {
  provider: string;
  from: string;
  to: string;
}): Promise<{ status: "initiated" | "logged" | "failed"; externalId?: string; error?: string }> {
  if (isDemoProvider(input.provider)) {
    return { status: "logged", externalId: `demo-phone-${Date.now()}` };
  }

  if (input.provider === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const token = process.env.TWILIO_AUTH_TOKEN!;
    const twimlUrl = process.env.TWILIO_TWIML_URL?.trim();
    if (!twimlUrl) {
      return {
        status: "failed",
        error: "Set TWILIO_TWIML_URL (TwiML App or webhook URL) to place live Twilio calls.",
      };
    }
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({
      To: input.to,
      From: input.from,
      Url: twimlUrl,
    });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { status: "failed", error: `Twilio call failed (${res.status}): ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as { sid?: string };
    return { status: "initiated", externalId: data.sid };
  }

  // Aircall / RingCentral: initiate via their APIs when tokens exist; otherwise fail clearly.
  return {
    status: "failed",
    error: `${input.provider} live dial requires provider API wiring — use demo_phone or Twilio for now.`,
  };
}

/**
 * Send an email from the employee's connected inbox to a prospect.
 * Demo providers record the outbound message and auto-append a realistic reply.
 * Live providers attempt delivery (SMTP relay / queue) and never fabricate replies.
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

  const delivery = await deliverOutboundEmail({
    provider: conn.provider,
    from: conn.address,
    to,
    subject,
    body,
  });
  if (delivery.status === "failed") {
    await db.channelConnection.update({
      where: { id: conn.id },
      data: { lastError: delivery.error || "send failed", status: "ERROR" },
    });
    throw new Error(delivery.error || "Email delivery failed.");
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
      status: delivery.status,
      fromAddress: conn.address,
      toAddress: to,
      externalId: delivery.externalId || `email-out-${Date.now()}`,
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

  const org = await db.org.findUnique({ where: { id: input.orgId } });
  const policy = parseIngestionPolicy(org?.ingestionPolicyJson ?? "{}");
  if (policy.gradeOutboundEmails !== false) {
    const { enqueueJob } = await import("./queue");
    await enqueueJob({
      orgId: input.orgId,
      type: "GRADE_EMAIL",
      payload: { messageId: outbound.id },
    });
  }

  let inbound = null;
  const simulate = input.simulateReply !== false && isDemoProvider(conn.provider);
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

  return { conversation, outbound, inbound, from: conn.address, deliveryStatus: delivery.status };
}

/**
 * Place (or log) a phone call from the employee's connected dialer.
 * Live Twilio dials when configured; demo synthesizes a transcript for coaching.
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
  const demo = isDemoProvider(conn.provider);

  if (!demo) {
    const live = await placeLivePhoneCall({ provider: conn.provider, from: conn.address, to });
    if (live.status === "failed") {
      await db.channelConnection.update({
        where: { id: conn.id },
        data: { lastError: live.error || "dial failed", status: "ERROR" },
      });
      throw new Error(live.error || "Live dial failed.");
    }
  }

  const hasTranscript = Boolean(input.transcript?.trim());
  if (!demo && !hasTranscript && input.gradeWithSalesCoach !== false) {
    // Live calls without a transcript yet: log CRM activity only; webhook/recording
    // will attach transcript later via ingest.
    const outbound = await db.message.create({
      data: {
        orgId: input.orgId,
        conversationId: conversation.id,
        senderId: input.userId,
        direction: "OUTBOUND",
        subject: `Outbound call · initiated`,
        body: notes || "Live outbound call initiated.",
        status: "initiated",
        fromAddress: conn.address,
        toAddress: to,
        durationSec: 0,
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
        type: "CALL",
        subject: `Call → ${contact?.name || to} (live)`,
        body: notes || "Live call initiated — transcript pending.",
        externalRef: `msg:${outbound.id}`,
        occurredAt: now,
      },
    });
    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now },
    });
    return {
      conversation,
      outbound,
      inbound: null,
      callId: null,
      gradeScore: null,
      from: conn.address,
      live: true,
    };
  }

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
  if (input.simulateProspectSummary !== false && demo) {
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
    live: false,
  };
}
