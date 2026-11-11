import type { ProspectAttitude, ProspectInterest, ScenarioPersona } from "./types";
import { businessSizeLabel, callTypeLabel, type ObjectionFamily } from "./scenario-options";

// Deterministic scenario drafting for "Quick start" and "Build your own".
// Pure function of the inputs (plus a seed for variety) so the client can
// render an instant preview and the server can rebuild the same draft.
// Nothing here is "verified" about anyone — every persona is fictional.

export interface ScenarioDraft {
  title: string;
  callType: string;
  difficulty: string;
  persona: ScenarioPersona;
  winConditions: string[];
}

export interface BuilderInput {
  callType: string;
  difficulty: string;
  industry?: string;
  role?: string;
  businessSize?: string;
  offering?: string;
  objective?: string;
  attitude?: ProspectAttitude;
  objectionFamily?: ObjectionFamily;
  customObjection?: string;
  seed?: number;
}

const FIRST_NAMES = ["Dana", "Marcus", "Priya", "Tom", "Elena", "Jordan", "Renee", "Victor", "Aisha", "Sam", "Noor", "Caleb"];
const LAST_NAMES = ["Whitfield", "Chen", "Raman", "Alvarez", "Petrova", "Blake", "Okafor", "Lindqvist", "Moreno", "Hayes", "Kowalski", "Nakamura"];

interface IndustryPack {
  companies: string[];
  pains: string[];
  priorities: string[];
  customers: string;
}

const GENERIC: IndustryPack = {
  companies: ["Northgate Group", "Harbor & Co.", "Crestline Partners", "Bluepeak Inc.", "Summit Works", "Ironwood Holdings"],
  pains: [
    "Too much of the team's week goes to manual, repetitive admin",
    "Leadership can't get a clear picture of what's happening without asking around",
    "Growth has outpaced the processes that worked when the company was smaller",
    "Staff turnover means things get dropped during handoffs",
  ],
  priorities: ["Hitting this year's growth target", "Keeping costs flat", "Not disrupting the team mid-quarter"],
  customers: "mid-market businesses",
};

