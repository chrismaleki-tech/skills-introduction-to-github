import Image from "next/image";
import Link from "next/link";
import { DemoForm } from "@/components/marketing/demo-form";
import { isClerkEnabled } from "@/lib/auth-mode";

export default function MarketingHomePage() {
  const appHref = isClerkEnabled() ? "/sign-up" : "/dashboard";
  const appLabel = isClerkEnabled() ? "Start free" : "Try the live demo";

  return (
    <>
      {/* Hero */}
      <section className="mkt-hero-wash relative overflow-hidden pt-24">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
          <p className="mkt-rise text-xs font-bold uppercase tracking-[0.2em] text-brand">
            SalesCoach AI <span className="font-medium text-muted">by Erota</span>
          </p>
          <h1 className="mkt-rise mkt-rise-delay-1 mt-5 max-w-4xl font-display text-4xl font-semibold leading-[1.08] tracking-tight text-marketing-ink sm:text-5xl md:text-6xl">
            Coach every rep against your playbook—without listening to every call.
          </h1>
          <p className="mkt-rise mkt-rise-delay-2 mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Turn real conversations into consistent, quote-backed coaching. Reinforce your methodology, surface skill
            gaps, and give every rep a focused next step.
          </p>
          <div className="mkt-rise mkt-rise-delay-3 mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#demo"
              className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
            >
              See it with your workflow
            </a>
            <Link
              href={appHref}
              className="rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-marketing-ink transition-colors hover:bg-surface-2"
            >
              {appLabel}
            </Link>
          </div>
          <ul className="mkt-rise mkt-rise-delay-3 mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-muted sm:text-sm">
            <li>✓ Your scoring methodology</li>
            <li>✓ Evidence from the conversation</li>
            <li>✓ Practice tied to the coaching gap</li>
          </ul>
        </div>

        <div className="mkt-fade relative mt-6 w-full border-t border-line/70">
          <div className="mx-auto max-w-6xl px-0 sm:px-6">
            <Image
              src="/marketing/hero-dashboard.png"
              alt="SalesCoach AI team dashboard with score trends and skill heatmap"
              width={1440}
              height={1100}
              priority
              className="h-auto w-full object-cover object-top sm:rounded-t-xl sm:border sm:border-b-0 sm:border-line sm:shadow-[0_24px_60px_-28px_rgba(45,62,80,0.35)]"
            />
          </div>
        </div>
      </section>

      {/* Outcomes */}
      <section className="border-t border-line bg-marketing-ink py-16 text-white sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Built for revenue leaders</p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Your methodology only matters when reps use it in the conversation.
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              {
                title: "Shorten the feedback loop",
                body: "Move from occasional call reviews to a clear coaching signal after every selected conversation.",
              },
              {
                title: "Coach with consistency",
                body: "Give managers and reps one shared definition of a strong discovery, demo, or negotiation call.",
              },
              {
                title: "Practice the exact gap",
                body: "Turn weak skills and missed objections into focused role-play before the next customer meeting.",
              },
            ].map((outcome) => (
              <div key={outcome.title} className="border-t border-white/20 pt-5">
                <h3 className="text-lg font-semibold">{outcome.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{outcome.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-line bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">The coaching loop</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
            From conversation to better next call
          </h2>
          <p className="mt-3 max-w-2xl text-muted">
            Start with the workflow you have today. SalesCoach turns the conversation into a score, a coaching action,
            and targeted practice.
          </p>
          <ol className="mt-12 grid gap-10 sm:grid-cols-3">
            {[
              {
                n: "01",
                title: "Bring the conversation",
                body: "Upload a recording, paste a transcript, or send completed calls through the authenticated webhook.",
              },
              {
                n: "02",
                title: "Apply your playbook",
                body: "Score the call against MEDDIC, SPIN, Challenger, or the custom behaviors your managers already coach.",
              },
              {
                n: "03",
                title: "Act on the gap",
                body: "Review quote-backed feedback, assign focused practice, and track whether the skill improves over time.",
              },
            ].map((step) => (
              <li key={step.n} className="border-t border-brand/30 pt-5">
                <div className="text-sm font-semibold tracking-wide text-brand">{step.n}</div>
                <h3 className="mt-2 text-lg font-semibold text-marketing-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Workflow and integrations */}
      <section id="integrations" className="border-t border-line bg-surface-2/50 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Workflow coverage</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
                Start now. Connect more of your stack as we build.
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                We will not pretend a logo is an integration. The capabilities below distinguish what works today from
                the native connections on our roadmap.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-white p-5">
                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
                  Available now
                </span>
                <h3 className="mt-4 text-lg font-semibold text-marketing-ink">Flexible call intake</h3>
                <ul className="mt-4 space-y-3 text-sm text-muted">
                  <li>✓ Audio file upload</li>
                  <li>✓ Pasted call transcript</li>
                  <li>✓ Authenticated ingestion webhook</li>
                  <li>✓ Text-based AI role-play</li>
                </ul>
              </div>
              <div className="rounded-xl border border-line bg-white p-5">
                <span className="inline-flex rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-muted">
                  Planned
                </span>
                <h3 className="mt-4 text-lg font-semibold text-marketing-ink">Native call sync</h3>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-muted">
                  {["Zoom", "Google Meet", "HubSpot", "Salesforce", "Gong", "Outreach"].map((name) => (
                    <span key={name} className="rounded-full border border-line px-3 py-1.5">
                      {name}
                    </span>
                  ))}
                </div>
                <a href="#demo" className="mt-5 inline-block text-sm font-semibold text-brand hover:underline">
                  Tell us which connection you need →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call grading */}
      <section className="border-t border-line bg-marketing-wash py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Your context, not generic advice</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
              See where the deal moved—and where the rep lost control
            </h2>
            <p className="mt-4 text-muted leading-relaxed">
              Products, personas, objections, competitors, and approved talk tracks ground every score. Managers get
              the evidence behind the rating, while reps get one clear behavior to apply next time.
            </p>
          </div>
          <Image
            src="/marketing/calls.png"
            alt="SalesCoach calls list with graded scores and sampling status"
            width={1440}
            height={1100}
            className="h-auto w-full rounded-xl border border-line shadow-[0_18px_40px_-24px_rgba(45,62,80,0.3)]"
          />
        </div>
      </section>

      {/* Honest product proof */}
      <section className="border-t border-line bg-white py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Transparent product example</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
              Inspect the score before you trust it.
            </h2>
            <p className="mt-4 leading-relaxed text-muted">
              No anonymous testimonial or invented ROI claim. This illustrative scorecard shows the level of specificity
              SalesCoach is designed to provide on a discovery call.
            </p>
            <p className="mt-4 text-sm font-medium text-marketing-ink">
              Every score links back to the rubric, rationale, and conversation evidence.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4 shadow-[0_24px_70px_-36px_rgba(45,62,80,0.45)] sm:p-6">
            <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">
                    ILLUSTRATIVE EXAMPLE
                  </span>
                  <span className="text-xs text-muted">Discovery call · 24 min</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-marketing-ink">Mid-market operations discovery</h3>
              </div>
              <div className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-center">
                <div className="text-2xl font-bold text-amber-800">74</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Developing</div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Skill breakdown</p>
                <div className="mt-3 space-y-3">
                  {([
                    ["Problem discovery", 88],
                    ["Business impact", 76],
                    ["Decision process", 61],
                    ["Next-step control", 54],
                  ] as const).map(([label, score]) => (
                    <div key={label}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-medium text-marketing-ink">{label}</span>
                        <span className="tabular-nums text-muted">{score}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-surface-2/70 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Coach this next</p>
                <p className="mt-2 text-sm font-semibold text-marketing-ink">Make the decision process explicit.</p>
                <blockquote className="mt-3 border-l-2 border-brand pl-3 text-xs italic leading-relaxed text-muted">
                  “It sounds like operations and finance will both weigh in. How will the final decision be made?”
                </blockquote>
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  Assign a role-play focused on identifying stakeholders and securing a mutual next step.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Role-play */}
      <section className="border-t border-line bg-white py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12">
          <Image
            src="/marketing/roleplay.png"
            alt="SalesCoach AI role-play scenarios with difficulty levels"
            width={1440}
            height={900}
            className="order-2 h-auto w-full rounded-xl border border-line shadow-[0_18px_40px_-24px_rgba(45,62,80,0.3)] lg:order-1"
          />
          <div className="order-1 lg:order-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Practice before the next live deal</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
              Turn coaching feedback into a repeatable behavior
            </h2>
            <p className="mt-4 text-muted leading-relaxed">
              Build scenarios from your real buyer personas and objections. Reps practice in text, then get graded on
              the same rubric as live calls—so the manager can coach, assign, and verify improvement in one loop.
            </p>
          </div>
        </div>
      </section>

      {/* Buyer clarity */}
      <section className="border-t border-line bg-marketing-wash py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">One system, two focused views</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
              Clear for reps. Useful for managers.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-xl border border-line bg-white p-6 sm:p-8">
              <div className="text-sm font-bold uppercase tracking-wider text-brand">For sales reps</div>
              <h3 className="mt-3 text-2xl font-semibold text-marketing-ink">Know what to do differently next time.</h3>
              <ul className="mt-5 space-y-3 text-sm text-muted">
                <li>✓ Quote-backed strengths and improvements</li>
                <li>✓ Focused role-play based on real coaching gaps</li>
                <li>✓ Personal score and skill trends</li>
                <li>✓ Clear assignments without spreadsheet follow-up</li>
              </ul>
            </div>
            <div className="rounded-xl border border-marketing-ink bg-marketing-ink p-6 text-white sm:p-8">
              <div className="text-sm font-bold uppercase tracking-wider text-cyan-300">For managers</div>
              <h3 className="mt-3 text-2xl font-semibold">Coach the team without reviewing every minute.</h3>
              <ul className="mt-5 space-y-3 text-sm text-slate-300">
                <li>✓ Consistent scoring against one methodology</li>
                <li>✓ Team trends and skill-level visibility</li>
                <li>✓ Evidence for targeted coaching conversations</li>
                <li>✓ Assignments tied to scenarios and call review</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-line bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Team-first pricing</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
            Validate the workflow before committing to a rollout
          </h2>
          <p className="mt-3 max-w-2xl text-muted">
            Sales coaching is a team purchase. Start with a guided evaluation, prove fit against your playbook, then
            choose a rollout based on team size and workflow.
          </p>

          <div className="mt-10 grid max-w-4xl gap-5 sm:mt-12 md:grid-cols-2">
            <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">
              <div className="text-sm font-semibold uppercase tracking-wider text-brand">Team evaluation</div>
              <div className="mt-3 font-display text-3xl font-semibold tracking-tight text-marketing-ink">
                14-day workspace
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Test the complete coaching loop with your methodology and representative call examples.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-marketing-ink">
                <li className="flex gap-2"><span className="font-semibold text-brand">✓</span> Manager workspace</li>
                <li className="flex gap-2"><span className="font-semibold text-brand">✓</span> Custom company context</li>
                <li className="flex gap-2"><span className="font-semibold text-brand">✓</span> Call grading and role-play</li>
                <li className="flex gap-2"><span className="font-semibold text-brand">✓</span> No credit card to evaluate</li>
              </ul>
              <Link
                href={appHref}
                className="mt-8 inline-flex w-full items-center justify-center rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-marketing-ink transition-colors hover:bg-surface-2"
              >
                Start an evaluation
              </Link>
            </div>

            <div className="rounded-xl border border-marketing-ink bg-marketing-ink p-6 text-white sm:p-8">
              <div className="text-sm font-semibold uppercase tracking-wider text-cyan-300">Team rollout</div>
              <div className="mt-3 font-display text-3xl font-semibold tracking-tight">Pilot pricing</div>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Pricing is scoped to your team size, onboarding needs, call volume, and required integrations.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-200">
                <li className="flex gap-2"><span className="font-semibold text-cyan-300">✓</span> Rep and manager workflows</li>
                <li className="flex gap-2"><span className="font-semibold text-cyan-300">✓</span> Methodology configuration</li>
                <li className="flex gap-2"><span className="font-semibold text-cyan-300">✓</span> Guided onboarding</li>
                <li className="flex gap-2"><span className="font-semibold text-cyan-300">✓</span> Integration roadmap planning</li>
              </ul>
              <a
                href="#demo"
                className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-marketing-ink transition-colors hover:bg-slate-100"
              >
                Discuss a team pilot
              </a>
            </div>
          </div>
          <p className="mt-4 max-w-4xl text-xs leading-relaxed text-muted">
            Team pricing is finalized during the pilot proposal. We do not advertise an enterprise security package or
            native integration until that capability is available.
          </p>
        </div>
      </section>

      {/* Early-stage trust */}
      <section className="border-t border-line bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-2xl border border-brand/30 bg-brand/5 p-6 sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Founding design partners</p>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
                  Help shape the integrations and coaching workflow your team needs.
                </h2>
                <p className="mt-4 max-w-2xl leading-relaxed text-muted">
                  SalesCoach is early. Rather than fill this page with borrowed logos or anonymous praise, we are
                  inviting a small group of sales teams to validate the product against real playbooks and workflows.
                </p>
              </div>
              <div className="rounded-xl border border-line bg-white p-5">
                <p className="text-sm font-semibold text-marketing-ink">Design partners receive</p>
                <ul className="mt-4 space-y-3 text-sm text-muted">
                  <li>✓ Direct onboarding support</li>
                  <li>✓ Rubric and scenario configuration</li>
                  <li>✓ Input on integration priorities</li>
                  <li>✓ A documented pilot success plan</li>
                </ul>
                <a href="#demo" className="mt-5 inline-block text-sm font-semibold text-brand hover:underline">
                  Apply for a pilot →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo CTA */}
      <section id="demo" className="border-t border-line bg-marketing-wash py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:items-start lg:gap-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Talk through your workflow</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
              See SalesCoach against your playbook
            </h2>
            <p className="mt-4 text-muted leading-relaxed">
              Tell us how your team records calls, which methodology managers coach, and where rep performance breaks
              down. We will show the current product honestly and identify any gap before proposing a pilot.
            </p>
            <Link href={appHref} className="mt-6 inline-block text-sm font-semibold text-brand hover:text-brand-hover">
              Prefer to click around first? {isClerkEnabled() ? "Create an account" : "Open the live demo"} →
            </Link>
          </div>
          <DemoForm />
        </div>
      </section>
    </>
  );
}
