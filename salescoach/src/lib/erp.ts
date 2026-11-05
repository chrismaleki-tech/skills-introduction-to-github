import { db } from "./db";
import { fmtMoney, stageMeta } from "./crm";

export const QUOTE_STATUSES = [
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
  { key: "expired", label: "Expired" },
] as const;

export const ORDER_STATUSES = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "fulfilled", label: "Fulfilled" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export const INVOICE_STATUSES = [
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "partial", label: "Partial" },
  { key: "paid", label: "Paid" },
  { key: "void", label: "Void" },
] as const;

export const PO_STATUSES = [
  { key: "draft", label: "Draft" },
  { key: "pending_approval", label: "Pending approval" },
  { key: "approved", label: "Approved" },
  { key: "submitted", label: "Submitted" },
  { key: "partial", label: "Partial" },
  { key: "received", label: "Received" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number]["key"];
export type OrderStatus = (typeof ORDER_STATUSES)[number]["key"];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]["key"];
export type PoStatus = (typeof PO_STATUSES)[number]["key"];

export type LineInput = {
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
};

export function statusLabel(
  statuses: readonly { key: string; label: string }[],
  key: string,
) {
  return statuses.find((s) => s.key === key)?.label ?? key;
}

export function calcTotals(lines: { quantity: number; unitPrice: number }[], taxRate = 0) {
  const subtotal = lines.reduce(
    (sum, l) => sum + Math.max(0, Math.round(l.quantity)) * Math.max(0, Math.round(l.unitPrice)),
    0,
  );
  const rate = Math.min(100, Math.max(0, Math.round(taxRate)));
  const taxAmount = Math.round((subtotal * rate) / 100);
  return { subtotal, taxRate: rate, taxAmount, total: subtotal + taxAmount };
}

export function normalizeLines(lines: LineInput[]): Array<LineInput & { lineTotal: number; sortOrder: number }> {
  return lines
    .map((l, i) => {
      const quantity = Math.max(1, Math.round(Number(l.quantity) || 1));
      const unitPrice = Math.max(0, Math.round(Number(l.unitPrice) || 0));
      return {
        productId: l.productId || null,
        description: l.description.trim() || "Line item",
        quantity,
        unitPrice,
        lineTotal: quantity * unitPrice,
        sortOrder: i,
      };
    })
    .filter((l) => l.description);
}

async function nextNumber(orgId: string, prefix: string, field: "quote" | "order" | "invoice" | "po") {
  const count =
    field === "quote"
      ? await db.quote.count({ where: { orgId } })
      : field === "order"
        ? await db.salesOrder.count({ where: { orgId } })
        : field === "invoice"
          ? await db.invoice.count({ where: { orgId } })
          : await db.purchaseOrder.count({ where: { orgId } });
  return `${prefix}-${String(1001 + count)}`;
}

async function writeErpActivity(input: {
  orgId: string;
  type: string;
  subject: string;
  body: string;
  externalRef: string;
  dealId?: string | null;
  accountId?: string | null;
  contactId?: string | null;
  ownerId?: string | null;
  occurredAt?: Date;
}) {
  return db.activity.upsert({
    where: { orgId_externalRef: { orgId: input.orgId, externalRef: input.externalRef } },
    create: {
      orgId: input.orgId,
      type: input.type,
      subject: input.subject,
      body: input.body,
      externalRef: input.externalRef,
      dealId: input.dealId ?? null,
      accountId: input.accountId ?? null,
      contactId: input.contactId ?? null,
      ownerId: input.ownerId ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    },
    update: {
      subject: input.subject,
      body: input.body,
      dealId: input.dealId ?? null,
      accountId: input.accountId ?? null,
      contactId: input.contactId ?? null,
    },
  });
}