const INDUSTRY_PACKS: Record<string, IndustryPack> = {
  "Software / SaaS": {
    companies: ["Lumen Analytics", "Stackbridge", "Orbital Labs", "Kestrel Software", "Parallax HQ", "Waypoint Systems"],
    pains: [
      "Churn ticked up two quarters in a row and nobody can agree on why",
      "The sales team is spending hours a week on CRM hygiene instead of selling",
      "Engineering and go-to-market plan off different numbers",
      "Onboarding new customers takes six weeks and support carries most of it",
    ],
    priorities: ["Net revenue retention", "Shortening the sales cycle", "Shipping the roadmap without adding headcount"],
    customers: "other B2B companies",
  },
  "Professional services": {
    companies: ["Meridian Advisory", "Clearwater Consulting", "Brightline Partners", "Hollis & Grant", "Fairview Group"],
    pains: [
      "Utilization is below target and partners don't trust the timesheet data",
      "Proposals take a week to assemble from scattered past work",
      "Client reporting is a monthly scramble",
      "Senior staff spend too long on work juniors could do with better tooling",
    ],
    priorities: ["Billable utilization", "Winning larger engagements", "Reducing partner time on admin"],
    customers: "business clients who buy expertise by the hour or project",
  },
  Healthcare: {
    companies: ["Riverside Medical Group", "Cedar Valley Clinics", "Northshore Health Partners", "Pinecrest Family Care"],
    pains: [
      "No-shows and late cancellations leave gaps the schedule can't fill",
      "Front-desk staff spend most of the day on the phone chasing paperwork",
      "Compliance reviews pull clinicians away from patients",
      "Patient communication is inconsistent across locations",
    ],
    priorities: ["Patient throughput", "Staying compliant without adding staff", "Clinician retention"],
    customers: "patients and referring providers",
  },
  "Financial services": {
    companies: ["Granite Peak Wealth", "Harborview Credit Union", "Atlas Capital Advisors", "Lakeshore Lending"],
    pains: [
      "Onboarding a new client involves four systems and a lot of rekeying",
      "Compliance reviews slow everything down and still miss things",
      "Advisors can't see a client's full picture in one place",
      "Reporting to regulators eats the first week of every quarter",
    ],
    priorities: ["Assets under management growth", "Audit readiness", "Advisor productivity"],
    customers: "individuals and small businesses",
  },
  Manufacturing: {
    companies: ["Ironbridge Fabrication", "Summit Precision", "Northfield Industries", "Keystone Components"],
    pains: [
      "Unplanned downtime on two lines last quarter cost more than the whole maintenance budget",
      "Inventory counts drift between the floor and the ERP",
      "Quality issues are found at the end of the line instead of where they start",
      "Hard to hire and keep skilled operators",
    ],
    priorities: ["On-time delivery", "Scrap and rework rates", "Keeping the plant staffed"],
    customers: "OEMs and distributors",
  },
  "Retail / e-commerce": {
    companies: ["Oak & Ember Home", "Trailhead Outfitters", "Brightwater Goods", "Mercer Street Market"],
    pains: [
      "Stockouts on best sellers while slow movers pile up in the back",
      "Returns are up and the process is manual end to end",
      "Can't tell which marketing spend actually drives repeat purchases",
      "Peak season staffing is a gamble every year",
    ],
    priorities: ["Margin per order", "Repeat purchase rate", "Getting through peak without breaking"],
    customers: "consumers",
  },
  "Wholesale distribution": {
    companies: ["Northgate Distribution", "Harbor Supply Co.", "Crestline Wholesale", "Bluepeak Logistics", "Ironwood Goods"],
    pains: [
      "Missed shipments from count drift between warehouses",
      "No visibility across locations until the monthly close",
      "Key accounts are threatening to consolidate suppliers",
      "Pricing exceptions are handled by email and nobody tracks them",
    ],
    priorities: ["Fill rate for key accounts", "Working capital tied up in inventory", "Margin leakage"],
    customers: "retailers and contractors",
  },
  "Logistics / transportation": {
    companies: ["Blue Ridge Freight", "Compass Carriers", "Harborline Logistics", "Meridian Transport"],
    pains: [
      "Dispatchers juggle three screens and a phone to keep trucks moving",
      "Detention and accessorial charges are disputed every week",
      "Driver turnover is brutal and recruiting never stops",
      "Customers want live tracking and we're still sending spreadsheets",
    ],
    priorities: ["Cost per mile", "Driver retention", "On-time percentage for the top ten customers"],
    customers: "shippers and 3PLs",
  },
  "Construction / real estate": {
    companies: ["Stonebridge Builders", "Ridgeline Development", "Keystone Property Group", "Harbor Point Realty"],
    pains: [
      "Change orders slip through and get eaten as margin",
      "Field and office are always working off different versions of the plan",
      "Subcontractor scheduling is a daily fire drill",
      "Owners want weekly updates and producing them takes a day",
    ],
    priorities: ["Finishing jobs on budget", "Winning the next two bids", "Keeping good subs busy"],
    customers: "property owners and developers",
  },
  "Hospitality / restaurants": {
    companies: ["The Copper Kettle Group", "Harborside Hospitality", "Juniper Table", "Lakeview Inns"],
    pains: [
      "Labor costs swing wildly week to week and scheduling is done on paper",
      "Food cost is up and we only find out after month end",
      "Online reviews mention slow service and we can't pin down why",
      "Turnover means we're always training someone new",
    ],
    priorities: ["Labor as a percentage of sales", "Guest ratings", "Opening the next location on time"],
    customers: "guests and event clients",
  },
  Education: {
    companies: ["Brightpath Academy", "Northstar Learning Group", "Cedar Ridge School District", "Summit Tutoring"],
    pains: [
      "Enrollment inquiries fall through the cracks between departments",
      "Teachers spend evenings on reporting that should be automatic",
      "Parent communication lives in five different tools",
      "Budget approvals take a full cycle and vendors have to wait",
    ],
    priorities: ["Enrollment numbers", "Teacher retention", "Staying inside a fixed annual budget"],
    customers: "students and families",
  },
  "Marketing / agencies": {
    companies: ["Signal & Noise", "Northlight Creative", "Fathom Digital", "Beacon Collective"],
    pains: [
      "Scope creep eats margin on almost every retainer",
      "Client reporting takes two days a month per account",
      "Pitching new business pulls senior people off billable work",
      "Freelancer costs are unpredictable",
    ],
    priorities: ["Retainer margin", "Winning two new accounts this quarter", "Keeping the best people"],
    customers: "brands and marketing teams",
  },
  Nonprofit: {
    companies: ["Riverbend Community Foundation", "Open Door Alliance", "Harbor Youth Collective", "Greenway Trust"],
    pains: [
      "Donor data is split across spreadsheets and an old database",
      "Grant reporting consumes weeks the program team doesn't have",
      "Volunteer coordination is done by text message",
      "The board wants impact metrics we don't currently capture",
    ],
    priorities: ["Donor retention", "Hitting the annual campaign goal", "Program delivery with a tiny staff"],
    customers: "donors, grant funders, and the community it serves",
  },
};

