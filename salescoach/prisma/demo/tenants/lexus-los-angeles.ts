/**
 * Demo tenant: Lexus of West Los Angeles — a luxury auto dealership on the
 * Westside selling new and Certified Pre-Owned Lexus vehicles to households
 * and small corporate/fleet accounts (production companies, real-estate
 * groups). Sales motion: internet leads and walk-ins, test drives, trade-in
 * appraisals, lease vs. finance conversations, F SPORT upsells, and extended
 * protection plans. Coaching culture: needs-first discovery, zero pressure,
 * transparent numbers.
 */

import type { DemoTenantSpec } from "../types";

// ---------- Transcripts ----------

const GOOD_CALL = `REP: Hi, may I speak with Melissa Grant? This is Aisha Thompson calling from Lexus of West Los Angeles — you sent us an inquiry last night on a 2026 RX 350h.
PROSPECT: Oh, hi. Yes, that was me. That was fast.
REP: We try to be. Do you have four or five minutes now, or is there a better time later today?
PROSPECT: Now works, I have a few minutes before a meeting.
REP: Perfect. Before I start quoting anything at you, can I ask what put the RX 350h on your list in the first place?
PROSPECT: Mostly the hybrid part. My commute got a lot worse this year and I am spending a fortune on gas.
REP: What does the commute look like these days?
PROSPECT: Mar Vista to mid-Wilshire. It should be twenty minutes and it is fifty on a good day, seventy when the 10 backs up.
REP: That is real time in the car. Roughly what are you putting into the tank each week right now?
PROSPECT: I fill up about once a week, so seventy, seventy-five dollars.
REP: Okay, call it three hundred a month. The 350h runs about thirty-seven miles per gallon in exactly that kind of stop-and-go, so most guests in your situation cut that spend close to half. Who else rides in the car — is this a commuter, a family car, or both?
PROSPECT: Both. Two kids, ten and thirteen, soccer gear everywhere, and a golden retriever on weekends.
REP: So cargo space and easy loading matter. What are you driving today?
PROSPECT: A 2019 RX 350, actually. We own it outright, about sixty-two thousand miles.
REP: A returning RX owner — that makes this easier, you already know the car. Would you want us to appraise the 2019 as a trade, or are you keeping it?
PROSPECT: Trade it, if the number makes sense. I should tell you though, my neighbor just got a BMW X5 and he swears he can get me the same monthly payment on one.
REP: That is a fair thing to check, and the X5 is a genuinely nice truck, so I will not pretend otherwise. What I would ask you to compare is the total cost of owning it, not just the payment on day one. On your commute the hybrid saves you around one hundred forty dollars a month in fuel alone, Lexus tops the reliability surveys year after year, and RX resale values hold up better at trade-in time. Would it help if I put the two side by side on paper when you come in, with nothing hidden?
PROSPECT: Honestly, yes. My last dealership experience was a lot of games with the payment sheet.
REP: You will not get that here — one sheet, every number itemized, and you keep the copy. One more thing on the hybrid, since people ask: the hybrid battery is warrantied for ten years or a hundred fifty thousand miles, so it will outlast most ownership periods.
PROSPECT: Good to know. Do you actually have one on the lot? I heard hybrids have waitlists.
REP: We do — I am looking at our West LA inventory right now, and we have an RX 350h Premium AWD in Nori Green with the tan interior, plus one in Iridium arriving next week. The Nori Green is the spec most people photograph, honestly.
PROSPECT: The green one sounds interesting.
REP: Then let us do this properly. Are you free Saturday morning? I can have the Nori Green pulled up and charged with fuel at ten thirty, we drive your actual commute route down Wilshire, and while we are out my appraiser puts a firm written number on your 2019 — no obligation on either.
PROSPECT: Saturday at ten thirty works.
REP: Booked. Bring the 2019 and your registration so the appraisal is a real number, not an estimate. I will email you a confirmation in the next ten minutes with my cell on it. Anything else you want me to have ready?
PROSPECT: The BMW comparison you mentioned, on paper.
REP: It will be printed and waiting. Thank you, Melissa — see you Saturday at ten thirty.
PROSPECT: Thanks, Aisha. See you then.`;

const MID_CALL = `REP: Hi, is this Derek? This is Kenji over at Lexus of West Los Angeles, following up on your website visit.
PROSPECT: Yeah, hi. I was looking at the RX pretty casually.
REP: Great choice. So the RX comes in the RX 350, the RX 350h hybrid, the RX 450h+ plug-in, and the RX 500h F SPORT Performance. Then within those you have Premium, Premium Plus, and Luxury packages, and the F SPORT models get adaptive variable suspension, twenty-one inch wheels, and the F SPORT steering wheel.
PROSPECT: That is a lot of versions.
REP: There is more — you can add the Technology package, panoramic roof, Mark Levinson audio, the convenience package with the digital key. The 500h makes 366 horsepower. The interior got a full redesign with the Tazuna cockpit concept.
PROSPECT: Okay. I am really just comparing it against the BMW X5 on payment.
REP: Oh, the RX definitely competes with the X5. Our lease programs change monthly but they are usually strong. Do you know what payment you are looking for?
PROSPECT: I would have to see numbers on both.
REP: Sure, payments depend on trim, money down, your credit tier, lots of factors. Are you trading anything in?
PROSPECT: Maybe my Audi Q5.
REP: Nice, we take those all the time. So would you maybe want to come in sometime and drive one?
PROSPECT: Maybe. Can you email me some pricing first?
REP: I can send you the brochure and current offers today. I will include all the trims so you can compare.
PROSPECT: Fine, send it over. I will take a look when I get a chance.
REP: Will do, Derek. Thanks for your time!`;

const POOR_CALL = `REP: Hey Derek, it's the Lexus store. You came in Sunday, right? Or was that somebody else, I have a few sheets in front of me.
PROSPECT: I came in two weeks ago, and it was about an RX.
REP: Right, right, the RX. So listen, the reason I am calling — my manager is doing a month-end push and if you can come in before Sunday I can probably knock something off. What payment do you need to be at to buy this week?
PROSPECT: I told the person I spoke with that I am comparing it against the X5 and I am not in a rush.
REP: The X5? Honestly BMWs live in the shop, everybody knows that. Look, these hybrids are flying off the lot, prices are only going up. If I could get you to your number today would you come in tonight?
PROSPECT: I do not have a number, and I do not respond well to this kind of thing.
REP: I am just trying to save you money, my friend. Should I put you down for Saturday? I will pencil you in at noon.
PROSPECT: Please do not pencil me in for anything. I will reach out if I want to move forward.
REP: Okay okay. I will call you next week to check in.
PROSPECT: I have to go.`;