/** Commercial context for grading prompts (open quote / order / AR). */
export function formatErpDealContext(docs: {
  quotes?: { number: string; status: string; total: number }[];
  orders?: { number: string; status: string; total: number }[];
  invoices?: { number: string; status: string; total: number; amountPaid: number }[];
}): string {
  const bits: string[] = [];
  const openQuote = docs.quotes?.find((q) => q.status === "sent" || q.status === "draft");
  if (openQuote) {
    bits.push(
      `Open quote ${openQuote.number} is ${statusLabel(QUOTE_STATUSES, openQuote.status)} at ${fmtMoney(openQuote.total)}.`,
    );
  }
  const openOrder = docs.orders?.find((o) => o.status === "pending" || o.status === "confirmed");
  if (openOrder) {
    bits.push(
      `Sales order ${openOrder.number} is ${statusLabel(ORDER_STATUSES, openOrder.status)} at ${fmtMoney(openOrder.total)}.`,
    );
  }
  const openInv = docs.invoices?.find((i) => i.status === "sent" || i.status === "partial");
  if (openInv) {
    const bal = openInv.total - openInv.amountPaid;
    bits.push(
      `Invoice ${openInv.number} is ${statusLabel(INVOICE_STATUSES, openInv.status)} with ${fmtMoney(bal)} outstanding.`,
    );
  }
  if (bits.length === 0) return "";
  bits.push("Ground commercial coaching in these live ERP documents.");
  return bits.join(" ");
}

export async function createQuote(input: {
  orgId: string;
  ownerId: string;
  dealId?: string | null;
  accountId?: string | null;
  contactId?: string | null;
  title?: string;
  notes?: string;
  taxRate?: number;
  taxCode?: string;
  currency?: string;
  validUntil?: Date | null;
  lines: LineInput[];
}) {
  const { resolveTaxRate, resolveFxRate, getOrgErpDefaults } = await import("./erp-deep");
  let accountId = input.accountId ?? null;
  let contactId = input.contactId ?? null;
  let dealStage: string | null = null;
  if (input.dealId) {
    const deal = await db.deal.findFirst({ where: { id: input.dealId, orgId: input.orgId } });
    if (!deal) throw new Error("Deal not found.");
    accountId = accountId ?? deal.accountId;
    contactId = contactId ?? deal.contactId;
    dealStage = deal.stage;
  }

  const lines = normalizeLines(input.lines);
  if (lines.length === 0) throw new Error("At least one line item is required.");
  const defaults = await getOrgErpDefaults(input.orgId);
  const currency = input.currency || defaults.baseCurrency;
  const tax = await resolveTaxRate(input.orgId, input.taxCode || defaults.defaultTaxCode);
  const taxRate = input.taxRate != null ? input.taxRate : tax.ratePercent;
  const fxRateToBase = await resolveFxRate(input.orgId, currency);
  const totals = calcTotals(lines, taxRate);
  const number = await nextNumber(input.orgId, "Q", "quote");

  const quote = await db.quote.create({
    data: {
      orgId: input.orgId,
      number,
      ownerId: input.ownerId,
      dealId: input.dealId ?? null,
      accountId,
      contactId,
      title: input.title?.trim() || `Quote ${number}`,
      notes: input.notes?.trim() ?? "",
      status: "draft",
      currency,
      fxRateToBase,
      taxCode: tax.code,
      validUntil: input.validUntil ?? null,
      ...totals,
      lines: { create: lines },
    },
    include: { lines: true },
  });

  // Nudge deal toward proposal when a quote is drafted from an earlier stage.
  if (input.dealId && dealStage && ["lead", "qualified", "discovery", "demo"].includes(dealStage)) {
    await db.deal.update({
      where: { id: input.dealId },
      data: {
        stage: "proposal",
        probability: stageMeta("proposal").probability,
        amount: Math.max(totals.total, 0),
        nextStep: `Review quote ${number} with prospect`,
      },
    });
  } else if (input.dealId && totals.total > 0) {
    await db.deal.update({
      where: { id: input.dealId },
      data: { amount: totals.total },
    });
  }

  await writeErpActivity({
    orgId: input.orgId,
    type: "QUOTE",
    subject: `Quote ${number} drafted · ${fmtMoney(totals.total, currency)}`,
    body: `${quote.title} · ${tax.code} @ ${taxRate}%`,
    externalRef: `quote:${quote.id}:draft`,
    dealId: quote.dealId,
    accountId: quote.accountId,
    contactId: quote.contactId,
    ownerId: input.ownerId,
  });

  return quote;
}

