import OpenAI from "openai";
import { db } from "./db";
import { aiAvailable, AI_MODEL } from "./ai";
import { DEAL_STAGES, fmtMoney, OPEN_STAGES, stageLabel } from "./crm";
import {
  acceptQuote,
  confirmOrder,
  createInvoiceFromOrder,
  createQuote,
  financeSnapshot,
  fulfillOrder,
  recordPayment,
  sendInvoice,
  sendQuote,
} from "./erp";
import { BAND_LABELS } from "./scoring";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AssistantLink = { href: string; label: string };

export type AssistantSource = "crm" | "erp" | "trainer";

export type AssistantResult = {
  reply: string;
  links?: AssistantLink[];
  data?: unknown;
  sources?: AssistantSource[];
  followUps?: string[];
  mode: "demo" | "llm";
};

const TOOL_SOURCES: Record<string, AssistantSource[]> = {
  pipeline_summary: ["crm"],
  search_deals: ["crm"],
  get_deal: ["crm", "erp", "trainer"],
  search_accounts_contacts: ["crm"],
  finance_snapshot: ["erp"],
  list_quotes: ["erp"],
  quote_action: ["erp"],
  create_quote_for_deal: ["crm", "erp"],
  list_orders: ["erp"],
  order_action: ["erp"],
  invoice_action: ["erp"],
  list_invoices: ["erp"],
  list_products: ["erp"],
  list_purchase_orders: ["erp"],
  warehouse_stock: ["erp"],
  gl_trial_balance: ["erp"],
  projects_summary: ["erp"],
  hr_payroll_snapshot: ["erp"],
  coaching_summary: ["trainer"],
  list_assignments: ["trainer"],
  list_calls: ["trainer", "crm"],
  get_call_grade: ["trainer", "crm"],
  list_roleplays: ["trainer"],
  update_deal_stage: ["crm"],
  get_document: ["erp"],
  list_activities: ["crm", "erp", "trainer"],
  list_conversations: ["crm"],
  list_scenarios: ["trainer"],
  my_performance: ["trainer"],
  help: ["crm", "erp", "trainer"],
};

// Fallback vocabulary (matches the Meridian seed) used when no tenant vocab
// is supplied — e.g. in unit tests that call routeDemoIntent directly.
const ACCOUNT_TOKENS = "Cascade|BlueRidge|Blue Ridge|Summit|Harbor|Northwind|Harbor Parts";
const REP_TOKENS = "Alex|Casey|Jordan|Morgan|Riley|Sarah";
const CONTACT_TOKENS = "Dana|Marta|Priya|Tom|Ellis";

/** Per-tenant name vocabulary so the demo intent router works in every workspace. */
export type DemoVocab = { accounts: string[]; reps: string[]; contacts: string[] };

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip a leading article and return a short display/match token for a name. */
export function shortNameToken(name: string | null | undefined): string | null {
  const cleaned = (name ?? "").trim().replace(/^the\s+/i, "");
  const first = cleaned.split(/\s+/)[0] ?? "";
  return first.length > 1 ? first : cleaned || null;
}

function vocabTokens(names: string[], fallback: string): string {
  const tokens = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    tokens.add(escapeRe(trimmed));
    const short = shortNameToken(trimmed);
    if (short && short.length > 2) tokens.add(escapeRe(short));
  }
  return tokens.size ? [...tokens].join("|") : fallback;
}

/** Build the tenant vocabulary for the demo router from live CRM data. */
export async function demoVocabForOrg(orgId: string): Promise<DemoVocab> {
  const [accounts, users, contacts] = await Promise.all([
    db.account.findMany({ where: { orgId }, select: { name: true }, take: 40 }),
    db.user.findMany({ where: { orgId }, select: { name: true }, take: 40 }),
    db.contact.findMany({ where: { orgId }, select: { name: true }, take: 40 }),
  ]);
  return {
    accounts: accounts.map((a) => a.name),
    reps: users.map((u) => u.name),
    contacts: contacts.map((c) => c.name),
  };
}

function sourcesForTools(names: string[]): AssistantSource[] {
  const set = new Set<AssistantSource>();
  for (const name of names) {
    for (const s of TOOL_SOURCES[name] ?? []) set.add(s);
  }
  return (["crm", "erp", "trainer"] as const).filter((s) => set.has(s));
}

type ToolCtx = {
  orgId: string;
  userId: string;
  role: string;
  isManager: boolean;
};

type ToolResult = {
  text: string;
  links?: AssistantLink[];
  data?: unknown;
  followUps?: string[];
};

type ToolDef = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>, ctx: ToolCtx) => Promise<ToolResult>;
};

function dealOwnerFilter(ctx: ToolCtx) {
  return ctx.isManager ? {} : { ownerId: ctx.userId };
}

function repFilter(ctx: ToolCtx) {
  return ctx.isManager ? {} : { repId: ctx.userId };
}

function q(s: unknown) {
  return String(s ?? "").trim();
}

function contains(hay: string, needle: string) {
  return hay.toLowerCase().includes(needle.toLowerCase());
}

async function resolveDeal(orgId: string, query?: string) {
  if (!query) return null;
  const cleaned = query.replace(/\b(deal|the|a|an|show|me|about|status|of)\b/gi, " ").replace(/\s+/g, " ").trim();
  const deals = await db.deal.findMany({
    where: { orgId },
    include: { account: true, contact: true },
    orderBy: { updatedAt: "desc" },
  });
  const needle = cleaned || query;
  const exact = deals.find((d) => d.name.toLowerCase() === needle.toLowerCase());
  if (exact) return exact;
  const soft = deals.find(
    (d) =>
      contains(d.name, needle) ||
      contains(d.account?.name ?? "", needle) ||
      contains(d.product, needle),
  );
  return soft ?? null;
}

async function resolveQuote(orgId: string, query?: string) {
  if (!query) return null;
  const byNumber = await db.quote.findFirst({
    where: { orgId, number: { equals: query.toUpperCase() } },
    include: { deal: true, account: true, lines: true },
  });
  if (byNumber) return byNumber;
  return db.quote.findFirst({
    where: {
      orgId,
      OR: [
        { number: { contains: query } },
        { title: { contains: query } },
        { deal: { name: { contains: query } } },
        { account: { name: { contains: query } } },
      ],
    },
    include: { deal: true, account: true, lines: true },
    orderBy: { updatedAt: "desc" },
  });
}

async function resolveOrder(orgId: string, query?: string) {
  if (!query) return null;
  const byNumber = await db.salesOrder.findFirst({
    where: { orgId, number: { equals: query.toUpperCase() } },
    include: { deal: true, account: true, invoices: true },
  });
  if (byNumber) return byNumber;
  return db.salesOrder.findFirst({
    where: {
      orgId,
      OR: [
        { number: { contains: query } },
        { deal: { name: { contains: query } } },
        { account: { name: { contains: query } } },
      ],
    },
    include: { deal: true, account: true, invoices: true },
    orderBy: { updatedAt: "desc" },
  });
}

async function resolveInvoice(orgId: string, query?: string) {
  if (!query) return null;
  const byNumber = await db.invoice.findFirst({
    where: { orgId, number: { equals: query.toUpperCase() } },
    include: { deal: true, account: true, payments: true, order: true },
  });
  if (byNumber) return byNumber;
  return db.invoice.findFirst({
    where: {
      orgId,
      OR: [
        { number: { contains: query } },
        { deal: { name: { contains: query } } },
        { account: { name: { contains: query } } },
      ],
    },
    include: { deal: true, account: true, payments: true, order: true },
    orderBy: { updatedAt: "desc" },
  });
}

async function resolveRep(orgId: string, query?: string) {
  if (!query) return null;
  return db.user.findFirst({
    where: {
      orgId,
      OR: [{ name: { contains: query } }, { email: { contains: query } }],
    },
  });
}

async function resolveProduct(orgId: string, query?: string) {
  if (!query) return null;
  return db.product.findFirst({
    where: {
      orgId,
      OR: [{ name: { contains: query } }, { sku: { contains: query } }],
    },
  });
}