const DEMO_CALL = `REP: Adaeze, thanks for making time this evening — I know the drive back from the test drive ran long. Quick recap of where we are, then the numbers, and you tell me where I have anything wrong. Sound good?
PROSPECT: Go ahead, Gabriel.
REP: On Saturday you and Emeka drove the GX 550 Luxury+. You told me the must-haves were three rows for the kids, real ground clearance for the Topanga fire roads on weekends, and enough tow rating for the small camper. The GX checks all three — and you said the third row actually fit your oldest, which the 4Runner never did.
PROSPECT: That is all accurate. The sticking point is the trade. Carvana quoted me thirty-one two for the 4Runner and your appraisal came in at twenty-nine eight. That is fourteen hundred dollars, Gabriel.
REP: You are right, and I am not going to wave that away. Two things, and then a proposal. First, here is our appraisal report itself — every deduction is itemized: the two tires at three millimeters, the windshield chip, the rear bumper scuff. Nothing in there is a mystery number. Second, Carvana's online quote is conditional — it gets finalized at pickup after their inspection, and quotes routinely come down at that step for exactly the items on this sheet.
PROSPECT: So you are saying their thirty-one two is not real.
REP: I am saying it is not final. Here is my proposal: if they hand you a firm written offer at thirty-one two after inspecting the truck, bring it to me and I will match it. And if you would rather not spend a Saturday on that, I will take this appraisal back to our used-car manager tonight with the service records you brought and ask him to sharpen it. Either way you should not pay the fourteen hundred.
PROSPECT: Okay. That is a fair way to handle it. Walk me through the rest of the numbers.
REP: One sheet, top to bottom. Luxury+ at MSRP, seventy-nine nine fifty — no market adjustment, we do not do those. Roof cross bars and all-weather mats, six ninety. The extended protection plan we discussed for the fire-road use, thirty-four ninety-five, and that one is optional — I will show the total both with and without it. Trade at twenty-nine eight pending what we just agreed, and your payoff is zero since you own it. Doc and registration fees are printed there, nothing added at signing.
PROSPECT: What does that do to the monthly on the sixty-month finance we discussed?
REP: With the protection plan it lands at eleven forty-two a month at the rate you were pre-approved for; without it, ten eighty-six. If the trade number improves, every additional thousand takes it down about seventeen dollars a month.
PROSPECT: And if we wanted the camper hitch wiring done before delivery?
REP: We can have our shop do the seven-pin wiring before you take it — I will fold it into the sheet at cost tomorrow so you see it before you decide anything.
PROSPECT: Alright. Get me the sharpened trade number and the wiring line by tomorrow, and Emeka and I will decide this week.
REP: Done. I will call you by six tomorrow evening with the revised sheet, and I will hold the GX with a stock note through Friday so nobody sells it out from under you — no deposit needed. Fair?
PROSPECT: Fair. Talk tomorrow, Gabriel.
REP: Thank you, Adaeze. Say hi to Emeka for me.`;

const FOLLOWUP_TRADE = `REP: Adaeze, Gabriel at Lexus of West LA — is now still a good time for the five-minute update I promised?
PROSPECT: It is. Did your manager move on the trade?
REP: He did. With the service records you sent over, he re-scored the 4Runner's condition and the new written number is thirty thousand six hundred — up eight hundred from Saturday. And the offer to match a firm, post-inspection Carvana number still stands on top of that.
PROSPECT: That is still six hundred short of their quote.
REP: Correct, against their conditional quote. If they inspect the truck and put thirty-one two in writing, I match it that day. But I did not want to hold your decision hostage to their schedule, so I also had the seven-pin trailer wiring quoted at our cost like I promised — two hundred forty installed, on the sheet, before delivery.
PROSPECT: That is what the trailer shop quoted me just for parts. Alright, that helps.
REP: So the revised sheet is in your inbox now: GX at MSRP, wiring at cost, trade at thirty thousand six hundred with the match commitment written on it, and the protection plan shown both in and out. What would you and Emeka need from me to make a decision by Friday?
PROSPECT: Nothing more, honestly. We will talk tonight and I will call you tomorrow.
REP: Perfect. I have the truck flagged as held through Friday close of business. Talk tomorrow, Adaeze.
PROSPECT: Thanks, Gabriel. You have been straight with us — it is noticed.
REP: That is the only way we do it here. Speak soon.`;

const FOLLOWUP_FLEET = `REP: Rachel, this is Nadia Haddad from Lexus of West Los Angeles — thanks for taking my call. Your office said fifteen minutes before your two o'clock, so I will be efficient. You reached out about vehicles for Harbor Light. Can you paint me the picture?
PROSPECT: Sure. We move talent and executives between our Culver City stages, hotels on the Westside, and location shoots. Right now we rent SUVs week to week and it is chaos — inconsistent cars, drivers complaining, and finance hates the invoices.
REP: How many vehicles are you running in a typical week?
PROSPECT: Two, sometimes three when we are in production. We are about to start a pilot in September, so it goes to three and stays there for at least six months.
REP: And what matters most in the vehicle itself — is this about comfort for the talent, image, logistics?
PROSPECT: All of it. Quiet, comfortable third row for security plus talent, something that looks right pulling up to a premiere, and it cannot be flashy-fragile. These cars get valeted six times a day.
REP: That profile is exactly why I want you to look at the TX 350 — three real rows, limo-quiet, and it is the SUV half the studios on the Westside are switching their shuttle fleets to. On the finance pain: would Harbor Light rather own these on the books or lease them?
PROSPECT: Our CFO Jonah will want to see both, honestly. He cares about one predictable monthly number and not surprise maintenance bills.
REP: Then I will build both. One thing that usually decides it for production companies: our fleet package includes scheduled maintenance and a service concierge — we pick the vehicle up from your lot and drop a loaner, so a service day never costs you a shuttle. What is the drop-dead date to have three vehicles on your lot before the pilot?
PROSPECT: First week of September, no later.
REP: Doable — I have TX 350s in West LA inventory now and can allocate three matching ones this week. Here is what I propose: Thursday at ten I come to Culver City with a TX for you and Jonah to ride in, and I bring the own-versus-lease sheet with the September delivery schedule. Thirty minutes.
PROSPECT: Thursday at ten works. Bring the numbers itemized — Jonah will pick them apart.
REP: Itemized is the only way we print them. See you Thursday, Rachel.`;