export async function sendQuote(quoteId: string, orgId: string, userId: string) {
  const quote = await db.quote.findFirst({ where: { id: quoteId, orgId } });
  if (!quote) throw new Error("Quote not found.");
  if (quote.status === "accepted" || quote.status === "rejected") {
    throw new Error(`Cannot send a ${quote.status} quote.`);
  }

  const updated = await db.quote.update({
    where: { id: quoteId },
    data: { status: "sent", sentAt: new Date() },
    include: { lines: true },
  });

  if (updated.dealId) {
    await db.deal.update({
      where: { id: updated.dealId },
      data: {
        stage: "proposal",
        probability: stageMeta("proposal").probability,
        amount: updated.total,
        nextStep: `Awaiting decision on quote ${updated.number}`,
      },
    });
  }

  await writeErpActivity({
    orgId,
    type: "QUOTE",
    subject: `Quote ${updated.number} sent · ${fmtMoney(updated.total)}`,
    body: updated.title || updated.notes,
    externalRef: `quote:${updated.id}:sent`,
    dealId: updated.dealId,
    accountId: updated.accountId,
    contactId: updated.contactId,
    ownerId: userId,
  });

  return updated;
}

export async function acceptQuote(quoteId: string, orgId: string, userId: string) {
  const quote = await db.quote.findFirst({
    where: { id: quoteId, orgId },
    include: { lines: true },
  });
  if (!quote) throw new Error("Quote not found.");
  if (quote.status === "accepted") {
    const existing = await db.salesOrder.findFirst({ where: { quoteId: quote.id, orgId } });
    if (existing) return { quote, order: existing };
  }
  if (quote.status === "rejected" || quote.status === "expired") {
    throw new Error(`Cannot accept a ${quote.status} quote.`);
  }

  const updated = await db.quote.update({
    where: { id: quoteId },
    data: { status: "accepted", acceptedAt: new Date() },
    include: { lines: true },
  });

  if (updated.dealId) {
    await db.deal.update({
      where: { id: updated.dealId },
      data: {
        stage: "negotiation",
        probability: stageMeta("negotiation").probability,
        amount: updated.total,
        nextStep: `Convert quote ${updated.number} to sales order`,
      },
    });
  }

  await writeErpActivity({
    orgId,
    type: "QUOTE",
    subject: `Quote ${updated.number} accepted · ${fmtMoney(updated.total)}`,
    body: updated.title,
    externalRef: `quote:${updated.id}:accepted`,
    dealId: updated.dealId,
    accountId: updated.accountId,
    contactId: updated.contactId,
    ownerId: userId,
  });

  const order = await createOrderFromQuote(updated.id, orgId, userId);
  return { quote: updated, order };
}

export async function rejectQuote(quoteId: string, orgId: string, userId: string) {
  const quote = await db.quote.findFirst({ where: { id: quoteId, orgId } });
  if (!quote) throw new Error("Quote not found.");
  const updated = await db.quote.update({
    where: { id: quoteId },
    data: { status: "rejected" },
  });
  await writeErpActivity({
    orgId,
    type: "QUOTE",
    subject: `Quote ${updated.number} rejected`,
    body: updated.title,
    externalRef: `quote:${updated.id}:rejected`,
    dealId: updated.dealId,
    accountId: updated.accountId,
    contactId: updated.contactId,
    ownerId: userId,
  });
  return updated;
}

