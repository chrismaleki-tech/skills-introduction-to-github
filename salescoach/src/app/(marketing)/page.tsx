import Image from "next/image";
import Link from "next/link";
import { DemoForm } from "@/components/marketing/demo-form";
import { Faq } from "@/components/marketing/faq";
import { FeedbackIllustration, VoiceIllustration } from "@/components/marketing/voice-illustration";
import { isClerkEnabled } from "@/lib/auth-mode";
import { PLANS, type PlanKey } from "@/lib/plans";
import { CALL_TYPES } from "@/lib/scenario-options";
import { TRIAL_ALLOWANCE } from "@/lib/plans";

// Trial length is set at provisioning (src/lib/provision.ts). Keep in sync.
const TRIAL_DAYS = TRIAL_ALLOWANCE.days;
const TRIAL_SEAT_LIMIT = TRIAL_ALLOWANCE.seats;
const TRIAL_ROLEPLAY_MIN = TRIAL_ALLOWANCE.roleplayMinutes;
const TRIAL_CALL_REVIEW_HOURS = TRIAL_ALLOWANCE.callReviewMinutes / 60;

const SCENARIO_HIGHLIGHTS: Record<string, string> = {
  cold_call: "Earn thirty seconds with a busy stranger.",
  discovery: "Ask the questions that surface real pain.",
  demo: "Show value against their problems, not features.",
  follow_up: "Revive a deal that went quiet.",
  objection_handling: "Work through doubt with evidence.",
  negotiation: "Hold your price and trade, don't give.",
  closing: "Turn \"leaning yes\" into a signed commitment.",
  renewal: "Keep a lukewarm customer and grow the account.",
};

