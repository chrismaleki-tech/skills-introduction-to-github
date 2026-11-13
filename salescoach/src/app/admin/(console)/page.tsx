import Link from "next/link";
import { platformOverview } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export default async function PlatformOverviewPage() {
  const counts = await platformOverview();
  const cards = [
    ["Workspaces", counts.workspaces, "Every customer workspace, including paused ones."],
    ["Users", counts.users, "People with access. Former members are not included."],
    ["Active trials", counts.activeTrials, "Trialing, not paused, and the trial end date is still ahead. A missing end date counts as 14 days from creation."],
    ["Expired trials", counts.expiredTrials, "Still marked trialing, not paused, and the trial end date has passed. Not a paid cancellation."],
    ["Paying", counts.paying, "Stripe status is active, or canceled with paid access still in the future. Includes paused workspaces that are still paying. Complimentary access is not counted."],
    ["Paused", counts.suspended, "Platform suspension. This is separate from a Stripe cancellation."],
  ] as const;

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Counts from the application database. Stripe remains the record of paid subscriptions. No revenue is shown
        here.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value, definition]) => (
          <section key={label} className="rounded-xl border border-line bg-surface p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
            <p className="mt-2 text-xs text-muted">{definition}</p>
          </section>
        ))}
      </div>
      {counts.workspaces === 0 && (
        <p className="mt-6 text-sm text-muted">No workspaces yet. New signups appear after someone creates an account.</p>
      )}
      <p className="mt-8 text-sm">
        <Link href="/admin/workspaces" className="font-medium text-brand hover:underline">
          Review workspaces
        </Link>
      </p>
    </main>
  );
}
