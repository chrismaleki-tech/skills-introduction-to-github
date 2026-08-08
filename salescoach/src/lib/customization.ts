/**
 * Per-tenant platform customization, stored as JSON on Org.customizationJson.
 * Editable by the customer in their Back Office and by vendor staff from the
 * platform console, so each customer's workspace can be shaped to their needs:
 * branding, which product modules are on, and where people land after login.
 *
 * Pure parsing/validation lives here (unit-tested); the session-aware route
 * guard lives in module-guard.ts.
 */

import {
  INDUSTRY_IDS,
  resolveIndustry,
  sanitizeFieldDefs,
  type FieldDef,
  type IndustryConfig,
  type Terminology,
} from "./industry";

export type ModuleId = "ask" | "crm" | "erp" | "conversations" | "calls" | "roleplay" | "coaching";

export const MODULES: { id: ModuleId; label: string; blurb: string }[] = [
  { id: "ask", label: "Ask assistant", blurb: "Natural-language assistant: floating chat and the /ask workspace." },
  { id: "crm", label: "CRM", blurb: "Pipeline, accounts, and contacts." },
  { id: "erp", label: "ERP", blurb: "Quotes, orders, invoices, inventory, purchasing, finance." },
  { id: "conversations", label: "Conversations & channels", blurb: "Email/phone inbox and channel connections." },
  { id: "calls", label: "Call recordings", blurb: "Uploaded and webhook-ingested call log." },
  { id: "roleplay", label: "Role-play & scenarios", blurb: "AI practice calls and the scenario library." },
  { id: "coaching", label: "Coaching & assignments", blurb: "Assignments, calibration, and rubrics." },
];

export const MODULE_IDS = MODULES.map((m) => m.id);

/** App route prefixes owned by each module (used by the route guard + nav). */
export const MODULE_ROUTES: Record<ModuleId, string[]> = {
  ask: ["/ask"],
  crm: ["/crm"],
  erp: ["/erp"],
  conversations: ["/conversations", "/channels"],
  calls: ["/calls"],
  roleplay: ["/roleplay", "/scenarios"],
  coaching: ["/assignments", "/calibration", "/rubrics"],
};

export function moduleForPath(pathname: string): ModuleId | null {
  for (const [module, prefixes] of Object.entries(MODULE_ROUTES) as [ModuleId, string[]][]) {
    if (prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))) return module;
  }
  return null;
}

/** Start pages an org can pick; "default" keeps role-based routing. */
export const START_PAGES: { value: string; label: string; module: ModuleId | null }[] = [
  { value: "default", label: "Role-based (managers → dashboard, reps → performance)", module: null },
  { value: "/ask", label: "Ask assistant", module: "ask" },
  { value: "/crm", label: "CRM pipeline", module: "crm" },
  { value: "/conversations", label: "Conversations inbox", module: "conversations" },
  { value: "/me", label: "My performance", module: null },
];

export type Customization = {
  /** Sidebar/mobile brand. Empty = product default ("SalesCoach AI"). */
  brandName: string;
  /** Hex accent color (#rgb or #rrggbb). Empty = default theme. */
  accentColor: string;
  /** Where "/" lands. One of START_PAGES values. */
  startPage: string;
  /** Module toggles; missing keys default to enabled. */
  modules: Record<ModuleId, boolean>;
  /** Industry pack id (see INDUSTRY_PACKS in industry.ts). */
  industry: string;
  /** Owner overrides for the pack's CRM terminology. */
  terminology: Partial<Terminology>;
  /** Owner-added custom fields, merged over the pack's. */
  customDealFields: FieldDef[];
  customAccountFields: FieldDef[];
};

export const DEFAULT_CUSTOMIZATION: Customization = {
  brandName: "",
  accentColor: "",
  startPage: "default",
  modules: { ask: true, crm: true, erp: true, conversations: true, calls: true, roleplay: true, coaching: true },
  industry: "generic",
  terminology: {},
  customDealFields: [],
  customAccountFields: [],
};

