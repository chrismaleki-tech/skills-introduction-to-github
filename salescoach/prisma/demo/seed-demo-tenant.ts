/**
 * Customer-demo seeding engine.
 *
 * Consumes a DemoTenantSpec (pure data — see ./types) and builds a fully
 * populated tenant through the SAME production code paths the app uses:
 * the real ingestion pipeline (transcription + sampling + grading), role-play
 * grading, CRM write-backs, channels, and the quote → order → invoice → payment
 * flow. Idempotent per tenant: if an org with the spec's name already exists,
 * the seed is skipped.
 */

import { db } from "../../src/lib/db";
import { hashPassword } from "../../src/lib/password";
import { METHODOLOGY_PRESETS } from "../../src/lib/presets";
import { ingestCall, gradeRoleplay } from "../../src/lib/pipeline";
import type { RoleplayMessage } from "../../src/lib/types";
import type { DemoTenantSpec } from "./types";
import { validateDemoSpec } from "./validate";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function seedDemoTenant(spec: DemoTenantSpec): Promise<{ orgId: string } | { skipped: true }> {
  const problems = validateDemoSpec(spec);
  if (problems.length) {
    throw new Error(`Demo spec "${spec.orgName}" is invalid:\n- ${problems.join("\n- ")}`);
  }

  const existing = await db.org.findFirst({ where: { name: spec.orgName } });
  if (existing) {
    console.log(`= ${spec.orgName}: already seeded, skipping`);
    return { skipped: true };
  }
  const slug = slugify(spec.orgName);
  console.log(`+ Seeding demo tenant: ${spec.orgName}`);

  // Global methodology presets (idempotent).
  for (const preset of METHODOLOGY_PRESETS) {
    const found = await db.methodology.findFirst({ where: { name: preset.name, isPreset: true, orgId: null } });
    if (!found) {
      await db.methodology.create({
        data: {
          name: preset.name,
          description: preset.description,
          isPreset: true,
          dimensionsJson: JSON.stringify(preset.dimensions),
        },
      });
    }
  }

  const org = await db.org.create({
    data: {
      name: spec.orgName,
      ingestionPolicyJson: JSON.stringify({
        minDurationSec: 60,
        sampleThreshold: 10,
        sampleSize: 10,
        gradeManualUploads: true,
        autoMatchCrm: true,
        gradeOutboundEmails: true,
      }),
      retentionPolicyJson: JSON.stringify({
        redactPiiInTranscripts: true,
        redactPiiInEmailBodies: true,
        retainCallDays: 365,
        retainEmailDays: 365,
      }),
    },
  });

  const preset = METHODOLOGY_PRESETS.find((candidate) => candidate.name === spec.rubric.presetName)!;
  const active = await db.methodology.create({
    data: {
      orgId: org.id,
      name: spec.rubric.name,
      description: spec.rubric.description,
      dimensionsJson: JSON.stringify([...preset.dimensions, ...(spec.rubric.customDimensions ?? [])]),
    },
  });
  await db.org.update({ where: { id: org.id }, data: { activeMethodologyId: active.id } });
  await db.companyContext.create({ data: { orgId: org.id, profileJson: JSON.stringify(spec.company) } });

  // Users
  const passwordHash = await hashPassword("password123");
  const userByEmail = new Map<string, { id: string; email: string; name: string }>();
  for (const userSpec of spec.users) {
    const user = await db.user.create({
      data: {
        orgId: org.id,
        name: userSpec.name,
        email: userSpec.email,
        role: userSpec.role,
        title: userSpec.title,
        passwordHash,
      },
    });
    userByEmail.set(userSpec.email.toLowerCase(), user);
  }
  const byEmail = (email: string) => userByEmail.get(email.toLowerCase())!;
  const manager = byEmail(spec.users.find((u) => u.role === "MANAGER")!.email);
  const repSpecs = spec.users.filter((u) => u.role === "REP");

  // Scenarios
  const scenarioByTitle = new Map<string, { id: string }>();
  for (const scenario of spec.scenarios) {
    const row = await db.scenario.create({
      data: {
        orgId: org.id,
        title: scenario.title,
        callType: scenario.callType,
        difficulty: scenario.difficulty,
        personaJson: JSON.stringify(scenario.persona),
        winConditionsJson: JSON.stringify(scenario.winConditions),
        methodologyId: active.id,
      },
    });
    scenarioByTitle.set(scenario.title, row);
  }

  // Call history through the real ingestion pipeline (sampling + grading).
  const now = new Date();
  const transcripts = [spec.transcripts.good, spec.transcripts.mid, spec.transcripts.poor, spec.transcripts.demo];
  let extId = 1000;
  for (let r = 0; r < repSpecs.length; r++) {
    const rep = byEmail(repSpecs[r].email);
    const callCount = repSpecs[r].highVolume ? 28 : 8;
    for (let i = 0; i < callCount; i++) {
      const daysAgo = Math.floor((i / callCount) * 49);
      const callDate = new Date(now.getTime() - daysAgo * 86400000 - (i % 7) * 3600000);
      const quality = (r + i) % 4;
      const durationSec = quality === 2 ? 95 : 300 + ((i * 137) % 900);
      await ingestCall({
        orgId: org.id,
        repId: rep.id,
        source: i % 9 === 0 ? "API" : "WEBHOOK",
        direction: "outbound",
        callType: quality === 3 ? "demo" : i % 3 === 0 ? "cold_call" : "discovery",
        durationSec,
        externalId: `demo-${slug}-${extId++}`,
        prospectName: spec.prospectNames[i % spec.prospectNames.length],
        callDate,
        providedTranscript: transcripts[quality],
      });
    }
    await ingestCall({
      orgId: org.id,
      repId: rep.id,
      source: "UPLOAD",
      callType: "discovery",
      durationSec: 840,
      prospectName: spec.prospectNames[r % spec.prospectNames.length],
      callDate: new Date(now.getTime() - 2 * 86400000),
      providedTranscript: spec.transcripts.followups[r % spec.transcripts.followups.length],
    });
    await ingestCall({
      orgId: org.id,
      repId: rep.id,
      source: "WEBHOOK",
      callType: "discovery",
      durationSec: 720,
      externalId: `demo-${slug}-flag-${r}`,
      prospectName: spec.prospectNames[(r + 1) % spec.prospectNames.length],
      callDate: new Date(now.getTime() - 1 * 86400000),
      providedTranscript: spec.transcripts.followups[(r + 1) % spec.transcripts.followups.length],
      repFlagged: true,
    });
  }

  // Role-play sessions (completed + graded)
  const toMessages = (pairs: [string, string][]): RoleplayMessage[] => {
    let at = 2000;
    const out: RoleplayMessage[] = [];
    for (const [repLine, prospectLine] of pairs) {
      out.push({ role: "rep", text: repLine, atMs: at });
      at += 9000;
      out.push({ role: "prospect", text: prospectLine, atMs: at });
      at += 8000;
    }
    return out;
  };
  const scenarioRows = [...scenarioByTitle.values()];
  for (let r = 0; r < repSpecs.length; r++) {
    for (let k = 0; k < 2; k++) {
      const good = (r + k) % 2 === 0;
      const session = await db.roleplaySession.create({
        data: {
          orgId: org.id,
          repId: byEmail(repSpecs[r].email).id,
          scenarioId: scenarioRows[(r + k) % scenarioRows.length].id,
          mode: "TEXT",
          status: "COMPLETED",
          messagesJson: JSON.stringify(toMessages(good ? spec.roleplayDialogues.good : spec.roleplayDialogues.poor)),
          durationSec: 95,
          startedAt: new Date(now.getTime() - (3 + k * 6 + r) * 86400000),
          endedAt: new Date(now.getTime() - (3 + k * 6 + r) * 86400000 + 95000),
        },
      });
      await gradeRoleplay(session.id);
    }
  }

  // Assignments
  for (const assignment of spec.assignments) {
    await db.assignment.create({
      data: {
        orgId: org.id,
        assignedToId: byEmail(assignment.repEmail).id,
        assignedById: manager.id,
        type: assignment.type,
        scenarioId: assignment.scenarioTitle ? scenarioByTitle.get(assignment.scenarioTitle)?.id : undefined,
        targetCount: assignment.targetCount,
        doneCount: assignment.doneCount ?? 0,
        note: assignment.note,
        status: (assignment.doneCount ?? 0) > 0 ? "IN_PROGRESS" : "PENDING",
        dueDate: new Date(now.getTime() + assignment.dueInDays * 86400000),
      },
    });
  }

  // CRM book
  const accountByRef = new Map<string, { id: string }>();
  for (const account of spec.accounts) {
    accountByRef.set(
      account.ref,
      await db.account.create({
        data: {
          orgId: org.id,
          ownerId: byEmail(account.ownerEmail).id,
          name: account.name,
          domain: account.domain ?? "",
          industry: account.industry ?? "",
          size: account.size ?? "",
          website: account.website ?? "",
          notes: account.notes ?? "",
        },
      }),
    );
  }
  const contactByRef = new Map<string, { id: string; email: string; phone: string }>();
  for (const contact of spec.contacts) {
    contactByRef.set(
      contact.ref,
      await db.contact.create({
        data: {
          orgId: org.id,
          accountId: accountByRef.get(contact.accountRef)!.id,
          ownerId: byEmail(contact.ownerEmail).id,
          name: contact.name,
          title: contact.title,
          email: contact.email,
          phone: contact.phone,
        },
      }),
    );
  }
  const dealByRef = new Map<string, { id: string; accountId: string | null; contactId: string | null; ownerId: string | null }>();
  for (const deal of spec.deals) {
    const row = await db.deal.create({
      data: {
        orgId: org.id,
        accountId: deal.accountRef ? accountByRef.get(deal.accountRef)!.id : undefined,
        contactId: deal.contactRef ? contactByRef.get(deal.contactRef)!.id : undefined,
        ownerId: byEmail(deal.ownerEmail).id,
        name: deal.name,
        stage: deal.stage,
        amount: deal.amount,
        product: deal.product,
        probability: deal.probability,
        nextStep: deal.nextStep ?? "",
        notes: deal.notes ?? "",
        closeDate: deal.closeInDays != null ? new Date(now.getTime() + deal.closeInDays * 86400000) : undefined,
      },
    });
    dealByRef.set(deal.ref, row);
    await db.activity.create({
      data: {
        orgId: org.id,
        dealId: row.id,
        accountId: row.accountId,
        contactId: row.contactId,
        ownerId: row.ownerId,
        type: "NOTE",
        subject: "Deal created",
        body: deal.createdNote ?? `Opened by ${deal.ownerEmail}.`,
      },
    });
  }

  // Link recent graded calls to flagged deals; write coaching back to CRM.
  const { writeBackGradeToCrm } = await import("../../src/lib/crm");
  for (const deal of spec.deals) {
    if (!deal.linkRecentCalls) continue;
    const row = dealByRef.get(deal.ref)!;
    const calls = await db.call.findMany({
      where: { orgId: org.id, repId: row.ownerId ?? undefined, status: "GRADED", dealId: null },
      include: { grade: true },
      orderBy: { callDate: "desc" },
      take: 2,
    });
    for (const call of calls) {
      await db.call.update({
        where: { id: call.id },
        data: { dealId: row.id, accountId: row.accountId, contactId: row.contactId },
      });
      if (call.grade) await writeBackGradeToCrm(call.id);
    }
  }

  // Channels + outreach
  const { connectChannel, sendCrmEmail, placeCrmCall } = await import("../../src/lib/channels");
  const staff = [...repSpecs.map((r) => byEmail(r.email)), manager];
  for (let i = 0; i < staff.length; i++) {
    await connectChannel({ orgId: org.id, userId: staff[i].id, channel: "EMAIL", provider: "demo_email", address: staff[i].email });
    await connectChannel({
      orgId: org.id,
      userId: staff[i].id,
      channel: "PHONE",
      provider: "demo_phone",
      address: `+1-555-02${String(i).padStart(2, "0")}`,
    });
  }
  for (const email of spec.outreachEmails) {
    const contact = contactByRef.get(email.contactRef)!;
    const contactRow = await db.contact.findUnique({ where: { id: contact.id } });
    const deal = email.dealRef ? dealByRef.get(email.dealRef) : undefined;
    await sendCrmEmail({
      orgId: org.id,
      userId: byEmail(email.fromEmail).id,
      to: contact.email,
      subject: email.subject,
      body: email.body,
      dealId: deal?.id,
      contactId: contact.id,
      accountId: deal?.accountId ?? contactRow?.accountId ?? undefined,
    });
  }
  for (const call of spec.outreachCalls) {
    const contact = contactByRef.get(call.contactRef)!;
    const contactRow = await db.contact.findUnique({ where: { id: contact.id } });
    const deal = call.dealRef ? dealByRef.get(call.dealRef) : undefined;
    await placeCrmCall({
      orgId: org.id,
      userId: byEmail(call.fromEmail).id,
      to: contact.phone,
      notes: call.notes,
      durationSec: call.durationSec,
      callType: call.callType,
      dealId: deal?.id,
      contactId: contact.id,
      accountId: deal?.accountId ?? contactRow?.accountId ?? undefined,
      gradeWithSalesCoach: true,
    });
  }

  // ERP: catalog, inventory, quote → cash
  const { createQuote, sendQuote, acceptQuote, confirmOrder, fulfillOrder, createInvoiceFromOrder, sendInvoice, recordPayment } =
    await import("../../src/lib/erp");
  const { ensureChartOfAccounts, adjustWarehouseStock } = await import("../../src/lib/erp-deep");

  await db.org.update({ where: { id: org.id }, data: { baseCurrency: "USD", defaultTaxCode: "US-CA" } });
  await db.taxCode.createMany({
    data: [
      { orgId: org.id, code: "US-CA", name: "California sales tax", ratePercent: 9, jurisdiction: "CA, USA" },
      { orgId: org.id, code: "US-EXEMPT", name: "Tax exempt", ratePercent: 0, jurisdiction: "USA" },
    ],
  });
  await ensureChartOfAccounts(org.id);

  let warehouse: { id: string } | null = null;
  if (spec.warehouse) {
    warehouse = await db.warehouse.create({
      data: {
        orgId: org.id,
        code: spec.warehouse.code,
        name: spec.warehouse.name,
        address: spec.warehouse.address,
        isDefault: true,
        bins: { create: [{ code: "A-01", name: "Receiving" }] },
      },
    });
  }

  const productBySku = new Map<string, { id: string; name: string; listPrice: number }>();
  for (const product of spec.products) {
    const row = await db.product.create({
      data: {
        orgId: org.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        category: product.category,
        listPrice: product.listPrice,
        cost: product.cost,
        unit: product.unit,
        trackInventory: product.trackInventory ?? false,
        reorderPoint: product.reorderPoint ?? 0,
        qtyOnHand: 0,
        qtyReserved: 0,
        active: true,
      },
    });
    productBySku.set(product.sku, row);
    if (product.trackInventory && product.initialStock && warehouse) {
      await adjustWarehouseStock({
        orgId: org.id,
        productId: row.id,
        warehouseId: warehouse.id,
        deltaOnHand: product.initialStock,
      });
    }
  }

  for (const quote of spec.quotes) {
    const deal = dealByRef.get(quote.dealRef)!;
    const owner = byEmail(quote.ownerEmail);
    const created = await createQuote({
      orgId: org.id,
      ownerId: owner.id,
      dealId: deal.id,
      accountId: deal.accountId ?? undefined,
      contactId: deal.contactId ?? undefined,
      title: quote.title,
      notes: quote.notes ?? "",
      taxCode: quote.taxCode ?? "US-EXEMPT",
      validUntil: new Date(now.getTime() + (quote.validInDays ?? 30) * 86400000),
      lines: quote.lines.map((line) => {
        const product = productBySku.get(line.sku)!;
        return {
          productId: product.id,
          description: line.description ?? product.name,
          quantity: line.quantity,
          unitPrice: line.unitPrice ?? product.listPrice,
        };
      }),
    });
    if (quote.status === "sent" || quote.status === "accepted") {
      await sendQuote(created.id, org.id, owner.id);
    }
    if (quote.status === "accepted") {
      const { order } = await acceptQuote(created.id, org.id, owner.id);
      await confirmOrder(order.id, org.id, owner.id);
      await fulfillOrder(order.id, org.id, owner.id);
      const invoice = await createInvoiceFromOrder(order.id, org.id, owner.id);
      await sendInvoice(invoice.id, org.id, owner.id);
      await recordPayment({
        orgId: org.id,
        userId: owner.id,
        invoiceId: invoice.id,
        amount: Math.round(invoice.total * 0.5),
        method: "ach",
        reference: `ACH-${slug.toUpperCase().slice(0, 12)}-1`,
      });
    }
  }

  // Re-apply the authored deal fields last: the production quote/order flows
  // deliberately move stages, overwrite nextStep/amount, and reset closeDate,
  // which would contradict the spec's curated story (emails, notes, amounts).
  for (const deal of spec.deals) {
    const row = dealByRef.get(deal.ref)!;
    await db.deal.update({
      where: { id: row.id },
      data: {
        stage: deal.stage,
        amount: deal.amount,
        probability: deal.probability,
        nextStep: deal.nextStep ?? "",
        closeDate: deal.closeInDays != null ? new Date(now.getTime() + deal.closeInDays * 86400000) : undefined,
      },
    });
  }

  const counts = {
    users: spec.users.length,
    calls: await db.call.count({ where: { orgId: org.id } }),
    grades: await db.grade.count({ where: { orgId: org.id } }),
    deals: spec.deals.length,
    products: spec.products.length,
    quotes: spec.quotes.length,
  };
  console.log(`  ${spec.orgName} ready:`, counts);
  return { orgId: org.id };
}
