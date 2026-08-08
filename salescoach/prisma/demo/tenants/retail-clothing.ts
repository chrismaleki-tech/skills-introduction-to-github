/**
 * Demo tenant: Thread & Loom — a Los Angeles contemporary apparel brand whose
 * wholesale team sells seasonal collections and a year-round core denim
 * program to independent boutiques, regional department stores, and online
 * retailers. Buyers care about sell-through, markup (keystone+), delivery
 * windows, neighborhood exclusivity, and markdown support.
 */

import type { DemoTenantSpec } from "../types";

export const spec: DemoTenantSpec = {
  orgName: "Thread & Loom",

  company: {
    description:
      "Thread & Loom is a Los Angeles contemporary apparel brand selling wholesale to independent boutiques, regional department stores, and online retailers. The line is built around a year-round core denim program (five fits, never dropped, reorderable weekly with no minimum) plus two seasonal capsule collections and an everyday knits program. Wholesale price points run $33-$92; suggested retail supports a 2.2-2.3x markup.",
    valueProps: [
      "Core denim program is in stock year-round: buyers open shallow and reorder weekly with no minimum, instead of guessing a full season out",
      "Contractual ship windows with a late-delivery credit — goods land when the selling season starts, not after it",
      "One stockist per neighborhood on the core program, in writing, protecting the buyer's full-price sell-through",
    ],
    products: [
      {
        name: "Core Denim Program",
        description:
          "Five permanent denim fits (selvedge straight, high-rise wide leg, and three companion fits) retailing $150-$168. Never dropped, replenished weekly from the LA Arts District DC.",
        differentiators: [
          "No reorder minimum on core styles — boutiques reorder six units at a time",
          "Supports 2.2-2.3x initial markup versus keystone on most contemporary denim",
          "48-hour reorder turnaround from Los Angeles",
        ],
        idealFor: "Retailers who want a denim anchor without betting a season's open-to-buy on one delivery.",
      },
      {
        name: "Seasonal Capsule Collection",
        description:
          "Two tightly edited capsules per year (18-24 SKUs): dresses, chore coats, statement knits. Sold off the linesheet during market with fixed delivery windows.",
        differentiators: [
          "Two delivery windows per season so opening orders can be split",
          "Ship-window guarantee with a credit if goods land late",
          "Editorial imagery and copy pack included for e-commerce accounts",
        ],
        idealFor: "Boutiques and online retailers who need newness with predictable delivery.",
      },
      {
        name: "Everyday Knits Program",
        description:
          "Replenishable knit basics — tee multipacks, rib mocknecks — at accessible price points that build basket size and repeat traffic.",
        differentiators: [
          "Highest sell-through category in the line (typically 75%+ at full price)",
          "Pack-based ordering keeps opening dollars low",
        ],
        idealFor: "Any account that wants dependable full-price volume between capsule drops.",
      },
    ],
    personas: [
      {
        title: "Boutique owner-buyer",
        industry: "Independent specialty retail",
        painPoints: [
          "A third of last season's buy went to the markdown rack",
          "Open-to-buy is committed six months out with no flexibility",
          "Vendors deliver late and eat the best selling weeks of the season",
          "The store two blocks over carries the same brands",
        ],
        notes:
          "Owns the P&L personally — markdowns come out of her pocket. Wins on reorderability, exclusivity, and split deliveries. Will end the call if the rep pitches fabric stories before asking about her sell-through.",
      },
      {
        title: "Department store category buyer",
        industry: "Regional department stores",
        painPoints: [
          "Denim wall runs sub-50% full-price sell-through",
          "Gives back six figures a year in markdown money to keep goods moving",
          "Planners demand vendor scorecards: on-time delivery, fill rate, sell-through by door",
        ],
        notes:
          "Data-driven and skeptical of brand romance. Needs sell-through by door, margin math, and markdown support terms before committing test doors. Decisions above ~$50k go through the DMM.",
      },
      {
        title: "Head of buying, online retailer",
        industry: "E-commerce apparel retail",
        painPoints: [
          "Return rates on denim bought without fit data",
          "Content production cost for every new SKU",
          "Stockouts on winners because vendors cannot replenish in-season",
        ],
        notes:
          "Cares about weeks-of-supply and replenishment speed more than seasonal storytelling. The included imagery pack and 48-hour core reorders are the wedge.",
      },
    ],
    objections: [
      {
        objection: "Your minimums are too high for a store my size.",
        approvedResponse:
          "Acknowledge, then explain the structure: the opening minimum is $2,500 and can be split across two delivery windows, and after opening, core styles have no reorder minimum — boutiques reorder six units at a time. The program is built so small doors buy shallow and chase winners.",
      },
      {
        objection: "The margins don't work at that wholesale price — I need better than keystone.",
        approvedResponse:
          "Reframe from initial markup to maintained margin: core denim retails $150-$168, which supports 2.2-2.3x, and because core styles are reorderable the buyer stops eating markdowns on a season-long bet. Quantify their markdown losses from last season, then show maintained margin beats a cheaper line they mark down by January.",
      },
      {
        objection: "My last vendor missed the delivery window and killed my season.",
        approvedResponse:
          "Never argue that it won't happen; show the mechanism: ship windows are contractual with a late-delivery credit, production is tracked weekly from the LA DC, and the buyer can cancel any late delivery without penalty. Offer references from two current stockists on delivery performance.",
      },
      {
        objection: "Fast fashion knocks off your looks at a third of the price.",
        approvedResponse:
          "Agree they will, then differentiate on what a knockoff cannot copy: fabric quality that keeps return rates low, a core program the customer comes back for, and full-price positioning the retailer's margin depends on. Their customer buying a $158 jean is not the customer cross-shopping a $40 one.",
      },
    ],
    competitors: [
      {
        name: "Velvet Standard",
        positioning:
          "Mid-market contemporary brand with lower opening minimums but seasonal-only buying and a weak delivery record. We win on the reorderable core program, contractual ship windows, and written neighborhood exclusivity. Anchor on their markdown losses from last season's Velvet Standard buy.",
      },
      {
        name: "Nova Basics",
        positioning:
          "Fast-fashion-adjacent wholesale program that wins on price and loses on quality and margin protection — they sell everyone on the block and discount widely. We win on exclusivity, full-price sell-through, and return rates. Never compete on first cost; compete on maintained margin.",
      },
    ],
    talkTracks: [
      "Open with the buyer's sell-through and markdown losses, not the collection. The linesheet comes out after the math.",
      "Always quantify last season's markdown dollars before any wholesale price talk — markdowns are where the buyer's margin actually goes.",
      "Position neighborhood exclusivity as protection for the buyer's full-price sell-through, not as a perk for us.",
    ],
    pricingNotes:
      "Wholesale $33-$92 per unit; suggested retail supports 2.2-2.3x markup on denim, keystone-plus across the line. Opening order minimum $2,500, splittable across two delivery windows. No reorder minimum on core styles. Terms: net 30 with 2/10 discount; first orders 50% deposit, 50% on delivery. Markdown support (up to 3% of receipts) only on programs above $25k with agreed sell-through checkpoints. Never quote program pricing before quantifying the buyer's markdown losses.",
  },

  rubric: {
    presetName: "Discovery Call Fundamentals",
    name: "Thread & Loom Wholesale Rubric",
    description:
      "Discovery Call Fundamentals plus a company-specific dimension: reps must quantify the buyer's sell-through, markup, and markdown losses in dollars before any wholesale price or minimums talk.",
    customDimensions: [
      {
        key: "sell_through_math",
        name: "Sell-through math",
        description:
          "Company-specific: quantified the buyer's sell-through rate, initial markup, and markdown losses in dollars before discussing wholesale price, minimums, or terms.",
        weight: 2,
        companySpecific: true,
        levels: [
          { score: 1, description: "Discussed price or minimums with no discussion of the buyer's sell-through or margins." },
          { score: 2, description: "Touched on sell-through or markdowns qualitatively ('stuff sat') with no numbers." },
          { score: 3, description: "Got a rough sizing — sell-through percentage or markdown share of the buy — but no dollar figure." },
          { score: 4, description: "Buyer confirmed a concrete dollar figure for markdown losses or margin give-back." },
          { score: 5, description: "Concrete dollar figure, played back and confirmed, then tied directly to maintained-margin math when price came up." },
        ],
      },
    ],
  },

  users: [
    { name: "Elena Vasquez", email: "elena@threadloom.demo", role: "MANAGER", title: "VP of Wholesale" },
    { name: "Devon Clarke", email: "devon@threadloom.demo", role: "TRAINER", title: "Sales Enablement Lead" },
    { name: "Priya Raman", email: "priya@threadloom.demo", role: "ADMIN", title: "Wholesale Operations Admin" },
    { name: "Maya Johnson", email: "maya@threadloom.demo", role: "REP", title: "Senior Account Executive, Northeast", highVolume: true },
    { name: "Sam Ortiz", email: "sam@threadloom.demo", role: "REP", title: "Account Executive, Key Accounts", highVolume: true },
    { name: "Grace Liu", email: "grace@threadloom.demo", role: "REP", title: "Territory Rep, South & Midwest" },
    { name: "Tunde Adeyemi", email: "tunde@threadloom.demo", role: "REP", title: "Account Executive, E-commerce Accounts" },
  ],

  scenarios: [
    {
      title: "Cold call: boutique owner burned by markdowns",
      callType: "cold_call",
      difficulty: "easy",
      persona: {
        name: "Dana Brooks",
        title: "Owner & Head Buyer",
        company: "Juniper & Sage",
        industry: "Independent specialty retail",
        personality:
          "Warm but guarded; answers her own phone between customers. Has heard every brand pitch and tunes out fabric stories. Opens up when someone asks about her numbers.",
        painPoints: [
          "A third of last fall's buy went to the markdown rack by January",
          "Open-to-buy committed six months out with zero flexibility to chase winners",
          "Boutique two blocks over carries three of the same brands",
        ],
        objections: [
          "Your minimums are too high for a store my size.",
          "I'm fully bought for the season — call me in the spring.",
        ],
        budget: "Owns the checkbook; comfortable to about $10k per season for a new vendor she trusts.",
        notes:
          "Will give a rep five minutes if they ask about her sell-through before pitching. Mentioning the no-minimum core reorder program and written neighborhood exclusivity is the path to a linesheet appointment.",
      },
      winConditions: [
        "Asked about sell-through and got Dana to size her markdown losses before any product talk",
        "Handled the minimums objection with the approved split-delivery and no-minimum-reorder response",
        "Booked a concrete linesheet appointment with a date and time",
      ],
    },
    {
      title: "Line review: skeptical department-store denim buyer",
      callType: "discovery",
      difficulty: "medium",
      persona: {
        name: "Rob Feinstein",
        title: "Category Buyer, Men's & Denim",
        company: "Harborline Department Stores",
        industry: "Regional department stores",
        personality:
          "Data-driven, blunt, allergic to brand romance. Quotes his own sell-through numbers from memory and expects vendors to know theirs. Respects reps who bring door-level data.",
        painPoints: [
          "Denim wall running 48% full-price sell-through across 11 doors",
          "Gave back roughly $180k in markdown money last year to keep the wall moving",
          "Planners scorecard every vendor on on-time delivery and fill rate",
        ],
        objections: [
          "The margins don't work at that wholesale price — I need better than keystone.",
          "Fast fashion knocks off your looks at a third of the price.",
        ],
        budget: "Controls the denim open-to-buy; anything above $50k in receipts needs his DMM's sign-off.",
        notes:
          "Wants a test: 3-4 doors, core program only, with sell-through checkpoints at week 6 and week 12. A rep who proposes exactly that, with maintained-margin math, wins the meeting.",
      },
      winConditions: [
        "Presented maintained-margin math against his 48% sell-through and $180k markdown figure, not generic claims",
        "Handled the margin objection with the approved maintained-margin reframe",
        "Secured agreement on a 3-4 door test with defined sell-through checkpoints and a follow-up including the DMM",
      ],
    },
    {
      title: "Negotiation: markdown support on the core denim program",
      callType: "negotiation",
      difficulty: "hard",
      persona: {
        name: "Alicia Whitmore",
        title: "Divisional Merchandise Manager",
        company: "Harborline Department Stores",
        industry: "Regional department stores",
        personality:
          "Polite, unhurried, and relentless. Negotiates for a living and opens with an anchor she does not expect to get. Rewards reps who trade rather than cave, and loses respect for ones who discount at the first push.",
        painPoints: [
          "Burned twice by vendors who shipped late and then refused markdown assistance",
          "CFO pressure to cut vendor count and concentrate receipts with reliable partners",
        ],
        objections: [
          "I need 8% markdown money and net 60 or this doesn't get past finance.",
          "My last vendor missed the delivery window and killed my season.",
        ],
        budget: "Signs off on the full denim program; can approve up to $75k in receipts without the GMM.",
        notes:
          "Company policy: markdown support caps at 3% of receipts, only on programs above $25k, with sell-through checkpoints; net 30 with 2/10. A strong rep holds those lines, trades markdown dollars for door count or checkpoint terms, and uses the contractual ship-window credit to defuse the delivery history.",
      },
      winConditions: [
        "Held the 3% markdown support cap and net 30 terms without caving to the 8%/net-60 anchor, trading value instead of discounting",
        "Defused the late-delivery history with the contractual ship-window credit and reference offer",
        "Closed agreement on program terms with a written recap and a signature date",
      ],
    },
  ],

  transcripts: {
    good: `REP: Hi Camille, this is Maya Johnson with Thread & Loom out of Los Angeles — did I catch you before the shop opens?
PROSPECT: You did. I've got a few minutes before eleven.
REP: I'll use them well. We're a contemporary brand — denim, knits, a small seasonal capsule — and we sell to about forty independents in the Northeast. I walked Court Street last month and Maison Ruby didn't have a real denim anchor. How is denim performing for you right now?
PROSPECT: It's honestly my weakest wall. I buy a little from Velvet Standard and fill in with vintage.
REP: When you say weakest — is that sell-through, or margin, or both?
PROSPECT: Both, if I'm honest. The wide-leg did fine last fall, everything else sat.
REP: Roughly what portion of that buy ended up on the markdown rack by January?
PROSPECT: Probably a third of it.
REP: And what's your opening markup on denim — are you at keystone, or better?
PROSPECT: Keystone. I can't push their price points past 2.0.
REP: Okay, let me play that back. On a ten-thousand-dollar wholesale denim buy at keystone, a third going to thirty-off means you handed back around two thousand dollars of margin — before the January cuts. Is that in the ballpark?
PROSPECT: That's the ballpark, and it's the part that keeps me up at night. Markdowns are where my whole margin goes.
REP: One more question on Velvet Standard — when the fall goods shipped, did they land when you needed them?
PROSPECT: Late, actually. September goods showed up mid-October last year. I lost the best selling weeks and then marked them down anyway.
REP: So the markdown problem and the delivery problem are the same problem — you're betting a season's dollars on one delivery that arrives late. That's exactly what our core program is built against. Five denim fits we never drop, retailing $150 to $168, which supports a 2.2 to 2.3 markup, and they're in stock year-round — you open shallow and reorder weekly instead of guessing in March what sells in October. What would it do to your open-to-buy if two-thirds of your denim wall were reorderable?
PROSPECT: It would free up real dollars. But what are your minimums? Small brands always want a five-figure opening and I'm not committing that to an unproven line.
REP: Fair question, and it's the one I hear most. The opening minimum is twenty-five hundred, and we can split it across two delivery windows so you're not sitting on the whole buy in one month. After opening, core styles have no reorder minimum — I have boutiques your size reordering six units at a time. Does twenty-five hundred split over two deliveries feel workable?
PROSPECT: That's more reasonable than I expected. What about terms?
REP: Net 30 standard, with a two percent discount if you pay inside ten days. First season runs half deposit, half on delivery.
PROSPECT: Okay. My other worry — the shop two blocks over carries half of what I carry.
REP: We protect that. One stockist per neighborhood on the core program — if Maison Ruby opens with us, we don't sell anyone else in your trade area, and it's in the agreement, not a handshake.
PROSPECT: In writing? That alone puts you ahead of most brands that call me.
REP: In writing. So here's what I'd suggest: I'm in Brooklyn Thursday and Friday with the fall linesheet and a sample bag — the five core fits plus the capsule. Give me thirty minutes before you open Thursday, and I'll bring sell-through numbers from two boutiques your size in the Northeast so you can check my math against real doors. Thursday at ten?
PROSPECT: Thursday at ten works. Bring the wide-leg.
REP: The high-rise wide leg goes at the top of the bag. I'll email a confirmation this afternoon with the linesheet, the core reorder terms, and the exclusivity language so you can read it all before I show up. Anything else you'd want in that email?
PROSPECT: No, that covers it. See you Thursday, Maya.
REP: See you Thursday, Camille. Thanks for the time before open.`,

    mid: `REP: Hi, this is Tunde calling from Thread & Loom. How's your day going?
PROSPECT: Busy. What's this about?
REP: We're a contemporary apparel brand out of LA. We do a core denim program, two seasonal capsules a year, knits — the denim is Japanese selvedge, the tees are combed cotton, we've got a waxed canvas chore coat that's basically our icon piece. Press loves us.
PROSPECT: Okay. We carry a lot of denim already.
REP: Sure, but ours is really special. The selvedge straight has a chain-stitched hem, the wide leg is our best seller, and the whole line is cut and sewn in LA. The capsule this season has this great Marisol dress too.
PROSPECT: What's the wholesale on the denim?
REP: The selvedge straight is $68 wholesale. We also have an imagery pack for online retailers, and the knits program does really well. Do you buy denim or does someone else on your team handle it?
PROSPECT: I buy everything. What are your minimums and terms?
REP: There's an opening minimum, I'd have to check the exact structure for your account type. It's around twenty-five hundred I believe. Terms are net 30.
PROSPECT: Alright. Send me the linesheet and I'll take a look when I'm planning spring.
REP: Will do, I'll email it over today. Should I follow up in a few weeks maybe?
PROSPECT: Sure, whenever.
REP: Great, thanks so much for your time!`,

    poor: `REP: Hey, is this the person who does the, um, buying for the store?
PROSPECT: This is Dana, it's my store. Who's calling?
REP: I'm with Thread & Loom, we're a clothing brand. So basically our stuff is really high quality and it sells super well everywhere. We do denim and, like, jackets and things.
PROSPECT: I'm with a customer right now. Is this a sales call?
REP: Kind of, yeah. So do you want to buy the fall collection? The linesheet closes soon so it's actually a really good time.
PROSPECT: I don't buy from brands I've never heard of over the phone.
REP: Okay but we're way better than Velvet Standard. Can I send you the linesheet? It has all the styles on it.
PROSPECT: Send whatever you want to the shop email. I need to go.
REP: Cool, and maybe I'll call back next week or something?
PROSPECT: I have a customer. Goodbye.`,

    demo: `REP: Rob, thanks for making time. Last call you told me your denim wall runs 48 percent full-price sell-through across the 11 doors, and you're giving back about $180k a year in markdown money to keep it moving. Today I want to walk the core program, the maintained-margin math against those numbers, and the test structure. Sound right?
PROSPECT: That works. Alicia's joining too — anything over $50k goes through her.
REP: Glad she's here. Alicia, anything you want to make sure we cover?
PROSPECT: Delivery. Your predecessor in this category shipped six weeks late and then wouldn't discuss markdown assistance. That killed a season and it's why the slot is open.
REP: Then let's start there instead of the line. Our ship windows are contractual with a late-delivery credit, production is tracked weekly out of our LA DC, and you can cancel any late delivery without penalty — it's in section two of the program terms in front of you. I'll also connect you with two current stockists who can speak to delivery performance directly. Fair place to start?
PROSPECT: It's the right place to start. Show me the margin math.
REP: Here's the wall today: 48 percent full-price sell-through means more than half your receipts need markdown dollars to move. The core program is five fits we never drop, retailing $150 to $168 against $64 to $68 wholesale — a 2.2 to 2.3 initial markup instead of keystone. And because core styles replenish weekly with no minimum, your buyers chase what's selling instead of marking down what isn't. In doors comparable to your Portsmouth and Burlington stores, the program runs 68 percent full-price sell-through.
PROSPECT: Every vendor shows me a deck with 68 percent on it. What's the test?
REP: Four doors, core program only, roughly $58k in receipts for the season. Sell-through checkpoints at week 6 and week 12 — if we're under 60 percent full-price at week 12, you get markdown support at the program cap and you walk away clean. If we're over, we plan the spring expansion together.
PROSPECT: What's the cap on markdown support?
REP: Three percent of receipts, on programs above $25k, tied to those checkpoints. I'll be straight with you — that number doesn't move, because our full-price positioning is the reason the sell-through holds. Where I have room is door selection, checkpoint timing, and the imagery pack for your e-commerce team at no charge.
PROSPECT: Finance will push for more than three.
REP: I understand, and I'd rather trade than discount: if finance needs more protection, we can structure the second delivery as cancelable at the week-6 checkpoint instead. That caps your downside harder than markdown dollars would. Would that get it through?
PROSPECT: That's a more useful lever than another point of markdown money, honestly. Send both structures.
REP: Done. So to confirm: I send the four-door test proposal with both protection structures, the delivery terms with the late credit, and the two stockist references today. What has to happen on your side to have this signed before the market window closes on the 28th?
PROSPECT: If the references check out and finance clears the cancelable-delivery structure, Alicia signs it. Get us the paperwork this week.
REP: You'll have it tomorrow morning, and I'm putting a fifteen-minute call on your calendars for Friday to close whatever the references surface. Thank you both.`,

    followups: [
      `REP: Jenny, it's Grace at Thread & Loom — quick one, do you have five minutes?
PROSPECT: For you, sure. The denim wall's been busy.
REP: That's what I was hoping to hear. It's been three weeks since the opening order landed — how are the five fits moving?
PROSPECT: The selvedge straight is nearly gone — I have two pairs left in the popular sizes. Wide leg is moving too. The mockneck sweaters honestly surprised me, I'm low on medium and large.
REP: So let's fix the sizes before the weekend. If I get a reorder in today — say twelve selvedge straight across your size curve, six wide leg, and twelve mocknecks in medium and large — it ships from LA within 48 hours and you're set by Friday.
PROSPECT: You can really turn it that fast? My old vendor quoted four weeks on reorders.
REP: That's the whole point of the core program — those five fits never go out of stock on our side. And there's no minimum, so if you'd rather do eight straights instead of twelve, that's fine too.
PROSPECT: No, twelve is right, they're selling. Add six of the tee packs while you're at it.
REP: Twelve selvedge straight, six wide leg, twelve mocknecks in M and L, six tee 3-packs. I'll email the confirmation in an hour — same net 30 terms. And Jenny, when we hit the eight-week mark I'd like to pull your sell-through together and talk about whether the chore coat earns a spot for fall. Can I put twenty minutes on your calendar for the week of the 14th?
PROSPECT: Do it. Tuesday mornings are quiet.
REP: Tuesday the 15th, 9:30. Thanks, Jenny — reorder lands Friday.`,

      `REP: Marcus, thanks for the time. Before I show you anything — you mentioned in your email that denim is your highest-return category online. How bad is it?
PROSPECT: Around 38 percent return rate on third-party denim. Fit is the whole problem. Customers order two sizes and send one back, or both.
REP: And what does a 38 percent return rate do to the category's contribution margin once you eat the shipping both ways?
PROSPECT: It roughly halves it. Denim is our biggest traffic driver and one of our worst earners.
REP: That's the pattern we see with online accounts, and it's why we handle fit differently. Our five core fits have fixed blocks — we never change the fit between seasons — so once a customer knows their size in the selvedge straight, their reorder always fits. Our online stockists see denim return rates in the low twenties after two seasons because repeat purchases replace guess-buying. What share of your denim revenue is repeat customers today?
PROSPECT: Less than a quarter. Most of it is new-customer discovery traffic.
REP: So the opportunity is turning discovery buyers into repeat buyers who don't return. Two more things that matter for your model: core styles replenish from LA in 48 hours, so you carry two or three weeks of supply instead of a season's worth, and every SKU ships with a full imagery and copy pack — you list without a photo shoot.
PROSPECT: The content pack alone saves us about $400 a SKU. What does a test look like?
REP: Six core SKUs, shallow — about $26k wholesale — with weekly replenishment against your sell-through. We watch return rate and repeat rate for twelve weeks. If returns don't beat your 38 percent, you exit clean at season end.
PROSPECT: Send me the SKU list and the imagery samples. If the content quality holds up I'll take it to my planning meeting Thursday.
REP: You'll have both today, plus the return-rate data from two comparable online accounts. I'll book thirty minutes Friday morning to hear what planning says and build the order together. Does 9 a.m. Pacific work?
PROSPECT: Friday at 9 works.
REP: Booked. Talk Friday, Marcus.`,
    ],
  },

  prospectNames: [
    "Maison Ruby",
    "Harborline Department Stores",
    "Juniper & Sage",
    "Golden Hour Collective",
    "Prairie Post Mercantile",
  ],

  roleplayDialogues: {
    good: [
      [
        "Hi Dana, this is Maya at Thread & Loom — I know I'm calling out of the blue, can I take thirty seconds to say why, and you can tell me if it's worth more?",
        "Thirty seconds. I have a customer browsing.",
      ],
      [
        "We're an LA contemporary brand and we work with independents on a reorderable core denim program. Quick question — last fall, how much of your denim buy ended up on the markdown rack?",
        "Too much. Probably a third of it by January.",
      ],
      [
        "On what kind of wholesale dollars — five figures?",
        "About nine thousand with my main vendor. So call it three grand I marked down, at keystone. It stings.",
      ],
      [
        "That's the exact problem our core program kills: five fits we never drop, in stock year-round, no reorder minimum — you open at twenty-five hundred split over two deliveries and chase what sells instead of betting the season. Worth thirty minutes with the linesheet and samples?",
        "Maybe. The last brand that said 'no minimums' had a five-thousand-dollar opening hiding behind it.",
      ],
      [
        "Fair — so I'll email the opening terms, the reorder terms, and the neighborhood exclusivity language in writing before we meet, and you can hold me to the paper. I'm in Austin Thursday — ten a.m. before you open?",
        "Send the paper today and you've got your Thursday. Bring the wide leg.",
      ],
    ],
    poor: [
      [
        "Hi, this is Sam from Thread & Loom. We're one of the fastest-growing contemporary brands out of LA. Do you have five minutes?",
        "Not really. What is it?",
      ],
      [
        "Our line is amazing — Japanese selvedge denim, a waxed chore coat that got written up in a magazine, great knits. Everyone who carries us loves us.",
        "I have four hundred vendors emailing me the same sentence. What are your numbers?",
      ],
      [
        "The denim retails around $158. It's really high quality, the fit is incredible. Want me to send the linesheet?",
        "I asked for numbers. Sell-through, margin, delivery performance. Do you know mine? Do you know yours?",
      ],
      [
        "I don't have those in front of me, but honestly the product sells itself. Could we set up a meeting sometime?",
        "A meeting about what, exactly? You haven't asked me one question about my wall.",
      ],
      [
        "Right, sorry — um, do you buy denim? I'll send the linesheet and maybe follow up next month?",
        "Send it to the buying inbox. I have to go.",
      ],
    ],
  },

  accounts: [
    {
      ref: "maison",
      ownerEmail: "maya@threadloom.demo",
      name: "Maison Ruby",
      domain: "maisonruby.demo",
      industry: "Independent boutique",
      size: "1 door",
      website: "https://maisonruby.demo",
      notes: "Court Street, Brooklyn. Owner-operated womenswear boutique; strong denim customer, weak denim wall. Exclusivity for Cobble Hill promised in the proposal.",
    },
    {
      ref: "harborline",
      ownerEmail: "sam@threadloom.demo",
      name: "Harborline Department Stores",
      domain: "harborline.demo",
      industry: "Regional department stores",
      size: "11 doors",
      website: "https://harborline.demo",
      notes: "New England chain. Denim wall at 48% full-price sell-through; ~$180k/yr in markdown money. Rob buys the category, Alicia (DMM) signs above $50k.",
    },
    {
      ref: "juniper",
      ownerEmail: "grace@threadloom.demo",
      name: "Juniper & Sage",
      domain: "junipersage.demo",
      industry: "Independent boutique",
      size: "1 door",
      website: "https://junipersage.demo",
      notes: "South Congress, Austin. Owner Dana Brooks was burned on markdowns last fall; interested in the fall capsule plus a shallow core opening.",
    },
    {
      ref: "golden",
      ownerEmail: "tunde@threadloom.demo",
      name: "Golden Hour Collective",
      domain: "goldenhour.demo",
      industry: "E-commerce apparel retail",
      size: "40-60",
      website: "https://goldenhour.demo",
      notes: "Online contemporary retailer. 38% denim return rate is the wedge; values the imagery pack and 48-hour replenishment.",
    },
    {
      ref: "prairie",
      ownerEmail: "grace@threadloom.demo",
      name: "Prairie Post Mercantile",
      domain: "prairiepost.demo",
      industry: "Independent boutique",
      size: "1 door",
      website: "https://prairiepost.demo",
      notes: "Des Moines. Opening order closed and delivered on time; selvedge straight nearly sold out in week three. Reference account for delivery performance.",
    },
  ],

  contacts: [
    {
      ref: "camille",
      accountRef: "maison",
      ownerEmail: "maya@threadloom.demo",
      name: "Camille Duval",
      title: "Owner & Head Buyer",
      email: "camille@maisonruby.demo",
      phone: "+1-718-555-0134",
    },
    {
      ref: "rob",
      accountRef: "harborline",
      ownerEmail: "sam@threadloom.demo",
      name: "Rob Feinstein",
      title: "Category Buyer, Men's & Denim",
      email: "rob@harborline.demo",
      phone: "+1-603-555-0171",
    },
    {
      ref: "alicia",
      accountRef: "harborline",
      ownerEmail: "sam@threadloom.demo",
      name: "Alicia Whitmore",
      title: "Divisional Merchandise Manager",
      email: "alicia@harborline.demo",
      phone: "+1-603-555-0128",
    },
    {
      ref: "dana",
      accountRef: "juniper",
      ownerEmail: "grace@threadloom.demo",
      name: "Dana Brooks",
      title: "Owner & Head Buyer",
      email: "dana@junipersage.demo",
      phone: "+1-512-555-0187",
    },
    {
      ref: "marcus",
      accountRef: "golden",
      ownerEmail: "tunde@threadloom.demo",
      name: "Marcus Bell",
      title: "Head of Buying",
      email: "marcus@goldenhour.demo",
      phone: "+1-415-555-0152",
    },
    {
      ref: "jenny",
      accountRef: "prairie",
      ownerEmail: "grace@threadloom.demo",
      name: "Jenny Kowalski",
      title: "Owner",
      email: "jenny@prairiepost.demo",
      phone: "+1-515-555-0119",
    },
  ],

  deals: [
    {
      ref: "maison-opening",
      accountRef: "maison",
      contactRef: "camille",
      ownerEmail: "maya@threadloom.demo",
      name: "Maison Ruby · Fall opening order",
      stage: "proposal",
      amount: 14526,
      product: "Core Denim Program + Fall capsule",
      probability: 65,
      nextStep: "Camille reviewing sent proposal; confirm Cobble Hill exclusivity language and close by Friday",
      closeInDays: 12,
      notes: "Camille confirmed ~$2k/season markdown give-back on her current denim vendor. Wide leg and Marisol dress were the linesheet favorites.",
      createdNote: "Opened after Maya's cold call quantified Camille's markdown losses and booked the Thursday linesheet appointment.",
      linkRecentCalls: true,
    },
    {
      ref: "harborline-denim",
      accountRef: "harborline",
      contactRef: "rob",
      ownerEmail: "sam@threadloom.demo",
      name: "Harborline · Core denim 4-door test",
      stage: "negotiation",
      amount: 58000,
      product: "Core Denim Program",
      probability: 70,
      nextStep: "Send both protection structures (3% markdown cap vs cancelable second delivery) + stockist references; Friday call with Rob and Alicia",
      closeInDays: 18,
      notes: "Rob is bought in on the maintained-margin math against his 48% sell-through / $180k markdown figure. Alicia holding for more markdown support; trading structure, not points.",
      createdNote: "Opened after Sam's line review landed the four-door test structure with Rob; Alicia (DMM) joined at negotiation.",
      linkRecentCalls: true,
    },
    {
      ref: "juniper-fall",
      accountRef: "juniper",
      contactRef: "dana",
      ownerEmail: "grace@threadloom.demo",
      name: "Juniper & Sage · Fall capsule + core opening",
      stage: "discovery",
      amount: 9800,
      product: "Fall capsule + Core Denim Program",
      probability: 35,
      nextStep: "Send opening terms and exclusivity language in writing ahead of the Thursday linesheet appointment",
      closeInDays: 30,
      notes: "Dana sized her markdown losses at roughly $3k last fall at keystone. Wants the paper before the meeting — she has been burned by hidden minimums.",
      createdNote: "Opened from Grace's cold call; Dana agreed to a Thursday linesheet appointment on the strength of the split-minimum structure.",
      linkRecentCalls: true,
    },
    {
      ref: "golden-core",
      accountRef: "golden",
      contactRef: "marcus",
      ownerEmail: "tunde@threadloom.demo",
      name: "Golden Hour · Core denim online test",
      stage: "demo",
      amount: 26000,
      product: "Core Denim Program + imagery pack",
      probability: 50,
      nextStep: "Marcus taking SKU list and imagery samples to Thursday planning; Friday 9am debrief booked",
      closeInDays: 25,
      notes: "38% denim return rate is the compelling pain; fixed fit blocks and the content pack (~$400/SKU saved) are the wedge. Twelve-week return-rate test proposed.",
      createdNote: "Opened after Tunde's discovery quantified the return-rate hit to category contribution margin.",
    },
    {
      ref: "harborline-womens",
      accountRef: "harborline",
      contactRef: "alicia",
      ownerEmail: "sam@threadloom.demo",
      name: "Harborline · Women's knits expansion",
      stage: "qualified",
      amount: 18500,
      product: "Everyday Knits Program",
      probability: 20,
      nextStep: "Park until the denim test signs; Alicia flagged knits as the next category review in spring",
      closeInDays: 75,
      notes: "Expansion opportunity surfaced during the denim negotiation. Do not push before the four-door test is signed.",
      createdNote: "Logged from Alicia's comment in the line review that women's knits is the next vendor slot opening.",
    },
    {
      ref: "prairie-opening",
      accountRef: "prairie",
      contactRef: "jenny",
      ownerEmail: "grace@threadloom.demo",
      name: "Prairie Post · Opening order",
      stage: "closed_won",
      amount: 12336,
      product: "Core Denim Program + Fall capsule",
      probability: 100,
      closeInDays: -20,
      notes: "Delivered on time; selvedge straight nearly sold out by week three. Jenny agreed to be a delivery-performance reference for Harborline.",
      createdNote: "Opened after Grace's market-week meeting; Jenny committed to a full opening across denim, knits, and outerwear.",
    },
  ],

  products: [
    {
      sku: "TL-DNM-201",
      name: "Selvedge Straight Jean",
      description: "Core fit. 13.5oz Japanese selvedge, chain-stitched hem, fixed block. Suggested retail $158.",
      category: "Denim",
      listPrice: 68,
      cost: 29,
      unit: "unit",
      trackInventory: true,
      initialStock: 480,
      reorderPoint: 120,
    },
    {
      sku: "TL-DNM-305",
      name: "High-Rise Wide Leg Jean",
      description: "Core fit and the line's best seller. 12oz comfort-stretch denim, fixed block. Suggested retail $148.",
      category: "Denim",
      listPrice: 64,
      cost: 27,
      unit: "unit",
      trackInventory: true,
      initialStock: 360,
      reorderPoint: 100,
    },
    {
      sku: "TL-KNT-110",
      name: "Everyday Tee 3-Pack",
      description: "Combed cotton crewneck tees in white, black, and heather. Pack-based ordering. Suggested retail $78/pack.",
      category: "Knits",
      listPrice: 33,
      cost: 13.5,
      unit: "pack",
      trackInventory: true,
      initialStock: 600,
      reorderPoint: 150,
    },
    {
      sku: "TL-KNT-215",
      name: "Rib Mockneck Sweater",
      description: "Fine-gauge ribbed mockneck, core knits program. Suggested retail $118.",
      category: "Knits",
      listPrice: 49,
      cost: 21,
      unit: "unit",
      trackInventory: true,
      initialStock: 300,
      reorderPoint: 80,
    },
    {
      sku: "TL-OTR-410",
      name: "Waxed Canvas Chore Coat",
      description: "10oz waxed canvas chore coat with corduroy collar — the line's icon piece. Suggested retail $228.",
      category: "Outerwear",
      listPrice: 92,
      cost: 41,
      unit: "unit",
      trackInventory: true,
      initialStock: 220,
      reorderPoint: 60,
    },
    {
      sku: "TL-DRS-520",
      name: "Marisol Capsule Dress",
      description: "Fall capsule midi dress in Tencel twill, two colorways. Suggested retail $138.",
      category: "Dresses",
      listPrice: 58,
      cost: 24,
      unit: "unit",
      trackInventory: true,
      initialStock: 240,
      reorderPoint: 70,
    },
  ],

  warehouse: {
    code: "LADC",
    name: "LA Arts District DC",
    address: "2100 E 7th St, Los Angeles, CA 90021",
  },

  quotes: [
    {
      dealRef: "maison-opening",
      ownerEmail: "maya@threadloom.demo",
      title: "Maison Ruby · Fall opening order",
      notes: "Split across two delivery windows (8/15 and 9/15). Cobble Hill exclusivity per core program agreement. First order: 50% deposit, 50% on delivery; net 30 thereafter.",
      status: "sent",
      validInDays: 14,
      lines: [
        { sku: "TL-DNM-201", description: "Selvedge Straight Jean — size curve 25-32", quantity: 48 },
        { sku: "TL-DRS-520", description: "Marisol Capsule Dress — both colorways", quantity: 60 },
        { sku: "TL-KNT-110", description: "Everyday Tee 3-Pack", quantity: 72 },
        { sku: "TL-OTR-410", description: "Waxed Canvas Chore Coat", quantity: 30 },
        { sku: "TL-KNT-215", description: "Rib Mockneck Sweater", quantity: 54 },
      ],
    },
    {
      dealRef: "golden-core",
      ownerEmail: "tunde@threadloom.demo",
      title: "Golden Hour · Core denim online test (12 weeks)",
      notes: "Shallow opening with weekly replenishment against sell-through. Imagery and copy pack included at no charge. Draft pending Thursday planning meeting.",
      status: "draft",
      lines: [
        { sku: "TL-DNM-201", description: "Selvedge Straight Jean — full size curve", quantity: 120 },
        { sku: "TL-DNM-305", description: "High-Rise Wide Leg Jean — full size curve", quantity: 96 },
        { sku: "TL-KNT-110", description: "Everyday Tee 3-Pack", quantity: 180 },
        { sku: "TL-KNT-215", description: "Rib Mockneck Sweater", quantity: 120 },
      ],
    },
    {
      dealRef: "prairie-opening",
      ownerEmail: "grace@threadloom.demo",
      title: "Prairie Post · Opening order",
      notes: "Delivered on time in a single window at Jenny's request. Net 30; 2/10 discount taken.",
      status: "accepted",
      lines: [
        { sku: "TL-DNM-201", description: "Selvedge Straight Jean — size curve 25-32", quantity: 60 },
        { sku: "TL-DNM-305", description: "High-Rise Wide Leg Jean", quantity: 36 },
        { sku: "TL-KNT-110", description: "Everyday Tee 3-Pack", quantity: 60 },
        { sku: "TL-OTR-410", description: "Waxed Canvas Chore Coat", quantity: 24 },
        { sku: "TL-KNT-215", description: "Rib Mockneck Sweater", quantity: 36 },
      ],
    },
  ],

  outreachEmails: [
    {
      fromEmail: "maya@threadloom.demo",
      contactRef: "camille",
      dealRef: "maison-opening",
      subject: "Maison Ruby proposal — exclusivity language + both delivery windows",
      body: "Hi Camille,\n\nGreat seeing the shop Thursday — the wide leg looked right at home on your denim wall.\n\nThe proposal is attached: $14,526 across the denim opening, the Marisol dress in both colorways, tees, mocknecks, and 30 chore coats, split across the 8/15 and 9/15 delivery windows as we discussed. Page two has the Cobble Hill exclusivity language in writing, and page three has the no-minimum core reorder terms.\n\nOne note on the math from our call: at a 2.2 markup on the core fits, the denim portion alone recovers the roughly $2,000 you gave back to markdowns last fall — before the capsule sells a unit.\n\nCan you confirm by Friday so we hold your slot in the 8/15 window?\n\nBest,\nMaya",
    },
    {
      fromEmail: "sam@threadloom.demo",
      contactRef: "rob",
      dealRef: "harborline-denim",
      subject: "Harborline 4-door test — both protection structures + references",
      body: "Rob,\n\nAs promised from yesterday's call, attached are both structures for the $58k four-door test:\n\n1. Markdown support at the 3% program cap, tied to the week-6 and week-12 sell-through checkpoints.\n2. Cancelable second delivery at the week-6 checkpoint — the harder downside cap Alicia asked finance about.\n\nAlso attached: the delivery terms with the contractual ship-window credit, and contact details for Jenny Kowalski (Prairie Post Mercantile) and one other stockist who can speak to on-time performance.\n\nAgainst your 48% full-price sell-through and $180k in annual markdown money, the maintained-margin model is on page 4 with your door-level numbers, not ours.\n\nFriday 15 minutes is on your and Alicia's calendars to close whatever the references surface. Goal: signed before the market window closes on the 28th.\n\nSam",
    },
  ],

  outreachCalls: [
    {
      fromEmail: "grace@threadloom.demo",
      contactRef: "dana",
      dealRef: "juniper-fall",
      notes: "Pre-meeting call: confirmed Thursday 10am linesheet appointment, walked through the emailed opening terms ($2,500 split across two windows) and South Congress exclusivity language. Dana asked to see the wide leg and the chore coat first.",
      durationSec: 340,
      callType: "discovery",
    },
    {
      fromEmail: "tunde@threadloom.demo",
      contactRef: "marcus",
      dealRef: "golden-core",
      notes: "Confirmed Marcus received the six-SKU test list and imagery samples ahead of Thursday planning. He flagged the content pack quality as 'better than our in-house shoots' — the $400/SKU savings line is landing. Friday 9am debrief confirmed.",
      durationSec: 280,
      callType: "demo",
    },
  ],

  assignments: [
    {
      repEmail: "tunde@threadloom.demo",
      scenarioTitle: "Negotiation: markdown support on the core denim program",
      type: "ROLEPLAY",
      targetCount: 2,
      doneCount: 0,
      note: "Before the Golden Hour close: practice holding the 3% markdown cap and trading structure instead of points. Alicia's 8%/net-60 anchor is the same move their finance team will make.",
      dueInDays: 4,
    },
    {
      repEmail: "sam@threadloom.demo",
      scenarioTitle: "Line review: skeptical department-store denim buyer",
      type: "ROLEPLAY",
      targetCount: 3,
      doneCount: 1,
      note: "Sell-through math scores dipped on your last two graded calls — run the Rob scenario until the maintained-margin reframe is automatic before Friday's Harborline call.",
      dueInDays: 6,
    },
    {
      repEmail: "grace@threadloom.demo",
      type: "UPLOAD",
      targetCount: 3,
      doneCount: 2,
      note: "Upload your three Juniper & Sage discovery calls for review before the Thursday linesheet appointment — I want to check the exclusivity positioning.",
      dueInDays: 3,
    },
  ],
};
