import type { Metadata } from "next";
import Link from "next/link";
import { BrandLockup } from "@/components/brand-logo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Erota Sales Intelligence collects and uses information from our website and product.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-24 sm:px-6 sm:pt-28">
      <Link href="/" aria-label="Erota Sales Intelligence home" className="inline-flex items-center gap-2 text-sm text-muted hover:text-marketing-ink">
        <span aria-hidden>←</span>
        <BrandLockup size="sm" textClassName="text-marketing-ink" />
      </Link>
      <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-marketing-ink">Privacy Policy</h1>
      <p className="mt-3 text-sm text-muted">Last updated: October 19, 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-marketing-ink">
        <section>
          <h2 className="text-lg font-semibold">Who we are</h2>
          <p className="mt-2 text-muted">
            Erota Sales Intelligence (“we”, “us”) provides AI-assisted sales call grading, role-play practice, and coaching
            analytics. This policy covers our marketing website and application.
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
            <li>
              <strong className="text-marketing-ink">Billing data:</strong> subscription status, plan, seat quantity,
              and Stripe customer identifiers. Payment-card details are collected and stored by Stripe, not Erota.
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
            We use service providers to operate the product: Clerk for authentication, Neon for PostgreSQL hosting,
            Cloudflare R2 for encrypted object storage, OpenAI for grading and role-play, Deepgram for transcription,
            Stripe for billing, and Vercel for application hosting. These providers process information only to deliver
            their contracted services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Recordings and consent</h2>
          <p className="mt-2 text-muted">
            Customers are responsible for providing required notices and obtaining permission to record and process
            conversations. Do not upload a conversation unless your organization has a lawful basis and the required
            consent.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Cookies</h2>
          <p className="mt-2 text-muted">
            Authentication cookies are required to keep signed-in users secure. With your permission, we also store a
            first-party attribution cookie for up to 30 days to understand which campaign introduced you to Erota. You
            may decline that optional cookie from the website notice.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Retention and deletion</h2>
          <p className="mt-2 text-muted">
            By default, uploaded audio is deleted after 90 days and call, transcript, score, and role-play records are
            deleted after 365 days. Authorized users may delete a call earlier from the application. Demo leads are
            retained while we pursue a sales conversation and may be deleted on request. Limited copies may remain in
            provider backups until their normal backup cycles expire.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Your choices</h2>
          <p className="mt-2 text-muted">
            Email{" "}
            <a className="text-brand hover:text-brand-hover" href="mailto:hello@erota.io">
              hello@erota.io
            </a>{" "}
            to access, correct, export, or delete personal information we hold about you. You may also object to or
            restrict certain processing where applicable.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="mt-2 text-muted">
            Questions about this policy:{" "}
            <a className="text-brand hover:text-brand-hover" href="mailto:hello@erota.io">
              hello@erota.io
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
