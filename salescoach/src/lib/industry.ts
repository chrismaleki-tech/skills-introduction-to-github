/**
 * Industry packs: per-tenant CRM shape — terminology (what a "deal" or an
 * "account" is called), pipeline stage sets, and custom fields on deals and
 * accounts. The platform owner applies a pack (and per-tenant tweaks) from
 * the console; the tenant app renders whatever was provisioned.
 *
 * Invariant: every pack's pipeline ends with the stable keys `closed_won`
 * and `closed_lost` (labels vary — "Sold", "Bound", "Placed"), so win/loss
 * logic (ERP nudges, vendor CRM, matching, dashboards) never depends on the
 * industry. Client-safe: no DB imports.
 */

export type Terminology = {
  deal: string;
  deals: string;
  pipeline: string;
  account: string;
  accounts: string;
  contact: string;
  contacts: string;
};

export type StageDef = { key: string; label: string; probability: number };

export type FieldType = "text" | "number" | "date" | "select";
export type FieldDef = { key: string; label: string; type: FieldType; options?: string[] };

export type IndustryPack = {
  id: string;
  name: string;
  blurb: string;
  terminology: Terminology;
  stages: StageDef[];
  dealFields: FieldDef[];
  accountFields: FieldDef[];
};

const GENERIC_TERMS: Terminology = {
  deal: "Deal",
  deals: "Deals",
  pipeline: "Pipeline",
  account: "Account",
  accounts: "Accounts",
  contact: "Contact",
  contacts: "Contacts",
};

const GENERIC_STAGES: StageDef[] = [
  { key: "lead", label: "Lead", probability: 10 },
  { key: "qualified", label: "Qualified", probability: 20 },
  { key: "discovery", label: "Discovery", probability: 35 },
  { key: "demo", label: "Demo", probability: 50 },
  { key: "proposal", label: "Proposal", probability: 65 },
  { key: "negotiation", label: "Negotiation", probability: 80 },
  { key: "closed_won", label: "Closed won", probability: 100 },
  { key: "closed_lost", label: "Closed lost", probability: 0 },
];