const ROLE_AUTHORITY: Record<string, string> = {
  "Owner / Founder": "Owns the decision outright, but every dollar feels personal.",
  CEO: "Final say, delegates evaluation to a direct report; cares about the headline outcome, not features.",
  CFO: "Controls budget; approves only with a clear payback and will question every assumption in the math.",
  "COO / VP of Operations": "Owns the operating budget up to a point; anything large needs the CFO.",
  "VP of Sales": "Can approve tooling for the team if it defends the number; CFO signs above the threshold.",
  "Head of Marketing": "Has a program budget; a new line item means cutting something else.",
  "IT Director / CTO": "Gatekeeper for anything technical; security and integration concerns come before price.",
  "HR Director": "Owns the people budget; needs leadership buy-in for anything company-wide.",
  "Office Manager": "Influences the decision and runs the evaluation, but the owner signs.",
  "Procurement Manager": "Owns the process and the terms, not the need; measured on savings.",
  "Practice Manager": "Runs operations day to day; the physicians or partners decide on spend.",
  "Store / Branch Manager": "Can trial locally; a rollout is a regional or corporate decision.",
};

const ROLE_PRIORITIES: Record<string, string[]> = {
  CFO: ["Cash flow and payback period", "Audit-ready numbers", "No surprises at quarter end"],
  "VP of Sales": ["Hitting the quarter", "Rep ramp time", "Pipeline visibility"],
  "Head of Marketing": ["Pipeline contribution", "Cost per lead", "Proving ROI to the CEO"],
  "IT Director / CTO": ["Security posture", "Fewer systems to maintain", "Not adding to the on-call burden"],
  "HR Director": ["Retention", "Time to hire", "Compliance"],
  "Procurement Manager": ["Documented savings", "Clean contract terms", "Vendor consolidation"],
};

const ATTITUDE_PERSONALITY: Record<ProspectAttitude, string> = {
  friendly:
    "Warm and talkative; happy to chat and shares freely once asked a real question. Can wander off-topic, and friendliness is not the same as buying — gets vague when it's time to commit.",
  neutral:
    "Even, professional, measured. Answers what's asked and nothing more. Not hostile, not eager — waiting to see whether this is worth their time.",
  skeptical:
    "Has sat through plenty of pitches that didn't pan out. Dry, a little guarded, quick to call out vague claims and wants specifics and proof before engaging seriously.",
  busy:
    "Clipped and distracted, clearly doing two things at once. Short answers, checks the time, will try to end the call unless the rep earns the next minute quickly.",
};

const ATTITUDE_INTEREST: Record<ProspectAttitude, ProspectInterest> = {
  friendly: "medium",
  neutral: "medium",
  skeptical: "low",
  busy: "low",
};