export const ASSISTANT_TOOLS: ToolDef[] = [
  {
    name: "pipeline_summary",
    description: "Summarize open CRM pipeline value, deal counts by stage, and deals with coaching.",
    parameters: { type: "object", properties: {} },
    async run(_args, ctx) {
      const deals = await db.deal.findMany({
        where: { orgId: ctx.orgId, stage: { in: [...OPEN_STAGES] }, ...dealOwnerFilter(ctx) },
        include: {
          account: { select: { name: true } },
          owner: { select: { name: true } },
        },
      });
      const withGrades = await db.call.findMany({
        where: {
          orgId: ctx.orgId,
          dealId: { not: null },
          status: "GRADED",
          ...(ctx.isManager ? {} : { repId: ctx.userId }),
        },
        select: { dealId: true },
        distinct: ["dealId"],
      });
      const coached = new Set(withGrades.map((c) => c.dealId));
      const total = deals.reduce((s, d) => s + d.amount, 0);
      const weighted = deals.reduce((s, d) => s + (d.amount * d.probability) / 100, 0);
      const stageRows = DEAL_STAGES.filter((s) => OPEN_STAGES.includes(s.key)).map((s) => {
        const list = deals.filter((d) => d.stage === s.key);
        return {
          label: s.label,
          count: list.length,
          value: list.reduce((a, d) => a + d.amount, 0),
        };
      });
      const byStage = stageRows.map((s) => `${s.label}: ${s.count} (${fmtMoney(s.value)})`);
      const top = [...deals]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
        .map(
          (d) =>
            `• ${d.name} — ${stageLabel(d.stage)} · ${fmtMoney(d.amount)} · ${d.owner?.name ?? "unassigned"}${coached.has(d.id) ? " · coached" : ""}`,
        );
      const scope = ctx.isManager ? "Open pipeline" : "Your open pipeline";
      return {
        text: [
          `${scope}: ${deals.length} deals · ${fmtMoney(total)} · weighted ${fmtMoney(Math.round(weighted))}.`,
          `${coached.size} deals have graded coaching.`,
          byStage.join(" · "),
          top.length ? `Largest deals:\n${top.join("\n")}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        links: [{ href: "/crm", label: "Open pipeline" }],
        data: {
          kind: "pipeline",
          count: deals.length,
          total,
          weighted: Math.round(weighted),
          stages: stageRows,
        },
        followUps: [
          "Show me the Cascade deal",
          "Who needs coaching?",
          "List open quotes",
        ],
      };
    },
  },
  {
    name: "list_invoices",
    description: "List invoices with optional search text.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
    },
    async run(args, ctx) {
      return listInvoicesTool(ctx, q(args.query));
    },
  },
  {
    name: "search_deals",
    description: "Find CRM deals by name, account, product, or stage.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        stage: { type: "string" },
      },
    },
    async run(args, ctx) {
      const query = q(args.query);
      const stage = q(args.stage).toLowerCase().replace(/\s+/g, "_");
      const deals = await db.deal.findMany({
        where: {
          orgId: ctx.orgId,
          ...dealOwnerFilter(ctx),
          ...(stage ? { stage } : {}),
          ...(query
            ? {
                OR: [
                  { name: { contains: query } },
                  { product: { contains: query } },
                  { account: { name: { contains: query } } },
                  { contact: { name: { contains: query } } },
                ],
              }
            : {}),
        },
        include: { account: true, contact: true, owner: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 8,
      });
      if (deals.length === 0) return { text: "No matching deals found." };
      return {
        text: deals
          .map(
            (d) =>
              `• ${d.name} — ${stageLabel(d.stage)} · ${fmtMoney(d.amount)} · ${d.account?.name ?? "no account"} · next: ${d.nextStep || "—"}`,
          )
          .join("\n"),
        links: deals.slice(0, 3).map((d) => ({ href: `/crm/deals/${d.id}`, label: d.name })),
      };
    },
  },
  {
    name: "get_deal",
    description: "Get a single deal with linked quotes, orders, invoices, and recent coaching.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Deal name or account" } },
      required: ["query"],
    },
    async run(args, ctx) {
      const deal = await resolveDeal(ctx.orgId, q(args.query));
      if (!deal) return { text: `I couldn't find a deal matching "${q(args.query)}".` };
      const [quotes, orders, invoices, calls] = await Promise.all([
        db.quote.findMany({ where: { dealId: deal.id }, orderBy: { updatedAt: "desc" }, take: 5 }),
        db.salesOrder.findMany({ where: { dealId: deal.id }, orderBy: { updatedAt: "desc" }, take: 5 }),
        db.invoice.findMany({ where: { dealId: deal.id }, orderBy: { updatedAt: "desc" }, take: 5 }),
        db.call.findMany({
          where: { dealId: deal.id },
          include: { grade: true },
          orderBy: { callDate: "desc" },
          take: 5,
        }),
      ]);
      const lines = [
        `**${deal.name}** — ${stageLabel(deal.stage)} · ${fmtMoney(deal.amount)} (${deal.probability}%)`,
        `Account: ${deal.account?.name ?? "—"} · Contact: ${deal.contact?.name ?? "—"}`,
        `Next step: ${deal.nextStep || "—"}`,
        quotes.length
          ? `Quotes: ${quotes.map((x) => `${x.number} ${x.status} ${fmtMoney(x.total)}`).join("; ")}`
          : "Quotes: none",
        orders.length
          ? `Orders: ${orders.map((x) => `${x.number} ${x.status} ${fmtMoney(x.total)}`).join("; ")}`
          : "Orders: none",
        invoices.length
          ? `Invoices: ${invoices.map((x) => `${x.number} ${x.status} bal ${fmtMoney(x.total - x.amountPaid)}`).join("; ")}`
          : "Invoices: none",
        calls.length
          ? `Recent calls: ${calls
              .map((c) => `${c.callType} ${c.grade ? `${c.grade.overallScore}/100` : c.status}`)
              .join("; ")}`
          : "Recent calls: none",
      ];
      const links: AssistantLink[] = [{ href: `/crm/deals/${deal.id}`, label: "Open deal" }];
      if (quotes[0]) links.push({ href: `/erp/quotes/${quotes[0].id}`, label: quotes[0].number });
      return { text: lines.join("\n"), links };
    },
  },
  {
    name: "finance_snapshot",
    description: "ERP finance snapshot: open quotes/orders, AR, cash collected, low stock.",
    parameters: { type: "object", properties: {} },
    async run(_args, ctx) {
      const snap = await financeSnapshot(ctx.orgId);
      return {
        text: [
          `Open quotes: ${snap.openQuoteCount} · ${fmtMoney(snap.openQuoteValue)}`,
          `Open orders: ${snap.openOrderCount} · ${fmtMoney(snap.openOrderValue)}`,
          `AR outstanding: ${fmtMoney(snap.arBalance)} (${snap.arCount} invoices)`,
          `Cash collected: ${fmtMoney(snap.revenue)}`,
          `Active products: ${snap.products} · low-stock SKUs: ${snap.lowStockCount}`,
          snap.lowStock.length
            ? `Low stock: ${snap.lowStock.map((p) => `${p.sku} avail ${p.qtyOnHand - p.qtyReserved}`).join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        links: [
          { href: "/erp", label: "ERP hub" },
          { href: "/erp/finance", label: "Finance" },
        ],
        data: {
          kind: "finance",
          openQuoteCount: snap.openQuoteCount,
          openQuoteValue: snap.openQuoteValue,
          openOrderCount: snap.openOrderCount,
          openOrderValue: snap.openOrderValue,
          arBalance: snap.arBalance,
          arCount: snap.arCount,
          revenue: snap.revenue,
          products: snap.products,
          lowStockCount: snap.lowStockCount,
        },
        followUps: ["List open quotes", "Show sales orders", "What's low in inventory?"],
      };
    },
  },
  {
    name: "list_quotes",
    description: "List quotes, optionally filtered by status or search text.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string" },
        query: { type: "string" },
      },
    },
    async run(args, ctx) {
      const status = q(args.status).toLowerCase();
      const query = q(args.query);
      const openStatuses = ["draft", "sent"];
      const quotes = await db.quote.findMany({
        where: {
          orgId: ctx.orgId,
          ...(status === "open"
            ? { status: { in: openStatuses } }
            : status
              ? { status }
              : {}),
          ...(query
            ? {
                OR: [
                  { number: { contains: query } },
                  { title: { contains: query } },
                  { deal: { name: { contains: query } } },
                  { account: { name: { contains: query } } },
                ],
              }
            : {}),
        },
        include: { deal: true, account: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });
      if (!quotes.length) return { text: "No quotes found." };
      return {
        text: quotes
          .map(
            (x) =>
              `• ${x.number} · ${x.status} · ${fmtMoney(x.total)} · ${x.title || x.deal?.name || "Untitled"} (${x.account?.name ?? "—"})`,
          )
          .join("\n"),
        links: [
          { href: "/erp/quotes", label: "All quotes" },
          ...quotes.slice(0, 2).map((x) => ({ href: `/erp/quotes/${x.id}`, label: x.number })),
        ],
      };
    },
  },
  {
    name: "quote_action",
    description: "Send, accept (creates order), or reject a quote by number or deal name.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        action: { type: "string", enum: ["send", "accept", "reject"] },
      },
      required: ["query", "action"],
    },
    async run(args, ctx) {
      const action = q(args.action).toLowerCase();
      let quote = await resolveQuote(ctx.orgId, q(args.query));
      if (!quote) {
        const deal = await resolveDeal(ctx.orgId, q(args.query));
        if (deal) {
          quote = await db.quote.findFirst({
            where: { orgId: ctx.orgId, dealId: deal.id },
            include: { deal: true, account: true, lines: true },
            orderBy: { updatedAt: "desc" },
          });
        }
      }
      if (!quote) return { text: `No quote matched "${q(args.query)}".` };
      if (action === "send") {
        const updated = await sendQuote(quote.id, ctx.orgId, ctx.userId);
        return {
          text: `Sent ${updated.number} (${fmtMoney(updated.total)}). Deal nudged to proposal.`,
          links: [{ href: `/erp/quotes/${updated.id}`, label: updated.number }],
        };
      }
      if (action === "accept") {
        const { quote: updated, order } = await acceptQuote(quote.id, ctx.orgId, ctx.userId);
        return {
          text: `Accepted ${updated.number}. Created sales order ${order.number} for ${fmtMoney(order.total)}.`,
          links: [
            { href: `/erp/quotes/${updated.id}`, label: updated.number },
            { href: `/erp/orders/${order.id}`, label: order.number },
          ],
        };
      }
      if (action === "reject") {
        const { rejectQuote } = await import("./erp");
        const updated = await rejectQuote(quote.id, ctx.orgId, ctx.userId);
        return {
          text: `Rejected ${updated.number}.`,
          links: [{ href: `/erp/quotes/${updated.id}`, label: updated.number }],
        };
      }
      return { text: `Unknown quote action "${action}". Use send, accept, or reject.` };
    },
  },
  {
    name: "create_quote_for_deal",
    description: "Create a draft quote for a deal from catalog products. Uses deal product line when possible.",
    parameters: {
      type: "object",
      properties: {
        deal: { type: "string" },
        product: { type: "string" },
        quantity: { type: "number" },
        title: { type: "string" },
      },
      required: ["deal"],
    },
    async run(args, ctx) {
      const deal = await resolveDeal(ctx.orgId, q(args.deal));
      if (!deal) return { text: `Deal not found: "${q(args.deal)}".` };
      const productQuery = q(args.product) || deal.product || "Meridian Core";
      const product = await resolveProduct(ctx.orgId, productQuery);
      if (!product) return { text: `No catalog product matched "${productQuery}".` };
      const quantity = Math.max(1, Math.round(Number(args.quantity) || 1));
      const quote = await createQuote({
        orgId: ctx.orgId,
        ownerId: ctx.userId,
        dealId: deal.id,
        accountId: deal.accountId,
        contactId: deal.contactId,
        title: q(args.title) || `${deal.name} · ${product.name}`,
        lines: [
          {
            productId: product.id,
            description: product.name,
            quantity,
            unitPrice: product.listPrice,
          },
        ],
      });
      return {
        text: `Drafted ${quote.number} for ${deal.name}: ${quantity}× ${product.name} = ${fmtMoney(quote.total)}.`,
        links: [
          { href: `/erp/quotes/${quote.id}`, label: quote.number },
          { href: `/crm/deals/${deal.id}`, label: "Deal" },
        ],
      };
    },
  },
  {
    name: "list_orders",
    description: "List sales orders with optional status/query filter.",
    parameters: {
      type: "object",
      properties: { status: { type: "string" }, query: { type: "string" } },
    },
    async run(args, ctx) {
      const status = q(args.status).toLowerCase();
      const query = q(args.query);
      const orders = await db.salesOrder.findMany({
        where: {
          orgId: ctx.orgId,
          ...(status ? { status } : {}),
          ...(query
            ? {
                OR: [
                  { number: { contains: query } },
                  { deal: { name: { contains: query } } },
                  { account: { name: { contains: query } } },
                ],
              }
            : {}),
        },
        include: { deal: true, account: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });
      if (!orders.length) return { text: "No orders found." };
      return {
        text: orders
          .map(
            (o) =>
              `• ${o.number} · ${o.status} · ${fmtMoney(o.total)} · ${o.deal?.name ?? o.account?.name ?? "—"}`,
          )
          .join("\n"),
        links: [
          { href: "/erp/orders", label: "All orders" },
          ...orders.slice(0, 2).map((o) => ({ href: `/erp/orders/${o.id}`, label: o.number })),
        ],
      };
    },
  },
  {
    name: "order_action",
    description: "Confirm (close-won), fulfill, or invoice a sales order.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        action: { type: "string", enum: ["confirm", "fulfill", "invoice"] },
      },
      required: ["query", "action"],
    },
    async run(args, ctx) {
      const action = q(args.action).toLowerCase();
      const order = await resolveOrder(ctx.orgId, q(args.query));
      if (!order) return { text: `No order matched "${q(args.query)}".` };
      if (action === "confirm") {
        const updated = await confirmOrder(order.id, ctx.orgId, ctx.userId);
        return {
          text: `Confirmed ${updated.number}. Linked deal marked closed-won.`,
          links: [{ href: `/erp/orders/${updated.id}`, label: updated.number }],
        };
      }
      if (action === "fulfill") {
        const updated = await fulfillOrder(order.id, ctx.orgId, ctx.userId);
        return {
          text: `Fulfilled ${updated.number}. Tracked inventory decremented.`,
          links: [{ href: `/erp/orders/${updated.id}`, label: updated.number }],
        };
      }
      if (action === "invoice") {
        const invoice = await createInvoiceFromOrder(order.id, ctx.orgId, ctx.userId);
        return {
          text: `Created ${invoice.number} for ${fmtMoney(invoice.total)} from ${order.number}.`,
          links: [
            { href: `/erp/invoices/${invoice.id}`, label: invoice.number },
            { href: `/erp/orders/${order.id}`, label: order.number },
          ],
        };
      }
      return { text: `Unknown order action "${action}".` };
    },
  },
  {
    name: "invoice_action",
    description: "Send an invoice or record a payment.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        action: { type: "string", enum: ["send", "pay"] },
        amount: { type: "number" },
      },
      required: ["query", "action"],
    },
    async run(args, ctx) {
      const action = q(args.action).toLowerCase();
      const invoice = await resolveInvoice(ctx.orgId, q(args.query));
      if (!invoice) return { text: `No invoice matched "${q(args.query)}".` };
      if (action === "send") {
        const updated = await sendInvoice(invoice.id, ctx.orgId, ctx.userId);
        return {
          text: `Sent ${updated.number} (${fmtMoney(updated.total)}).`,
          links: [{ href: `/erp/invoices/${updated.id}`, label: updated.number }],
        };
      }
      if (action === "pay") {
        const balance = invoice.total - invoice.amountPaid;
        const amount = Math.round(Number(args.amount) || balance);
        const result = await recordPayment({
          orgId: ctx.orgId,
          userId: ctx.userId,
          invoiceId: invoice.id,
          amount,
          method: "ach",
        });
        return {
          text: `Recorded ${fmtMoney(amount)} on ${result.invoice.number}. Status: ${result.invoice.status}. Balance ${fmtMoney(result.invoice.total - result.invoice.amountPaid)}.`,
          links: [{ href: `/erp/invoices/${result.invoice.id}`, label: result.invoice.number }],
        };
      }
      return { text: `Unknown invoice action "${action}".` };
    },
  },
  {
    name: "list_products",
    description: "List catalog products and optional inventory levels.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" }, inventory_only: { type: "boolean" } },
    },
    async run(args, ctx) {
      const query = q(args.query);
      const products = await db.product.findMany({
        where: {
          orgId: ctx.orgId,
          active: true,
          ...(args.inventory_only ? { trackInventory: true } : {}),
          ...(query
            ? { OR: [{ name: { contains: query } }, { sku: { contains: query } }] }
            : {}),
        },
        orderBy: { name: "asc" },
      });
      if (!products.length) return { text: "No products found." };
      return {
        text: products
          .map((p) => {
            const stock = p.trackInventory
              ? ` · on hand ${p.qtyOnHand} (reserved ${p.qtyReserved})`
              : "";
            return `• ${p.sku} ${p.name} — ${fmtMoney(p.listPrice)}/${p.unit}${stock}`;
          })
          .join("\n"),
        links: [
          { href: "/erp/catalog", label: "Catalog" },
          { href: "/erp/inventory", label: "Inventory" },
          { href: "/erp/warehouses", label: "Warehouses" },
        ],
      };
    },
  },
  {
    name: "warehouse_stock",
    description: "Multi-warehouse inventory balances and recent transfers.",
    parameters: { type: "object", properties: { query: { type: "string" } } },
    async run(args, ctx) {
      const { ensureDefaultWarehouse } = await import("./erp-deep");
      await ensureDefaultWarehouse(ctx.orgId);
      const query = q(args.query);
      const warehouses = await db.warehouse.findMany({
        where: { orgId: ctx.orgId },
        include: {
          balances: {
            include: { product: { select: { sku: true, name: true } } },
            ...(query
              ? { where: { OR: [{ product: { sku: { contains: query } } }, { product: { name: { contains: query } } }] } }
              : {}),
          },
        },
        orderBy: [{ isDefault: "desc" }, { code: "asc" }],
      });
      const lines = warehouses.map((w) => {
        const stock =
          w.balances.length === 0
            ? "empty"
            : w.balances.map((b) => `${b.product.sku} ${b.qtyOnHand}`).join(", ");
        return `• ${w.code} ${w.name}${w.isDefault ? " (default)" : ""}: ${stock}`;
      });
      return {
        text: lines.join("\n") || "No warehouses.",
        links: [
          { href: "/erp/warehouses", label: "Warehouses" },
          { href: "/erp/inventory", label: "Inventory" },
        ],
      };
    },
  },
  {
    name: "gl_trial_balance",
    description: "General ledger trial balance and recent journal count.",
    parameters: { type: "object", properties: {} },
    async run(_args, ctx) {
      const { glTrialBalance } = await import("./erp-deep");
      const tb = await glTrialBalance(ctx.orgId);
      const jeCount = await db.journalEntry.count({ where: { orgId: ctx.orgId } });
      return {
        text: [
          `Journal entries: ${jeCount}`,
          ...tb
            .filter((a) => a.debit > 0 || a.credit > 0)
            .map((a) => `• ${a.code} ${a.name}: Dr ${fmtMoney(a.debit)} / Cr ${fmtMoney(a.credit)}`),
        ].join("\n"),
        links: [
          { href: "/erp/ledger", label: "General ledger" },
          { href: "/api/erp/gl?format=csv", label: "Export CSV" },
        ],
      };
    },
  },
  {
    name: "projects_summary",
    description: "Implementation projects and hours logged.",
    parameters: { type: "object", properties: { query: { type: "string" } } },
    async run(args, ctx) {
      const query = q(args.query);
      const projects = await db.project.findMany({
        where: {
          orgId: ctx.orgId,
          ...(query
            ? { OR: [{ name: { contains: query } }, { code: { contains: query } }] }
            : {}),
        },
        include: { _count: { select: { timeEntries: true } } },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });
      const hours = await db.timeEntry.groupBy({
        by: ["projectId"],
        where: { orgId: ctx.orgId },
        _sum: { hours: true },
      });
      const byId = Object.fromEntries(hours.map((h) => [h.projectId, h._sum.hours ?? 0]));
      if (!projects.length) return { text: "No projects.", links: [{ href: "/erp/projects", label: "Projects" }] };
      return {
        text: projects
          .map((p) => `• ${p.code} ${p.name} (${p.status}) — ${byId[p.id] ?? 0}h / ${p.budgetHours || "—"}h budget`)
          .join("\n"),
        links: [{ href: "/erp/projects", label: "Projects" }],
      };
    },
  },
  {
    name: "hr_payroll_snapshot",
    description: "HR headcount and monthly payroll accrual snapshot.",
    parameters: { type: "object", properties: {} },
    async run(_args, ctx) {
      const { payrollAccrualSnapshot } = await import("./erp-deep");
      const snap = await payrollAccrualSnapshot(ctx.orgId);
      return {
        text: [
          `Headcount: ${snap.headcount}`,
          `Annual payroll: ${fmtMoney(snap.annualPayroll)}`,
          `Monthly accrual: ${fmtMoney(snap.monthlyAccrual)}`,
          ...snap.byDepartment.map((d) => `• ${d.department}: ${d.count} · ${fmtMoney(d.annual)}/yr`),
        ].join("\n"),
        links: [
          { href: "/erp/hr", label: "HR & payroll" },
          { href: "/erp/ledger", label: "Ledger" },
        ],
      };
    },
  },
  {
    name: "coaching_summary",
    description: "Team or rep coaching summary: average scores, needs coaching, recent grades.",
    parameters: {
      type: "object",
      properties: {
        rep: { type: "string" },
        needs_coaching_only: { type: "boolean" },
      },
    },
    async run(args, ctx) {
      const rep = (await resolveRep(ctx.orgId, q(args.rep))) || (!ctx.isManager ? { id: ctx.userId, name: "you" } : null);
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const grades = await db.grade.findMany({
        where: {
          orgId: ctx.orgId,
          createdAt: { gte: since },
          ...(rep
            ? {
                OR: [{ call: { repId: rep.id } }, { roleplay: { repId: rep.id } }],
              }
            : {}),
        },
        include: {
          call: { include: { rep: { select: { name: true } }, deal: { select: { name: true } } } },
          roleplay: { include: { rep: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      });
      const filtered = args.needs_coaching_only
        ? grades.filter((g) => g.overallScore < 60)
        : grades;
      if (!filtered.length) {
        return { text: rep ? `No recent grades for ${"name" in rep ? rep.name : "rep"}.` : "No recent grades." };
      }
      const avg = Math.round(filtered.reduce((s, g) => s + g.overallScore, 0) / filtered.length);
      const lines = filtered.slice(0, 8).map((g) => {
        const who = g.call?.rep?.name ?? g.roleplay?.rep?.name ?? "rep";
        const subject = g.subjectType === "CALL" ? g.call?.deal?.name || "call" : "role-play";
        return `• ${who} · ${g.overallScore}/100 (${BAND_LABELS[g.band as keyof typeof BAND_LABELS] ?? g.band}) · ${subject}`;
      });
      const label = rep && "name" in rep ? (rep.name === "you" ? "You" : rep.name) : "Team";
      return {
        text: [
          `${label} · last 30 days: ${filtered.length} grades · avg ${avg}/100`,
          lines.join("\n"),
        ].join("\n"),
        links: [
          { href: ctx.isManager ? "/dashboard" : "/me", label: ctx.isManager ? "Team dashboard" : "My performance" },
          ...(rep && "id" in rep && rep.name !== "you" ? [{ href: `/team/${rep.id}`, label: `${rep.name}'s drill-down` }] : []),
          { href: "/calls", label: "Calls" },
        ],
        followUps: [
          "What was Alex's last Cascade call score?",
          "Show recent role-plays",
          "Show assignments",
        ],
      };
    },
  },
  {
    name: "list_assignments",
    description: "List coaching assignments and their progress.",
    parameters: {
      type: "object",
      properties: { rep: { type: "string" }, status: { type: "string" } },
    },
    async run(args, ctx) {
      const rep = await resolveRep(ctx.orgId, q(args.rep));
      const status = q(args.status).toUpperCase();
      const assignments = await db.assignment.findMany({
        where: {
          orgId: ctx.orgId,
          ...(rep ? { assignedToId: rep.id } : ctx.isManager ? {} : { assignedToId: ctx.userId }),
          ...(status ? { status } : {}),
        },
        include: {
          assignedTo: { select: { name: true } },
          scenario: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      });
      if (!assignments.length) return { text: "No assignments found." };
      return {
        text: assignments
          .map(
            (a) =>
              `• ${a.assignedTo.name} · ${a.type} · ${a.status} · ${a.doneCount}/${a.targetCount}${a.scenario ? ` · ${a.scenario.title}` : ""}${a.note ? ` — ${a.note}` : ""}`,
          )
          .join("\n"),
        links: [{ href: "/assignments", label: "Assignments" }],
      };
    },
  },
  {
    name: "list_calls",
    description: "List recent sales calls, optionally filtered by rep, deal/account, or graded-only.",
    parameters: {
      type: "object",
      properties: {
        rep: { type: "string" },
        query: { type: "string", description: "Deal, account, or prospect name" },
        graded_only: { type: "boolean" },
      },
    },
    async run(args, ctx) {
      const rep = await resolveRep(ctx.orgId, q(args.rep));
      const query = q(args.query);
      const deal = query ? await resolveDeal(ctx.orgId, query) : null;
      const calls = await db.call.findMany({
        where: {
          orgId: ctx.orgId,
          ...(rep ? { repId: rep.id } : repFilter(ctx)),
          ...(args.graded_only ? { status: "GRADED" } : {}),
          ...(deal
            ? { dealId: deal.id }
            : query
              ? {
                  OR: [
                    { prospectName: { contains: query } },
                    { deal: { name: { contains: query } } },
                    { account: { name: { contains: query } } },
                    { rep: { name: { contains: query } } },
                  ],
                }
              : {}),
        },
        include: {
          rep: { select: { name: true } },
          deal: { select: { name: true } },
          account: { select: { name: true } },
          grade: true,
        },
        orderBy: { callDate: "desc" },
        take: 10,
      });
      if (!calls.length) return { text: "No matching calls found." };
      return {
        text: calls
          .map((c) => {
            const score = c.grade
              ? `${c.grade.managerOverrideScore ?? c.grade.overallScore}/100 (${BAND_LABELS[c.grade.band as keyof typeof BAND_LABELS] ?? c.grade.band})`
              : c.status;
            return `• ${c.rep.name} · ${c.callType} · ${c.deal?.name || c.account?.name || c.prospectName || "call"} · ${score}`;
          })
          .join("\n"),
        links: [
          { href: "/calls", label: "All calls" },
          ...calls.slice(0, 3).map((c) => ({
            href: `/calls/${c.id}`,
            label: c.deal?.name || c.prospectName || "Call",
          })),
        ],
      };
    },
  },
  {
    name: "get_call_grade",
    description: "Get the latest graded call for a rep and/or deal, with scorecard summary.",
    parameters: {
      type: "object",
      properties: {
        rep: { type: "string" },
        query: { type: "string", description: "Deal or account name" },
      },
    },
    async run(args, ctx) {
      const rep = await resolveRep(ctx.orgId, q(args.rep));
      const query = q(args.query);
      const deal = query ? await resolveDeal(ctx.orgId, query) : null;
      const call = await db.call.findFirst({
        where: {
          orgId: ctx.orgId,
          status: "GRADED",
          ...(rep ? { repId: rep.id } : {}),
          ...(deal
            ? { dealId: deal.id }
            : query
              ? {
                  OR: [
                    { deal: { name: { contains: query } } },
                    { account: { name: { contains: query } } },
                    { prospectName: { contains: query } },
                  ],
                }
              : {}),
        },
        include: {
          rep: { select: { name: true } },
          deal: { select: { id: true, name: true } },
          account: { select: { name: true } },
          grade: true,
        },
        orderBy: { callDate: "desc" },
      });
      if (!call?.grade) {
        return {
          text: `No graded call found${rep ? ` for ${rep.name}` : ""}${query ? ` matching "${query}"` : ""}.`,
          links: [{ href: "/calls", label: "Calls" }],
        };
      }
      const score = call.grade.managerOverrideScore ?? call.grade.overallScore;
      const band = BAND_LABELS[call.grade.band as keyof typeof BAND_LABELS] ?? call.grade.band;
      const lines = [
        `${call.rep.name} · ${call.callType} · ${call.deal?.name || call.account?.name || call.prospectName || "call"}`,
        `Score: ${score}/100 (${band})${call.grade.managerOverrideScore != null ? " · manager override" : ""}`,
        call.grade.summary ? `Summary: ${call.grade.summary}` : "",
      ].filter(Boolean);
      const links: AssistantLink[] = [{ href: `/calls/${call.id}`, label: "Open scorecard" }];
      if (call.deal) links.push({ href: `/crm/deals/${call.deal.id}`, label: call.deal.name });
      return { text: lines.join("\n"), links };
    },
  },
  {
    name: "list_roleplays",
    description: "List recent role-play practice sessions and scores.",
    parameters: {
      type: "object",
      properties: { rep: { type: "string" } },
    },
    async run(args, ctx) {
      const rep = await resolveRep(ctx.orgId, q(args.rep));
      const sessions = await db.roleplaySession.findMany({
        where: {
          orgId: ctx.orgId,
          ...(rep ? { repId: rep.id } : {}),
        },
        include: {
          rep: { select: { name: true } },
          scenario: { select: { title: true, difficulty: true } },
          grade: true,
        },
        orderBy: { startedAt: "desc" },
        take: 10,
      });
      if (!sessions.length) return { text: "No role-play sessions found." };
      return {
        text: sessions
          .map((s) => {
            const score = s.grade
              ? `${s.grade.managerOverrideScore ?? s.grade.overallScore}/100`
              : s.status;
            return `• ${s.rep.name} · ${s.scenario.title} (${s.scenario.difficulty}) · ${score}`;
          })
          .join("\n"),
        links: [
          { href: "/roleplay", label: "Role-play" },
          ...sessions.slice(0, 2).map((s) => ({ href: `/roleplay/${s.id}`, label: s.scenario.title })),
        ],
      };
    },
  },
  {
    name: "list_purchase_orders",
    description: "List purchase orders and vendor restocks.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" }, status: { type: "string" } },
    },
    async run(args, ctx) {
      const query = q(args.query);
      const status = q(args.status).toLowerCase();
      const pos = await db.purchaseOrder.findMany({
        where: {
          orgId: ctx.orgId,
          ...(status ? { status } : {}),
          ...(query
            ? {
                OR: [
                  { number: { contains: query } },
                  { vendor: { name: { contains: query } } },
                ],
              }
            : {}),
        },
        include: { vendor: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });
      if (!pos.length) return { text: "No purchase orders found." };
      return {
        text: pos
          .map((p) => `• ${p.number} · ${p.status} · ${fmtMoney(p.total)} · ${p.vendor?.name ?? "—"}`)
          .join("\n"),
        links: [{ href: "/erp/purchasing", label: "Purchasing" }],
      };
    },
  },
  {
    name: "search_accounts_contacts",
    description: "Search CRM accounts and contacts.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
    async run(args, ctx) {
      const query = q(args.query);
      const [accounts, contacts] = await Promise.all([
        db.account.findMany({
          where: {
            orgId: ctx.orgId,
            OR: [{ name: { contains: query } }, { domain: { contains: query } }, { industry: { contains: query } }],
          },
          take: 5,
        }),
        db.contact.findMany({
          where: {
            orgId: ctx.orgId,
            OR: [{ name: { contains: query } }, { email: { contains: query } }, { title: { contains: query } }],
          },
          include: { account: { select: { name: true } } },
          take: 5,
        }),
      ]);
      if (!accounts.length && !contacts.length) return { text: `No accounts/contacts for "${query}".` };
      const lines = [
        ...accounts.map((a) => `Account · ${a.name} (${a.industry || a.domain || "—"})`),
        ...contacts.map(
          (c) => `Contact · ${c.name}${c.title ? `, ${c.title}` : ""} @ ${c.account?.name ?? "—"} · ${c.email || c.phone || ""}`,
        ),
      ];
      return {
        text: lines.join("\n"),
        links: [
          ...accounts.slice(0, 2).map((a) => ({ href: `/crm/accounts/${a.id}`, label: a.name })),
          { href: "/crm/contacts", label: "Contacts" },
        ],
      };
    },
  },
  {
    name: "update_deal_stage",
    description: "Move a CRM deal to a new pipeline stage.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        stage: {
          type: "string",
          description: "lead|qualified|discovery|demo|proposal|negotiation|closed_won|closed_lost",
        },
      },
      required: ["query", "stage"],
    },
    async run(args, ctx) {
      const deal = await resolveDeal(ctx.orgId, q(args.query));
      if (!deal) return { text: `No deal matched "${q(args.query)}".` };
      if (!ctx.isManager && deal.ownerId !== ctx.userId) {
        return { text: "You can only update deals you own." };
      }
      const stageRaw = q(args.stage).toLowerCase().replace(/\s+/g, "_");
      const stage = DEAL_STAGES.find(
        (s) => s.key === stageRaw || s.label.toLowerCase() === q(args.stage).toLowerCase(),
      );
      if (!stage) return { text: `Unknown stage "${q(args.stage)}".` };
      const updated = await db.deal.update({
        where: { id: deal.id },
        data: { stage: stage.key, probability: stage.probability },
      });
      await db.activity.create({
        data: {
          orgId: ctx.orgId,
          dealId: deal.id,
          accountId: deal.accountId,
          contactId: deal.contactId,
          ownerId: ctx.userId,
          type: "NOTE",
          subject: `Stage → ${stage.label}`,
          body: `Moved from ${stageLabel(deal.stage)} to ${stage.label} via Ask.`,
        },
      });
      return {
        text: `Moved **${updated.name}** to ${stage.label} (${stage.probability}%).`,
        links: [{ href: `/crm/deals/${updated.id}`, label: "Open deal" }],
        followUps: ["Show me the Cascade deal", "What's our pipeline look like?"],
      };
    },
  },
  {
    name: "get_document",
    description: "Get quote, sales order, or invoice detail by number.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        type: { type: "string", enum: ["quote", "order", "invoice", "auto"] },
      },
      required: ["query"],
    },
    async run(args, ctx) {
      const query = q(args.query);
      const type = q(args.type).toLowerCase() || "auto";
      if (type === "quote" || type === "auto" || /^Q-/i.test(query)) {
        const quote = await resolveQuote(ctx.orgId, query);
        if (quote) {
          const lines = await db.quoteLine.findMany({ where: { quoteId: quote.id }, orderBy: { sortOrder: "asc" } });
          return {
            text: [
              `**${quote.number}** · ${quote.status} · ${fmtMoney(quote.total)}`,
              `Title: ${quote.title || "—"} · Deal: ${quote.deal?.name ?? "—"} · Account: ${quote.account?.name ?? "—"}`,
              lines.length
                ? `Lines:\n${lines.map((l) => `• ${l.quantity}× ${l.description} @ ${fmtMoney(l.unitPrice)} = ${fmtMoney(l.lineTotal)}`).join("\n")}`
                : "Lines: none",
            ].join("\n"),
            links: [{ href: `/erp/quotes/${quote.id}`, label: quote.number }],
            followUps: [`Accept quote ${quote.number}`, "List open quotes"],
          };
        }
        if (type === "quote") return { text: `No quote matched "${query}".` };
      }
      if (type === "order" || type === "auto" || /^SO-/i.test(query)) {
        const order = await resolveOrder(ctx.orgId, query);
        if (order) {
          const lines = await db.orderLine.findMany({ where: { orderId: order.id }, orderBy: { sortOrder: "asc" } });
          return {
            text: [
              `**${order.number}** · ${order.status} · ${fmtMoney(order.total)}`,
              `Deal: ${order.deal?.name ?? "—"} · Account: ${order.account?.name ?? "—"}`,
              `Invoices: ${order.invoices?.map((i) => `${i.number} ${i.status}`).join("; ") || "none"}`,
              lines.length
                ? `Lines:\n${lines.map((l) => `• ${l.quantity}× ${l.description} @ ${fmtMoney(l.unitPrice)}`).join("\n")}`
                : "",
            ]
              .filter(Boolean)
              .join("\n"),
            links: [{ href: `/erp/orders/${order.id}`, label: order.number }],
            followUps: [`Confirm order ${order.number}`, "Finance snapshot"],
          };
        }
        if (type === "order") return { text: `No order matched "${query}".` };
      }
      if (type === "invoice" || type === "auto" || /^INV-/i.test(query)) {
        const invoice = await resolveInvoice(ctx.orgId, query);
        if (invoice) {
          return {
            text: [
              `**${invoice.number}** · ${invoice.status} · ${fmtMoney(invoice.total)}`,
              `Paid ${fmtMoney(invoice.amountPaid)} · Balance ${fmtMoney(invoice.total - invoice.amountPaid)}`,
              `Deal: ${invoice.deal?.name ?? "—"} · Account: ${invoice.account?.name ?? "—"}`,
              invoice.payments?.length
                ? `Payments: ${invoice.payments.map((p) => `${fmtMoney(p.amount)} ${p.method}`).join("; ")}`
                : "Payments: none",
            ].join("\n"),
            links: [{ href: `/erp/invoices/${invoice.id}`, label: invoice.number }],
            followUps: [`Record payment on ${invoice.number}`, "List invoices"],
          };
        }
      }
      return { text: `No document matched "${query}".` };
    },
  },
  {
    name: "list_activities",
    description: "List recent CRM/ERP/coaching activity timeline entries for a deal or account.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
    async run(args, ctx) {
      const deal = await resolveDeal(ctx.orgId, q(args.query));
      const activities = await db.activity.findMany({
        where: {
          orgId: ctx.orgId,
          ...(deal
            ? { dealId: deal.id }
            : {
                OR: [
                  { subject: { contains: q(args.query) } },
                  { account: { name: { contains: q(args.query) } } },
                ],
              }),
        },
        include: { owner: { select: { name: true } }, deal: { select: { name: true } } },
        orderBy: { occurredAt: "desc" },
        take: 12,
      });
      if (!activities.length) return { text: "No activities found." };
      return {
        text: activities
          .map(
            (a) =>
              `• ${a.type} · ${a.subject}${a.score != null ? ` · ${a.score}/100` : ""} · ${a.deal?.name ?? "—"} · ${a.owner?.name ?? ""}`,
          )
          .join("\n"),
        links: deal
          ? [{ href: `/crm/deals/${deal.id}`, label: deal.name }]
          : [{ href: "/crm", label: "Pipeline" }],
        followUps: deal ? [`Show me the ${deal.name} deal`] : ["What's our pipeline look like?"],
      };
    },
  },
  {
    name: "list_conversations",
    description: "List CRM email/phone conversation threads.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
    },
    async run(args, ctx) {
      const query = q(args.query);
      const deal = query ? await resolveDeal(ctx.orgId, query) : null;
      const conversations = await db.conversation.findMany({
        where: {
          orgId: ctx.orgId,
          ...(ctx.isManager ? {} : { ownerId: ctx.userId }),
          ...(deal
            ? { dealId: deal.id }
            : query
              ? {
                  OR: [
                    { subject: { contains: query } },
                    { prospectAddress: { contains: query } },
                    { deal: { name: { contains: query } } },
                  ],
                }
              : {}),
        },
        include: {
          deal: { select: { name: true } },
          contact: { select: { name: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { lastMessageAt: "desc" },
        take: 10,
      });
      if (!conversations.length) return { text: "No conversations found." };
      return {
        text: conversations
          .map(
            (c) =>
              `• ${c.channel} · ${c.subject || "(no subject)"} · ${c.deal?.name || c.contact?.name || c.prospectAddress} · ${c._count.messages} msgs · ${c.status}`,
          )
          .join("\n"),
        links: [{ href: "/conversations", label: "Conversations" }],
        followUps: ["Show me the Cascade deal", "Find contact Dana"],
      };
    },
  },
  {
    name: "list_scenarios",
    description: "List sales trainer role-play scenarios.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
    },
    async run(args, ctx) {
      const query = q(args.query);
      const scenarios = await db.scenario.findMany({
        where: {
          orgId: ctx.orgId,
          ...(query
            ? {
                OR: [{ title: { contains: query } }, { callType: { contains: query } }, { difficulty: { contains: query } }],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      });
      if (!scenarios.length) return { text: "No scenarios found." };
      return {
        text: scenarios
          .map((s) => `• ${s.title} · ${s.callType} · ${s.difficulty}`)
          .join("\n"),
        links: [
          { href: "/scenarios", label: "Scenarios" },
          ...scenarios.slice(0, 2).map((s) => ({ href: `/scenarios/${s.id}`, label: s.title })),
        ],
        followUps: ["Show recent role-plays", "Who needs coaching?"],
      };
    },
  },
  {
    name: "my_performance",
    description: "Summary of the current user's coaching performance and open assignments.",
    parameters: { type: "object", properties: {} },
    async run(_args, ctx) {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const [grades, assignments, calls] = await Promise.all([
        db.grade.findMany({
          where: {
            orgId: ctx.orgId,
            createdAt: { gte: since },
            OR: [{ call: { repId: ctx.userId } }, { roleplay: { repId: ctx.userId } }],
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        db.assignment.findMany({
          where: { orgId: ctx.orgId, assignedToId: ctx.userId, status: { not: "COMPLETED" } },
          include: { scenario: { select: { title: true } } },
          take: 8,
        }),
        db.call.count({ where: { orgId: ctx.orgId, repId: ctx.userId, callDate: { gte: since } } }),
      ]);
      const avg = grades.length
        ? Math.round(grades.reduce((s, g) => s + (g.managerOverrideScore ?? g.overallScore), 0) / grades.length)
        : null;
      return {
        text: [
          `Last 30 days: ${calls} calls · ${grades.length} grades${avg != null ? ` · avg ${avg}/100` : ""}`,
          grades[0]
            ? `Latest: ${grades[0].overallScore}/100 (${BAND_LABELS[grades[0].band as keyof typeof BAND_LABELS] ?? grades[0].band})`
            : "Latest: no grades yet",
          assignments.length
            ? `Open assignments:\n${assignments.map((a) => `• ${a.type} · ${a.doneCount}/${a.targetCount}${a.scenario ? ` · ${a.scenario.title}` : ""}`).join("\n")}`
            : "Open assignments: none",
        ].join("\n"),
        links: [
          { href: "/me", label: "My performance" },
          { href: "/assignments", label: "Assignments" },
        ],
        followUps: ["Show recent role-plays", "Show assignments", "Who needs coaching?"],
      };
    },
  },
  {
    name: "help",
    description: "Explain what the assistant can do across coaching, CRM, and ERP.",
    parameters: { type: "object", properties: {} },
    async run(_args, ctx) {
      // Examples come from the tenant's own data so every workspace's help
      // text references its accounts and reps, not another tenant's.
      const [account, rep, contact] = await Promise.all([
        db.account.findFirst({ where: { orgId: ctx.orgId }, orderBy: { createdAt: "asc" }, select: { name: true } }),
        db.user.findFirst({ where: { orgId: ctx.orgId, role: "REP" }, orderBy: { createdAt: "asc" }, select: { name: true } }),
        db.contact.findFirst({ where: { orgId: ctx.orgId }, orderBy: { createdAt: "asc" }, select: { name: true } }),
      ]);
      const acct = shortNameToken(account?.name) ?? "your account";
      const repName = shortNameToken(rep?.name) ?? "your rep";
      const contactName = shortNameToken(contact?.name) ?? "a contact";
      return {
        text: [
          "I can work across the whole platform. Try:",
          "• “What's our pipeline look like?”",
          `• “Show me the ${acct} deal”`,
          `• “List open quotes” / “Accept the ${acct} quote”`,
          "• “Finance snapshot” / “What's low in inventory?” / “Show purchase orders”",
          "• “Trial balance” / “Warehouse stock” / “Projects” / “Payroll”",
          `• “Who needs coaching?” / “How is ${repName} doing?”`,
          `• “What was ${repName}'s last ${acct} call score?”`,
          "• “Show recent role-plays” / “Show assignments”",
          `• “Create a quote for ${acct}”`,
          `• “Find contact ${contactName}”`,
        ].join("\n"),
        links: [
          { href: "/ask", label: "Ask view" },
          { href: "/crm", label: "Pipeline" },
          { href: "/erp", label: "ERP" },
          { href: "/erp/ledger", label: "Ledger" },
          { href: "/dashboard", label: "Dashboard" },
        ],
      };
    },
  },
];

function openaiTools() {
  return ASSISTANT_TOOLS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

async function runTool(name: string, args: Record<string, unknown>, ctx: ToolCtx) {
  const tool = ASSISTANT_TOOLS.find((t) => t.name === name);
  if (!tool) return { text: `Unknown tool: ${name}` };
  return tool.run(args, ctx);
}

/** Deterministic NL router for demo mode (no API key). */
export function routeDemoIntent(
  message: string,
  domain: "all" | AssistantSource = "all",
  vocab?: DemoVocab,
): { name: string; args: Record<string, unknown> }[] {
  const m = message.trim();
  const lower = m.toLowerCase();
  const accountRe = new RegExp(`\\b(${vocab ? vocabTokens(vocab.accounts, ACCOUNT_TOKENS) : ACCOUNT_TOKENS})\\b`, "i");
  const repRe = new RegExp(`\\b(${vocab ? vocabTokens(vocab.reps, REP_TOKENS) : REP_TOKENS})\\b`, "i");
  const contactRe = new RegExp(`\\b(${vocab ? vocabTokens(vocab.contacts, CONTACT_TOKENS) : CONTACT_TOKENS})\\b`, "i");
  const namedAccount = m.match(accountRe)?.[1];
  const namedRep = m.match(repRe)?.[1];
  const namedContact = m.match(contactRe)?.[1];
  const allowCrm = domain === "all" || domain === "crm";
  const allowErp = domain === "all" || domain === "erp";
  const allowTrainer = domain === "all" || domain === "trainer";
  // Named deal lookups are cross-cutting — useful from any tab.
  const looksLikeDealLookup =
    Boolean(namedAccount) &&
    (/\b(deal|show|get|open|status|tell me about|what's|whats)\b/.test(lower) ||
      /\bdeal\b/.test(lower));

  if (/^(help|what can you do|commands)\b/.test(lower) || lower === "?") {
    return [{ name: "help", args: {} }];
  }

  // Domain shortcuts when the user scopes the workspace to one system.
  if (domain === "crm" && /^(summary|overview|status|how are we)\b/.test(lower) && !namedAccount) {
    return [{ name: "pipeline_summary", args: {} }];
  }
  if (domain === "erp" && /^(summary|overview|status|how are we)\b/.test(lower) && !namedAccount) {
    return [{ name: "finance_snapshot", args: {} }];
  }
  if (domain === "trainer" && /^(summary|overview|status|how are we)\b/.test(lower)) {
    return [{ name: "coaching_summary", args: {} }];
  }
  if (allowErp && /\b(trial balance|general ledger|g\/?l|journal)\b/.test(lower)) {
    return [{ name: "gl_trial_balance", args: {} }];
  }
  if (allowErp && /\b(warehouse|warehouses|transfer)\b/.test(lower)) {
    return [{ name: "warehouse_stock", args: {} }];
  }
  if (allowErp && /\b(project|projects|time entries|hours logged)\b/.test(lower)) {
    return [{ name: "projects_summary", args: {} }];
  }
  if (allowErp && /\b(payroll|headcount|hr|employees)\b/.test(lower)) {
    return [{ name: "hr_payroll_snapshot", args: {} }];
  }

  // Call / scorecard intents (trainer + CRM overlap)
  if (
    (allowTrainer || allowCrm) &&
    /\b(call score|last call|graded call|scorecard|call grade)\b/.test(lower)
  ) {
    return [
      {
        name: "get_call_grade",
        args: { rep: namedRep || "", query: namedAccount || "" },
      },
    ];
  }
  if (
    (allowTrainer || allowCrm) &&
    /\b(calls?|call history)\b/.test(lower) &&
    !/\brole-?play\b/.test(lower)
  ) {
    if (/\b(score|grade|last)\b/.test(lower) || (namedRep && namedAccount)) {
      return [
        {
          name: "get_call_grade",
          args: { rep: namedRep || "", query: namedAccount || namedRep || "" },
        },
      ];
    }
    return [
      {
        name: "list_calls",
        args: {
          rep: namedRep || "",
          query: namedAccount || "",
          graded_only: /\bgraded\b/.test(lower),
        },
      },
    ];
  }
  if (allowTrainer && /\b(role-?plays?|practice sessions?)\b/.test(lower)) {
    return [{ name: "list_roleplays", args: { rep: namedRep || "" } }];
  }
  if (allowTrainer && /\b(scenarios?)\b/.test(lower)) {
    return [{ name: "list_scenarios", args: { query: "" } }];
  }
  if (allowTrainer && /\b(my performance|my scores|how am i doing)\b/.test(lower)) {
    return [{ name: "my_performance", args: {} }];
  }

  if (allowCrm && /\b(pipeline|open deals|deal board)\b/.test(lower) && !namedAccount) {
    return [{ name: "pipeline_summary", args: {} }];
  }
  if (allowErp && /\b(finance|cash collected|a\/?r|accounts receivable|revenue)\b/.test(lower)) {
    return [{ name: "finance_snapshot", args: {} }];
  }
  if (allowErp && /\b(inventory|stock|reorder|low stock)\b/.test(lower)) {
    return [{ name: "list_products", args: { inventory_only: true } }];
  }
  if (allowErp && /\b(catalog|products?|skus?)\b/.test(lower) && !/\bquote\b/.test(lower)) {
    return [{ name: "list_products", args: {} }];
  }
  if (allowTrainer && /\b(who needs coaching|needs coaching|coaching queue)\b/.test(lower)) {
    return [{ name: "coaching_summary", args: { needs_coaching_only: true } }];
  }
  if (allowTrainer && /\b(assignments?)\b/.test(lower)) {
    return [{ name: "list_assignments", args: { rep: namedRep || "" } }];
  }
  if (allowTrainer && /\b(how is|how's|performance of|scores? for)\b/.test(lower)) {
    return [{ name: "coaching_summary", args: { rep: namedRep ?? "" } }];
  }
  if (
    allowTrainer &&
    /\b(coaching|team avg|graded calls|scorecard|trainer)\b/.test(lower) &&
    !/\bcall\b/.test(lower)
  ) {
    return [{ name: "coaching_summary", args: { rep: namedRep || "" } }];
  }

  // Move deal stage
  if (allowCrm && /\b(move|set|update|change)\b.*\b(stage|to)\b|\bstage\b.*\b(to|as)\b/.test(lower)) {
    const stageMatch = m.match(
      /\b(lead|qualified|discovery|demo|proposal|negotiation|closed[_\s]?won|closed[_\s]?lost)\b/i,
    );
    return [
      {
        name: "update_deal_stage",
        args: {
          query: namedAccount || m,
          stage: (stageMatch?.[1] || "").replace(/\s+/g, "_"),
        },
      },
    ];
  }

  // Document detail
  if (allowErp && /\b(Q-\d+|SO-\d+|INV-\d+)\b/i.test(m) && /\b(show|get|open|details?|line items?)\b/.test(lower)) {
    const num = m.match(/\b(Q-\d+|SO-\d+|INV-\d+)\b/i)?.[0] || "";
    return [{ name: "get_document", args: { query: num, type: "auto" } }];
  }

  if ((allowCrm || allowErp || allowTrainer) && /\b(activit(y|ies)|timeline)\b/.test(lower)) {
    return [{ name: "list_activities", args: { query: namedAccount || m } }];
  }
  if (allowCrm && /\b(conversations?|threads?|emails?|outreach)\b/.test(lower)) {
    return [{ name: "list_conversations", args: { query: namedAccount || namedContact || "" } }];
  }

  // Quote actions (ERP)
  if (allowErp && /\b(accept|approve)\b.*\bquote\b|\bquote\b.*\b(accept|approve)\b/.test(lower)) {
    const num = m.match(/\bQ-?\d{3,}\b/i)?.[0];
    return [{ name: "quote_action", args: { action: "accept", query: num || namedAccount || m } }];
  }
  if (allowErp && /\bsend\b.*\bquote\b|\bquote\b.*\bsend\b/.test(lower)) {
    const num = m.match(/\bQ-?\d{3,}\b/i)?.[0];
    return [{ name: "quote_action", args: { action: "send", query: num || namedAccount || m } }];
  }
  if (allowErp && /\breject\b.*\bquote\b/.test(lower)) {
    const num = m.match(/\bQ-?\d{3,}\b/i)?.[0];
    return [{ name: "quote_action", args: { action: "reject", query: num || m } }];
  }
  if (allowErp && /\b(create|draft|new)\b.*\bquote\b|\bquote\b.*\b(for|on)\b/.test(lower)) {
    const product = m.match(/\b(Meridian Core|Meridian Forecast|Core|Forecast|scanner)\b/i)?.[0];
    const qty = Number(m.match(/\b(\d+)\s*(x|×|seats?|units?)?\b/i)?.[1] || 1);
    return [
      {
        name: "create_quote_for_deal",
        args: { deal: namedAccount || "", product, quantity: qty },
      },
    ];
  }
  if (allowErp && /\bquotes?\b/.test(lower)) {
    let status = "";
    if (/\bopen\b/.test(lower)) status = "open";
    else if (/\bdraft\b/.test(lower)) status = "draft";
    else if (/\bsent\b/.test(lower)) status = "sent";
    const query = m.match(/\b(Q-\d+)\b/i)?.[0] || namedAccount || "";
    return [{ name: "list_quotes", args: { status, query } }];
  }

  // Purchase orders before sales orders (avoid "order" substring match)
  if (allowErp && /\bpurchase\s*orders?\b|\bPO-?\d{3,}\b|\bvendors?\b/.test(lower)) {
    return [
      {
        name: "list_purchase_orders",
        args: { query: m.match(/\bPO-?\d{3,}\b/i)?.[0] || "" },
      },
    ];
  }

  // Order actions
  if (allowErp && /\bconfirm\b.*\border\b|\border\b.*\bconfirm\b/.test(lower)) {
    const num = m.match(/\bSO-?\d{3,}\b/i)?.[0];
    return [{ name: "order_action", args: { action: "confirm", query: num || namedAccount || m } }];
  }
  if (allowErp && /\bfulfill\b.*\border\b/.test(lower)) {
    const num = m.match(/\bSO-?\d{3,}\b/i)?.[0];
    return [{ name: "order_action", args: { action: "fulfill", query: num || m } }];
  }
  if (allowErp && /\binvoice\b.*\border\b|\bcreate invoice\b/.test(lower)) {
    const num = m.match(/\bSO-?\d{3,}\b/i)?.[0];
    return [{ name: "order_action", args: { action: "invoice", query: num || namedAccount || m } }];
  }
  if (allowErp && /\b(sales\s+)?orders?\b/.test(lower) && !/\bpurchase\b/.test(lower)) {
    return [
      {
        name: "list_orders",
        args: { query: m.match(/\bSO-\d+\b/i)?.[0] || namedAccount || "" },
      },
    ];
  }

  // Invoice actions
  if (allowErp && /\b(pay|payment|record payment)\b/.test(lower) && /\b(invoice|inv-)/.test(lower)) {
    const num = m.match(/\bINV-?\d{3,}\b/i)?.[0];
    const amount = Number(m.match(/\$?\s*([\d,]+)/)?.[1]?.replace(/,/g, "") || 0);
    return [{ name: "invoice_action", args: { action: "pay", query: num || m, amount } }];
  }
  if (allowErp && /\bsend\b.*\binvoice\b/.test(lower)) {
    const num = m.match(/\bINV-?\d{3,}\b/i)?.[0];
    return [{ name: "invoice_action", args: { action: "send", query: num || m } }];
  }
  if (allowErp && /\binvoices?\b/.test(lower)) {
    const query = m.match(/\bINV-\d+\b/i)?.[0] || namedAccount || "";
    return [{ name: "list_invoices", args: { query } }];
  }

  // Deal / account / contact — allowed from CRM, or any tab when clearly an entity lookup
  if (allowCrm || looksLikeDealLookup || Boolean(namedAccount || namedContact)) {
    if (
      (namedContact || /\b(contact|email|phone)\b/.test(lower)) &&
      !/\bdeal\b/.test(lower) &&
      !/\bquote\b/.test(lower) &&
      !/\bcall\b/.test(lower)
    ) {
      const query = namedContact || namedAccount || m;
      return [{ name: "search_accounts_contacts", args: { query } }];
    }
    if (looksLikeDealLookup || /\bdeal\b/.test(lower) || (namedAccount && /\b(show|get|open|status|tell me about|what's|whats)\b/.test(lower))) {
      const query =
        namedAccount ||
        m
          .replace(/^(show|get|open|what's|whats|status|tell me about)\s+/i, "")
          .replace(/\bdeal\b/gi, "")
          .trim();
      return [{ name: "get_deal", args: { query } }];
    }
    if (allowCrm && (/\b(deal|account|contact)\b/.test(lower) || namedAccount)) {
      return [{ name: "search_deals", args: { query: namedAccount || m } }];
    }
  }

  // Scoped fallbacks when domain is set but phrasing was vague
  if (domain === "crm") return [{ name: "pipeline_summary", args: {} }];
  if (domain === "erp") return [{ name: "finance_snapshot", args: {} }];
  if (domain === "trainer") return [{ name: "coaching_summary", args: {} }];
  return [{ name: "help", args: {} }];
}

async function listInvoicesTool(ctx: ToolCtx, query = "") {
  const invoices = await db.invoice.findMany({
    where: {
      orgId: ctx.orgId,
      ...(query
        ? {
            OR: [
              { number: { contains: query } },
              { account: { name: { contains: query } } },
              { deal: { name: { contains: query } } },
            ],
          }
        : {}),
    },
    include: { account: true, deal: true },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });
  if (!invoices.length) return { text: "No invoices found.", links: [{ href: "/erp/invoices", label: "Invoices" }] };
  return {
    text: invoices
      .map(
        (i) =>
          `• ${i.number} · ${i.status} · ${fmtMoney(i.total)} · paid ${fmtMoney(i.amountPaid)} · ${i.account?.name ?? "—"}`,
      )
      .join("\n"),
    links: [
      { href: "/erp/invoices", label: "All invoices" },
      ...invoices.slice(0, 2).map((i) => ({ href: `/erp/invoices/${i.id}`, label: i.number })),
    ],
  };
}

export async function runAssistantChat(input: {
  message: string;
  history?: ChatMessage[];
  orgId: string;
  userId: string;
  role: string;
  isManager: boolean;
  domain?: "all" | AssistantSource;
}): Promise<AssistantResult> {
  const ctx: ToolCtx = {
    orgId: input.orgId,
    userId: input.userId,
    role: input.role,
    isManager: input.isManager,
  };
  const domain = input.domain ?? "all";
  const message = input.message.trim();
  if (!message) {
    return {
      reply: "Ask me anything about pipeline, quotes, orders, invoices, or coaching.",
      mode: "demo",
      sources: [],
    };
  }

  if (!aiAvailable()) {
    const vocab = await demoVocabForOrg(ctx.orgId);
    const calls = routeDemoIntent(message, domain, vocab);
    const parts: string[] = [];
    const links: AssistantLink[] = [];
    const toolNames: string[] = [];
    const followUps: string[] = [];
    let data: unknown;
    for (const call of calls) {
      toolNames.push(call.name);
      const result = await runTool(call.name, call.args, ctx);
      parts.push(result.text);
      links.push(...(result.links ?? []));
      followUps.push(...(result.followUps ?? []));
      if (result.data != null && data == null) data = result.data;
    }
    const uniq = links.filter((l, i, arr) => arr.findIndex((x) => x.href === l.href) === i);
    const uniqFollow = followUps.filter((f, i, arr) => arr.indexOf(f) === i).slice(0, 4);
    return {
      reply: parts.join("\n\n") || "I wasn't sure — try “help”.",
      links: uniq.slice(0, 6),
      sources: sourcesForTools(toolNames),
      followUps: uniqFollow,
      data,
      mode: "demo",
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const domainHint =
    domain === "crm"
      ? "Prefer CRM tools (pipeline, deals, accounts, contacts)."
      : domain === "erp"
        ? "Prefer ERP tools (quotes, orders, invoices, catalog, inventory, finance)."
        : domain === "trainer"
          ? "Prefer coaching/trainer tools (scores, assignments, role-play performance)."
          : "Query across CRM, ERP, and sales trainer as needed.";
  const system = `You are SalesCoach Assistant for Meridian Software.
You help managers and reps across CRM (pipeline, accounts, contacts), ERP (catalog, quotes, orders, invoices, inventory, warehouses, GL, projects, HR/payroll, finance), and sales trainer / coaching (scores, assignments, role-play).
${domainHint}
Use tools for live data and actions. Be concise. After tool results, summarize clearly with numbers and next steps.
Current user role: ${input.role}.`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...(input.history ?? []).slice(-8).map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: message },
  ];

  const links: AssistantLink[] = [];
  const toolNames: string[] = [];
  const followUps: string[] = [];
  let data: unknown;
  let guard = 0;
  while (guard++ < 4) {
    const res = await client.chat.completions.create({
      model: AI_MODEL,
      temperature: 0.2,
      messages,
      tools: openaiTools(),
      tool_choice: "auto",
    });
    const choice = res.choices[0]?.message;
    if (!choice) break;

    if (choice.tool_calls?.length) {
      messages.push(choice);
      for (const tc of choice.tool_calls) {
        if (tc.type !== "function") continue;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }
        toolNames.push(tc.function.name);
        const result = await runTool(tc.function.name, args, ctx);
        links.push(...(result.links ?? []));
        followUps.push(...(result.followUps ?? []));
        if (result.data != null && data == null) data = result.data;
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result.text,
        });
      }
      continue;
    }

    const reply = choice.content?.trim() || "Done.";
    const uniq = links.filter((l, i, arr) => arr.findIndex((x) => x.href === l.href) === i);
    return {
      reply,
      links: uniq.slice(0, 6),
      sources: sourcesForTools(toolNames),
      followUps: followUps.filter((f, i, arr) => arr.indexOf(f) === i).slice(0, 4),
      data,
      mode: "llm",
    };
  }

  return {
    reply: "I hit a tool loop limit — try a more specific question.",
    links,
    sources: sourcesForTools(toolNames),
    followUps: followUps.slice(0, 4),
    data,
    mode: "llm",
  };
}
