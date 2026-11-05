// Typed payloads for JSON-string columns (SQLite has no native Json type).
// Every JSON column in prisma/schema.prisma has a type + parse helper here.

// ---------- Rubrics / methodologies ----------

export interface RubricLevel {
  score: number; // 1..5
  description: string;
}

export interface RubricDimension {
  key: string; // stable identifier, e.g. "discovery"
  name: string;
  description: string;
  weight: number; // relative weight in the 0-100 rollup
  levels: RubricLevel[];
  companySpecific?: boolean; // added by the customer, not part of the preset
}

// ---------- Company context ----------

export interface CompanyProduct {
  name: string;
  description: string;
  differentiators: string[];
  idealFor: string;
}

export interface BuyerPersona {
  title: string;
  industry: string;
  painPoints: string[];
  notes: string;
}

export interface ObjectionEntry {
  objection: string;
  approvedResponse: string;
}

export interface CompetitorEntry {
  name: string;
  positioning: string; // how we win against them
}

export interface CompanyProfile {
  description: string;
  valueProps: string[];
  products: CompanyProduct[];
  personas: BuyerPersona[];
  objections: ObjectionEntry[];
  competitors: CompetitorEntry[];
  talkTracks: string[];
  pricingNotes: string;
}

export const EMPTY_COMPANY_PROFILE: CompanyProfile = {
  description: "",
  valueProps: [],
  products: [],
  personas: [],
  objections: [],
  competitors: [],
  talkTracks: [],
  pricingNotes: "",
};

// ---------- Ingestion / sampling policy ----------

export interface IngestionPolicy {
  minDurationSec: number; // calls shorter than this are skipped entirely
  sampleThreshold: number; // grade everything up to this many eligible calls/rep/month
  sampleSize: number; // random sample size per rep per month beyond threshold
  gradeManualUploads: boolean; // manual uploads bypass sampling
}

export const DEFAULT_INGESTION_POLICY: IngestionPolicy = {
  minDurationSec: 60,
  sampleThreshold: 10,
  sampleSize: 10,
  gradeManualUploads: true,
};

// ---------- Transcripts ----------

export interface TranscriptSegment {
  speaker: "rep" | "prospect";
  startSec: number;
  endSec: number;
  text: string;
}

// ---------- Grades ----------

export interface QuoteRef {
  atSec: number;
  text: string;
}

export interface DimensionScore {
  key: string;
  name: string;
  score: number; // 1..5
  weight: number;
  rationale: string;
  quotes: QuoteRef[];
}

export interface Mechanics {
  talkRatio: number; // fraction of words spoken by the rep, 0..1
  questionCount: number; // questions asked by the rep
  longestMonologueSec: number; // longest uninterrupted rep stretch
  fillerWords: number;
  interruptions: number; // times the rep started before the prospect finished
}

export interface GradeResult {
  dimensionScores: DimensionScore[];
  overallScore: number; // 0..100
  band: ScoreBand;
  strengths: string[];
  improvements: string[];
  summary: string;
  mechanics: Mechanics;
  gradedBy: string;
}

export type ScoreBand = "exceptional" | "strong" | "developing" | "needs_coaching";

// ---------- Scenarios / role-play ----------

export interface ScenarioPersona {
  name: string;
  title: string;
  company: string;
  industry: string;
  personality: string; // e.g. "skeptical, time-pressed, data-driven"
  painPoints: string[];
  objections: string[]; // objections this persona will raise
  budget: string;
  notes: string;
}

export interface RoleplayMessage {
  role: "rep" | "prospect";
  text: string;
  atMs: number; // ms since session start
}

// ---------- Parse helpers ----------

function parse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export const parseDimensions = (j: string) => parse<RubricDimension[]>(j, []);
export const parseCompanyProfile = (j: string) =>
  ({ ...EMPTY_COMPANY_PROFILE, ...parse<Partial<CompanyProfile>>(j, {}) }) as CompanyProfile;
export const parseIngestionPolicy = (j: string) =>
  ({ ...DEFAULT_INGESTION_POLICY, ...parse<Partial<IngestionPolicy>>(j, {}) }) as IngestionPolicy;
export const parseSegments = (j: string) => parse<TranscriptSegment[]>(j, []);
export const parseDimensionScores = (j: string) => parse<DimensionScore[]>(j, []);
export const parseStringArray = (j: string) => parse<string[]>(j, []);
export const parseMechanics = (j: string) =>
  parse<Mechanics>(j, {
    talkRatio: 0,
    questionCount: 0,
    longestMonologueSec: 0,
    fillerWords: 0,
    interruptions: 0,
  });
export const parsePersona = (j: string) =>
  parse<ScenarioPersona>(j, {
    name: "",
    title: "",
    company: "",
    industry: "",
    personality: "",
    painPoints: [],
    objections: [],
    budget: "",
    notes: "",
  });
export const parseMessages = (j: string) => parse<RoleplayMessage[]>(j, []);