interface CallTypePack {
  situation: (p: { offering: string; company: string; role: string }) => string;
  objective: string;
  attitude: ProspectAttitude;
  interest: ProspectInterest;
  wins: string[];
  titleVerb: string;
}

const CALL_TYPE_PACKS: Record<string, CallTypePack> = {
  cold_call: {
    situation: ({ company }) =>
      `An unscheduled outbound call. ${company} has never heard from the rep before and the prospect picked up expecting someone else.`,
    objective: "Earn thirty seconds, uncover one relevant problem, and book a follow-up meeting",
    attitude: "busy",
    interest: "low",
    wins: [
      "Open with a relevant reason for the call and ask permission to continue",
      "Surface at least one real pain point with a discovery question",
      "Book a specific follow-up with a day and time",
    ],
    titleVerb: "Cold call",
  },
  discovery: {
    situation: () =>
      `A scheduled 30-minute discovery call. The prospect agreed to it after a short email exchange and has done no research on the rep's company.`,
    objective: "Uncover their top two pain points and agree the next step",
    attitude: "neutral",
    interest: "medium",
    wins: [
      "Set an agenda and confirm the time available",
      "Surface at least two pain points and quantify the cost of one of them",
      "Confirm who else is involved in the decision",
      "Agree a concrete next step with a date",
    ],
    titleVerb: "Discovery",
  },
  demo: {
    situation: ({ company, offering }) =>
      `A scheduled product demo. A discovery call already happened; the prospect wants to see ${offering || "the product"} against their own situation at ${company}, not a tour of every feature.`,
    objective: "Tie the demo to their stated problems and get agreement to a proposal or pilot",
    attitude: "neutral",
    interest: "medium",
    wins: [
      "Recap their priorities before showing anything",
      "Connect each capability shown to a problem they raised",
      "Handle the main objection without getting defensive",
      "Agree the path to a decision (proposal, pilot, or next meeting with the decision maker)",
    ],
    titleVerb: "Demo",
  },
  follow_up: {
    situation: ({ company }) =>
      `A follow-up call. The rep sent a proposal to ${company} ten days ago and heard nothing back; the prospect finally picked up.`,
    objective: "Find out what's really blocking the deal and re-establish momentum",
    attitude: "busy",
    interest: "medium",
    wins: [
      "Ask what has changed since the last conversation instead of re-pitching",
      "Surface the real reason for the silence",
      "Agree a specific next action with a date",
    ],
    titleVerb: "Follow-up",
  },
  objection_handling: {
    situation: ({ company }) =>
      `A second conversation. ${company} is interested in principle, but the prospect has a list of concerns and opens with the biggest one.`,
    objective: "Resolve their main concern credibly and keep the evaluation moving",
    attitude: "skeptical",
    interest: "medium",
    wins: [
      "Acknowledge and clarify the objection before answering it",
      "Answer with specifics (evidence, examples, numbers) rather than reassurance",
      "Check whether the concern is actually resolved",
      "Secure agreement to a next step",
    ],
    titleVerb: "Objection handling",
  },
  negotiation: {
    situation: ({ company }) =>
      `A pricing conversation. ${company} wants to buy but the prospect has been told to get a better deal and has a competitor's quote in hand.`,
    objective: "Hold the price (or trade concessions for value) and agree terms",
    attitude: "neutral",
    interest: "high",
    wins: [
      "Re-anchor on the value and cost of the problem before discussing discounts",
      "Trade any concession for something (term length, timing, references, scope)",
      "Avoid giving away a discount without a reason",
      "Agree concrete terms and a signature timeline",
    ],
    titleVerb: "Negotiation",
  },
  closing: {
    situation: ({ company }) =>
      `The closing call. ${company} has seen the demo and the proposal; the prospect says they are "leaning yes" but keeps finding reasons to wait.`,
    objective: "Get a verbal commitment and a dated plan to sign",
    attitude: "friendly",
    interest: "high",
    wins: [
      "Summarize what was agreed and confirm nothing has changed",
      "Surface the real hesitation behind the delay",
      "Ask for the business directly",
      "Agree a signature date and the steps to get there",
    ],
    titleVerb: "Closing",
  },
  renewal: {
    situation: ({ company }) =>
      `An annual renewal conversation with an existing customer. ${company} has used the product for a year with mixed results and the contract is up in six weeks.`,
    objective: "Secure the renewal and open the door to an expansion",
    attitude: "neutral",
    interest: "medium",
    wins: [
      "Review the outcomes achieved this year in their terms",
      "Surface and address any dissatisfaction honestly",
      "Confirm the renewal and introduce one relevant expansion",
    ],
    titleVerb: "Renewal",
  },
};

