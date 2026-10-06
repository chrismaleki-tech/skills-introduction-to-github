import type { RubricDimension } from "./types";

// Methodology preset library (Phase 0). Each preset is a rubric: weighted
// dimensions with written 1..5 level descriptions. Customers clone and
// customize; grading is a pure function of whichever rubric is active.

function levels(one: string, three: string, five: string) {
  return [
    { score: 1, description: one },
    { score: 2, description: `Between: ${one} / ${three}` },
    { score: 3, description: three },
    { score: 4, description: `Between: ${three} / ${five}` },
    { score: 5, description: five },
  ];
}

export interface MethodologyPreset {
  name: string;
  description: string;
  dimensions: RubricDimension[];
}

export const METHODOLOGY_PRESETS: MethodologyPreset[] = [
  {
    name: "Discovery Call Fundamentals",
    description:
      "Methodology-neutral fundamentals for discovery and first calls. Good default for teams without a formal methodology.",
    dimensions: [
      {
        key: "opening",
        name: "Opening & rapport",
        description: "Earns attention early, sets an agenda, and establishes credibility without rambling.",
        weight: 1,
        levels: levels(
          "Generic pitch opening; no permission or agenda; prospect disengaged early.",
          "Serviceable opening with a reason for the call, but little personalization or agenda.",
          "Personalized, permission-based opening with a clear agenda the prospect agrees to.",
        ),
      },
      {
        key: "discovery",
        name: "Discovery questions",
        description: "Asks open-ended questions that uncover situation, problems, and impact.",
        weight: 2,
        levels: levels(
          "Few or closed questions; jumps straight to pitching.",
          "Some open questions but stays surface-level; misses obvious follow-ups.",
          "Layered open questions that surface real problems and quantify impact.",
        ),
      },
      {
        key: "listening",
        name: "Active listening",
        description: "Builds on prospect answers, summarizes, and lets the prospect talk.",
        weight: 1.5,
        levels: levels(
          "Talks over the prospect; ignores answers; monologues.",
          "Hears answers but rarely builds on them; some monologues.",
          "Paraphrases, references earlier answers, healthy talk ratio.",
        ),
      },
      {
        key: "value",
        name: "Value articulation",
        description: "Connects capabilities to the prospect's stated problems using company value props.",
        weight: 1.5,
        levels: levels(
          "Feature dump disconnected from the prospect's needs.",
          "Mentions relevant value but generically; misses company-approved differentiators.",
          "Tailors value props precisely to stated pains with proof points.",
        ),
      },
      {
        key: "objections",
        name: "Objection handling",
        description: "Acknowledges, explores, and answers objections using approved responses.",
        weight: 1.5,
        levels: levels(
          "Gets defensive, argues, or capitulates immediately.",
          "Answers objections adequately but without exploring the concern behind them.",
          "Welcomes objections, isolates the real concern, answers with the approved response.",
        ),
      },
      {
        key: "next_steps",
        name: "Next-step close",
        description: "Secures a concrete, time-bound next step with the right people.",
        weight: 1.5,
        levels: levels(
          "Ends with nothing scheduled ('I'll send some info').",
          "Proposes a vague next step without a time or clear commitment.",
          "Locks a calendared next step with agenda and attendees before hanging up.",
        ),
      },
    ],
  },
  {
    name: "MEDDIC",
    description: "Qualification-driven rubric: Metrics, Economic buyer, Decision criteria/process, Identify pain, Champion.",
    dimensions: [
      {
        key: "metrics",
        name: "Metrics",
        description: "Quantifies the economic impact of the problem and the solution.",
        weight: 2,
        levels: levels(
          "No attempt to quantify impact.",
          "Touches on impact qualitatively; no numbers.",
          "Establishes concrete metrics the prospect confirms (cost, time, revenue).",
        ),
      },
      {
        key: "economic_buyer",
        name: "Economic buyer",
        description: "Identifies who owns the budget and works toward access.",
        weight: 1.5,
        levels: levels(
          "Never asks who controls budget or decision.",
          "Asks about decision-makers but doesn't pursue access.",
          "Identifies the economic buyer and secures a path to them.",
        ),
      },
      {
        key: "decision_criteria",
        name: "Decision criteria & process",
        description: "Uncovers how and on what basis the decision will be made.",
        weight: 1.5,
        levels: levels(
          "No exploration of the buying process.",
          "Learns pieces of the process but not criteria or timeline.",
          "Maps criteria, process, timeline, and who is involved.",
        ),
      },
      {
        key: "identify_pain",
        name: "Identify pain",
        description: "Surfaces and develops the compelling pain driving action.",
        weight: 2,
        levels: levels(
          "Accepts surface statements; no real pain identified.",
          "Identifies pain but doesn't develop urgency or consequences.",
          "Develops explicit pain with consequences of inaction the prospect articulates.",
        ),
      },
      {
        key: "champion",
        name: "Champion building",
        description: "Tests for and equips an internal champion.",
        weight: 1.5,
        levels: levels(
          "Treats the contact as a message-taker.",
          "Friendly contact but no test of influence or willingness to sell internally.",
          "Tests the champion's influence and arms them to sell internally.",
        ),
      },
      {
        key: "next_steps",
        name: "Advance & next steps",
        description: "Converts qualification into a concrete advance in the deal.",
        weight: 1.5,
        levels: levels(
          "Call ends without an advance.",
          "Soft next step without commitment.",
          "Specific, calendared advance tied to the decision process.",
        ),
      },
    ],
  },
  {
    name: "SPIN Selling",
    description: "Question-sequence rubric: Situation, Problem, Implication, Need-payoff.",
    dimensions: [
      {
        key: "situation",
        name: "Situation questions",
        description: "Efficiently establishes context without interrogating.",
        weight: 1,
        levels: levels(
          "Skips context entirely or asks endless factual questions.",
          "Gets basic context but inefficiently.",
          "Establishes just enough context quickly, using pre-call research.",
        ),
      },
      {
        key: "problem",
        name: "Problem questions",
        description: "Uncovers difficulties and dissatisfactions the product can solve.",
        weight: 2,
        levels: levels(
          "Never explores problems; pitches from assumptions.",
          "Surfaces one problem but doesn't explore breadth.",
          "Systematically uncovers multiple relevant problems.",
        ),
      },
      {
        key: "implication",
        name: "Implication questions",
        description: "Develops the seriousness and knock-on effects of the problems.",
        weight: 2.5,
        levels: levels(
          "Jumps from problem straight to pitch.",
          "Some exploration of consequences, prospect not fully engaged.",
          "Builds implications until the prospect articulates the cost of inaction.",
        ),
      },
      {
        key: "need_payoff",
        name: "Need-payoff questions",
        description: "Gets the prospect to state the value of solving the problem.",
        weight: 2,
        levels: levels(
          "Tells the prospect the benefits instead of asking.",
          "Asks one need-payoff question; rep still does most of the selling.",
          "Prospect articulates the payoff in their own words.",
        ),
      },
      {
        key: "capability",
        name: "Demonstrating capability",
        description: "Presents capabilities matched to explicit needs the prospect stated.",
        weight: 1.5,
        levels: levels(
          "Feature dump untethered to needs.",
          "Relevant capabilities but framed around features not needs.",
          "Presents only capabilities tied to explicit, stated needs.",
        ),
      },
      {
        key: "advance",
        name: "Obtaining commitment",
        description: "Closes for a realistic advance appropriate to the call.",
        weight: 1,
        levels: levels(
          "No attempt to advance.",
          "Vague continuation without commitment.",
          "Clear, appropriate advance the prospect commits to.",
        ),
      },
    ],
  },
  {
    name: "Challenger",
    description: "Teach-Tailor-Take-Control rubric for insight-led selling.",
    dimensions: [
      {
        key: "teach",
        name: "Commercial teaching",
        description: "Brings insight that reframes how the prospect sees their business.",
        weight: 2.5,
        levels: levels(
          "No insight offered; conversation follows the prospect's existing frame.",
          "Shares interesting information but it doesn't reframe anything.",
          "Delivers a credible insight that visibly shifts the prospect's thinking.",
        ),
      },
      {
        key: "tailor",
        name: "Tailoring",
        description: "Adapts the message to the person's role, industry, and priorities.",
        weight: 2,
        levels: levels(
          "One-size-fits-all pitch.",
          "Some role/industry awareness but generic value framing.",
          "Message precisely tailored to this stakeholder's economic drivers.",
        ),
      },
      {
        key: "control",
        name: "Taking control",
        description: "Maintains constructive tension; steers process and pricing conversations confidently.",
        weight: 2,
        levels: levels(
          "Defers to the prospect on everything; caves on pushback.",
          "Holds ground occasionally but avoids tension.",
          "Comfortably maintains tension, redirects, and drives the process.",
        ),
      },
      {
        key: "objections",
        name: "Reframing objections",
        description: "Uses objections as teaching moments rather than obstacles.",
        weight: 1.5,
        levels: levels(
          "Objections derail the conversation.",
          "Handles objections adequately without reframing.",
          "Reframes objections into support for the core insight.",
        ),
      },
      {
        key: "next_steps",
        name: "Momentum & next steps",
        description: "Converts the reframe into concrete deal momentum.",
        weight: 2,
        levels: levels(
          "Insight lands but nothing happens next.",
          "Soft follow-up without commitment.",
          "Prospect commits to a specific action driven by the new frame.",
        ),
      },
    ],
  },
];
