import { redirect } from "next/navigation";
import { billingAccess } from "@/lib/billing";
import { db } from "@/lib/db";
import { PLANS, planForPriceId, priceIdForPlan, type CheckoutPlanKey, type PlanKey } from "@/lib/plans";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { usageForRep } from "@/lib/usage";

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
  const teamSize = await db.user.count({ where: { orgId: user.orgId } });
  const storedPlan = user.org.planKey as PlanKey;
  const planKey = user.org.stripePriceId
    ? planForPriceId(user.org.stripePriceId)
    : PLANS[storedPlan]
      ? storedPlan
      : "trial";
  const currentPlan = PLANS[planKey];
  const usage = await usageForRep(user.org, user.id);
  const checkoutReady = {
    pro: Boolean(process.env.STRIPE_SECRET_KEY && priceIdForPlan("pro")),
    max: Boolean(process.env.STRIPE_SECRET_KEY && priceIdForPlan("max")),
  };

  return (
    <div>
      <PageHeader
        title="Billing"
        subtitle="Choose and manage your Erota Sales Intelligence plan."
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
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
            <div>
              <div className="text-xl font-semibold">{currentPlan.name}</div>
              <div className="mt-1 text-sm text-muted">
                {currentPlan.pricePerSeat === null
                  ? "Custom per-seat pricing"
                  : `$${currentPlan.pricePerSeat} per seat/month`}
                {user.org.stripeSubscriptionId ? ` · ${user.org.stripeSeatCount} seats` : ""}
              </div>
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
            <div>
              <dt className="text-muted">Your role-play usage</dt>
              <dd className="mt-1">
                {minutes(usage.roleplaySeconds)} / {limit(currentPlan.roleplayMinutesPerSeat, "min")}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Your call-scoring usage</dt>
              <dd className="mt-1">
                {hours(usage.callScoringSeconds)} / {limit(
                  currentPlan.callScoringMinutesPerSeat === null
                    ? null
                    : currentPlan.callScoringMinutesPerSeat / 60,
                  "hr",
                )}
              </dd>
            </div>
          </dl>

          {user.org.stripeSubscriptionId && (
            <div className="mt-6 flex flex-wrap gap-3">
              <form action="/api/billing/portal" method="post" className="w-full sm:w-auto">
                <button
                  type="submit"
                  className="min-h-11 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover sm:w-auto"
                >
                  Manage subscription
                </button>
              </form>
            </div>
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

      <div className="mt-8">
        <h2 className="text-2xl font-semibold tracking-tight">Choose a plan</h2>
        <p className="mt-2 text-sm text-muted">
          Paid plans are billed per seat each month. Your organization currently has {teamSize}{" "}
          {teamSize === 1 ? "member" : "members"}.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PlanCard plan="trial" current={planKey === "trial"} />
          <CheckoutPlanCard
            plan="pro"
            teamSize={teamSize}
            current={planKey === "pro"}
            checkoutReady={checkoutReady.pro}
            hasSubscription={Boolean(user.org.stripeSubscriptionId)}
          />
          <CheckoutPlanCard
            plan="max"
            teamSize={teamSize}
            current={planKey === "max"}
            checkoutReady={checkoutReady.max}
            hasSubscription={Boolean(user.org.stripeSubscriptionId)}
          />
          <PlanCard plan="enterprise" current={planKey === "enterprise"} />
        </div>
      </div>
    </div>
  );
}

function minutes(seconds: number) {
  return `${Math.ceil(seconds / 60)} min`;
}

function hours(seconds: number) {
  return `${(seconds / 3600).toFixed(1)} hr`;
}

function limit(value: number | null, unit: "min" | "hr") {
  return value === null ? "No fixed limit" : `${value} ${unit}`;
}

function PlanCard({ plan, current }: { plan: "trial" | "enterprise"; current: boolean }) {
  const definition = PLANS[plan];
  return (
    <div className="flex flex-col rounded-xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{definition.name}</h3>
        {current && <span className="rounded-full bg-brand/10 px-2 py-1 text-xs font-medium text-brand">Current</span>}
      </div>
      <div className="mt-3 text-3xl font-semibold">
        {definition.pricePerSeat === null ? "Custom" : `$${definition.pricePerSeat}`}
      </div>
      <div className="text-xs text-muted">per seat/month</div>
      <p className="mt-4 text-sm text-muted">{definition.description}</p>
      <ul className="mt-5 flex-1 space-y-2 text-sm">
        {definition.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
      </ul>
      {plan === "enterprise" && (
        <a
          href="mailto:hello@erota.io?subject=Erota%20Sales%20Intelligence%20Enterprise"
          className="mt-6 rounded-lg border border-line px-4 py-2.5 text-center text-sm font-semibold hover:bg-surface"
        >
          Book a demo
        </a>
      )}
    </div>
  );
}

function CheckoutPlanCard({
  plan,
  teamSize,
  current,
  checkoutReady,
  hasSubscription,
}: {
  plan: CheckoutPlanKey;
  teamSize: number;
  current: boolean;
  checkoutReady: boolean;
  hasSubscription: boolean;
}) {
  const definition = PLANS[plan];
  return (
    <div className={`flex flex-col rounded-xl border bg-white p-5 ${plan === "max" ? "border-brand shadow-sm" : "border-line"}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{definition.name}</h3>
        {current && <span className="rounded-full bg-brand/10 px-2 py-1 text-xs font-medium text-brand">Current</span>}
      </div>
      <div className="mt-3 text-3xl font-semibold">${definition.pricePerSeat}</div>
      <div className="text-xs text-muted">per seat/month</div>
      <p className="mt-4 text-sm text-muted">{definition.description}</p>
      <ul className="mt-5 flex-1 space-y-2 text-sm">
        {definition.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
      </ul>
      {!hasSubscription ? (
        <form action="/api/billing/checkout" method="post" className="mt-6 space-y-3">
          <input type="hidden" name="plan" value={plan} />
          <label className="block text-xs font-medium text-muted">
            Seats
            <input
              type="number"
              name="seats"
              min={teamSize}
              max={500}
              defaultValue={teamSize}
              className="mt-1 min-h-10 w-full rounded-lg border border-line px-3 text-sm text-marketing-ink"
            />
          </label>
          <button
            type="submit"
            disabled={!checkoutReady}
            className="min-h-11 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Get started
          </button>
          {!checkoutReady && <p className="text-xs text-amber-700">Awaiting this plan&apos;s Stripe price.</p>}
        </form>
      ) : (
        <p className="mt-6 text-xs text-muted">Use Manage subscription above to change an active plan.</p>
      )}
    </div>
  );
}
