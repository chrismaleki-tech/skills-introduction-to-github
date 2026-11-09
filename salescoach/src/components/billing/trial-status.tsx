import Link from "next/link";
import { fmtMinutes, LOW_ALLOWANCE_WARNING_SECONDS, type Allowance, type TrialStatus } from "@/lib/usage";

// Workspace-wide trial position: days left, the two shared minute pools, and
// seats. Rendered for managers (with upgrade actions) and reps (who are told
// to ask an admin). Each pool is reported on its own, so running out of AI
// Role Play says nothing about call review and vice versa.

function fmtDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(value)
    : "—";
}

export function poolState(a: Allowance): "ok" | "low" | "exhausted" {
  if (a.remainingSeconds === null) return "ok";
  if (a.remainingSeconds <= 0) return "exhausted";
  if (a.remainingSeconds <= LOW_ALLOWANCE_WARNING_SECONDS) return "low";
  return "ok";
}

function Meter({ label, allowance, note }: { label: string; allowance: Allowance; note?: string }) {
  const limit = allowance.limitSeconds ?? 0;
  const used = Math.min(allowance.usedSeconds, limit);
  const remaining = allowance.remainingSeconds ?? 0;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const state = poolState(allowance);
  const bar = state === "exhausted" ? "bg-rose-500" : state === "low" ? "bg-amber-500" : "bg-brand";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted">
          {fmtMinutes(used)} used · <span className={state === "exhausted" ? "font-semibold text-rose-700" : state === "low" ? "font-semibold text-amber-700" : "text-foreground"}>{fmtMinutes(remaining)} left</span> of {fmtMinutes(limit)}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} aria-label={`${label} used`}>
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

export function UpgradeAction({ manager, label = "Upgrade" }: { manager: boolean; label?: string }) {
  if (manager) {
    return (
      <Link
        href="/billing"
        className="inline-flex min-h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
      >
        {label}
      </Link>
    );
  }
  return <span className="text-sm text-muted">Ask a workspace admin to upgrade from Billing.</span>;
}

export function TrialStatusCard({
  status,
  manager,
  title = "Free trial",
}: {
  status: TrialStatus;
  manager: boolean;
  title?: string;
}) {
  const rp = poolState(status.roleplay);
  const cr = poolState(status.callReview);
  const seatsFull = status.seats.used >= status.seats.limit;
  const alerts: { tone: "rose" | "amber"; text: string }[] = [];
  if (status.expired) {
    alerts.push({
      tone: "rose",
      text: `Your ${status.totalDays}-day trial ended on ${fmtDate(status.trialEndsAt)}. Saved calls, role-plays, and scores stay viewable; AI Role Play and call review resume when you upgrade.`,
    });
  } else {
    if (rp === "exhausted") alerts.push({ tone: "rose", text: `AI Role Play minutes are used up. Call review is still available while that allowance lasts.` });
    else if (rp === "low") alerts.push({ tone: "amber", text: `Only ${fmtMinutes(status.roleplay.remainingSeconds ?? 0)} of AI Role Play left for the whole workspace.` });
    if (cr === "exhausted") alerts.push({ tone: "rose", text: `Call review minutes are used up. AI Role Play is still available while that allowance lasts.` });
    else if (cr === "low") alerts.push({ tone: "amber", text: `Only ${fmtMinutes(status.callReview.remainingSeconds ?? 0)} of call review left for the whole workspace.` });
    if (status.daysLeft <= 3) alerts.push({ tone: "amber", text: `${status.daysLeft} day${status.daysLeft === 1 ? "" : "s"} left in the trial.` });
  }
  const needsUpgrade = status.expired || rp === "exhausted" || cr === "exhausted";

  return (
    <section className="rounded-xl border border-line bg-surface" data-testid="trial-status">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">{title}</h2>
          <div className="mt-1 text-xl font-semibold">
            {status.expired ? "Trial ended" : `${status.daysLeft} day${status.daysLeft === 1 ? "" : "s"} remaining`}
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {status.expired ? `Ended ${fmtDate(status.trialEndsAt)}` : `Ends ${fmtDate(status.trialEndsAt)} · no card on file`}
          </div>
        </div>
        <UpgradeAction manager={manager} label={needsUpgrade ? "Upgrade to continue" : "Choose a plan"} />
      </div>

      <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-5">
        <Meter label="AI Role Play" allowance={status.roleplay} />
        <Meter label="Call review" allowance={status.callReview} note="Metered by recording length; pasted transcripts use an estimate." />
        <div className="sm:col-span-2">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">Seats</span>
            <span className={`tabular-nums ${seatsFull ? "font-semibold text-amber-700" : "text-muted"}`}>
              {status.seats.used} of {status.seats.limit} used
              {status.seats.pendingInvites > 0 ? ` (${status.seats.pendingInvites} pending invite${status.seats.pendingInvites === 1 ? "" : "s"})` : ""}
            </span>
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <ul className="space-y-2 px-4 pb-4 sm:px-5">
          {alerts.map((a) => (
            <li
              key={a.text}
              className={`rounded-lg border px-3 py-2 text-sm ${a.tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}
            >
              {a.text}
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-line px-4 py-3 text-xs text-muted sm:px-5">
        Trial allowances are shared across your workspace for the full {status.totalDays}-day trial.
      </p>
    </section>
  );
}
