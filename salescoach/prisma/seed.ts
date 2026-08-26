/* Seed: demo tenant "Meridian Software" with a full team, methodology presets,
 * company context, two months of ingested calls (run through the real
 * ingestion pipeline, including sampling), role-play scenarios and graded
 * sessions, and manager assignments. Run: npm run db:seed */
process.env.SEEDING = "1";
process.env.INLINE_JOBS = "1";

import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
import { METHODOLOGY_PRESETS } from "../src/lib/presets";
import { ingestCall, gradeRoleplay } from "../src/lib/pipeline";
import type { CompanyProfile, RoleplayMessage, ScenarioPersona } from "../src/lib/types";

const COMPANY: CompanyProfile = {
  description:
    "Meridian Software sells a real-time multi-warehouse inventory platform to mid-market distributors and 3PLs (50-500 employees).",
  valueProps: [
    "Real-time inventory accuracy across every warehouse",
    "First warehouse live in 6 weeks, phased rollout",
    "Pays for itself in reduced missed shipments within the first quarter",
  ],
  products: [
    {
      name: "Meridian Core",
      description: "Real-time inventory tracking and sync across warehouses.",
      differentiators: ["ERP integration (NetSuite, SAP B1)", "6-week phased deployment", "99.9% count accuracy SLA"],
      idealFor: "Distributors running 2+ warehouses on spreadsheets or legacy ERP modules.",
    },
    {
      name: "Meridian Forecast",
      description: "Demand forecasting add-on using live inventory signals.",
      differentiators: ["Works day one on Core data", "No data science team required"],
      idealFor: "Teams with seasonal demand swings.",
    },
  ],
  personas: [
    {
      title: "VP of Operations",
      industry: "Wholesale distribution",
      painPoints: ["Missed shipments from count drift", "No visibility across warehouses", "Manual cycle counts eating labor"],
      notes: "Cares about customer commitments and labor cost, not tech.",
    },
    {
      title: "CFO",
      industry: "Wholesale distribution",
      painPoints: ["Inventory write-offs", "Working capital tied up in safety stock"],
      notes: "Skeptical of software ROI claims; wants payback math.",
    },
  ],
  objections: [
    {
      objection: "We've been burned by software rollouts before — these take a year and go over budget.",
      approvedResponse:
        "Acknowledge, then explain the phased deployment: first warehouse live in 6 weeks, fixed-fee implementation, reference customers who hit that timeline.",
    },
    {
      objection: "It's too expensive.",
      approvedResponse:
        "Reframe to payback: quantify their missed-shipment and write-off costs, then show most customers recover the subscription in the first quarter.",
    },
    {
      objection: "Our ERP already has an inventory module.",
      approvedResponse:
        "Agree it does, then differentiate: ERP modules batch-sync overnight; Meridian is real-time across warehouses, which is what prevents mis-ships.",
    },
  ],
  competitors: [
    { name: "StockPilot", positioning: "We win on ERP integration depth and deployment speed; they win on price. Anchor on total cost of mis-ships." },
    { name: "InFlow", positioning: "SMB tool; we win when the prospect has multiple warehouses or an ERP." },
  ],
  talkTracks: [
    "Open with the multi-warehouse count-drift problem, not the product.",
    "Always quantify missed shipments before discussing price.",
  ],
  pricingNotes: "Mid-market lands $2-4k/month. Never quote before quantifying impact.",
};

// --- Transcript templates of varying quality ---

const GOOD_CALL = `REP: Hi Dana, this is Alex from Meridian Software — did I catch you at an okay time?
PROSPECT: You've got a couple of minutes.
REP: Appreciate it. We work with distributors juggling inventory across multiple warehouses. How is your team keeping counts in sync today?
PROSPECT: Spreadsheets plus our NetSuite module, and honestly it drifts constantly.
REP: When the counts drift, where does it bite you first — write-offs, or missed shipments?
PROSPECT: Missed shipments. We shorted our biggest retail account twice last quarter.
REP: Ouch. Roughly what does a shorted order to an account like that cost you, between the chargeback and the relationship?
PROSPECT: The chargebacks alone were around forty grand last quarter.
REP: So call it $160k a year before you even count the relationship risk. If counts were accurate in real time across both warehouses, does that number mostly go away?
PROSPECT: Most of it, yeah. But look, we've been burned by software rollouts before. These things take a year.
REP: That's fair, and it's the most common concern we hear. Our deployments are phased — first warehouse live in six weeks, fixed-fee implementation. I can share two distributors your size who hit that timeline. Would that be useful?
PROSPECT: Maybe. What does it cost?
REP: Most customers your size land between two and four thousand a month — so against $160k of chargebacks the payback is inside a quarter. Who besides you would need to see that math for this to move?
PROSPECT: My CFO, Marta. She owns the budget.
REP: Perfect. Could we get thirty minutes Thursday with you and Marta? I'll bring the payback model and the rollout plan for your two warehouses.
PROSPECT: Alright, Thursday afternoon. Send the invite.
REP: Done — I'll send it with a one-page agenda so Marta knows exactly what she's getting. Thanks, Dana.`;

