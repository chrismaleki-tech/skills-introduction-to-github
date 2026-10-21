import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How SalesCoach AI collects and uses information from our website and product.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-28">
      <p className="text-sm text-muted">
        <Link href="/" className="text-brand hover:text-brand-hover">
          ← SalesCoach AI
        </Link>
      </p>
      <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-marketing-ink">Privacy Policy</h1>
      <p className="mt-3 text-sm text-muted">Last updated: August 26, 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-marketing-ink">
        <section>
          <h2 className="text-lg font-semibold">Who we are</h2>
          <p className="mt-2 text-muted">
            SalesCoach AI (“we”, “us”) provides AI-assisted sales call grading, role-play practice, and coaching
            analytics. This policy covers our marketing website and product demo.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Information we collect</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-muted">
            <li>
              <strong className="text-marketing-ink">Demo requests:</strong> name, work email, and optional company name
              when you submit the Book a demo form.
            </li>
            <li>
              <strong className="text-marketing-ink">Product usage:</strong> account profile, uploaded call audio or
              transcripts, role-play messages, grades, and settings you configure in the app.
            </li>
            <li>
              <strong className="text-marketing-ink">Technical data:</strong> basic server logs (IP, user agent, timestamps)
              needed to operate and secure the service.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">How we use information</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-muted">
            <li>Respond to demo requests and provide customer support</li>
            <li>Operate call transcription, grading, role-play, and dashboards</li>
            <li>Improve product quality and reliability</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Processors</h2>
          <p className="mt-2 text-muted">
            Depending on configuration, we may use subprocessors such as OpenAI (grading / role-play) and Deepgram
            (transcription). Those providers process content only to deliver the requested feature.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Retention</h2>
          <p className="mt-2 text-muted">
            Demo leads are retained while we pursue a sales conversation, then deleted or archived on request. Product
            call data is retained for your organization until you delete it or close the account, subject to backup
            windows.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Your choices</h2>
          <p className="mt-2 text-muted">
            Email{" "}
            <a className="text-brand hover:text-brand-hover" href="mailto:privacy@salescoach.ai">
              privacy@salescoach.ai
            </a>{" "}
            to access, correct, or delete personal information we hold about you.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="mt-2 text-muted">
            Questions about this policy:{" "}
            <a className="text-brand hover:text-brand-hover" href="mailto:hello@salescoach.ai">
              hello@salescoach.ai
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