export async function createOrderFromQuote(quoteId: string, orgId: string, userId: string) {
  const quote = await db.quote.findFirst({
    where: { id: quoteId, orgId },
    include: { lines: true },
  });
  if (!quote) throw new Error("Quote not found.");

  const existing = await db.salesOrder.findFirst({ where: { quoteId: quote.id, orgId } });
  if (existing) return existing;

  const number = await nextNumber(orgId, "SO", "order");
  const order = await db.salesOrder.create({
    data: {
      orgId,
      number,
      quoteId: quote.id,
      dealId: quote.dealId,
      accountId: quote.accountId,
      contactId: quote.contactId,
      ownerId: userId,
      status: "pending",
      notes: quote.notes,
      currency: quote.currency,
      fxRateToBase: quote.fxRateToBase,
      taxCode: quote.taxCode,
      subtotal: quote.subtotal,
      taxRate: quote.taxRate,
      taxAmount: quote.taxAmount,
      total: quote.total,
      lines: {
        create: quote.lines.map((l) => ({
          productId: l.productId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          sortOrder: l.sortOrder,
        })),
      },
    },
    include: { lines: true },
  });

  if (order.dealId) {
    await db.deal.update({
      where: { id: order.dealId },
      data: {
        stage: "negotiation",
        probability: stageMeta("negotiation").probability,
        amount: order.total,
        nextStep: `Confirm sales order ${order.number}`,
      },
    });
  }

  await writeErpActivity({
    orgId,
    type: "ORDER",
    subject: `Sales order ${order.number} created · ${fmtMoney(order.total)}`,
    body: `From quote ${quote.number}`,
    externalRef: `order:${order.id}:created`,
    dealId: order.dealId,
    accountId: order.accountId,
    contactId: order.contactId,
    ownerId: userId,
  });

  return order;
}

export async function createOrder(input: {
  orgId: string;
  ownerId: string;
  dealId?: string | null;
  accountId?: string | null;
  contactId?: string | null;
  quoteId?: string | null;
  notes?: string;
  taxRate?: number;
  lines: LineInput[];
}) {
  if (input.quoteId) return createOrderFromQuote(input.quoteId, input.orgId, input.ownerId);

  let accountId = input.accountId ?? null;
  let contactId = input.contactId ?? null;
  if (input.dealId) {
    const deal = await db.deal.findFirst({ where: { id: input.dealId, orgId: input.orgId } });
    if (!deal) throw new Error("Deal not found.");
    accountId = accountId ?? deal.accountId;
    contactId = contactId ?? deal.contactId;
  }

  const lines = normalizeLines(input.lines);
  if (lines.length === 0) throw new Error("At least one line item is required.");
  const totals = calcTotals(lines, input.taxRate ?? 0);
  const number = await nextNumber(input.orgId, "SO", "order");

  const order = await db.salesOrder.create({
    data: {
      orgId: input.orgId,
      number,
      dealId: input.dealId ?? null,
      accountId,
      contactId,
      ownerId: input.ownerId,
      notes: input.notes?.trim() ?? "",
      status: "pending",
      ...totals,
      lines: { create: lines },
    },
    include: { lines: true },
  });

  await writeErpActivity({
    orgId: input.orgId,
    type: "ORDER",
    subject: `Sales order ${order.number} created · ${fmtMoney(order.total)}`,
    body: order.notes || "Manual order",
    externalRef: `order:${order.id}:created`,
    dealId: order.dealId,
    accountId: order.accountId,
    contactId: order.contactId,
    ownerId: input.ownerId,
  });

  return order;
}