export const INDUSTRY_PACKS: IndustryPack[] = [
  {
    id: "generic",
    name: "General B2B",
    blurb: "The default sales shape: deals, accounts, contacts, classic stages.",
    terminology: GENERIC_TERMS,
    stages: GENERIC_STAGES,
    dealFields: [],
    accountFields: [],
  },
  {
    id: "saas",
    name: "SaaS & Software",
    blurb: "Subscription sales with ARR, seats, and renewal tracking.",
    terminology: { ...GENERIC_TERMS },
    stages: [
      { key: "lead", label: "Lead", probability: 10 },
      { key: "qualified", label: "Qualified", probability: 25 },
      { key: "demo", label: "Demo", probability: 45 },
      { key: "trial", label: "Trial / POC", probability: 60 },
      { key: "proposal", label: "Proposal", probability: 75 },
      { key: "closed_won", label: "Won", probability: 100 },
      { key: "closed_lost", label: "Lost", probability: 0 },
    ],
    dealFields: [
      { key: "arr", label: "ARR ($)", type: "number" },
      { key: "seats", label: "Seats", type: "number" },
      { key: "renewal_date", label: "Renewal date", type: "date" },
      { key: "competitor", label: "Competitor", type: "text" },
    ],
    accountFields: [
      { key: "employees", label: "Employees", type: "number" },
      { key: "tech_stack", label: "Tech stack", type: "text" },
    ],
  },
  {
    id: "real_estate",
    name: "Real Estate",
    blurb: "Listings and transactions: showings, offers, escrow, closing.",
    terminology: {
      deal: "Listing",
      deals: "Listings",
      pipeline: "Transactions",
      account: "Property",
      accounts: "Properties",
      contact: "Client",
      contacts: "Clients",
    },
    stages: [
      { key: "new_lead", label: "New lead", probability: 10 },
      { key: "showing", label: "Showing", probability: 30 },
      { key: "offer", label: "Offer made", probability: 55 },
      { key: "under_contract", label: "Under contract", probability: 75 },
      { key: "escrow", label: "Inspection & escrow", probability: 90 },
      { key: "closed_won", label: "Sold", probability: 100 },
      { key: "closed_lost", label: "Fell through", probability: 0 },
    ],
    dealFields: [
      { key: "listing_price", label: "Listing price ($)", type: "number" },
      { key: "address", label: "Address", type: "text" },
      { key: "commission_pct", label: "Commission (%)", type: "number" },
      { key: "closing_date", label: "Target closing", type: "date" },
    ],
    accountFields: [
      {
        key: "property_type",
        label: "Property type",
        type: "select",
        options: ["Single family", "Condo", "Multi-family", "Commercial", "Land"],
      },
      { key: "bedrooms", label: "Bedrooms", type: "number" },
      { key: "square_feet", label: "Square feet", type: "number" },
      { key: "year_built", label: "Year built", type: "number" },
    ],
  },
  {
    id: "insurance",
    name: "Insurance",
    blurb: "Policies from inquiry through quoting and underwriting to bound.",
    terminology: {
      deal: "Policy",
      deals: "Policies",
      pipeline: "Book of business",
      account: "Household",
      accounts: "Households",
      contact: "Policyholder",
      contacts: "Policyholders",
    },
    stages: [
      { key: "inquiry", label: "Inquiry", probability: 10 },
      { key: "needs_review", label: "Needs review", probability: 30 },
      { key: "quoting", label: "Quoting", probability: 50 },
      { key: "underwriting", label: "Underwriting", probability: 75 },
      { key: "closed_won", label: "Bound", probability: 100 },
      { key: "closed_lost", label: "Declined", probability: 0 },
    ],
    dealFields: [
      { key: "premium", label: "Annual premium ($)", type: "number" },
      {
        key: "policy_type",
        label: "Policy type",
        type: "select",
        options: ["Auto", "Home", "Life", "Commercial", "Umbrella"],
      },
      { key: "carrier", label: "Carrier", type: "text" },
      { key: "effective_date", label: "Effective date", type: "date" },
    ],
    accountFields: [
      { key: "members", label: "Household members", type: "number" },
      { key: "existing_policies", label: "Existing policies", type: "number" },
    ],
  },
  {
    id: "wholesale",
    name: "Wholesale & Distribution",
    blurb: "Retailer opportunities: samples, pricing, purchase orders.",
    terminology: {
      deal: "Opportunity",
      deals: "Opportunities",
      pipeline: "Order pipeline",
      account: "Retailer",
      accounts: "Retailers",
      contact: "Buyer",
      contacts: "Buyers",
    },
    stages: [
      { key: "inbound", label: "Inbound", probability: 10 },
      { key: "sampling", label: "Samples sent", probability: 35 },
      { key: "pricing", label: "Pricing & terms", probability: 55 },
      { key: "po_pending", label: "PO pending", probability: 80 },
      { key: "closed_won", label: "PO received", probability: 100 },
      { key: "closed_lost", label: "Passed", probability: 0 },
    ],
    dealFields: [
      { key: "sku_count", label: "SKU count", type: "number" },
      { key: "monthly_volume", label: "Est. monthly volume", type: "number" },
      {
        key: "payment_terms",
        label: "Payment terms",
        type: "select",
        options: ["Net 15", "Net 30", "Net 60", "Net 90"],
      },
    ],
    accountFields: [
      { key: "store_count", label: "Store count", type: "number" },
      { key: "region", label: "Region", type: "text" },
    ],
  },
  {
    id: "recruiting",
    name: "Staffing & Recruiting",
    blurb: "Placements from role opened through interviews to hired.",
    terminology: {
      deal: "Placement",
      deals: "Placements",
      pipeline: "Placements",
      account: "Client",
      accounts: "Clients",
      contact: "Candidate",
      contacts: "Candidates",
    },
    stages: [
      { key: "role_open", label: "Role opened", probability: 10 },
      { key: "sourcing", label: "Sourcing", probability: 25 },
      { key: "interviews", label: "Interviewing", probability: 50 },
      { key: "offer", label: "Offer extended", probability: 75 },
      { key: "closed_won", label: "Placed", probability: 100 },
      { key: "closed_lost", label: "Role lost", probability: 0 },
    ],
    dealFields: [
      { key: "role_title", label: "Role title", type: "text" },
      { key: "salary", label: "Salary ($)", type: "number" },
      { key: "fee_pct", label: "Fee (%)", type: "number" },
      { key: "start_date", label: "Start date", type: "date" },
    ],
    accountFields: [
      { key: "open_roles", label: "Open roles", type: "number" },
      { key: "industry_focus", label: "Industry", type: "text" },
    ],
  },
];

export const INDUSTRY_IDS = INDUSTRY_PACKS.map((p) => p.id);

export function industryPack(id: string): IndustryPack {
  return INDUSTRY_PACKS.find((p) => p.id === id) ?? INDUSTRY_PACKS[0];
}

/** Resolved per-org CRM shape: pack + owner overrides/additions. */
export type IndustryConfig = {
  packId: string;
  packName: string;
  terms: Terminology;
  stages: StageDef[];
  dealFields: FieldDef[];
  accountFields: FieldDef[];
};

function mergeFields(base: FieldDef[], extra: FieldDef[]): FieldDef[] {
  const byKey = new Map(base.map((f) => [f.key, f] as const));
  for (const field of extra) byKey.set(field.key, field);
  return [...byKey.values()];
}

