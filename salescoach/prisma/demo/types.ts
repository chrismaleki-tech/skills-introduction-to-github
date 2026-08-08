/**
 * Customer demo tenant specification.
 *
 * A DemoTenantSpec is pure data: everything industry-specific about a demo
 * tenant (company context, people, transcripts, CRM book, ERP catalog) lives
 * here, while prisma/demo/seed-demo-tenant.ts turns a spec into a fully
 * populated org through the SAME production code paths the app uses
 * (ingestion pipeline, grading, role-play grading, channels, quote→cash).
 */

import type { CompanyProfile, ScenarioPersona, RubricDimension } from "../../src/lib/types";

export type DemoRole = "MANAGER" | "TRAINER" | "ADMIN" | "REP";

export interface DemoUserSpec {
  name: string;
  /** Full email, e.g. "maya@threadloom.demo". All demo users share password123. */
  email: string;
  role: DemoRole;
  title: string;
  /** High-volume reps get ~28 calls (sampling kicks in); default ~8. */
  highVolume?: boolean;
}

export interface DemoRubricSpec {
  /** Must match a METHODOLOGY_PRESETS name, e.g. "Discovery Call Fundamentals". */
  presetName: string;
  name: string;
  description: string;
  /** Industry-specific dimensions appended to the preset's. */
  customDimensions?: RubricDimension[];
}

export interface DemoScenarioSpec {
  title: string;
  callType: string; // e.g. cold_call | discovery | demo | negotiation
  difficulty: "easy" | "medium" | "hard";
  persona: ScenarioPersona;
  winConditions: string[];
}

/** Four quality tiers rotated across seeded calls + follow-up transcripts. */
export interface DemoTranscripts {
  /** Excellent call: discovery, quantified pain, objection handled, concrete next step. */
  good: string;
  /** Mediocre: feature-dumping, weak discovery, soft close. */
  mid: string;
  /** Poor: unprepared, no discovery, prospect disengages. Keep duration-plausible (~90s). */
  poor: string;
  /** Strong later-stage demo/negotiation call referencing earlier discovery. */
  demo: string;
  /** 2+ distinct extra transcripts used for manual uploads and rep-flagged calls. */
  followups: string[];
}

export interface DemoAccountSpec {
  /** Local ref used by contacts/deals/quotes to point here. */
  ref: string;
  ownerEmail: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  website?: string;
  notes?: string;
}

export interface DemoContactSpec {
  ref: string;
  accountRef: string;
  ownerEmail: string;
  name: string;
  title: string;
  email: string;
  phone: string;
}

export interface DemoDealSpec {
  ref: string;
  accountRef?: string;
  contactRef?: string;
  ownerEmail: string;
  name: string;
  /** lead | qualified | discovery | demo | proposal | negotiation | closed_won | closed_lost */
  stage: string;
  amount: number;
  product: string;
  probability: number;
  nextStep?: string;
  /** Days from now (negative = past, for closed deals). */
  closeInDays?: number;
  notes?: string;
  /** Body of the "Deal created" timeline note. */
  createdNote?: string;
  /** Link the owner's two most recent graded calls to this deal (writes coaching back to CRM). */
  linkRecentCalls?: boolean;
}

export interface DemoProductSpec {
  sku: string;
  name: string;
  description: string;
  category: string;
  listPrice: number;
  cost: number;
  unit: string;
  trackInventory?: boolean;
  reorderPoint?: number;
  /** Initial on-hand quantity placed in the tenant warehouse (requires trackInventory). */
  initialStock?: number;
}

export interface DemoQuoteLineSpec {
  sku: string;
  description?: string;
  quantity: number;
  /** Defaults to the product's listPrice. */
  unitPrice?: number;
}

export interface DemoQuoteSpec {
  dealRef: string;
  ownerEmail: string;
  title: string;
  notes?: string;
  lines: DemoQuoteLineSpec[];
  /** draft → nothing else; sent → sendQuote; accepted → full quote→order→invoice→50% payment path. */
  status: "draft" | "sent" | "accepted";
  validInDays?: number;
}

export interface DemoOutreachEmailSpec {
  fromEmail: string;
  contactRef: string;
  dealRef?: string;
  subject: string;
  body: string;
}

export interface DemoOutreachCallSpec {
  fromEmail: string;
  contactRef: string;
  dealRef?: string;
  notes: string;
  durationSec: number;
  callType: string;
}

export interface DemoAssignmentSpec {
  repEmail: string;
  /** Title of one of the spec's scenarios (for ROLEPLAY) — omit for UPLOAD. */
  scenarioTitle?: string;
  type: "ROLEPLAY" | "UPLOAD";
  targetCount: number;
  doneCount?: number;
  note: string;
  dueInDays: number;
}

export interface DemoWarehouseSpec {
  code: string;
  name: string;
  address: string;
}

export interface DemoTenantSpec {
  orgName: string;
  company: CompanyProfile;
  rubric: DemoRubricSpec;
  users: DemoUserSpec[];
  scenarios: DemoScenarioSpec[];
  transcripts: DemoTranscripts;
  /** Prospect/company names rotated across seeded call history (4+). */
  prospectNames: string[];
  /** Rep/prospect text role-play dialogues: one strong, one weak. Each entry is [repLine, prospectLine]. */
  roleplayDialogues: { good: [string, string][]; poor: [string, string][] };
  accounts: DemoAccountSpec[];
  contacts: DemoContactSpec[];
  deals: DemoDealSpec[];
  products: DemoProductSpec[];
  warehouse?: DemoWarehouseSpec;
  quotes: DemoQuoteSpec[];
  outreachEmails: DemoOutreachEmailSpec[];
  outreachCalls: DemoOutreachCallSpec[];
  assignments: DemoAssignmentSpec[];
}