export async function confirmOrder(orderId: string, orgId: string, userId: string) {
  const order = await db.salesOrder.findFirst({
    where: { id: orderId, orgId },
    include: { lines: true },
  });
  if (!order) throw new Error("Order not found.");
  if (order.status === "cancelled" || order.status === "fulfilled") {
    throw new Error(`Cannot confirm a ${order.status} order.`);
  }
  if (order.status === "confirmed") return order;

  const { ensureDefaultWarehouse, adjustWarehouseStock } = await import("./erp-deep");
  const warehouse =
    (order.warehouseId
      ? await db.warehouse.findFirst({ where: { id: order.warehouseId } })
      : null) || (await ensureDefaultWarehouse(orgId));

  for (const line of order.lines) {
    if (!line.productId) continue;
    const product = await db.product.findFirst({ where: { id: line.productId, orgId } });
    if (!product?.trackInventory) continue;
    await adjustWarehouseStock({
      orgId,
      productId: line.productId,
      warehouseId: warehouse.id,
      deltaReserved: line.quantity,
    });
  }

  const updated = await db.salesOrder.update({
    where: { id: orderId },
    data: { status: "confirmed", warehouseId: warehouse.id },
  });
  if (updated.dealId) {
    await db.deal.update({
      where: { id: updated.dealId },
      data: {
        stage: "closed_won",
        probability: 100,
        amount: updated.total,
        closeDate: new Date(),
        nextStep: `Invoice sales order ${updated.number}`,
      },
    });
  }
  await writeErpActivity({
    orgId,
    type: "ORDER",
    subject: `Sales order ${updated.number} confirmed · ${fmtMoney(updated.total)}`,
    body: `Deal marked closed won. Stock reserved at ${warehouse.code}.`,
    externalRef: `order:${updated.id}:confirmed`,
    dealId: updated.dealId,
    accountId: updated.accountId,
    contactId: updated.contactId,
    ownerId: userId,
  });
  return updated;
}

export async function fulfillOrder(orderId: string, orgId: string, userId: string) {
  const order = await db.salesOrder.findFirst({
    where: { id: orderId, orgId },
    include: { lines: true },
  });
  if (!order) throw new Error("Order not found.");
  if (order.status === "cancelled") throw new Error("Cannot fulfill a cancelled order.");
  if (order.status === "fulfilled") return order;

  const { ensureDefaultWarehouse, adjustWarehouseStock } = await import("./erp-deep");
  const warehouse =
    (order.warehouseId
      ? await db.warehouse.findFirst({ where: { id: order.warehouseId } })
      : null) || (await ensureDefaultWarehouse(orgId));

  for (const line of order.lines) {
    if (!line.productId) continue;
    const product = await db.product.findFirst({ where: { id: line.productId, orgId } });
    if (!product?.trackInventory) continue;
    await adjustWarehouseStock({
      orgId,
      productId: line.productId,
      warehouseId: warehouse.id,
      deltaOnHand: -line.quantity,
      deltaReserved: -line.quantity,
    });
  }

  const updated = await db.salesOrder.update({
    where: { id: orderId },
    data: { status: "fulfilled", fulfilledAt: new Date(), warehouseId: warehouse.id },
  });

  await writeErpActivity({
    orgId,
    type: "ORDER",
    subject: `Sales order ${updated.number} fulfilled`,
    body: `Inventory decremented from ${warehouse.code}.`,
    externalRef: `order:${updated.id}:fulfilled`,
    dealId: updated.dealId,
    accountId: updated.accountId,
    contactId: updated.contactId,
    ownerId: userId,
  });

  return updated;
}

export async function createInvoiceFromOrder(orderId: string, orgId: string, userId: string) {
  const order = await db.salesOrder.findFirst({
    where: { id: orderId, orgId },
    include: { lines: true },
  });
  if (!order) throw new Error("Order not found.");
  if (order.status === "cancelled") throw new Error("Cannot invoice a cancelled order.");

  const existing = await db.invoice.findFirst({ where: { orderId: order.id, orgId } });
  if (existing) return existing;

  const number = await nextNumber(orgId, "INV", "invoice");
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 30);

  const invoice = await db.invoice.create({
    data: {
      orgId,
      number,
      orderId: order.id,
      dealId: order.dealId,
      accountId: order.accountId,
      contactId: order.contactId,
      ownerId: userId,
      projectId: order.projectId,
      status: "draft",
      notes: order.notes,
      currency: order.currency,
      fxRateToBase: order.fxRateToBase,
      taxCode: order.taxCode,
      subtotal: order.subtotal,
      taxRate: order.taxRate,
      taxAmount: order.taxAmount,
      total: order.total,
      amountPaid: 0,
      dueAt,
      lines: {
        create: order.lines.map((l) => ({
          productId: l.productId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          sortOrder: l.sortOrder,
        })),
      },
    },
    include: { lines: true },
  });

  await writeErpActivity({
    orgId,
    type: "INVOICE",
    subject: `Invoice ${invoice.number} drafted · ${fmtMoney(invoice.total)}`,
    body: `From sales order ${order.number}`,
    externalRef: `invoice:${invoice.id}:draft`,
    dealId: invoice.dealId,
    accountId: invoice.accountId,
    contactId: invoice.contactId,
    ownerId: userId,
  });

  return invoice;
}