const MID_CALL = `REP: Hi, this is Alex calling from Meridian Software. How are you today?
PROSPECT: Busy. What's this about?
REP: We make an inventory management platform. It does real-time tracking, ERP integration, forecasting, cycle count automation, barcode scanning, and multi-warehouse sync. Companies love it.
PROSPECT: We have an inventory module in our ERP already.
REP: Sure, but ours is better. It's real-time. Do you have inventory problems at all?
PROSPECT: Sometimes counts are off, sure.
REP: Right, that's exactly what we fix. Our accuracy SLA is 99.9%. We integrate with NetSuite and SAP. The dashboard is really intuitive too.
PROSPECT: Okay. What does it cost?
REP: Pricing depends on a lot of factors. I'd have to get you a quote. Can I ask how many warehouses you run?
PROSPECT: Two.
REP: Great, that's our sweet spot. So would you want to see a demo sometime?
PROSPECT: Maybe. Send me some information and I'll take a look.
REP: Will do, I'll email you a deck today. Thanks for your time!`;

const POOR_CALL = `REP: Hey, is this the person who handles, um, purchasing software?
PROSPECT: This is the operations line. Who's calling?
REP: I'm with Meridian, we do inventory stuff. So basically our platform is like, you know, the best on the market. We have real-time syncing and basically everything you need. It's got AI too.
PROSPECT: We're not really looking at anything right now.
REP: Okay but the thing is, prices go up next quarter, so it's actually a really good time to buy. We're way better than StockPilot.
PROSPECT: Like I said, we're not evaluating anything.
REP: Um, okay. Well can I send you a deck? It has like all the features listed.
PROSPECT: Fine. Send it to the info address.
REP: Cool cool. And, uh, maybe I'll follow up next week or something?
PROSPECT: I have to run.
REP: Okay thanks bye.`;

const DEMO_CALL = `REP: Thanks for making time, Dana. Last time you said missed shipments cost about forty grand a quarter and that Marta would need to see payback math. Today I'd like to show exactly how the two-warehouse rollout works, then the numbers. Sound right?
PROSPECT: That works. Marta joined too.
REP: Great — Marta, anything you want to make sure we cover?
PROSPECT: Just the real costs. Software quotes never survive contact with reality.
REP: Fair. Then I'll show implementation fees on the same slide as subscription. First: this is your Fresno warehouse live view — every SKU, updated on scan, synced to NetSuite in under a second. Dana, how long does that reconciliation take your team today?
PROSPECT: Most of a day, every week.
REP: So call it a day of labor a week back, on top of the chargebacks. Marta, here's the payback model with your numbers — subscription, fixed-fee implementation, against $160k annual chargebacks plus that labor. Quarter one payback. What would you want to stress-test in this?
PROSPECT: What happens if the rollout slips past six weeks?
REP: Good question — the implementation fee is fixed, so slippage is on us, and the contract includes a credit if we miss the go-live date. That's in section three here.
PROSPECT: That's more accountability than the last vendor gave us.
REP: That's exactly why we structure it that way. What would you both need to see to be comfortable moving to a contract review by month-end?
PROSPECT: Send the reference customers and the draft contract. If the references check out, we'll take it to legal.
REP: Done — you'll have both by tomorrow, and I'll book a check-in for Friday to answer whatever the references surface.`;

// Distinct filler transcripts so auto-ingested calls vary.
function fillerTranscript(i: number): string {
  const base = [GOOD_CALL, MID_CALL, POOR_CALL, DEMO_CALL][i % 4];
  return base;
}