function objectionFor(family: ObjectionFamily | undefined, ctx: { offering: string; industry: string; role: string; custom?: string }): string {
  const thing = ctx.offering ? "this" : "something like this";
  switch (family) {
    case "custom":
      return ctx.custom?.trim() || "I'm just not convinced we need this right now.";
    case "budget":
      return `Honestly, there's no budget for ${thing} this year. We'd have to cut something else to pay for it.`;
    case "timing":
      return "This isn't a priority this quarter. Call me back in six months and maybe we'll talk.";
    case "incumbent":
      return "We already have a provider for this. Switching would be a huge hassle for not much gain.";
    case "authority":
      return "I'm not the one who makes this call. You'd need to convince my boss, and I'm not sure it's worth their time.";
    case "trust":
      return "I've never heard of you. The last vendor who promised this kind of result didn't deliver, so why would you be different?";
    case "priorities":
      return "We've got bigger fires to put out right now. This is on the list, but it's nowhere near the top.";
    case "auto":
    default:
      return "";
  }
}

const AUTO_OBJECTIONS_BY_CALL_TYPE: Record<string, string[]> = {
  cold_call: ["I'm in the middle of something — can you just send me an email?", "We're fine with how we handle that today."],
  discovery: ["We've looked at things like this before and it never stuck.", "I'd need to understand a lot more before involving anyone else."],
  demo: ["That looks like a lot of change for my team to absorb.", "How is this different from what we already have?"],
  follow_up: ["Honestly, it fell off the radar — other things came up.", "The price in the proposal was higher than I expected."],
  objection_handling: ["Our current setup isn't perfect, but it works and people know it.", "Your reference customers aren't in our industry."],
  negotiation: ["Your competitor quoted twenty percent less for roughly the same thing.", "I can't go back to my boss with this number."],
  closing: ["I just want to run it past one more person before we commit.", "Can we start next quarter instead? Things are hectic."],
  renewal: ["Adoption was lower than we hoped — I'm not sure we got our money's worth.", "We're being asked to cut vendor spend across the board."],
};

function pick<T>(arr: readonly T[], seed: number, offset = 0): T {
  return arr[(Math.abs(seed) + offset) % arr.length];
}

