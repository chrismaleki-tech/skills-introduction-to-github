import type { Metadata } from "next";
import Link from "next/link";
import { BrandLockup } from "@/components/brand-logo";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing use of Erota Sales Intelligence.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-24 sm:px-6 sm:pt-28">
      <Link href="/" aria-label="Erota Sales Intelligence home" className="inline-flex items-center gap-2 text-sm text-muted hover:text-marketing-ink">
        <span aria-hidden>←</span>
        <BrandLockup size="sm" textClassName="text-marketing-ink" />
      </Link>
      <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-marketing-ink">
        Terms of Service
      </h1>
      <p className="mt-3 text-sm text-muted">Last updated: October 19, 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-marketing-ink">
        <Section title="Agreement">
          By creating an account or using Erota Sales Intelligence, you agree to these terms. If you use the service for
          an organization, you confirm that you have authority to accept these terms for that organization.
        </Section>
        <Section title="The service">
          The service provides AI-assisted role-play, transcription, call review, scoring, and sales-coaching
          analytics. AI-generated outputs may be incomplete or inaccurate and must be reviewed by qualified people
          before being used for employment, compensation, legal, or customer decisions.
        </Section>
        <Section title="Recording and content responsibilities">
          You are responsible for obtaining all notices, permissions, and consents required to record, upload, and
          process conversations. You must not upload content you do not have the right to use. You retain ownership of
          your content and authorize us and our subprocessors to process it only to provide, secure, and improve the
          service.
        </Section>
        <Section title="Plans, trials, and billing">
          Trials are time-limited. Paid plans renew monthly until canceled and are billed per seat at the price shown
          during checkout. Plan allowances reset each billing period. Fees are non-refundable except where required by
          law. You may manage payment methods and cancellation through the Stripe customer portal.
        </Section>
        <Section title="Acceptable use">
          You may not use the service to break the law, violate privacy or recording rules, infringe rights, distribute
          malware, probe security, overload the service, share credentials improperly, or attempt to extract another
          customer&apos;s data.
        </Section>
        <Section title="Availability and changes">
          We may update features, limits, and these terms as the service evolves. We may suspend access when necessary
          to prevent harm, address nonpayment, or comply with law. We do not guarantee uninterrupted availability.
        </Section>
        <Section title="Disclaimers and liability">
          The service is provided “as is” to the extent permitted by law. Erota disclaims implied warranties and is not
          liable for indirect, incidental, special, consequential, or lost-profit damages. Erota&apos;s aggregate
          liability is limited to fees you paid for the service during the three months preceding the claim, except
          where applicable law prohibits that limitation.
        </Section>
        <Section title="Termination">
          You may stop using the service at any time. We may terminate access for material breach. Account termination
          does not erase payment obligations already incurred. Data deletion follows the Privacy Policy and configured
          retention periods.
        </Section>
        <Section title="Contact">
          Questions about these terms may be sent to{" "}
          <a href="mailto:hello@erota.io" className="text-brand hover:underline">
            hello@erota.io
          </a>
          .
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-muted">{children}</p>
    </section>
  );
}