export default function MarketingHomePage() {
  const clerk = isClerkEnabled();
  const startHref = "/start";
  const accountNote = clerk
    ? `Free account required · ${TRIAL_DAYS}-day trial · no credit card`
    : "Opens the live demo workspace";

  const primaryBtn =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const secondaryBtn =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-marketing-ink transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <>
      {/* 1. Hero */}
      <section className="mkt-hero-wash relative overflow-hidden pt-24 sm:pt-28">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-6 sm:px-6 sm:pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div className="min-w-0">
            <p className="mkt-rise-visible text-xs font-bold uppercase tracking-[0.2em] text-brand">AI Role Play</p>
            <h1 className="mkt-rise-visible mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-marketing-ink sm:text-5xl lg:text-[3.4rem]">
              Practice your next sales call before it counts.
            </h1>
            <p className="mkt-rise mkt-rise-delay-2 mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Practice sales conversations with realistic AI prospects, handle tough objections, and get actionable
              feedback before your next customer call.
            </p>
            <div className="mkt-rise mkt-rise-delay-3 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href={startHref} className={primaryBtn}>
                <MicIcon /> Try AI Role Play
              </Link>
              <a href="#how-it-works" className={secondaryBtn}>
                See how it works
              </a>
            </div>
            <p className="mkt-rise mkt-rise-delay-3 mt-3 text-xs text-muted">{accountNote}</p>
            <ul className="mkt-rise mkt-rise-delay-3 mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              <li className="flex items-center gap-2"><Check /> Spoken, two-way conversation</li>
              <li className="flex items-center gap-2"><Check /> Prospects that push back</li>
              <li className="flex items-center gap-2"><Check /> Graded on your playbook</li>
            </ul>
          </div>
          <VoiceIllustration className="mkt-fade min-w-0" />
        </div>
      </section>

      {/* 2. Product demonstration */}
      <section id="how-it-works" className="scroll-mt-20 border-t border-line bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">How a session works</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
                A real conversation, then feedback you can act on
              </h2>
              <p className="mt-3 text-muted">
                You talk; the prospect listens, answers what you actually said, and raises objections when they fit.
                When you hang up, the call is scored against your team&apos;s methodology.
              </p>
            </div>
            <span className="inline-flex w-fit shrink-0 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">
              Visual walkthrough
            </span>
          </div>

          <ol className="mt-12 grid gap-6 lg:grid-cols-3">
            {[
              {
                n: "1",
                title: "Pick who you're calling",
                body: "Choose a ready-made call, build your own prospect, or draft one from a business's website. Review the briefing and press Start voice role-play.",
                src: "/marketing/walkthrough-scenario.png",
                alt: "Erota scenario creator showing Quick start, Build your own, and Use a business website options",
                label: "Product screenshot",
              },
              {
                n: "2",
                title: "Talk it through",
                body: "The prospect speaks back in a natural voice, holds their role, and warms up or shuts down based on what you say. Interrupt, pause, and recover like a real call.",
                src: "/marketing/walkthrough-call.png",
                alt: "Erota live voice role-play screen with the prospect briefing and Start call button",
                label: "Product screenshot",
              },
              {
                n: "3",
                title: "Read your scorecard",
                body: "Scores per skill, quote-backed strengths and improvements, and one thing to do differently. Then run it again.",
                src: null,
                alt: "",
                label: "Illustration",
              },
            ].map((step) => (
              <li key={step.n} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="relative aspect-[16/11] border-b border-line bg-surface-2">
                  {step.src ? (
                    <Image
                      src={step.src}
                      alt={step.alt}
                      fill
                      sizes="(min-width: 1024px) 384px, (min-width: 640px) 90vw, 100vw"
                      className="object-cover object-left-top"
                    />
                  ) : (
                    <FeedbackIllustration />
                  )}
                  <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted shadow-sm">
                    {step.label}
                  </span>
                </div>
                <div className="p-5">
                  <div className="text-xs font-bold uppercase tracking-wider text-brand">Step {step.n}</div>
                  <h3 className="mt-1 text-lg font-semibold text-marketing-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted">
            Screenshots are from the Erota app using a sample workspace; the scorecard is an illustration of the feedback
            layout. A recorded example call is coming — we won&apos;t publish one until it&apos;s a real session.
          </p>
        </div>
      </section>

      {/* 3. Three steps */}
      <section className="border-t border-line bg-marketing-ink py-16 text-white sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Three steps. Ten minutes.</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              ["Choose your scenario.", "Cold call, discovery, objections, negotiation — or describe the exact buyer you're about to meet."],
              ["Talk with an AI prospect.", "A live spoken conversation with someone who has a job, priorities, and reasons to say no."],
              ["Review your feedback and practice again.", "See what worked, what didn't, and the one change that would have moved the call."],
            ].map(([title, body], i) => (
              <li key={title} className="border-t border-white/20 pt-5">
                <div className="text-sm font-semibold tracking-wide text-cyan-300">0{i + 1}</div>
                <h3 className="mt-2 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4. Practice scenarios */}
      <section id="scenarios" className="scroll-mt-20 border-t border-line bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Practice scenarios</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
              Pick the call you&apos;re dreading
            </h2>
            <p className="mt-3 text-muted">
              Each one starts you with a realistic prospect and a clear goal. Choose a difficulty from beginner to
              advanced and an industry if you want one.
            </p>
          </div>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CALL_TYPES.map((c) => (
              <li key={c.value}>
                <Link
                  href={`${startHref}?template=${c.value}`}
                  className="group flex h-full flex-col rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent/60 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="text-base font-semibold text-marketing-ink">{c.label}</span>
                  <span className="mt-1 flex-1 text-sm text-muted">{SCENARIO_HIGHLIGHTS[c.value] ?? c.blurb}</span>
                  <span className="mt-3 text-sm font-semibold text-brand group-hover:underline">Practice this →</span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Ready-made",
                body: "Eight call types with sensible defaults. Pick one and you're talking in under a minute.",
                href: startHref,
                cta: "Quick start",
              },
              {
                title: "Build your own",
                body: "Dropdowns for what you sell, the prospect's industry, role, company size, attitude, difficulty, and the objection you want to face.",
                href: `${startHref}?path=build`,
                cta: "Build a prospect",
              },
              {
                title: "From a business website",
                body: "Paste a prospect's public site. Erota reads what the business does and drafts a fictional contact, plausible needs, and objections — with website facts kept separate from assumptions.",
                href: `${startHref}?path=website`,
                cta: "Use a website",
              },
            ].map((card) => (
              <div key={card.title} className="flex flex-col rounded-xl border border-line bg-white p-5">
                <h3 className="text-lg font-semibold text-marketing-ink">{card.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{card.body}</p>
                <Link href={card.href} className="mt-4 text-sm font-semibold text-brand hover:underline">
                  {card.cta} →
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">Every scenario can be edited, saved, reused, and duplicated.</p>
        </div>
      </section>

      {/* 5. Feedback and improvement */}
      <section id="feedback" className="scroll-mt-20 border-t border-line bg-marketing-wash py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Feedback and improvement</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
              Specific enough to change your next call
            </h2>
            <p className="mt-4 leading-relaxed text-muted">
              After each session Erota scores the conversation against your team&apos;s methodology — MEDDIC, SPIN,
              Challenger, discovery fundamentals, or your own rubric — and shows the moments behind each score, the
              scenario&apos;s objective, and the difficulty you chose.
            </p>
            <p className="mt-4 leading-relaxed text-muted">
              The same engine grades your real calls when you upload a recording or transcript, so practice and live
              performance are measured the same way. Managers can assign the scenario that targets a gap and see
              whether the skill improves.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-4 shadow-[0_24px_70px_-36px_rgba(45,62,80,0.45)] sm:p-6">
            <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">ILLUSTRATIVE EXAMPLE</span>
                  <span className="text-xs text-muted">Discovery role-play · Intermediate · 9 min</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-marketing-ink">Discovery: COO at Northgate Distribution</h3>
                <p className="mt-1 text-xs text-muted">Objective: uncover two pain points and book a demo</p>
              </div>
              <div className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-center">
                <div className="text-2xl font-bold text-amber-800">68</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Developing</div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Skill breakdown</p>
                <div className="mt-3 space-y-3">
                  {([
                    ["Opening & rapport", 82],
                    ["Discovery questions", 74],
                    ["Objection handling", 58],
                    ["Next-step control", 51],
                  ] as const).map(([label, score]) => (
                    <div key={label}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-medium text-marketing-ink">{label}</span>
                        <span className="tabular-nums text-muted">{score}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="presentation">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-surface-2/70 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">What happened</p>
                <blockquote className="mt-2 border-l-2 border-line pl-3 text-xs leading-relaxed text-muted">
                  <span className="font-semibold text-marketing-ink">Dana (6:12):</span> “We already have a provider for
                  this.”
                  <br />
                  <span className="font-semibold text-marketing-ink">You:</span> “Totally understand — but our platform
                  is really different, let me show you…”
                </blockquote>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">Improve this</p>
                <p className="mt-1 text-sm font-semibold text-marketing-ink">Clarify the objection before answering it.</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">Try saying</p>
                <p className="mt-1 text-xs italic leading-relaxed text-muted">
                  “Makes sense. What&apos;s working well with them today — and what made you take this call anyway?”
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Individual and team benefits */}
      <section id="teams" className="scroll-mt-20 border-t border-line bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">For individuals and teams</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
              Built for the rep. Useful for the manager.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">
              <div className="text-sm font-bold uppercase tracking-wider text-brand">For sales reps</div>
              <h3 className="mt-3 text-2xl font-semibold text-marketing-ink">Walk in prepared.</h3>
              <ul className="mt-5 space-y-3 text-sm text-muted">
                <li className="flex gap-2"><Check /> Rehearse tomorrow&apos;s call against a prospect like the real one</li>
                <li className="flex gap-2"><Check /> Practice the objections that keep tripping you up</li>
                <li className="flex gap-2"><Check /> Work on one skill at a time and watch the score move</li>
                <li className="flex gap-2"><Check /> Upload a real call and get the same kind of feedback</li>
              </ul>
              <Link href={startHref} className="mt-6 inline-block text-sm font-semibold text-brand hover:underline">
                Start practicing →
              </Link>
            </div>
            <div className="rounded-xl border border-line bg-white p-6 sm:p-8">
              <div className="text-sm font-bold uppercase tracking-wider text-brand">For managers</div>
              <h3 className="mt-3 text-2xl font-semibold text-marketing-ink">Coach consistently, without sitting in on every call.</h3>
              <ul className="mt-5 space-y-3 text-sm text-muted">
                <li className="flex gap-2"><Check /> Assign the scenario that targets each rep&apos;s gap</li>
                <li className="flex gap-2"><Check /> One methodology for role-plays and real calls</li>
                <li className="flex gap-2"><Check /> Team dashboard with score trends and a skill heatmap</li>
                <li className="flex gap-2"><Check /> Invite your team and manage seats from one place</li>
              </ul>
              <a href="#demo" className="mt-6 inline-block text-sm font-semibold text-brand hover:underline">
                Talk to us about a team rollout →
              </a>
            </div>
          </div>
          <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface-2">
            <Image
              src="/marketing/team-dashboard.png"
              alt="Erota team dashboard with graded calls, role-plays, score trend, and skill heatmap"
              width={1280}
              height={880}
              sizes="(min-width: 1152px) 1152px, 100vw"
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>

      {/* 7. Pricing */}
      <section id="pricing" className="scroll-mt-20 border-t border-line bg-marketing-wash py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Pricing</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
              Per seat, billed monthly
            </h2>
            <p className="mt-3 text-muted">
              Start with a {TRIAL_DAYS}-day free trial: {TRIAL_ROLEPLAY_MIN} minutes of AI Role Play and {TRIAL_CALL_REVIEW_HOURS} hours of call review, shared across
              your workspace for the full trial. Paid plans are billed monthly per seat, and their AI Role Play minutes and
              call review hours are per seat, per month.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 xl:grid-cols-4">
            {(["trial", "pro", "max", "enterprise"] as PlanKey[]).map((key) => {
              const plan = PLANS[key];
              const featured = key === "max";
              const sub = featured ? "text-slate-300" : "text-muted";
              const glance: [string, string][] =
                key === "trial"
                  ? [
                      ["AI Role Play", `${TRIAL_ROLEPLAY_MIN} min total, shared`],
                      ["Call review", `${TRIAL_CALL_REVIEW_HOURS} hrs total, shared`],
                      ["Seats", `Up to ${TRIAL_SEAT_LIMIT}`],
                      ["Length", `${TRIAL_DAYS} days`],
                    ]
                  : key === "enterprise"
                    ? [
                        ["AI Role Play", "Custom"],
                        ["Call review", "Custom"],
                        ["Seats", "Custom"],
                        ["Billing", "Contract"],
                      ]
                    : [
                        ["AI Role Play", `${plan.roleplayMinutesPerSeat} min / seat / mo`],
                        ["Call review", `${(plan.callScoringMinutesPerSeat ?? 0) / 60} hrs / seat / mo`],
                        ["Seats", "Add or remove any time"],
                        ["Billing", "Monthly"],
                      ];
              return (
                <div
                  key={key}
                  className={`flex flex-col rounded-xl border p-5 sm:p-6 ${
                    featured ? "border-marketing-ink bg-marketing-ink text-white shadow-lg" : "border-line bg-white text-marketing-ink"
                  }`}
                >
                  <div className={`text-sm font-semibold ${featured ? "text-cyan-300" : "text-brand"}`}>{plan.name}</div>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-semibold tracking-tight">
                      {plan.pricePerSeat === null ? "Custom" : `$${plan.pricePerSeat}`}
                    </span>
                    {plan.pricePerSeat !== null && <span className={`text-xs ${sub}`}>/ seat / month</span>}
                  </div>
                  <p className={`mt-3 text-sm leading-relaxed ${sub}`}>{plan.description}</p>

                  <dl className={`mt-5 divide-y rounded-lg border text-xs ${featured ? "divide-white/10 border-white/15" : "divide-line border-line"}`}>
                    {glance.map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-3 px-3 py-2">
                        <dt className={sub}>{k}</dt>
                        <dd className="text-right font-semibold">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <ul className={`mt-5 flex-1 space-y-2.5 text-sm ${featured ? "text-slate-200" : ""}`}>
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <span aria-hidden="true" className={featured ? "text-cyan-300" : "text-brand"}>✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {key === "enterprise" ? (
                    <a
                      href="#demo"
                      className="mt-7 inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      Talk to sales
                    </a>
                  ) : (
                    <Link
                      href={startHref}
                      className={`mt-7 inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                        featured
                          ? "bg-white text-marketing-ink hover:bg-slate-100 focus-visible:outline-white"
                          : "bg-accent text-white hover:bg-accent-hover focus-visible:outline-accent"
                      }`}
                    >
                      {key === "trial" ? "Start free trial" : `Start with ${plan.name}`}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 rounded-xl border border-line bg-white p-5 text-sm text-muted sm:p-6">
            <h3 className="text-sm font-semibold text-marketing-ink">How the free trial works</h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              <li className="flex gap-2"><Check /> {TRIAL_DAYS}-day free trial from the day you create your workspace. No credit card.</li>
              <li className="flex gap-2"><Check /> {TRIAL_ROLEPLAY_MIN} minutes of AI Role Play and {TRIAL_CALL_REVIEW_HOURS} hours of call review, for up to {TRIAL_SEAT_LIMIT} seats. Usage shared across your workspace for the full trial; inviting teammates does not add minutes.</li>
              <li className="flex gap-2"><Check /> When an allowance is used up or the trial ends, that activity pauses until you choose Pro or Max. Your scenarios, calls, transcripts, and scores stay viewable.</li>
              <li className="flex gap-2"><Check /> Paid plans start a monthly subscription the day you subscribe, with fresh per-seat monthly allowances; cancel from Billing any time and keep access through the paid period.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 8. FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-line bg-white py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.6fr_1.4fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">FAQ</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
              Practical questions
            </h2>
            <p className="mt-3 text-sm text-muted">
              Something else?{" "}
              <a href="mailto:hello@erota.io" className="font-semibold text-brand hover:underline">
                hello@erota.io
              </a>
            </p>
          </div>
          <Faq
            items={[
              {
                q: "Is this a spoken conversation?",
                a: (
                  <>
                    Yes. You talk through your browser microphone and the prospect answers out loud in real time. You can
                    interrupt them and they stop; brief pauses mid-sentence won&apos;t cut you off. A typed role-play is
                    available if you&apos;re somewhere you can&apos;t speak.
                  </>
                ),
              },
              {
                q: "Can I customize the prospect and scenario?",
                a: (
                  <>
                    Yes. Start from one of eight ready-made calls, or build your own: what you sell, the prospect&apos;s
                    industry, role, and company size, the call type, your objective, difficulty (beginner, intermediate,
                    advanced), their attitude (friendly, neutral, skeptical, busy), and the main objection. Every field in
                    the briefing is editable, including the prospect&apos;s voice. Scenarios can be saved, reused, and
                    duplicated.
                  </>
                ),
              },
              {
                q: "Can I create a scenario from a business website?",
                a: (
                  <>
                    Yes. Paste a prospect&apos;s public website. Erota reads the public page, summarizes what the business
                    does and who it serves, and drafts a fictional contact with plausible needs and objections for the
                    call type you choose. Facts stated on the site are listed separately from assumptions made for the
                    simulation, and we never name real employees. If a site can&apos;t be read, you can describe the business
                    instead.
                  </>
                ),
              },
              {
                q: "What feedback will I receive?",
                a: (
                  <>
                    A score for each skill in your team&apos;s methodology (MEDDIC, SPIN Selling, Challenger, Discovery
                    Call Fundamentals, or a custom rubric), an overall score, quote-backed strengths and improvements, and a
                    summary that takes the scenario&apos;s objective and difficulty into account. Feedback arrives after
                    you end the call; the prospect stays in character during it.
                  </>
                ),
              },
              {
                q: "Are sessions recorded or transcribed?",
                a: (
                  <>
                    AI Role Play sessions are spoken conversations that are transcribed live so you and your manager can read the conversation afterwards;
                    Erota stores that transcript and the score, not the audio of the role-play. Calls you upload for
                    review are stored as audio and transcribed; audio is deleted after 90 days by default and records after
                    365 days, or sooner if you delete them. Details are in our{" "}
                    <Link href="/privacy" className="font-semibold text-brand hover:underline">
                      privacy policy
                    </Link>
                    .
                  </>
                ),
              },
              {
                q: "What is included in the trial?",
                a: (
                  <>
                    A {TRIAL_DAYS}-day free trial with {TRIAL_ROLEPLAY_MIN} minutes of AI Role Play (spoken conversations with an AI prospect) and{" "}
                    {TRIAL_CALL_REVIEW_HOURS} hours of call review, plus scoring, scenarios, and dashboards, for up to {TRIAL_SEAT_LIMIT} seats. Usage is shared
                    across your workspace for the full trial, so inviting teammates does not add minutes. No credit card. When
                    an allowance runs out or the trial ends, that activity pauses until you pick a plan; your data stays.
                  </>
                ),
              },
              {
                q: "Can teams use their own sales playbook?",
                a: (
                  <>
                    Yes. Choose a methodology preset or define your own scoring dimensions, and fill in your company
                    profile — products, buyer personas, common objections, competitors, and approved talk tracks. Prospects
                    and grading are grounded in that profile, so practice reinforces how your team actually sells.
                  </>
                ),
              },
            ]}
          />
        </div>
      </section>

      {/* 9. Final call to action */}
      <section id="demo" className="scroll-mt-20 border-t border-line bg-marketing-wash py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-start lg:gap-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Get started</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
              Your next call is a few minutes away. Practice it first.
            </h2>
            <p className="mt-4 leading-relaxed text-muted">
              Create a free account, pick a scenario, and have your first conversation in under ten minutes.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href={startHref} className={primaryBtn}>
                <MicIcon /> Try AI Role Play
              </Link>
            </div>
            <p className="mt-3 text-xs text-muted">{accountNote}</p>
            <p className="mt-8 text-sm text-muted">
              Rolling this out to a team? Tell us about your reps and how you coach today, and we&apos;ll walk you through
              Erota against your playbook.
            </p>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-marketing-ink">Request a team demo</h3>
            <DemoForm />
          </div>
        </div>
      </section>
    </>
  );
}

function Check() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-brand" fill="currentColor">
      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4L8.5 12l6.8-6.7a1 1 0 0 1 1.4 0z" clipRule="evenodd" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}