export function buildScenarioDraft(input: BuilderInput): ScenarioDraft {
  const seed = input.seed ?? 0;
  const callType = CALL_TYPE_PACKS[input.callType] ? input.callType : "discovery";
  const ct = CALL_TYPE_PACKS[callType];
  const industry = (input.industry ?? "").trim();
  const pack = INDUSTRY_PACKS[industry] ?? GENERIC;
  const role = (input.role ?? "").trim() || pick(["COO / VP of Operations", "Owner / Founder", "Head of Marketing", "CFO"], seed);
  const company = pick(pack.companies, seed);
  const name = `${pick(FIRST_NAMES, seed)} ${pick(LAST_NAMES, seed, 5)}`;
  const offering = (input.offering ?? "").trim();
  const attitude = input.attitude ?? ct.attitude;
  const difficulty = ["easy", "medium", "hard"].includes(input.difficulty) ? input.difficulty : "medium";
  const businessSize = input.businessSize ? businessSizeLabel(input.businessSize) : "";
  const objective = (input.objective ?? "").trim() || ct.objective;

  const chosen = objectionFor(input.objectionFamily, { offering, industry, role, custom: input.customObjection });
  const autos = AUTO_OBJECTIONS_BY_CALL_TYPE[callType] ?? [];
  const objections = [chosen, ...autos].filter(Boolean);
  // Beginners get one objection; advanced prospects stack them.
  const objectionCount = difficulty === "easy" ? 1 : difficulty === "hard" ? 3 : 2;
  const finalObjections = objections.slice(0, objectionCount);

  const pains = [pick(pack.pains, seed), pick(pack.pains, seed, 1), pick(pack.pains, seed, 2)].filter((p, i, a) => a.indexOf(p) === i);
  const priorities = ROLE_PRIORITIES[role] ?? pack.priorities;

  let interest: ProspectInterest = input.attitude ? ATTITUDE_INTEREST[attitude] : ct.interest;
  if (difficulty === "hard" && interest === "high") interest = "medium";
  if (difficulty === "easy" && interest === "low") interest = "medium";

  const budget =
    difficulty === "hard"
      ? "Guarded. Will not discuss numbers until the problem is quantified, and says so."
      : difficulty === "easy"
        ? "Has a realistic budget in mind and will share a range if asked directly."
        : "Has some flexibility but needs a business case before committing to a number.";

  const industryLabel = industry || "their industry";
  const title = `${ct.titleVerb}: ${role}${industry ? ` in ${industry.toLowerCase()}` : ""}`;

  const persona: ScenarioPersona = {
    name,
    title: role,
    company,
    industry: industryLabel,
    personality: ATTITUDE_PERSONALITY[attitude],
    painPoints: pains,
    objections: finalObjections,
    budget,
    notes: [
      businessSize ? `${company} is a ${businessSize.toLowerCase()} business serving ${pack.customers}.` : `${company} serves ${pack.customers}.`,
      ROLE_AUTHORITY[role] ?? "",
    ]
      .filter(Boolean)
      .join(" "),
    attitude,
    interest,
    priorities,
    businessSize,
    authority: ROLE_AUTHORITY[role] ?? "Influences the decision; final sign-off sits with someone more senior.",
    offering,
    objective,
    situation: ct.situation({ offering, company, role }),
  };

  return { title, callType, difficulty, persona, winConditions: ct.wins };
}

// Ready-made starting points for "Quick start". Each is a BuilderInput with
// an industry left open so the user can optionally pick one.
export const QUICK_START_TEMPLATES: { key: string; callType: string; label: string; blurb: string; preset: Partial<BuilderInput> }[] = [
  { key: "cold_call", callType: "cold_call", label: "Cold call", blurb: "Break through with a busy stranger and earn a meeting.", preset: { attitude: "busy", objectionFamily: "timing" } },
  { key: "discovery", callType: "discovery", label: "Discovery call", blurb: "Ask the questions that surface real pain.", preset: { attitude: "neutral", objectionFamily: "auto" } },
  { key: "demo", callType: "demo", label: "Product demo", blurb: "Show value, not features, and keep the deal moving.", preset: { attitude: "neutral", objectionFamily: "incumbent" } },
  { key: "follow_up", callType: "follow_up", label: "Follow-up call", blurb: "Revive a deal that went quiet after the proposal.", preset: { attitude: "busy", objectionFamily: "priorities" } },
  { key: "objection_handling", callType: "objection_handling", label: "Handling objections", blurb: "Work through doubt with evidence instead of reassurance.", preset: { attitude: "skeptical", objectionFamily: "trust" } },
  { key: "negotiation", callType: "negotiation", label: "Pricing & negotiation", blurb: "Hold your price under pressure and trade, don't give.", preset: { attitude: "neutral", objectionFamily: "budget" } },
  { key: "closing", callType: "closing", label: "Closing the sale", blurb: "Turn \"leaning yes\" into a signed commitment.", preset: { attitude: "friendly", objectionFamily: "authority" } },
  { key: "renewal", callType: "renewal", label: "Renewal or upsell", blurb: "Keep a lukewarm customer and grow the account.", preset: { attitude: "neutral", objectionFamily: "budget" } },
];

export function describeCallType(callType: string): string {
  return callTypeLabel(callType);
}