async function main() {
  console.log("Seeding...");

  // Wipe (idempotent seed) — children before parents
  await db.usageEvent.deleteMany();
  await db.job.deleteMany();
  await db.unmatchedIngest.deleteMany();
  await db.grade.deleteMany();
  await db.transcript.deleteMany();
  await db.call.deleteMany();
  await db.roleplaySession.deleteMany();
  await db.assignment.deleteMany();
  await db.scenario.deleteMany();
  await db.companyContext.deleteMany();
  await db.user.deleteMany();
  await db.methodology.deleteMany();
  await db.org.deleteMany();

  const org = await db.org.create({
    data: {
      name: "Meridian Software",
      ingestionPolicyJson: JSON.stringify({
        minDurationSec: 60,
        sampleThreshold: 10,
        sampleSize: 10,
        gradeManualUploads: true,
      }),
      retentionPolicyJson: JSON.stringify({
        redactPiiInTranscripts: true,
        retainCallDays: 365,
      }),
    },
  });

  // Methodology presets (global) + org's active clone of Discovery Fundamentals
  const presetRows = [];
  for (const p of METHODOLOGY_PRESETS) {
    presetRows.push(
      await db.methodology.create({
        data: {
          name: p.name,
          description: p.description,
          isPreset: true,
          dimensionsJson: JSON.stringify(p.dimensions),
        },
      }),
    );
  }
  const active = await db.methodology.create({
    data: {
      orgId: org.id,
      name: "Meridian Sales Rubric (Discovery Fundamentals + custom)",
      description:
        "Cloned from Discovery Call Fundamentals with a company-specific dimension for quantifying missed-shipment impact.",
      dimensionsJson: JSON.stringify([
        ...METHODOLOGY_PRESETS[0].dimensions,
        {
          key: "quantify_impact",
          name: "Quantified missed-shipment impact",
          description:
            "Company-specific: got the prospect to put a dollar figure on count drift (chargebacks, write-offs, labor) before any pricing talk.",
          weight: 2,
          companySpecific: true,
          levels: [
            { score: 1, description: "Discussed price with no quantification of impact." },
            { score: 2, description: "Mentioned costs qualitatively only." },
            { score: 3, description: "Got a rough qualitative sizing of the problem." },
            { score: 4, description: "Prospect stated a concrete cost figure." },
            { score: 5, description: "Concrete figure, annualized, and tied back to pricing as payback." },
          ],
        },
      ]),
    },
  });
  await db.org.update({ where: { id: org.id }, data: { activeMethodologyId: active.id } });

  await db.companyContext.create({
    data: { orgId: org.id, profileJson: JSON.stringify(COMPANY) },
  });

  // Users
  const passwordHash = await hashPassword("password123");
  const mkUser = (name: string, email: string, role: string, title: string) =>
    db.user.create({ data: { orgId: org.id, name, email, role, title, passwordHash } });
  const manager = await mkUser("Sarah Chen", "sarah@meridian.demo", "MANAGER", "VP of Sales");
  const trainer = await mkUser("Marcus Webb", "marcus@meridian.demo", "TRAINER", "Sales Enablement Lead");
  await mkUser("Ana Ruiz", "ana@meridian.demo", "ADMIN", "RevOps Admin");
  const reps = [];
  for (const [name, email, title] of [
    ["Alex Rivera", "alex@meridian.demo", "Account Executive"],
    ["Jordan Patel", "jordan@meridian.demo", "SDR"],
    ["Casey Nguyen", "casey@meridian.demo", "SDR"],
    ["Morgan Blake", "morgan@meridian.demo", "Account Executive"],
    ["Riley Okafor", "riley@meridian.demo", "SDR"],
  ] as const) {
    reps.push(await mkUser(name, email, "REP", title));
  }

  // Scenarios
  const personas: { title: string; persona: ScenarioPersona; callType: string; difficulty: string; win: string[] }[] = [
    {
      title: "Cold call: skeptical VP of Operations",
      callType: "cold_call",
      difficulty: "medium",
      persona: {
        name: "Dana Whitfield",
        title: "VP of Operations",
        company: "Cascade Distribution",
        industry: "Wholesale distribution",
        personality: "Time-pressed, practical, allergic to buzzwords. Warms up to specific, quantified talk.",
        painPoints: ["Shorted two big retail orders last quarter from count drift", "Weekly manual reconciliation eats a full day"],
        objections: [
          "We've been burned by software rollouts before — these things take a year and go over budget.",
          "Our ERP already has an inventory module.",
        ],
        budget: "Has budget authority up to $50k/yr; CFO sign-off above that.",
        notes: "Will end the call quickly if the rep pitches features before asking about her operation.",
      },
      win: [
        "Uncovered the missed-shipment pain and got a dollar figure on it",
        "Handled the rollout-risk objection with the phased deployment response",
        "Booked a concrete next meeting including the CFO",
      ],
    },
    {
      title: "Discovery: ROI-focused CFO",
      callType: "discovery",
      difficulty: "hard",
      persona: {
        name: "Marta Iglesias",
        title: "CFO",
        company: "Cascade Distribution",
        industry: "Wholesale distribution",
        personality: "Polite but relentless on numbers. Interrupts vague claims and asks for evidence.",
        painPoints: ["Inventory write-offs growing YoY", "Working capital locked in safety stock"],
        objections: ["It's too expensive.", "Every vendor promises payback in a quarter — nobody delivers."],
        budget: "Owns the budget. Will not approve without a payback model she has stress-tested.",
        notes: "Rewards reps who volunteer implementation costs and risk terms without being cornered.",
      },
      win: [
        "Presented payback math using her numbers, not generic claims",
        "Handled the price objection with the approved reframe",
        "Secured agreement on decision criteria and a follow-up with legal/procurement",
      ],
    },
    {
      title: "Objection gauntlet: incumbent-happy ops manager",
      callType: "discovery",
      difficulty: "easy",
      persona: {
        name: "Tom Herrera",
        title: "Operations Manager",
        company: "BlueRidge Supply",
        industry: "Industrial supply",
        personality: "Friendly, chatty, conflict-averse. Hides objections behind politeness.",
        painPoints: ["Cycle counts constantly behind", "One warehouse runs a different WMS than the other"],
        objections: ["Our ERP already has an inventory module.", "I'd have to convince my VP and she hates change."],
        budget: "No budget authority; can champion internally.",
        notes: "A good rep will test his influence and equip him to sell internally.",
      },
      win: ["Surfaced the hidden objection", "Tested champion strength", "Armed him with a one-pager and booked the VP meeting"],
    },
  ];
  const scenarioRows = [];
  for (const s of personas) {
    scenarioRows.push(
      await db.scenario.create({
        data: {
          orgId: org.id,
          title: s.title,
          callType: s.callType,
          difficulty: s.difficulty,
          personaJson: JSON.stringify(s.persona),
          winConditionsJson: JSON.stringify(s.win),
          methodologyId: active.id,
        },
      }),
    );
  }

  // Calls: ~7 weeks of history through the real ingestion pipeline.
  const now = new Date();
  const transcripts = [GOOD_CALL, MID_CALL, POOR_CALL, DEMO_CALL];
  let extId = 1000;
  for (let r = 0; r < reps.length; r++) {
    const rep = reps[r];
    // Volume varies by rep: SDRs high volume (sampling kicks in), AEs low volume.
    const isHighVolume = rep.title === "SDR";
    const callCount = isHighVolume ? 34 : 8;
    for (let i = 0; i < callCount; i++) {
      const daysAgo = Math.floor((i / callCount) * 49);
      const callDate = new Date(now.getTime() - daysAgo * 86400000 - (i % 7) * 3600000);
      const quality = (r + i) % 4;
      const durationSec = quality === 2 ? 95 : 300 + ((i * 137) % 900);
      await ingestCall({
        orgId: org.id,
        repId: rep.id,
        source: i % 9 === 0 ? "API" : "WEBHOOK",
        direction: "outbound",
        callType: quality === 3 ? "demo" : i % 3 === 0 ? "cold_call" : "discovery",
        durationSec,
        externalId: `seed-${extId++}`,
        prospectName: ["Cascade Distribution", "BlueRidge Supply", "Harbor Freight Co", "Summit Logistics"][i % 4],
        callDate,
        providedTranscript: transcripts[quality],
      });
    }
    // One manual upload + one rep-flagged call each
    await ingestCall({
      orgId: org.id,
      repId: rep.id,
      source: "UPLOAD",
      callType: "discovery",
      durationSec: 840,
      prospectName: "Pinnacle Wholesale",
      callDate: new Date(now.getTime() - 2 * 86400000),
      providedTranscript: fillerTranscript(r),
    });
    await ingestCall({
      orgId: org.id,
      repId: rep.id,
      source: "WEBHOOK",
      callType: "discovery",
      durationSec: 720,
      externalId: `seed-flag-${r}`,
      prospectName: "Cascade Distribution",
      callDate: new Date(now.getTime() - 1 * 86400000),
      providedTranscript: fillerTranscript(r + 1),
      repFlagged: true,
    });
  }

  // Role-play sessions (completed + graded)
  const rpDialogue = (good: boolean): RoleplayMessage[] => {
    const msgs: [string, string][] = good
      ? [
          ["Hi Dana, this is Alex at Meridian — I know I'm calling cold, can I take thirty seconds to say why, and you can tell me if it's relevant?", "Thirty seconds. Go."],
          ["We help distributors whose counts drift across warehouses. Curious — when your Fresno and Reno counts disagree, what happens downstream?", "Usually we find out when a shipment gets shorted. It's ugly."],
          ["How often did that happen last quarter, roughly?", "Twice with our biggest account. Chargebacks were about forty grand."],
          ["So $160k a year, before the relationship damage. If counts were real-time accurate, does most of that disappear?", "Probably. But software rollouts around here take a year and blow the budget."],
          ["Fair — heard that a lot. Ours is phased: first warehouse live in six weeks, fixed fee, with a credit if we miss the date. Worth thirty minutes Thursday with you and whoever owns budget to see the payback math?", "Bring the math and you've got your meeting. I'll pull in Marta."],
        ]
      : [
          ["Hi, this is Jordan from Meridian Software. We're the leading inventory platform. Do you have five minutes?", "Not really. What's this about?"],
          ["Our platform has real-time sync, AI forecasting, barcode scanning, and a great dashboard. Companies love it.", "We have an ERP module for that."],
          ["Ours is way better though. Would you want a demo?", "You haven't asked me a single thing about my operation."],
          ["Right, sorry — so do you have inventory issues?", "Everyone does. Look, send me a deck and I'll get to it eventually."],
          ["Okay! I'll email that today. Thanks!", "Sure. Bye."],
        ];
    let at = 2000;
    const out: RoleplayMessage[] = [];
    for (const [rep, pro] of msgs) {
      out.push({ role: "rep", text: rep, atMs: at });
      at += 9000;
      out.push({ role: "prospect", text: pro, atMs: at });
      at += 8000;
    }
    return out;
  };

  for (let r = 0; r < reps.length; r++) {
    for (let k = 0; k < 2; k++) {
      const good = (r + k) % 2 === 0;
      const session = await db.roleplaySession.create({
        data: {
          orgId: org.id,
          repId: reps[r].id,
          scenarioId: scenarioRows[(r + k) % scenarioRows.length].id,
          mode: "TEXT",
          status: "COMPLETED",
          messagesJson: JSON.stringify(rpDialogue(good)),
          durationSec: 95,
          startedAt: new Date(now.getTime() - (3 + k * 6 + r) * 86400000),
          endedAt: new Date(now.getTime() - (3 + k * 6 + r) * 86400000 + 95000),
        },
      });
      await gradeRoleplay(session.id);
    }
  }

  // Assignments
  await db.assignment.create({
    data: {
      orgId: org.id,
      assignedToId: reps[1].id,
      assignedById: manager.id,
      type: "ROLEPLAY",
      scenarioId: scenarioRows[0].id,
      targetCount: 3,
      doneCount: 1,
      note: "Objection handling dipped below 60 twice this month — run the cold-call gauntlet.",
      status: "IN_PROGRESS",
      dueDate: new Date(now.getTime() + 5 * 86400000),
    },
  });
  await db.assignment.create({
    data: {
      orgId: org.id,
      assignedToId: reps[3].id,
      assignedById: trainer.id,
      type: "UPLOAD_CALLS",
      targetCount: 3,
      doneCount: 3,
      note: "Upload your three Cascade discovery calls for review before Thursday.",
      status: "COMPLETED",
      completedAt: new Date(now.getTime() - 86400000),
    },
  });
  await db.assignment.create({
    data: {
      orgId: org.id,
      assignedToId: reps[4].id,
      assignedById: manager.id,
      type: "ROLEPLAY",
      scenarioId: scenarioRows[1].id,
      targetCount: 2,
      doneCount: 0,
      note: "Practice the CFO payback conversation before the Summit Logistics meeting.",
      status: "PENDING",
      dueDate: new Date(now.getTime() + 3 * 86400000),
    },
  });

  const counts = {
    calls: await db.call.count(),
    graded: await db.grade.count(),
    roleplays: await db.roleplaySession.count(),
    scenarios: await db.scenario.count(),
    assignments: await db.assignment.count(),
    users: await db.user.count(),
  };
  console.log("Seeded:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
