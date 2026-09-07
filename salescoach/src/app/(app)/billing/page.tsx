import { redirect } from "next/navigation";
import { billingAccess } from "@/lib/billing";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";

function date(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(value)
    : "—";
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) redirect("/me");
  const params = await searchParams;
  const access = billingAccess(user.org);
  const checkoutReady = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);

  return (
    <div>
      <PageHeader
        title="Billing"
        subtitle="Manage your SalesCoach AI subscription and payment method."
      />

      {params.checkout === "success" && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Payment received. Stripe is activating your subscription; refresh if the status has not updated yet.
        </div>
      )}
      {params.checkout === "canceled" && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Checkout was canceled. Your existing access has not changed.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Current plan">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xl font-semibold">SalesCoach Individual</div>
              <div className="mt-1 text-sm text-muted">$50 per month · cancel anytime</div>
            </div>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                access.entitled
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {access.status.replace("_", " ")}
            </span>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted">Trial ends</dt>
              <dd className="mt-1">{date(access.trialEndsAt)}</dd>
            </div>
            <div>
              <dt className="text-muted">Paid through</dt>
              <dd className="mt-1">{date(user.org.subscriptionEndsAt)}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            {!user.org.stripeSubscriptionId ? (
              <form action="/api/billing/checkout" method="post">
                <button
                  type="submit"
                  disabled={!checkoutReady}
                  className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Subscribe for $50/month
                </button>
              </form>
            ) : (
              <form action="/api/billing/portal" method="post">
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
                >
                  Manage subscription
                </button>
              </form>
            )}
          </div>
          {!checkoutReady && (
            <p className="mt-3 text-xs text-amber-700">
              Checkout is awaiting Stripe production configuration.
            </p>
          )}
        </Card>

        <Card title="Included">
          <ul className="space-y-3 text-sm">
            <li>✓ Call upload, transcription, and graded scorecards</li>
            <li>✓ AI sales role-play and coaching feedback</li>
            <li>✓ Manager dashboard and assignments</li>
            <li>✓ Custom company profile and rubric</li>
          </ul>
          <p className="mt-6 text-xs text-muted">
            Receipts, invoices, payment methods, cancellation, and tax details are managed securely by Stripe.
          </p>
        </Card>
      </div>
    </div>
  );
}