export function resolveIndustry(input: {
  industry: string;
  terminology: Partial<Terminology>;
  customDealFields: FieldDef[];
  customAccountFields: FieldDef[];
}): IndustryConfig {
  const pack = industryPack(input.industry);
  return {
    packId: pack.id,
    packName: pack.name,
    terms: { ...pack.terminology, ...stripEmpty(input.terminology) },
    stages: pack.stages,
    dealFields: mergeFields(pack.dealFields, input.customDealFields),
    accountFields: mergeFields(pack.accountFields, input.customAccountFields),
  };
}

function stripEmpty(terms: Partial<Terminology>): Partial<Terminology> {
  const out: Partial<Terminology> = {};
  for (const [k, v] of Object.entries(terms)) {
    if (typeof v === "string" && v.trim()) out[k as keyof Terminology] = v.trim();
  }
  return out;
}

// ---------- Stage helpers (org-aware; tolerate legacy/unknown keys) ----------

export function stageLabelIn(stages: StageDef[], key: string): string {
  return stages.find((s) => s.key === key)?.label ?? key.replaceAll("_", " ");
}

export function stageMetaIn(stages: StageDef[], key: string): StageDef {
  return stages.find((s) => s.key === key) ?? { key, label: key.replaceAll("_", " "), probability: 0 };
}

export function isClosedStage(key: string): boolean {
  return key === "closed_won" || key === "closed_lost";
}

export function openStagesIn(stages: StageDef[]): StageDef[] {
  return stages.filter((s) => !isClosedStage(s.key));
}

/**
 * The open stage whose probability is closest to (without exceeding) the
 * target — used by ERP to nudge deals forward ("quote sent" ≈ 65%,
 * "order pending" ≈ 80%) regardless of industry stage names.
 */
export function stageNearProbability(stages: StageDef[], target: number): StageDef {
  const open = openStagesIn(stages);
  const eligible = open.filter((s) => s.probability <= target);
  const pick = (eligible.length ? eligible : open).reduce((best, s) =>
    Math.abs(s.probability - target) < Math.abs(best.probability - target) ? s : best,
  );
  return pick;
}

// ---------- Custom field values (stored as JSON maps on Deal/Account) ----------

export type CustomValues = Record<string, string | number>;

export function parseCustomValues(json: string | null | undefined): CustomValues {
  try {
    const parsed: unknown = JSON.parse(json || "{}");
    if (!parsed || typeof parsed !== "object") return {};
    const out: CustomValues = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" || typeof v === "number") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Validate submitted values against the org's field definitions. */
export function sanitizeCustomValues(
  fields: FieldDef[],
  input: unknown,
): { ok: true; values: CustomValues } | { ok: false; error: string } {
  if (input == null) return { ok: true, values: {} };
  if (typeof input !== "object") return { ok: false, error: "custom must be an object." };
  const byKey = new Map(fields.map((f) => [f.key, f] as const));
  const values: CustomValues = {};
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    const field = byKey.get(key);
    if (!field) return { ok: false, error: `Unknown field "${key}".` };
    if (raw == null || raw === "") continue;
    if (field.type === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) return { ok: false, error: `${field.label} must be a number.` };
      values[key] = n;
    } else if (field.type === "select") {
      const v = String(raw);
      if (!field.options?.includes(v)) {
        return { ok: false, error: `${field.label} must be one of: ${field.options?.join(", ")}.` };
      }
      values[key] = v;
    } else {
      values[key] = String(raw).slice(0, 500);
    }
  }
  return { ok: true, values };
}

/** Sanitize an owner-defined extra field list (console input). */
export function sanitizeFieldDefs(input: unknown): { ok: true; fields: FieldDef[] } | { ok: false; error: string } {
  if (input == null) return { ok: true, fields: [] };
  if (!Array.isArray(input)) return { ok: false, error: "fields must be an array." };
  if (input.length > 10) return { ok: false, error: "At most 10 extra fields per object." };
  const fields: FieldDef[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid field entry." };
    const f = raw as Record<string, unknown>;
    const label = typeof f.label === "string" ? f.label.trim().slice(0, 40) : "";
    if (!label) return { ok: false, error: "Every field needs a label." };
    const type = f.type;
    if (type !== "text" && type !== "number" && type !== "date" && type !== "select") {
      return { ok: false, error: `Field "${label}": type must be text, number, date, or select.` };
    }
    const key =
      typeof f.key === "string" && f.key.trim()
        ? f.key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)
        : label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
    if (!key || seen.has(key)) return { ok: false, error: `Duplicate or invalid field key for "${label}".` };
    seen.add(key);
    let options: string[] | undefined;
    if (type === "select") {
      options = Array.isArray(f.options)
        ? f.options.map((o) => String(o).trim().slice(0, 60)).filter(Boolean).slice(0, 12)
        : [];
      if (!options.length) return { ok: false, error: `Select field "${label}" needs options.` };
    }
    fields.push({ key, label, type, ...(options ? { options } : {}) });
  }
  return { ok: true, fields };
}
