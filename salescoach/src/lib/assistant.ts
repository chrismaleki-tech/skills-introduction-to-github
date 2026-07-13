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
  coaching_summary: ["trainer"],
  list_assignments: ["trainer"],
  help: ["crm", "erp", "trainer"],
};

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

type ToolDef = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>, ctx: ToolCtx) => Promise<{ text: string; links?: AssistantLink[]; data?: unknown }>;
};

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
        where: { orgId: ctx.orgId, stage: { in: [...OPEN_STAGES] } },
        include: {
          account: { select: { name: true } },
          owner: { select: { name: true } },
        },
      });
      const withGrades = await db.call.findMany({
        where: { orgId: ctx.orgId, dealId: { not: null }, status: "GRADED" },
        select: { dealId: true },
        distinct: ["dealId"],
      });
      const coached = new Set(withGrades.map((c) => c.dealId));
      const total = deals.reduce((s, d) => s + d.amount, 0);
      const weighted = deals.reduce((s, d) => s + (d.amount * d.probability) / 100, 0);
      const byStage = DEAL_STAGES.filter((s) => OPEN_STAGES.includes(s.key)).map((s) => {
        const list = deals.filter((d) => d.stage === s.key);
        return `${s.label}: ${list.length} (${fmtMoney(list.reduce((a, d) => a + d.amount, 0))})`;
      });
      const top = [...deals]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
        .map(
          (d) =>
            `• ${d.name} — ${stageLabel(d.stage)} · ${fmtMoney(d.amount)} · ${d.owner?.name ?? "unassigned"}${coached.has(d.id) ? " · coached" : ""}`,
        );
      return {
        text: [
          `Open pipeline: ${deals.length} deals · ${fmtMoney(total)} · weighted ${fmtMoney(Math.round(weighted))}.`,
          `${coached.size} deals have graded coaching.`,
          byStage.join(" · "),
          top.length ? `Largest deals:\n${top.join("\n")}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        links: [{ href: "/crm", label: "Open pipeline" }],
        data: { count: deals.length, total, weighted },
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
        data: snap,
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
      const quotes = await db.quote.findMany({
        where: {
          orgId: ctx.orgId,
          ...(status ? { status } : {}),
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
      const rep = await resolveRep(ctx.orgId, q(args.rep));
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
        return { text: rep ? `No recent grades for ${rep.name}.` : "No recent grades." };
      }
      const avg = Math.round(filtered.reduce((s, g) => s + g.overallScore, 0) / filtered.length);
      const lines = filtered.slice(0, 8).map((g) => {
        const who = g.call?.rep?.name ?? g.roleplay?.rep?.name ?? "rep";
        const subject = g.subjectType === "CALL" ? g.call?.deal?.name || "call" : "role-play";
        return `• ${who} · ${g.overallScore}/100 (${BAND_LABELS[g.band as keyof typeof BAND_LABELS] ?? g.band}) · ${subject}`;
      });
      return {
        text: [
          `${rep ? rep.name : "Team"} · last 30 days: ${filtered.length} grades · avg ${avg}/100`,
          lines.join("\n"),
        ].join("\n"),
        links: [
          { href: "/dashboard", label: "Team dashboard" },
          ...(rep ? [{ href: `/team/${rep.id}`, label: `${rep.name}'s drill-down` }] : []),
          { href: "/calls", label: "Calls" },
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
          ...(rep ? { assignedToId: rep.id } : {}),
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
    name: "help",
    description: "Explain what the assistant can do across coaching, CRM, and ERP.",
    parameters: { type: "object", properties: {} },
    async run() {
      return {
        text: [
          "I can work across the whole platform. Try:",
          "• “What's our pipeline look like?”",
          "• “Show me the Cascade deal”",
          "• “List open quotes” / “Accept the Cascade quote”",
          "• “Confirm order SO-1002” / “Invoice Harbor's order”",
          "• “Finance snapshot” / “What's low in inventory?”",
          "• “Who needs coaching?” / “How is Alex doing?”",
          "• “Create a quote for BlueRidge with Meridian Core”",
          "• “Find contact Dana” / “Show assignments”",
        ].join("\n"),
        links: [
          { href: "/crm", label: "Pipeline" },
          { href: "/erp", label: "ERP" },
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
): { name: string; args: Record<string, unknown> }[] {
  const m = message.trim();
  const lower = m.toLowerCase();

  if (/^(help|what can you do|commands)\b/.test(lower) || lower === "?") {
    return [{ name: "help", args: {} }];
  }

  // Domain shortcuts when the user scopes the workspace to one system.
  if (domain === "crm" && /^(summary|overview|status|how are we)\b/.test(lower)) {
    return [{ name: "pipeline_summary", args: {} }];
  }
  if (domain === "erp" && /^(summary|overview|status|how are we)\b/.test(lower)) {
    return [{ name: "finance_snapshot", args: {} }];
  }
  if (domain === "trainer" && /^(summary|overview|status|how are we)\b/.test(lower)) {
    return [{ name: "coaching_summary", args: {} }];
  }

  if (
    domain !== "erp" &&
    domain !== "trainer" &&
    /\b(pipeline|open deals|deal board)\b/.test(lower) &&
    !/\b(cascade|blueridge|summit|harbor|northwind)\b/.test(lower)
  ) {
    return [{ name: "pipeline_summary", args: {} }];
  }
  if (domain !== "crm" && domain !== "trainer" && /\b(finance|cash collected|a\/?r|accounts receivable|revenue)\b/.test(lower)) {
    return [{ name: "finance_snapshot", args: {} }];
  }
  if (domain !== "crm" && domain !== "trainer" && /\b(inventory|stock|reorder|low stock)\b/.test(lower)) {
    return [{ name: "list_products", args: { inventory_only: true } }];
  }
  if (domain !== "crm" && domain !== "trainer" && /\b(catalog|products?|skus?)\b/.test(lower) && !/\bquote\b/.test(lower)) {
    return [{ name: "list_products", args: {} }];
  }
  if (domain !== "crm" && domain !== "erp" && /\b(who needs coaching|needs coaching|coaching queue)\b/.test(lower)) {
    return [{ name: "coaching_summary", args: { needs_coaching_only: true } }];
  }
  if (domain !== "crm" && domain !== "erp" && /\b(assignments?)\b/.test(lower)) {
    return [{ name: "list_assignments", args: {} }];
  }
  if (domain !== "crm" && domain !== "erp" && /\b(how is|how's|performance of|scores? for)\b/.test(lower)) {
    const repMatch = m.match(/\b(Alex|Casey|Jordan|Morgan|Riley|Sarah)\b/i);
    return [{ name: "coaching_summary", args: { rep: repMatch?.[1] ?? "" } }];
  }
  if (domain !== "crm" && domain !== "erp" && /\b(coaching|team avg|graded calls|scorecard|role-?play|trainer)\b/.test(lower)) {
    return [{ name: "coaching_summary", args: {} }];
  }

  // Quote actions (ERP)
  if (domain !== "crm" && domain !== "trainer" && /\b(accept|approve)\b.*\bquote\b|\bquote\b.*\b(accept|approve)\b/.test(lower)) {
    const num = m.match(/\bQ-?\d{3,}\b/i)?.[0];
    const deal = m.match(/\b(Cascade|BlueRidge|Summit|Harbor|Northwind)\b/i)?.[0];
    return [{ name: "quote_action", args: { action: "accept", query: num || deal || m } }];
  }
  if (domain !== "crm" && domain !== "trainer" && /\bsend\b.*\bquote\b|\bquote\b.*\bsend\b/.test(lower)) {
    const num = m.match(/\bQ-?\d{3,}\b/i)?.[0];
    const deal = m.match(/\b(Cascade|BlueRidge|Summit|Harbor|Northwind)\b/i)?.[0];
    return [{ name: "quote_action", args: { action: "send", query: num || deal || m } }];
  }
  if (domain !== "crm" && domain !== "trainer" && /\breject\b.*\bquote\b/.test(lower)) {
    const num = m.match(/\bQ-?\d{3,}\b/i)?.[0];
    return [{ name: "quote_action", args: { action: "reject", query: num || m } }];
  }
  if (domain !== "crm" && domain !== "trainer" && /\b(create|draft|new)\b.*\bquote\b|\bquote\b.*\b(for|on)\b/.test(lower)) {
    const deal = m.match(/\b(Cascade|BlueRidge|Summit|Harbor|Northwind)[^,]*/i)?.[0] || "";
    const product = m.match(/\b(Meridian Core|Meridian Forecast|Core|Forecast|scanner)\b/i)?.[0];
    const qty = Number(m.match(/\b(\d+)\s*(x|×|seats?|units?)?\b/i)?.[1] || 1);
    return [{ name: "create_quote_for_deal", args: { deal, product, quantity: qty } }];
  }
  if (domain !== "crm" && domain !== "trainer" && /\bquotes?\b/.test(lower)) {
    const status = lower.includes("open") || lower.includes("sent") ? (lower.includes("draft") ? "draft" : "sent") : "";
    const query = m.match(/\b(Cascade|BlueRidge|Summit|Harbor|Northwind|Q-\d+)\b/i)?.[0] || "";
    return [{ name: "list_quotes", args: { status: status === "sent" || status === "draft" ? status : "", query } }];
  }

  // Order actions
  if (domain !== "crm" && domain !== "trainer" && /\bconfirm\b.*\border\b|\border\b.*\bconfirm\b/.test(lower)) {
    const num = m.match(/\bSO-?\d{3,}\b/i)?.[0];
    const deal = m.match(/\b(Cascade|BlueRidge|Summit|Harbor|Northwind)\b/i)?.[0];
    return [{ name: "order_action", args: { action: "confirm", query: num || deal || m } }];
  }
  if (domain !== "crm" && domain !== "trainer" && /\bfulfill\b.*\border\b/.test(lower)) {
    const num = m.match(/\bSO-?\d{3,}\b/i)?.[0];
    return [{ name: "order_action", args: { action: "fulfill", query: num || m } }];
  }
  if (domain !== "crm" && domain !== "trainer" && /\binvoice\b.*\border\b|\bcreate invoice\b/.test(lower)) {
    const num = m.match(/\bSO-?\d{3,}\b/i)?.[0];
    const deal = m.match(/\b(Cascade|BlueRidge|Summit|Harbor|Northwind)\b/i)?.[0];
    return [{ name: "order_action", args: { action: "invoice", query: num || deal || m } }];
  }
  if (domain !== "crm" && domain !== "trainer" && /\borders?\b/.test(lower)) {
    return [{ name: "list_orders", args: { query: m.match(/\b(Cascade|BlueRidge|Summit|Harbor|SO-\d+)\b/i)?.[0] || "" } }];
  }

  // Invoice actions
  if (domain !== "crm" && domain !== "trainer" && /\b(pay|payment|record payment)\b/.test(lower) && /\b(invoice|inv-)/.test(lower)) {
    const num = m.match(/\bINV-?\d{3,}\b/i)?.[0];
    const amount = Number(m.match(/\$?\s*([\d,]+)/)?.[1]?.replace(/,/g, "") || 0);
    return [{ name: "invoice_action", args: { action: "pay", query: num || m, amount } }];
  }
  if (domain !== "crm" && domain !== "trainer" && /\bsend\b.*\binvoice\b/.test(lower)) {
    const num = m.match(/\bINV-?\d{3,}\b/i)?.[0];
    return [{ name: "invoice_action", args: { action: "send", query: num || m } }];
  }
  if (domain !== "crm" && domain !== "trainer" && /\binvoices?\b/.test(lower)) {
    const query = m.match(/\b(Cascade|BlueRidge|Summit|Harbor|Northwind|INV-\d+)\b/i)?.[0] || "";
    return [{ name: "list_invoices", args: { query } }];
  }

  if (
    domain !== "erp" &&
    domain !== "trainer" &&
    (/\b(deal|account|contact)\b/.test(lower) ||
      /\b(cascade|blueridge|summit|harbor|northwind|dana|priya|tom)\b/.test(lower))
  ) {
    if (/\b(contact|email|phone|dana|marta|priya|tom|ellis)\b/.test(lower) && !/\bdeal\b/.test(lower) && !/\bquote\b/.test(lower)) {
      const query = m.match(/\b(Dana|Marta|Priya|Tom|Ellis|Cascade|BlueRidge|Summit|Harbor|Northwind)\b/i)?.[0] || m;
      return [{ name: "search_accounts_contacts", args: { query } }];
    }
    if (/\b(show|get|open|what's|whats|status|tell me about)\b/.test(lower) || /\bdeal\b/.test(lower)) {
      const named = m.match(/\b(Cascade|BlueRidge|Summit|Harbor|Northwind)\b/i)?.[0];
      const query =
        named ||
        m
          .replace(/^(show|get|open|what's|whats|status|tell me about)\s+/i, "")
          .replace(/\bdeal\b/gi, "")
          .trim();
      return [{ name: "get_deal", args: { query } }];
    }
    return [{ name: "search_deals", args: { query: m } }];
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
    const calls = routeDemoIntent(message, domain);
    const parts: string[] = [];
    const links: AssistantLink[] = [];
    const toolNames: string[] = [];
    for (const call of calls) {
      toolNames.push(call.name);
      const result = await runTool(call.name, call.args, ctx);
      parts.push(result.text);
      links.push(...(result.links ?? []));
    }
    const uniq = links.filter((l, i, arr) => arr.findIndex((x) => x.href === l.href) === i);
    return {
      reply: parts.join("\n\n") || "I wasn't sure — try “help”.",
      links: uniq.slice(0, 6),
      sources: sourcesForTools(toolNames),
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
You help managers and reps across CRM (pipeline, accounts, contacts), ERP (catalog, quotes, orders, invoices, inventory, finance), and sales trainer / coaching (scores, assignments, role-play).
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
    return { reply, links: uniq.slice(0, 6), sources: sourcesForTools(toolNames), mode: "llm" };
  }

  return {
    reply: "I hit a tool loop limit — try a more specific question.",
    links,
    sources: sourcesForTools(toolNames),
    mode: "llm",
  };
}
