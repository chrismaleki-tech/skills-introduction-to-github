// Shared vocabulary for scenarios: the fixed option lists the builder, the
// API validators, the prompts and the UI all agree on. Pure data — safe to
// import from client and server code.

export const CALL_TYPES = [
  { value: "cold_call", label: "Cold call", blurb: "First contact. The prospect isn't expecting you." },
  { value: "discovery", label: "Discovery call", blurb: "A booked first conversation to understand their situation." },
  { value: "demo", label: "Product demo", blurb: "Walk through your product against their needs." },
  { value: "follow_up", label: "Follow-up call", blurb: "Re-engage after a demo, proposal, or silence." },
  { value: "objection_handling", label: "Handling objections", blurb: "They have concerns. Work through them." },
  { value: "negotiation", label: "Pricing & negotiation", blurb: "Terms, discounts, and procurement pressure." },
  { value: "closing", label: "Closing the sale", blurb: "Get the commitment and a signature path." },
  { value: "renewal", label: "Renewal or upsell", blurb: "An existing customer deciding whether to stay or grow." },
] as const;

export type CallType = (typeof CALL_TYPES)[number]["value"];
export const CALL_TYPE_VALUES = CALL_TYPES.map((c) => c.value) as string[];

export function callTypeLabel(value: string): string {
  return CALL_TYPES.find((c) => c.value === value)?.label ?? value.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
}

export const DIFFICULTIES = [
  { value: "easy", label: "Beginner", blurb: "Open and forgiving. One objection; good answers land." },
  { value: "medium", label: "Intermediate", blurb: "Realistic. Mildly skeptical; you have to earn the details." },
  { value: "hard", label: "Advanced", blurb: "Tough. Time-pressed, pushes back, and only strong calls get a next step." },
] as const;
export const DIFFICULTY_VALUES = DIFFICULTIES.map((d) => d.value) as string[];
export function difficultyLabel(value: string): string {
  return DIFFICULTIES.find((d) => d.value === value)?.label ?? value;
}

export const ATTITUDES = [
  { value: "friendly", label: "Friendly", blurb: "Warm, chatty, open to hearing you out." },
  { value: "neutral", label: "Neutral", blurb: "Professional and even. Answers what's asked." },
  { value: "skeptical", label: "Skeptical", blurb: "Has been burned before. Wants proof." },
  { value: "busy", label: "Busy", blurb: "Short on time. Get to the point or lose them." },
] as const;
export const ATTITUDE_VALUES = ATTITUDES.map((a) => a.value) as string[];

export const INTEREST_LEVELS = [
  { value: "low", label: "Low — not looking" },
  { value: "medium", label: "Medium — open if it's worth it" },
  { value: "high", label: "High — actively evaluating" },
] as const;

export const INDUSTRIES = [
  "Software / SaaS",
  "Professional services",
  "Healthcare",
  "Financial services",
  "Manufacturing",
  "Retail / e-commerce",
  "Wholesale distribution",
  "Logistics / transportation",
  "Construction / real estate",
  "Hospitality / restaurants",
  "Education",
  "Marketing / agencies",
  "Nonprofit",
] as const;

export const PROSPECT_ROLES = [
  "Owner / Founder",
  "CEO",
  "CFO",
  "COO / VP of Operations",
  "VP of Sales",
  "Head of Marketing",
  "IT Director / CTO",
  "HR Director",
  "Office Manager",
  "Procurement Manager",
  "Practice Manager",
  "Store / Branch Manager",
] as const;

export const BUSINESS_SIZES = [
  { value: "solo", label: "Solo / 1-10 people" },
  { value: "small", label: "Small — 10-50 people" },
  { value: "mid", label: "Mid-size — 50-500 people" },
  { value: "enterprise", label: "Enterprise — 500+ people" },
] as const;
export function businessSizeLabel(value: string): string {
  return BUSINESS_SIZES.find((b) => b.value === value)?.label ?? value;
}

export const OBJECTIVES = [
  "Book a follow-up meeting",
  "Uncover their top two pain points",
  "Get agreement to a demo with the decision maker",
  "Get a verbal commitment to move forward",
  "Hold price and agree next steps",
  "Secure the renewal",
  "Expand to an additional team or product",
  "Resolve their main concern and re-engage",
] as const;

export const OBJECTION_FAMILIES = [
  { value: "auto", label: "Automatic — fit the scenario" },
  { value: "budget", label: "Budget — \"We don't have money for this.\"" },
  { value: "timing", label: "Timing — \"Not a priority this quarter.\"" },
  { value: "incumbent", label: "Existing provider — \"We already use someone.\"" },
  { value: "authority", label: "Authority — \"I'm not the one who decides.\"" },
  { value: "trust", label: "Trust — \"Never heard of you. Why should I believe that?\"" },
  { value: "priorities", label: "Competing priorities — \"We've got bigger fires.\"" },
  { value: "custom", label: "Write my own…" },
] as const;
export type ObjectionFamily = (typeof OBJECTION_FAMILIES)[number]["value"];

// OpenAI Realtime voices. marin and cedar are the newest, most natural
// conversational voices for gpt-realtime; the rest remain selectable.
export const VOICES = [
  { value: "marin", label: "Marin", blurb: "Warm, natural, measured (recommended)" },
  { value: "cedar", label: "Cedar", blurb: "Relaxed, grounded, natural (recommended)" },
  { value: "alloy", label: "Alloy", blurb: "Neutral and even" },
  { value: "ash", label: "Ash", blurb: "Low, calm, deliberate" },
  { value: "ballad", label: "Ballad", blurb: "Soft and expressive" },
  { value: "coral", label: "Coral", blurb: "Bright and upbeat" },
  { value: "echo", label: "Echo", blurb: "Clear and direct" },
  { value: "sage", label: "Sage", blurb: "Composed and thoughtful" },
  { value: "shimmer", label: "Shimmer", blurb: "Light and energetic" },
  { value: "verse", label: "Verse", blurb: "Conversational, quick" },
] as const;
export const VOICE_VALUES = VOICES.map((v) => v.value) as string[];
