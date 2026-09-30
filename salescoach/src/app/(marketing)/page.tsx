import Image from "next/image";
import Link from "next/link";
import { DemoForm } from "@/components/marketing/demo-form";

export default function MarketingHomePage() {
  return (
    <>
      {/* Hero — one composition: brand, headline, support, CTAs, full-bleed product */}
      <section className="mkt-hero-wash relative overflow-hidden pt-24">
        <div className="mx-auto max-w-6xl px-6 pt-10 pb-8 sm:pt-14">
          <p className="mkt-rise font-display text-4xl font-semibold tracking-tight text-marketing-ink sm:text-5xl md:text-6xl">
            <span className="text-brand">Sales</span>Coach AI
          </p>
          <h1 className="mkt-rise mkt-rise-delay-1 mt-5 max-w-3xl text-2xl font-semibold tracking-tight text-marketing-ink sm:text-3xl md:text-[2.15rem] md:leading-snug">
            Turn every sales call into coaching — graded against your playbook.
          </h1>
          <p className="mkt-rise mkt-rise-delay-2 mt-4 max-w-xl text-base text-muted sm:text-lg">
            Upload real calls, practice against AI prospects, and give managers a clear scorecard on what to coach next.
          </p>
          <div className="mkt-rise mkt-rise-delay-3 mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#demo"
              className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover transition-colors"
            >
              Book a demo
            </a>
            <Link
              href="/dashboard"
              className="rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-marketing-ink hover:bg-surface-2 transition-colors"
            >
              Try the live demo
            </Link>
          </div>
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

      {/* How it works */}
      <section id="how-it-works" className="border-t border-line bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
            How it works
          </h2>
          <p className="mt-3 max-w-2xl text-muted">
            One loop for reps and managers: capture the conversation, grade it on your rubric, coach the gap.
          </p>
          <ol className="mt-12 grid gap-10 sm:grid-cols-3">
            {[
              {
                n: "01",
                title: "Ingest the call",
                body: "Upload audio or paste a transcript. Point your dialer webhook at SalesCoach for automatic intake.",
              },
              {
                n: "02",
                title: "Grade the conversation",
                body: "AI scores 0–100 across your methodology — MEDDIC, SPIN, Challenger, or a custom Meridian-style rubric.",
              },
              {
                n: "03",
                title: "Coach with evidence",
                body: "Managers see skill heatmaps, weak dimensions, and timestamped quotes — then assign role-play practice.",
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

      {/* Call grading */}
      <section className="border-t border-line bg-marketing-wash py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
              Grade real calls against your company context
            </h2>
            <p className="mt-4 text-muted leading-relaxed">
              Products, objections, competitors, and talk tracks ground every score. Reps get strengths, next steps, and
              quote-backed feedback — not generic AI fluff.
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

      {/* Role-play */}
      <section className="border-t border-line bg-white py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
          <Image
            src="/marketing/roleplay.png"
            alt="SalesCoach AI role-play scenarios with difficulty levels"
            width={1440}
            height={900}
            className="order-2 h-auto w-full rounded-xl border border-line shadow-[0_18px_40px_-24px_rgba(45,62,80,0.3)] lg:order-1"
          />
          <div className="order-1 lg:order-2">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
              Practice against AI prospects that fight back
            </h2>
            <p className="mt-4 text-muted leading-relaxed">
              Build scenarios from your buyer personas. Reps role-play in text, then get graded on the same rubric as live
              calls — so practice and production stay comparable.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-line bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
            Simple pricing
          </h2>
          <p className="mt-3 max-w-xl text-muted">One seat. Full coaching loop. Cancel anytime.</p>

          <div className="mt-12 max-w-lg border-t-4 border-brand bg-surface-2/60 px-8 py-10">
            <div className="text-sm font-semibold uppercase tracking-wider text-brand">Individual</div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="font-display text-5xl font-semibold tracking-tight text-marketing-ink">$50</span>
              <span className="text-muted">/ month</span>
            </div>
            <ul className="mt-6 space-y-3 text-sm text-marketing-ink">
              <li className="flex gap-2">
                <span className="text-brand font-semibold">✓</span> Call upload & graded scorecards
              </li>
              <li className="flex gap-2">
                <span className="text-brand font-semibold">✓</span> AI role-play with shared rubrics
              </li>
              <li className="flex gap-2">
                <span className="text-brand font-semibold">✓</span> Manager dashboard & assignments
              </li>
              <li className="flex gap-2">
                <span className="text-brand font-semibold">✓</span> Custom methodology + company profile
              </li>
            </ul>
            <a
              href="#demo"
              className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
            >
              Start with a demo
            </a>
          </div>
        </div>
      </section>

      {/* Demo CTA */}
      <section id="demo" className="border-t border-line bg-marketing-wash py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-marketing-ink sm:text-4xl">
              See SalesCoach on your pipeline
            </h2>
            <p className="mt-4 text-muted leading-relaxed">
              Tell us who you coach. We’ll walk you through call grading, role-play, and the manager dashboard — or jump
              straight into the interactive demo.
            </p>
            <Link href="/dashboard" className="mt-6 inline-block text-sm font-semibold text-brand hover:text-brand-hover">
              Prefer to click around first? Open the live demo →
            </Link>
          </div>
          <DemoForm />
        </div>
      </section>
    </>
  );
}