export async function sendInvoice(invoiceId: string, orgId: string, userId: string) {
  const invoice = await db.invoice.findFirst({ where: { id: invoiceId, orgId } });
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "void" || invoice.status === "paid") {
    throw new Error(`Cannot send a ${invoice.status} invoice.`);
  }
  const updated = await db.invoice.update({
    where: { id: invoiceId },
    data: { status: invoice.amountPaid > 0 ? "partial" : "sent" },
  });
  const { postInvoiceToGl } = await import("./erp-deep");
  await postInvoiceToGl(updated.id, userId);
  await writeErpActivity({
    orgId,
    type: "INVOICE",
    subject: `Invoice ${updated.number} sent · ${fmtMoney(updated.total, updated.currency)}`,
    body: updated.dueAt ? `Due ${updated.dueAt.toISOString().slice(0, 10)} · GL posted` : "GL posted",
    externalRef: `invoice:${updated.id}:sent`,
    dealId: updated.dealId,
    accountId: updated.accountId,
    contactId: updated.contactId,
    ownerId: userId,
  });
  return updated;
}

export async function recordPayment(input: {
  orgId: string;
  userId: string;
  invoiceId: string;
  amount: number;
  method?: string;
  reference?: string;
  notes?: string;
  receivedAt?: Date;
}) {
  const invoice = await db.invoice.findFirst({ where: { id: input.invoiceId, orgId: input.orgId } });
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "void") throw new Error("Cannot pay a void invoice.");

  const amount = Math.max(1, Math.round(Number(input.amount) || 0));
  const balance = invoice.total - invoice.amountPaid;
  if (amount > balance) throw new Error(`Payment exceeds balance of ${fmtMoney(balance, invoice.currency)}.`);

  const payment = await db.payment.create({
    data: {
      orgId: input.orgId,
      invoiceId: invoice.id,
      recordedById: input.userId,
      amount,
      currency: invoice.currency,
      method: input.method?.trim() || "ach",
      reference: input.reference?.trim() ?? "",
      notes: input.notes?.trim() ?? "",
      receivedAt: input.receivedAt ?? new Date(),
    },
  });

  const amountPaid = invoice.amountPaid + amount;
  const status = amountPaid >= invoice.total ? "paid" : amountPaid > 0 ? "partial" : invoice.status;
  const updated = await db.invoice.update({
    where: { id: invoice.id },
    data: {
      amountPaid,
      status,
      paidAt: status === "paid" ? new Date() : invoice.paidAt,
    },
  });

  const { postPaymentToGl } = await import("./erp-deep");
  await postPaymentToGl(payment.id, input.userId);

  await writeErpActivity({
    orgId: input.orgId,
    type: "PAYMENT",
    subject: `Payment ${fmtMoney(amount, invoice.currency)} on ${updated.number}`,
    body: [
      `Method: ${payment.method}`,
      payment.reference ? `Ref: ${payment.reference}` : null,
      `Balance: ${fmtMoney(updated.total - updated.amountPaid, invoice.currency)}`,
      "GL posted",
    ]
      .filter(Boolean)
      .join(" · "),
    externalRef: `payment:${payment.id}`,
    dealId: updated.dealId,
    accountId: updated.accountId,
    contactId: updated.contactId,
    ownerId: input.userId,
    occurredAt: payment.receivedAt,
  });

  return { payment, invoice: updated };
}