// ---------- Spec ----------

export const spec: DemoTenantSpec = {
  orgName: "Lexus of West Los Angeles",

  company: {
    description:
      "Lexus of West Los Angeles is a family-operated luxury dealership on Santa Monica Blvd selling new and Certified Pre-Owned Lexus vehicles to Westside households and small corporate fleets (production companies, real-estate groups). The sales floor runs on internet leads and walk-ins: test drives, trade-in appraisals, lease-versus-finance conversations, F SPORT upsells, and extended protection plans — with a strict needs-first, no-pressure, transparent-numbers culture.",
    valueProps: [
      "Transparent one-touch pricing: one itemized sheet, no market adjustments, no fees appearing at signing — the guest keeps the copy",
      "Lexus reliability plus our service culture: top-of-industry dependability ratings, service concierge with pickup and loaners, and a ten-year hybrid battery warranty",
      "The deepest hybrid lineup in luxury: real fuel savings on LA commutes (RX 350h, ES 300h) without range anxiety or charger hunting",
    ],
    products: [
      {
        name: "RX 350h hybrid SUV line",
        description:
          "The two-row flagship SUV as a hybrid: about 37 mpg in stop-and-go traffic, AWD standard, Premium through Luxury trims.",
        differentiators: [
          "Dramatically better city fuel economy than a comparable BMW X5 or Mercedes GLE — 37 mpg vs. their low twenties",
          "Ten-year / 150,000-mile hybrid battery warranty",
          "Strongest resale values in the midsize luxury SUV segment",
        ],
        idealFor:
          "Commuter professionals and families crossing the 405/10 daily who want luxury without the gas bill or a charging cable.",
      },
      {
        name: "ES 300h sedan line",
        description:
          "The luxury commuter sedan: about 44 mpg combined, whisper-quiet cabin, priced well under German midsize rivals.",
        differentiators: [
          "Best real-world fuel economy of any non-plug-in luxury sedan",
          "Thousands less than a comparably equipped BMW 5 Series or Mercedes E-Class",
          "Lexus dependability — routinely the lowest cost-of-ownership in its class",
        ],
        idealFor: "Long-commute professionals and ride-comfort buyers upgrading from a Camry, Accord, or aging German sedan.",
      },
      {
        name: "GX 550 / TX 350 family and adventure line",
        description:
          "Three-row body-on-frame capability (GX 550 Premium and Luxury trims) and three-row road-trip comfort (TX 350) for larger households and small fleets.",
        differentiators: [
          "GX 550: real body-on-frame capability (full-time 4WD, crawl control) with a valet-friendly interior",
          "TX 350: a genuinely adult-usable third row — the studio-shuttle favorite on the Westside",
          "Both tow-rated for campers and trailers common in weekend Topanga/Sierra trips",
        ],
        idealFor: "Family upgraders outgrowing a two-row, and production or real-estate fleets moving clients and talent.",
      },
    ],
    personas: [
      {
        title: "Commuter professional",
        industry: "Consumer — luxury auto (individual buyer)",
        painPoints: [
          "45-70 minute each-way commutes on the 405/10 and Wilshire",
          "Spending $250-350/month on gas in a non-hybrid",
          "Burned before by payment games and fees appearing at signing",
        ],
        notes:
          "Researches online first, arrives as an internet lead with quotes in hand. Wants the monthly payment early — the rep's job is to earn the right to that conversation by understanding the commute and trade first.",
      },
      {
        title: "Family upgrader",
        industry: "Consumer — luxury auto (household)",
        painPoints: [
          "Outgrew a two-row SUV: kids, gear, dog, grandparents",
          "Needs the trade-in on the current vehicle to make the numbers work",
          "Decision is made jointly with a spouse — one test drive is never the close",
        ],
        notes:
          "Cross-shops the GX/TX against the BMW X5, Mercedes GLE, and Tesla Model Y. Trade-in value is the emotional center of the deal; transparency on the appraisal wins or loses it.",
      },
      {
        title: "Small-fleet manager",
        industry: "Media production / real estate",
        painPoints: [
          "Weekly SUV rentals are expensive, inconsistent, and an invoicing mess",
          "Needs predictable monthly cost and zero downtime — a car in service is a shuttle lost",
          "CFO scrutinizes own-versus-lease and every line item",
        ],
        notes:
          "Buys 2-4 vehicles at once, usually TX 350s. Decision criteria: delivery timing before a production start, service concierge with loaners, and an itemized fleet quote the CFO can defend.",
      },
    ],
    objections: [
      {
        objection: "I can get the BMW X5 for the same monthly payment.",
        approvedResponse:
          "Never disparage BMW. Acknowledge it is a genuinely good vehicle, then reframe from payment to total cost of ownership: hybrid fuel savings on their actual commute (quantify it), Lexus reliability and lower maintenance spend, and stronger resale at trade-in time. Offer a printed side-by-side and a back-to-back test drive.",
      },
      {
        objection: "Your trade-in offer is lower than what Carvana quoted me.",
        approvedResponse:
          "Do not argue with the number. Walk through our itemized appraisal report line by line so every deduction is visible, explain that online quotes are conditional and routinely drop after the pickup inspection, and commit in writing to match any firm post-inspection offer they bring us. If records support it, take the appraisal back to the used-car manager for a sharpened number.",
      },
      {
        objection: "I need to think about it.",
        approvedResponse:
          "Agree — a vehicle purchase should be slept on, and say so sincerely. Then isolate: ask what specifically they want to think through (payment, trade number, spouse sign-off, color), resolve what can be resolved now, and set a specific follow-up time. Offer to hold the vehicle with a stock note, no deposit, so thinking does not cost them the car.",
      },
      {
        objection: "I'm just looking.",
        approvedResponse:
          "Welcome it — looking is exactly what the showroom is for. Take the pressure off explicitly ('no one here works on pushing people into cars'), then ask one low-stakes discovery question: what put this vehicle on their list today. Offer a no-obligation test drive and a written trade estimate as useful things to leave with, whether they buy here or not.",
      },
    ],
    competitors: [
      {
        name: "Westside BMW dealers (X5)",
        positioning:
          "They win on badge sportiness and aggressive lease teasers. We win on total cost of ownership: hybrid fuel savings, reliability ratings, cheaper maintenance, stronger resale — put it on one printed sheet next to their quote.",
      },
      {
        name: "Beverly Hills Mercedes dealers (GLE)",
        positioning:
          "They win on interior glamour. We win on dependability, hybrid economy the GLE cannot match without a plug, and our no-market-adjustment pricing policy versus their addendum stickers.",
      },
      {
        name: "Tesla (Model Y direct sales)",
        positioning:
          "They win on tech image and carpool-lane access. We win with buyers who do not want charging logistics: hybrid economy with zero range anxiety, a human service concierge with loaners versus service-center queues, and ride comfort.",
      },
      {
        name: "Carvana / online used retailers",
        positioning:
          "They win on trade-in convenience and a big conditional number. We win on certainty: our appraisal is firm and itemized today, theirs gets revised at pickup — and we match any firm post-inspection offer in writing.",
      },
    ],
    talkTracks: [
      "Open every conversation with the guest's life, not the car: commute, family, weekends, current vehicle. Earn the payment conversation.",
      "Quantify the hybrid math on their actual commute before comparing payments — dollars per month, not miles per gallon.",
      "When trade-in friction appears, put our itemized appraisal report physically in the guest's hands and walk it line by line.",
      "Close on a specific, calendared next step: a test drive with a day and time, an appraisal appointment, or a numbers review with both decision-makers present.",
    ],
    pricingNotes:
      "Never quote a monthly payment before completing needs discovery and the trade conversation — a payment without the trade number and term is a guess that will be wrong, and wrong numbers destroy trust. MSRP on the sheet, no market adjustments, ever. Protection plans and F SPORT upgrades are presented as options with the total shown both with and without. Typical transactions: ES 300h $52-56k, RX 350h $59-67k, GX 550 $72-85k, TX 350 $58-66k; fleet deals 3+ units get fleet pricing through the GSM.",
  },

  rubric: {
    presetName: "Discovery Call Fundamentals",
    name: "Lexus WLA Guest Experience Rubric",
    description:
      "Cloned from Discovery Call Fundamentals with a dealership-specific dimension: reps must establish commute, family, and trade-in context before any payment or pricing talk. No-pressure language is graded, not just outcomes.",
    customDimensions: [
      {
        key: "needs_first_discovery",
        name: "Needs-first discovery",
        description:
          "Dealership-specific: did the rep establish the guest's commute, family/usage, and current-vehicle/trade context before discussing payment, price, or discounts — and was the eventual numbers conversation grounded in that context?",
        weight: 2,
        companySpecific: true,
        levels: [
          { score: 1, description: "Opened with price, payment, or 'what will it take' pressure before asking anything about the guest." },
          { score: 2, description: "Asked one or two surface questions but pivoted to payment or inventory push before understanding usage or trade." },
          { score: 3, description: "Covered commute or family usage and asked about the current vehicle, but the numbers talk was not clearly connected back to those needs." },
          { score: 4, description: "Established commute, usage, and trade context before any numbers, and referenced at least one of them when presenting figures." },
          { score: 5, description: "Full needs picture (commute, family, weekends, trade) built first; every number presented was explicitly tied back to the guest's stated situation, with no-pressure language throughout." },
        ],
      },
    ],
  },

  users: [
    { name: "Diane Castellanos", email: "diane@lexuswla.demo", role: "MANAGER", title: "General Sales Manager" },
    { name: "Marcus Osei", email: "marcus@lexuswla.demo", role: "TRAINER", title: "Guest Experience Training Lead" },
    { name: "Rosa Delgado", email: "rosa@lexuswla.demo", role: "ADMIN", title: "Sales Operations Administrator" },
    { name: "Gabriel Fuentes", email: "gabriel@lexuswla.demo", role: "REP", title: "Senior Sales Consultant", highVolume: true },
    { name: "Aisha Thompson", email: "aisha@lexuswla.demo", role: "REP", title: "Sales Consultant", highVolume: true },
    { name: "Kenji Watanabe", email: "kenji@lexuswla.demo", role: "REP", title: "Sales Consultant" },
    { name: "Nadia Haddad", email: "nadia@lexuswla.demo", role: "REP", title: "Fleet & Corporate Sales Consultant" },
  ],

  scenarios: [
    {
      title: "Internet lead follow-up: RX 350h commuter",
      callType: "discovery",
      difficulty: "easy",
      persona: {
        name: "Melissa Grant",
        title: "Marketing Director",
        company: "Household buyer (agency job in Century City)",
        industry: "Consumer — luxury auto",
        personality:
          "Friendly but efficient; researches everything online first. Warms up quickly to a rep who asks about her life before quoting anything. Shuts down at the first whiff of pressure.",
        painPoints: [
          "Mar Vista to mid-Wilshire commute, 50-70 minutes each way",
          "Spending about $300 a month on gas in her 2019 RX 350",
          "Two kids plus a dog — needs cargo space and easy loading",
        ],
        objections: [
          "I can get the BMW X5 for the same monthly payment.",
          "My last dealership experience was payment games — how do I know yours is different?",
        ],
        budget: "Owns her 2019 RX 350 outright as a trade; comfortable around $900-1,000 a month financed, but will not say so unless trust is earned.",
        notes:
          "Submitted a website inquiry on an RX 350h last night. A good rep responds fast, discovers commute, family, and trade before numbers, quantifies the hybrid fuel savings in dollars, and books a specific test-drive time with a trade appraisal attached.",
      },
      winConditions: [
        "Established commute, family usage, and the 2019 RX trade before any payment or price talk",
        "Handled the BMW X5 payment comparison with the approved total-cost-of-ownership response, without disparaging BMW",
        "Booked a test drive with a specific day and time, with the trade appraisal scheduled during the visit",
      ],
    },
    {
      title: "Payment shopper cross-shopping the BMW X5",
      callType: "negotiation",
      difficulty: "medium",
      persona: {
        name: "Derek Cho",
        title: "Portfolio Manager",
        company: "Household buyer (finance job in Santa Monica)",
        industry: "Consumer — luxury auto",
        personality:
          "Numbers-first and skeptical of salespeople; opens every conversation asking for the payment. Respects reps who are direct and transparent, punishes evasion and spec-dumping by disengaging.",
        painPoints: [
          "Wants a premium SUV but refuses to overpay relative to the X5 lease offers he has in hand",
          "His Audi Q5 lease matures in six weeks, so timing pressure is real",
          "Hates wasting time — has walked out of two dealerships already",
        ],
        objections: [
          "I can get the BMW X5 for the same monthly payment.",
          "Just give me your best number over the phone — I am not coming in to play games.",
        ],
        budget: "Pre-approved through his credit union; genuinely can afford either vehicle. Target payment around $850 but anchored low at $750.",
        notes:
          "The trap is quoting a payment before discovery — any number given cold will be shopped against BMW and lost. A strong rep redirects to total cost of ownership, quantifies the hybrid savings on his Santa Monica commute, and converts the phone demand into an in-person side-by-side numbers review.",
      },
      winConditions: [
        "Declined to quote a cold payment without discovery, while keeping Derek engaged rather than lecturing him",
        "Reframed the X5 comparison to total cost of ownership using the approved response, with the fuel math quantified in dollars per month",
        "Secured a calendared in-person appointment for a side-by-side numbers review, with his Q5 lease-return appraised at the same visit",
      ],
    },
    {
      title: "Trade-in value objection on a GX 550 Luxury+",
      callType: "negotiation",
      difficulty: "hard",
      persona: {
        name: "Adaeze Okonkwo",
        title: "Architect",
        company: "Household buyer (co-deciding with spouse Emeka)",
        industry: "Consumer — luxury auto",
        personality:
          "Precise, fair, and unemotional about numbers; keeps a printed Carvana quote in her bag and quotes it verbatim. Rewards transparency and written commitments; any hand-waving about the trade number ends the deal.",
        painPoints: [
          "Family of five outgrew their 2019 4Runner; third row is a hard requirement",
          "Weekend Topanga fire-road trips and a small camper demand real capability, not a crossover",
          "The deal only works if the trade-in gap versus Carvana's $31,200 quote is closed or explained",
        ],
        objections: [
          "Your trade-in offer is lower than what Carvana quoted me.",
          "I need to think about it — Emeka and I decide together, and we do not decide in showrooms.",
        ],
        budget: "Approved for the GX 550 Luxury+ around $80k; the sticking point is the $1,400 trade gap, not the price of the truck.",
        notes:
          "Post-test-drive negotiation. A strong rep walks the itemized appraisal line by line, explains that online quotes are conditional until post-inspection, offers a written match commitment, takes the appraisal back for sharpening, and sets a specific follow-up — respecting the joint decision instead of pushing for a same-day close.",
      },
      winConditions: [
        "Handled the Carvana trade-in objection with the approved response: itemized appraisal walkthrough plus a written match commitment on any firm post-inspection offer",
        "Kept the numbers transparent — MSRP with no market adjustment, options shown with and without — and tied them back to the family's stated needs",
        "Set a specific, time-bound follow-up that included both decision-makers, with the vehicle held via stock note rather than pressuring a same-day signature",
      ],
    },
  ],

  transcripts: {
    good: GOOD_CALL,
    mid: MID_CALL,
    poor: POOR_CALL,
    demo: DEMO_CALL,
    followups: [FOLLOWUP_TRADE, FOLLOWUP_FLEET],
  },

  prospectNames: ["Melissa Grant", "Derek Cho", "The Okonkwo Household", "Harbor Light Productions", "The Vasquez Family"],

  roleplayDialogues: {
    good: [
      [
        "Hi Melissa, this is Aisha at Lexus of West Los Angeles — you inquired about an RX 350h last night. Do you have four minutes now, or should I call after your workday?",
        "Now is fine, actually. You are quick.",
      ],
      [
        "Then I will make it count. Before any numbers — what put the RX 350h on your list? Most guests tell me it is the commute.",
        "It is exactly the commute. Mar Vista to mid-Wilshire, and I am spending three hundred a month on gas.",
      ],
      [
        "So call it three hundred a month today. The 350h roughly halves that in stop-and-go. Who else rides in the car, and what are you driving now?",
        "Two kids and a golden retriever. I have a 2019 RX 350 that we own outright — I would trade it if the number is fair.",
      ],
      [
        "A returning RX owner with a trade — that is the easy version of this. Anything else in the running I should know about?",
        "My neighbor says he can get me a BMW X5 at the same payment, honestly.",
      ],
      [
        "The X5 is a genuinely nice truck, so let us compare them honestly: on your commute the hybrid saves about a hundred forty a month in fuel, and the RX holds value better at trade time. Come in Saturday at ten thirty — I will have the side-by-side printed, the Nori Green pulled up for your commute route, and a firm written appraisal on your 2019 while we drive. Deal?",
        "Deal. Saturday at ten thirty — and bring that comparison on paper.",
      ],
    ],
    poor: [
      [
        "Hey, is this Derek? It is the Lexus store. So the RX comes in the 350, the 350h, the 450h plug-in, and the 500h F SPORT Performance, plus Premium, Premium Plus, and Luxury packages. Which one do you want to buy?",
        "I only asked about pricing online. I have not decided anything.",
      ],
      [
        "Well, what monthly payment do you need to be at? If I can hit your number, can you come in tonight?",
        "I am not giving you a number, and I am not coming in tonight.",
      ],
      [
        "These hybrids are flying off the lot, my friend. Prices go up next month — this is really the week to buy.",
        "You have not asked me a single thing about what I actually need.",
      ],
      [
        "Okay, sure — but you are comparing us to BMW, right? BMWs live in the shop, everyone knows that.",
        "My last two cars were BMWs and they were fine. This is not working for me.",
      ],
      [
        "Alright, alright. Should I just pencil you in for Saturday at noon? I will put you down tentatively.",
        "Please do not put me down for anything. I have to go.",
      ],
    ],
  },

  accounts: [
    {
      ref: "grant",
      ownerEmail: "aisha@lexuswla.demo",
      name: "The Grant Household",
      industry: "Consumer — luxury auto",
      size: "Household",
      notes: "Internet lead on RX 350h. Returning Lexus owner (2019 RX 350 trade). Commuter + family buyer; burned before by payment games.",
    },
    {
      ref: "cho",
      ownerEmail: "kenji@lexuswla.demo",
      name: "The Cho Household",
      industry: "Consumer — luxury auto",
      size: "Household",
      notes: "Payment-first shopper cross-shopping BMW X5 lease offers. Audi Q5 lease matures in six weeks. Pre-approved through credit union.",
    },
    {
      ref: "okonkwo",
      ownerEmail: "gabriel@lexuswla.demo",
      name: "The Okonkwo Household",
      industry: "Consumer — luxury auto",
      size: "Household",
      notes: "Family of five upgrading from a 2019 4Runner to a GX 550 Luxury+. Joint decision (Adaeze + Emeka). Trade gap vs. Carvana is the deal's center of gravity.",
    },
    {
      ref: "harborlight",
      ownerEmail: "nadia@lexuswla.demo",
      name: "Harbor Light Productions",
      domain: "harborlightprods.demo",
      industry: "Media production",
      size: "40-80",
      website: "https://harborlightprods.demo",
      notes: "Culver City production company replacing weekly SUV rentals with an owned/leased shuttle fleet. Three TX 350s needed before a September pilot start. CFO Jonah Blake scrutinizes every line.",
    },
    {
      ref: "vasquez",
      ownerEmail: "gabriel@lexuswla.demo",
      name: "The Vasquez Family",
      industry: "Consumer — luxury auto",
      size: "Household",
      notes: "Delivered: RX 350h Premium AWD in Iridium. Textbook needs-first deal — referenced in training. Strong referral source.",
    },
  ],

  contacts: [
    {
      ref: "melissa",
      accountRef: "grant",
      ownerEmail: "aisha@lexuswla.demo",
      name: "Melissa Grant",
      title: "Marketing Director (household decision-maker)",
      email: "melissa.grant@lamail.demo",
      phone: "+1-310-555-0164",
    },
    {
      ref: "derek",
      accountRef: "cho",
      ownerEmail: "kenji@lexuswla.demo",
      name: "Derek Cho",
      title: "Portfolio Manager (household decision-maker)",
      email: "derek.cho@lamail.demo",
      phone: "+1-424-555-0137",
    },
    {
      ref: "adaeze",
      accountRef: "okonkwo",
      ownerEmail: "gabriel@lexuswla.demo",
      name: "Adaeze Okonkwo",
      title: "Architect (co-decision-maker with spouse)",
      email: "adaeze.okonkwo@lamail.demo",
      phone: "+1-310-555-0189",
    },
    {
      ref: "rachel",
      accountRef: "harborlight",
      ownerEmail: "nadia@lexuswla.demo",
      name: "Rachel Stein",
      title: "Head of Production Operations",
      email: "rachel@harborlightprods.demo",
      phone: "+1-310-555-0122",
    },
    {
      ref: "jonah",
      accountRef: "harborlight",
      ownerEmail: "nadia@lexuswla.demo",
      name: "Jonah Blake",
      title: "Chief Financial Officer",
      email: "jonah@harborlightprods.demo",
      phone: "+1-213-555-0146",
    },
    {
      ref: "miguel",
      accountRef: "vasquez",
      ownerEmail: "gabriel@lexuswla.demo",
      name: "Miguel Vasquez",
      title: "High school teacher (household decision-maker)",
      email: "miguel.vasquez@lamail.demo",
      phone: "+1-818-555-0158",
    },
  ],

  deals: [
    {
      ref: "deal-grant-rx",
      accountRef: "grant",
      contactRef: "melissa",
      ownerEmail: "aisha@lexuswla.demo",
      name: "Grant · RX 350h Premium AWD",
      stage: "discovery",
      amount: 60940,
      product: "RX 350h Premium AWD",
      probability: 40,
      nextStep: "Saturday 10:30 AM test drive on her commute route + written appraisal on the 2019 RX 350",
      closeInDays: 14,
      notes: "Cross-shopping BMW X5 on payment. Bring the printed total-cost-of-ownership side-by-side.",
      createdNote:
        "Internet lead from the website RX 350h page, responded within 12 hours. Discovery call covered commute (Mar Vista to mid-Wilshire), family usage, and the owned-outright 2019 RX 350 trade before any numbers. Test drive booked for Saturday 10:30 AM with appraisal during the drive.",
      linkRecentCalls: true,
    },
    {
      ref: "deal-cho-rx",
      accountRef: "cho",
      contactRef: "derek",
      ownerEmail: "kenji@lexuswla.demo",
      name: "Cho · RX 350h F SPORT",
      stage: "negotiation",
      amount: 66595,
      product: "RX 350h Premium AWD + F SPORT appearance package",
      probability: 70,
      nextStep: "In-person side-by-side numbers review vs. his X5 lease offer; Q5 lease-return appraisal same visit",
      closeInDays: 7,
      notes: "Q5 lease matures in six weeks — real timing pressure. Do not quote cold payments; he shops every number against BMW.",
      createdNote:
        "Payment-first internet lead with X5 lease quotes in hand. Held the line on needs-first discovery, quantified hybrid fuel savings on his Santa Monica commute, and converted the phone payment demand into an in-person numbers review. Quote sent with the F SPORT package and protection plan itemized.",
      linkRecentCalls: true,
    },
    {
      ref: "deal-okonkwo-gx",
      accountRef: "okonkwo",
      contactRef: "adaeze",
      ownerEmail: "gabriel@lexuswla.demo",
      name: "Okonkwo · GX 550 Luxury+",
      stage: "proposal",
      amount: 84650,
      product: "GX 550 Luxury+",
      probability: 60,
      nextStep: "Deliver sharpened trade number + seven-pin wiring line by 6 PM; decision with Emeka by Friday",
      closeInDays: 10,
      notes: "Trade gap vs. Carvana ($31,200 conditional quote) is the whole deal. Written match commitment extended. Vehicle held via stock note through Friday.",
      createdNote:
        "Walk-in family of five upgrading from a 2019 4Runner. Test drive confirmed the third row and Topanga fire-road fit. Post-drive numbers call handled the Carvana trade objection with the itemized appraisal walkthrough and a written match commitment; used-car manager re-scored the trade to $30,600 with service records.",
      linkRecentCalls: true,
    },
    {
      ref: "deal-harborlight-fleet",
      accountRef: "harborlight",
      contactRef: "rachel",
      ownerEmail: "nadia@lexuswla.demo",
      name: "Harbor Light · TX 350 shuttle fleet (3 units)",
      stage: "demo",
      amount: 184485,
      product: "TX 350 Luxury AWD x3 + protection plans",
      probability: 45,
      nextStep: "Thursday 10 AM Culver City ride-along with Rachel + CFO Jonah; present own-vs-lease sheet with September delivery schedule",
      closeInDays: 30,
      notes: "Hard deadline: three vehicles on their lot the first week of September before pilot production starts. Fleet package with service concierge + loaners is the differentiator vs. continuing rentals.",
      createdNote:
        "Inbound from Harbor Light's production ops after their rental costs spiked. Discovery established two-to-three vehicles per week in rentals, talent-comfort requirements, and CFO scrutiny on own-vs-lease. Three matching TX 350s allocated from West LA inventory pending the Thursday decision meeting.",
    },
    {
      ref: "deal-walkin-es",
      ownerEmail: "kenji@lexuswla.demo",
      name: "Walk-in · ES 300h lease inquiry",
      stage: "lead",
      amount: 52480,
      product: "ES 300h Luxury",
      probability: 15,
      nextStep: "Follow up with the lease-vs-finance comparison she requested; invite for an extended test drive",
      closeInDays: 21,
      notes: "Saturday walk-in, 'just looking' — took the pressure off per playbook, she stayed forty minutes. Downsizing from a paid-off Highlander; commutes Culver City to Burbank.",
      createdNote:
        "Saturday floor walk-in browsing the ES 300h. Opened with the approved 'just looking' response, learned the Culver City to Burbank commute and the paid-off Highlander, and left with permission to send a lease-vs-finance comparison. No appointment yet — nurture.",
    },
    {
      ref: "deal-vasquez-rx",
      accountRef: "vasquez",
      contactRef: "miguel",
      ownerEmail: "gabriel@lexuswla.demo",
      name: "Vasquez · RX 350h Premium (delivered)",
      stage: "closed_won",
      amount: 63150,
      product: "RX 350h Premium AWD + Lexus Extended Protection",
      probability: 100,
      closeInDays: -12,
      notes: "Delivered in Iridium with the extended protection plan. Referenced in Saturday training as the textbook needs-first deal. Ask for referrals at first service visit.",
      createdNote:
        "Referral from a service customer. Full needs-first path: commute and family discovery, trade appraised on the spot, one itemized sheet, protection plan presented with-and-without. Signed on the second visit, delivered twelve days ago.",
    },
  ],

  products: [
    {
      sku: "RX350H-PREM",
      name: "RX 350h Premium AWD",
      description: "Two-row hybrid luxury SUV, 2.5L hybrid AWD, ~37 mpg city. Premium package: heated/ventilated front seats, power liftgate, panoramic roof.",
      category: "Vehicle — SUV",
      listPrice: 58950,
      cost: 54400,
      unit: "vehicle",
      trackInventory: true,
      reorderPoint: 2,
      initialStock: 7,
    },
    {
      sku: "ES300H-LUX",
      name: "ES 300h Luxury",
      description: "Hybrid luxury sedan, ~44 mpg combined. Luxury package: semi-aniline leather, heated rear seats, 12.3-inch multimedia.",
      category: "Vehicle — Sedan",
      listPrice: 51890,
      cost: 47900,
      unit: "vehicle",
      trackInventory: true,
      reorderPoint: 2,
      initialStock: 5,
    },
    {
      sku: "GX550-LP",
      name: "GX 550 Luxury+",
      description: "Three-row body-on-frame 4x4, twin-turbo V6, adaptive variable suspension, full-time 4WD with crawl control. Tow rated 9,000 lbs.",
      category: "Vehicle — SUV",
      listPrice: 79950,
      cost: 74100,
      unit: "vehicle",
      trackInventory: true,
      reorderPoint: 2,
      initialStock: 3,
    },
    {
      sku: "TX350-LUX",
      name: "TX 350 Luxury AWD",
      description: "Three-row luxury crossover with an adult-usable third row — the Westside studio-shuttle favorite. Luxury package interior.",
      category: "Vehicle — SUV",
      listPrice: 62650,
      cost: 57800,
      unit: "vehicle",
      trackInventory: true,
      reorderPoint: 2,
      initialStock: 6,
    },
    {
      sku: "FSPORT-PKG",
      name: "F SPORT styling accessory set",
      description: "Dealer-installed F SPORT styling: 21-inch alloy wheels, F SPORT steering wheel and pedal set, and badging.",
      category: "Upgrade package",
      listPrice: 4150,
      cost: 2600,
      unit: "package",
      trackInventory: false,
    },
    {
      sku: "LEXT-PROT",
      name: "Lexus Extended Protection plan",
      description: "Extended vehicle service agreement: 8-year/125,000-mile mechanical coverage, roadside assistance, and service-loaner benefit.",
      category: "Protection plan",
      listPrice: 3495,
      cost: 1400,
      unit: "plan",
      trackInventory: false,
    },
  ],

  warehouse: {
    code: "LOT-WLA",
    name: "West LA vehicle inventory",
    address: "11000 Santa Monica Blvd, Los Angeles, CA 90025",
  },

  quotes: [
    {
      dealRef: "deal-cho-rx",
      ownerEmail: "kenji@lexuswla.demo",
      title: "Cho · RX 350h F SPORT — itemized",
      notes: "One sheet as promised: MSRP, no market adjustment, options shown so the total works with or without the protection plan. Side-by-side vs. the X5 lease offer attached at the appointment.",
      status: "sent",
      taxCode: "US-CA",
      validInDays: 10,
      lines: [
        { sku: "RX350H-PREM", description: "RX 350h Premium AWD — Iridium / black interior", quantity: 1 },
        { sku: "FSPORT-PKG", description: "F SPORT appearance package", quantity: 1 },
        { sku: "LEXT-PROT", description: "Lexus Extended Protection plan (optional — total shown with and without)", quantity: 1 },
      ],
    },
    {
      dealRef: "deal-harborlight-fleet",
      ownerEmail: "nadia@lexuswla.demo",
      title: "Harbor Light · TX 350 shuttle fleet (3 units) — fleet pricing",
      notes: "Fleet pricing per GSM approval: three matching TX 350 Luxury AWD, delivery first week of September. Includes fleet service concierge with pickup and loaners. Own-vs-lease comparison presented Thursday.",
      status: "draft",
      taxCode: "US-CA",
      validInDays: 21,
      lines: [
        { sku: "TX350-LUX", description: "TX 350 Luxury AWD — matching spec, fleet price", quantity: 3, unitPrice: 58000 },
        { sku: "LEXT-PROT", description: "Lexus Extended Protection plan — fleet vehicles", quantity: 3 },
      ],
    },
    {
      dealRef: "deal-vasquez-rx",
      ownerEmail: "gabriel@lexuswla.demo",
      title: "Vasquez · RX 350h Premium — delivered",
      notes: "Final signed sheet: RX 350h Premium AWD in Iridium plus extended protection. Trade and fees itemized on the delivery copy.",
      status: "accepted",
      taxCode: "US-CA",
      validInDays: 30,
      lines: [
        { sku: "RX350H-PREM", description: "RX 350h Premium AWD — Iridium / rioja red interior", quantity: 1, unitPrice: 59750 },
        { sku: "LEXT-PROT", description: "Lexus Extended Protection plan", quantity: 1, unitPrice: 3400 },
      ],
    },
  ],

  outreachEmails: [
    {
      fromEmail: "aisha@lexuswla.demo",
      contactRef: "melissa",
      dealRef: "deal-grant-rx",
      subject: "Saturday 10:30 — your RX 350h drive + appraisal confirmed",
      body: `Hi Melissa,

Great speaking with you today. Confirming Saturday at 10:30 AM at our Santa Monica Blvd store.

Here is what will be ready when you arrive:
- The RX 350h Premium AWD in Nori Green, pulled up and ready — we will drive your actual Wilshire commute route
- A firm written appraisal on your 2019 RX 350 while we are out (please bring the registration)
- The printed side-by-side vs. the BMW X5 you asked for: payment, fuel cost on your commute, maintenance, and resale on one page

No obligation on any of it, and every number stays itemized. My cell is below if anything changes.

See you Saturday,
Aisha Thompson
Lexus of West Los Angeles`,
    },
    {
      fromEmail: "nadia@lexuswla.demo",
      contactRef: "rachel",
      dealRef: "deal-harborlight-fleet",
      subject: "Thursday 10 AM at your lot — TX 350 ride-along + own-vs-lease numbers",
      body: `Hi Rachel,

Thank you for the time today. Confirming Thursday at 10:00 AM at your Culver City lot — I will bring a TX 350 Luxury for you and Jonah to ride in, spec'd exactly as the three fleet units would be.

For the meeting I will have:
- The itemized fleet quote for three matching TX 350s (Jonah can pick apart every line — that is how we print them)
- The own-vs-lease comparison with one predictable monthly number for each path
- The September delivery schedule, with all three units allocated from our West LA inventory this week
- Details on the fleet service concierge: we collect the vehicle from your lot and leave a loaner, so a service day never costs you a shuttle

If anything shifts with the pilot dates, call my cell and we will adjust.

Best,
Nadia Haddad
Fleet & Corporate Sales, Lexus of West Los Angeles`,
    },
  ],

  outreachCalls: [
    {
      fromEmail: "gabriel@lexuswla.demo",
      contactRef: "adaeze",
      dealRef: "deal-okonkwo-gx",
      notes:
        "Promised 6 PM update delivered: used-car manager re-scored the 4Runner trade to $30,600 with the service records; written Carvana match commitment reiterated; seven-pin trailer wiring added to the sheet at cost ($240 installed). Revised itemized sheet emailed during the call. Adaeze and Emeka deciding tonight, callback expected tomorrow. GX held via stock note through Friday.",
      durationSec: 380,
      callType: "negotiation",
    },
    {
      fromEmail: "kenji@lexuswla.demo",
      contactRef: "derek",
      dealRef: "deal-cho-rx",
      notes:
        "Follow-up on the sent quote. Derek pushed again for a best-and-final over the phone; held the approved line — numbers side by side in person with his X5 offer sheet, Q5 lease-return appraised same visit. Quantified the fuel math on his Santa Monica commute (~$120/month savings) which landed. Appointment set for Tuesday 5:30 PM.",
      durationSec: 290,
      callType: "negotiation",
    },
  ],

  assignments: [
    {
      repEmail: "kenji@lexuswla.demo",
      scenarioTitle: "Payment shopper cross-shopping the BMW X5",
      type: "ROLEPLAY",
      targetCount: 3,
      doneCount: 1,
      note: "Your last two graded calls quoted payment ranges before discovery was done. Run the X5 payment-shopper gauntlet three times before the Cho appointment on Tuesday — hold the line without lecturing.",
      dueInDays: 4,
    },
    {
      repEmail: "aisha@lexuswla.demo",
      scenarioTitle: "Trade-in value objection on a GX 550 Luxury+",
      type: "ROLEPLAY",
      targetCount: 2,
      doneCount: 0,
      note: "You handle internet leads beautifully; trade-gap negotiations are the next skill. Practice the Carvana objection with the itemized-appraisal walkthrough and the written match commitment — no hand-waving on the number.",
      dueInDays: 7,
    },
    {
      repEmail: "nadia@lexuswla.demo",
      type: "UPLOAD",
      targetCount: 3,
      doneCount: 2,
      note: "Upload your three Harbor Light fleet calls before Thursday's Culver City meeting — I want to review the own-vs-lease framing with Marcus before you present to their CFO.",
      dueInDays: 3,
    },
  ],
};