export function isValidAccentColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

/** Parse the stored JSON, tolerating missing/partial/garbage values. */
export function parseCustomization(json: string | null | undefined): Customization {
  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(json || "{}");
    if (parsed && typeof parsed === "object") raw = parsed as Record<string, unknown>;
  } catch {
    // fall through to defaults
  }

  const modules = { ...DEFAULT_CUSTOMIZATION.modules };
  if (raw.modules && typeof raw.modules === "object") {
    for (const id of MODULE_IDS) {
      const v = (raw.modules as Record<string, unknown>)[id];
      if (typeof v === "boolean") modules[id] = v;
    }
  }

  const brandName = typeof raw.brandName === "string" ? raw.brandName.slice(0, 60).trim() : "";
  const accentColor =
    typeof raw.accentColor === "string" && isValidAccentColor(raw.accentColor) ? raw.accentColor : "";
  const startPage =
    typeof raw.startPage === "string" && START_PAGES.some((p) => p.value === raw.startPage)
      ? raw.startPage
      : "default";

  const industry =
    typeof raw.industry === "string" && INDUSTRY_IDS.includes(raw.industry) ? raw.industry : "generic";
  const terminology: Partial<Terminology> = {};
  if (raw.terminology && typeof raw.terminology === "object") {
    for (const [k, v] of Object.entries(raw.terminology as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) terminology[k as keyof Terminology] = v.trim().slice(0, 30);
    }
  }
  const dealFields = sanitizeFieldDefs(raw.customDealFields);
  const accountFields = sanitizeFieldDefs(raw.customAccountFields);

  return {
    brandName,
    accentColor,
    startPage,
    modules,
    industry,
    terminology,
    customDealFields: dealFields.ok ? dealFields.fields : [],
    customAccountFields: accountFields.ok ? accountFields.fields : [],
  };
}

/** The org's resolved CRM shape (pack + owner tweaks). */
export function industryConfigOf(customization: Customization): IndustryConfig {
  return resolveIndustry(customization);
}

/**
 * Validate a client-submitted customization payload. Returns the normalized
 * value or a human error. Guards against turning off every module.
 */
export function normalizeCustomization(input: unknown): { ok: true; value: Customization } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid payload." };
  const raw = input as Record<string, unknown>;

  if (raw.accentColor != null && raw.accentColor !== "" && !isValidAccentColor(String(raw.accentColor))) {
    return { ok: false, error: "Accent color must be a hex value like #6366f1." };
  }
  if (raw.startPage != null && !START_PAGES.some((p) => p.value === raw.startPage)) {
    return { ok: false, error: "Unknown start page." };
  }
  if (raw.industry != null && !INDUSTRY_IDS.includes(String(raw.industry))) {
    return { ok: false, error: `Unknown industry pack. Use: ${INDUSTRY_IDS.join(", ")}.` };
  }
  const dealFieldCheck = sanitizeFieldDefs(raw.customDealFields);
  if (!dealFieldCheck.ok) return { ok: false, error: `Deal fields: ${dealFieldCheck.error}` };
  const accountFieldCheck = sanitizeFieldDefs(raw.customAccountFields);
  if (!accountFieldCheck.ok) return { ok: false, error: `Account fields: ${accountFieldCheck.error}` };

  const value = parseCustomization(JSON.stringify(raw));
  if (MODULE_IDS.every((id) => !value.modules[id])) {
    return { ok: false, error: "At least one module must stay enabled." };
  }
  const startModule = START_PAGES.find((p) => p.value === value.startPage)?.module;
  if (startModule && !value.modules[startModule]) {
    return { ok: false, error: "The chosen start page belongs to a disabled module." };
  }
  return { ok: true, value };
}

/** Slightly lighter variant of a hex color, for hover states. */
export function lightenHex(hex: string, amount = 0.25): string {
  if (!isValidAccentColor(hex)) return hex;
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const channels = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16));
  const lightened = channels.map((c) => Math.round(c + (255 - c) * amount));
  return `#${lightened.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