export async function createPurchaseOrder(input: {
  orgId: string;
  ownerId: string;
  vendorId: string;
  notes?: string;
  lines: Array<{ productId?: string | null; description: string; quantity: number; unitCost: number }>;
}) {
  const vendor = await db.vendor.findFirst({ where: { id: input.vendorId, orgId: input.orgId } });
  if (!vendor) throw new Error("Vendor not found.");

  const lines = input.lines
    .map((l, i) => {
      const quantity = Math.max(1, Math.round(Number(l.quantity) || 1));
      const unitCost = Math.max(0, Math.round(Number(l.unitCost) || 0));
      return {
        productId: l.productId || null,
        description: l.description.trim() || "PO line",
        quantity,
        unitCost,
        lineTotal: quantity * unitCost,
        sortOrder: i,
      };
    })
    .filter((l) => l.description);
  if (lines.length === 0) throw new Error("At least one line item is required.");

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const number = await nextNumber(input.orgId, "PO", "po");

  return db.purchaseOrder.create({
    data: {
      orgId: input.orgId,
      number,
      vendorId: vendor.id,
      ownerId: input.ownerId,
      notes: input.notes?.trim() ?? "",
      status: "draft",
      subtotal,
      total: subtotal,
      lines: { create: lines },
    },
    include: { lines: true, vendor: true },
  });
}

export async function submitPurchaseOrder(poId: string, orgId: string, userId: string) {
  const po = await db.purchaseOrder.findFirst({ where: { id: poId, orgId } });
  if (!po) throw new Error("Purchase order not found.");
  const updated = await db.purchaseOrder.update({
    where: { id: poId },
    data: { status: "pending_approval" },
  });
  await writeErpActivity({
    orgId,
    type: "PO",
    subject: `PO ${updated.number} submitted for approval · ${fmtMoney(updated.total)}`,
    body: updated.notes,
    externalRef: `po:${updated.id}:pending_approval`,
    ownerId: userId,
  });
  return updated;
}

export async function approvePurchaseOrder(poId: string, orgId: string, userId: string) {
  const { approvePurchaseOrder: approve } = await import("./erp-deep");
  const updated = await approve(poId, orgId, userId);
  await writeErpActivity({
    orgId,
    type: "PO",
    subject: `PO ${updated.number} approved`,
    body: updated.notes,
    externalRef: `po:${updated.id}:approved`,
    ownerId: userId,
  });
  return updated;
}

export async function receivePurchaseOrder(poId: string, orgId: string, userId: string) {
  const { receivePurchaseOrderDeep } = await import("./erp-deep");
  const result = await receivePurchaseOrderDeep({
    orgId,
    userId,
    poId,
    createVendorBill: true,
  });
  return db.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
}

export async function financeSnapshot(orgId: string) {
  const [products, quotes, orders, invoices, payments, lowStock] = await Promise.all([
    db.product.count({ where: { orgId, active: true } }),
    db.quote.findMany({ where: { orgId } }),
    db.salesOrder.findMany({ where: { orgId } }),
    db.invoice.findMany({ where: { orgId } }),
    db.payment.findMany({ where: { orgId } }),
    db.product.findMany({
      where: { orgId, trackInventory: true, active: true },
    }),
  ]);

  const openQuotes = quotes.filter((q) => q.status === "draft" || q.status === "sent");
  const openOrders = orders.filter((o) => o.status === "pending" || o.status === "confirmed");
  const arInvoices = invoices.filter((i) => i.status === "sent" || i.status === "partial");
  const revenue = payments.reduce((s, p) => s + p.amount, 0);
  const arBalance = arInvoices.reduce((s, i) => s + (i.total - i.amountPaid), 0);
  const pipelineBooked = openOrders.reduce((s, o) => s + o.total, 0);
  const low = lowStock.filter((p) => p.qtyOnHand - p.qtyReserved <= p.reorderPoint);

  return {
    products,
    openQuoteCount: openQuotes.length,
    openQuoteValue: openQuotes.reduce((s, q) => s + q.total, 0),
    openOrderCount: openOrders.length,
    openOrderValue: pipelineBooked,
    arBalance,
    arCount: arInvoices.length,
    revenue,
    lowStockCount: low.length,
    lowStock: low,
  };
}
