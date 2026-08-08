import { db } from "./db";

function normEmail(e: string) {
  return e.trim().toLowerCase();
}

function normPhone(p: string) {
  return p.replace(/\D/g, "");
}

/**
 * Auto-attach a call to CRM records from prospect email / phone / name when
 * the ingest payload didn't already supply deal/contact/account ids.
 */
export async function autoMatchCallToCrm(input: {
  orgId: string;
  callId: string;
  prospectEmail?: string;
  prospectPhone?: string;
  prospectName?: string;
  callType?: string;
  preferOwnerId?: string;
}) {
  const call = await db.call.findUnique({ where: { id: input.callId } });
  if (!call) return null;
  if (call.dealId && call.contactId && call.accountId) return call;

  let contactId = call.contactId;
  let accountId = call.accountId;
  let dealId = call.dealId;
  let prospectName = call.prospectName;

  if (!contactId && input.prospectEmail) {
    const byEmail = await db.contact.findFirst({
      where: { orgId: input.orgId, email: { equals: normEmail(input.prospectEmail) } },
    });
    // SQLite case-sensitivity: also scan if exact match missed
    const contact =
      byEmail ??
      (await db.contact.findMany({ where: { orgId: input.orgId }, take: 500 })).find(
        (c) => c.email && normEmail(c.email) === normEmail(input.prospectEmail!),
      );
    if (contact) {
      contactId = contact.id;
      accountId = accountId ?? contact.accountId;
      if (!prospectName) prospectName = contact.name;
    }
  }

  if (!contactId && input.prospectPhone) {
    const needle = normPhone(input.prospectPhone);
    if (needle.length >= 7) {
      const contacts = await db.contact.findMany({
        where: { orgId: input.orgId, NOT: { phone: "" } },
        take: 500,
      });
      const contact = contacts.find((c) => normPhone(c.phone).endsWith(needle.slice(-10)));
      if (contact) {
        contactId = contact.id;
        accountId = accountId ?? contact.accountId;
        if (!prospectName) prospectName = contact.name;
      }
    }
  }

  if (!contactId && input.prospectName?.trim()) {
    const name = input.prospectName.trim().toLowerCase();
    const contact = await db.contact.findFirst({
      where: { orgId: input.orgId, name: { contains: input.prospectName.trim() } },
    });
    // fallback loose match
    const matched =
      contact ??
      (await db.contact.findMany({ where: { orgId: input.orgId }, take: 500 })).find(
        (c) => c.name.toLowerCase() === name,
      );
    if (matched) {
      contactId = matched.id;
      accountId = accountId ?? matched.accountId;
    }
  }

  if (!dealId && (contactId || accountId)) {
    const deal = await db.deal.findFirst({
      where: {
        orgId: input.orgId,
        // Prefer open deals; stage keys vary per industry pack, but the
        // closed keys are stable across all of them.
        stage: { notIn: ["closed_won", "closed_lost"] },
        ...(contactId ? { contactId } : { accountId: accountId! }),
        ...(input.preferOwnerId ? { ownerId: input.preferOwnerId } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
    if (deal) {
      dealId = deal.id;
      accountId = accountId ?? deal.accountId;
      contactId = contactId ?? deal.contactId;
    }
  }

  if (!dealId && !contactId && !accountId) return call;

  return db.call.update({
    where: { id: call.id },
    data: {
      dealId: dealId ?? call.dealId,
      contactId: contactId ?? call.contactId,
      accountId: accountId ?? call.accountId,
      prospectName: prospectName || call.prospectName,
    },
  });
}
