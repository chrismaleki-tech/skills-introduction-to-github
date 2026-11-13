import Link from "next/link";
import { notFound } from "next/navigation";
import { ROLES } from "@/lib/invites";
import { workspaceDetail } from "@/lib/platform-admin";
import { TRIAL_SEAT_LIMIT } from "@/lib/seats";
import { describeAllowanceWindow, limitSecondsForOrg } from "@/lib/usage";

export const dynamic = "force-dynamic";

function when(value: Date | null | undefined) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(value);
}

function dateInput(value: Date | null | undefined) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function minutes(seconds: number) {
  return `${Math.ceil(seconds / 60)} min`;
}

function cap(seconds: number | null) {
  return seconds === null ? "No fixed cap" : minutes(seconds);
}

const field = "mt-1 min-h-10 w-full rounded-lg border border-line bg-white px-3 text-sm";

export default async function WorkspaceAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const detail = await workspaceDetail(id);
  if (!detail) notFound();
  const { org, access, window, usage } = detail;
  const roleplayCap = limitSecondsForOrg(org, window.planKey, "roleplay");
  const callReviewCap = limitSecondsForOrg(org, window.planKey, "call_review");
  const trialEditable = org.planStatus === "trialing" && !detail.paidEntitled;

  return (
    <main className="space-y-8">
      <div>
        <Link href="/admin/workspaces" className="text-sm text-brand hover:underline">
          All workspaces
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{org.name}</h1>
        <p className="mt-1 font-mono text-xs text-muted">{org.id}</p>
      </div>

      {query.ok && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{query.ok}</p>}
      {query.error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{query.error}</p>}

      <section className="grid gap-4 rounded-xl border border-line p-4 sm:grid-cols-2">
        <Fact label="Contact" value={detail.contact ? `${detail.contact.name || "Unnamed"} · ${detail.contact.email}` : "No members"} />
        <Fact label="Members" value={`${org.users.length} active · ${detail.removedMembers} former`} />
        <Fact label="Stored plan" value={`${org.planKey} · status ${org.planStatus}`} />
        <Fact label="Platform access" value={access.status === "suspended" ? "Paused by Erota" : access.entitled ? access.status : "Not entitled"} />
        <Fact label="Trial" value={`${when(org.trialEndsAt)} (stored) · effective ${when(access.trialEndsAt)}`} />
        <Fact label="Paid through" value={when(org.subscriptionEndsAt)} />
        <Fact label="Created" value={when(org.createdAt)} />
        <Fact label="Last activity" value={when(detail.lastActivity)} />
      </section>

      <section>
        <h2 className="text-lg font-semibold">{window.basis === "trial" ? "Usage for this trial" : "Usage this billing period"}</h2>
        <p className="mt-1 text-sm text-muted">
          {window.scope === "workspace" ? "Shared by the whole workspace." : "Paid plans are capped per seat. Totals below are the workspace sum; each person has their own cap."}{" "}
          {describeAllowanceWindow(window, when)} Extra allowance is included in the cap.
          {window.scope === "seat" ? " On a paid plan the extra minutes are added to every seat." : " On a trial the extra minutes are added once to the shared pool."}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Fact label="AI Role Play" value={`${minutes(usage.roleplayUsed)} used · cap ${cap(roleplayCap)} · bonus ${minutes(org.bonusRoleplaySec)}`} />
          <Fact label="Call review" value={`${minutes(usage.callReviewUsed)} used · cap ${cap(callReviewCap)} · bonus ${minutes(org.bonusCallReviewSec)}`} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Membership</h2>
        <p className="mt-1 text-sm text-muted">Roles use the existing workspace model. The last Admin cannot be changed to another role.</p>
        {org.users.length === 0 ? (
          <p className="mt-3 text-sm text-muted">This workspace has no active members.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {org.users.map((member) => (
              <li key={member.id} className="px-3 py-3 text-sm">
                <div className="font-medium">{member.name || "Unnamed"}</div>
                <div className="text-xs text-muted">{member.email}</div>
                <div className="mt-1 text-xs text-muted">
                  AI Role Play {minutes(usage.roleplayByRep.get(member.id) ?? 0)} · call review {minutes(usage.callReviewByRep.get(member.id) ?? 0)} in this window
                </div>
                <form action={`/api/admin/workspaces/${org.id}/members/${member.id}/role`} method="post" className="mt-3 grid gap-2 sm:grid-cols-4">
                  <select name="role" defaultValue={member.role} className={field}>
                    {ROLES.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <input name="reason" required minLength={8} maxLength={500} placeholder="Reason" className={field} />
                  <input name="confirm" required placeholder="Type ROLE" className={field} autoComplete="off" />
                  <button type="submit" className="min-h-10 rounded-lg border border-line px-3 text-sm font-medium">
                    Update role
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Action title="Extend the trial" note={trialEditable ? "Sets the trial end to the end of the selected UTC date. Stripe columns are not changed." : "This workspace is not on a trial, or a paid Stripe period is still entitled. Use complimentary access instead of changing the subscription."}>
          {trialEditable && (
            <form action={`/api/admin/workspaces/${org.id}/trial`} method="post" className="space-y-2">
              <input type="date" name="date" required defaultValue={dateInput(org.trialEndsAt)} className={field} />
              <input name="reason" required minLength={8} maxLength={500} placeholder="Reason" className={field} />
              <input name="confirm" required placeholder="Type EXTEND" className={field} autoComplete="off" />
              <button className="min-h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white">Extend trial</button>
            </form>
          )}
        </Action>

        <Action title="Add allowance" note="Adds minutes on top of the plan cap. It does not change the plan or the Stripe subscription.">
          <form action={`/api/admin/workspaces/${org.id}/allowance`} method="post" className="space-y-2">
            <select name="kind" className={field} defaultValue="roleplay">
              <option value="roleplay">AI Role Play</option>
              <option value="call_review">Call review</option>
            </select>
            <input name="minutes" required inputMode="numeric" pattern="[0-9]+" placeholder="Minutes to add" className={field} />
            <input name="reason" required minLength={8} maxLength={500} placeholder="Reason" className={field} />
            <input name="confirm" required placeholder="Type GRANT" className={field} autoComplete="off" />
            <button className="min-h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white">Add minutes</button>
          </form>
        </Action>

        <Action title={org.suspendedAt ? "Restore access" : "Pause access"} note="A pause stops AI Role Play and call review. It is not a Stripe cancellation, and saved results stay viewable. The reason is shown to the customer.">
          <form action={`/api/admin/workspaces/${org.id}/suspension`} method="post" className="space-y-2">
            <input type="hidden" name="intent" value={org.suspendedAt ? "restore" : "suspend"} />
            <input name="reason" required minLength={8} maxLength={500} placeholder="Reason" className={field} />
            <input name="confirm" required placeholder={org.suspendedAt ? "Type RESTORE" : "Type SUSPEND"} className={field} autoComplete="off" />
            <button className="min-h-10 rounded-lg border border-line px-4 text-sm font-semibold">
              {org.suspendedAt ? "Restore workspace" : "Pause workspace"}
            </button>
          </form>
        </Action>

        <Action
          title="Complimentary access"
          note={`This grants Pro or Max minutes until the end of the selected UTC date. It does not change the stored plan, the Stripe subscription, or the Stripe seat quantity. While the complimentary plan is the access actually in effect, the workspace is limited to ${TRIAL_SEAT_LIMIT} seats, including members and pending invitations. That is the trial seat cap.${detail.paidEntitled ? " A paid Stripe period is still entitled, so this is saved but does not apply until that period ends. Until then, the Stripe seat count stays in effect." : ""}`}
        >
          <form action={`/api/admin/workspaces/${org.id}/comp`} method="post" className="space-y-2">
            <input type="hidden" name="intent" value="set" />
            <select name="plan" className={field} defaultValue={org.compPlanKey === "max" ? "max" : "pro"}>
              <option value="pro">Pro</option>
              <option value="max">Max</option>
            </select>
            <input type="date" name="date" required defaultValue={dateInput(org.compExpiresAt)} className={field} />
            <input name="reason" required minLength={8} maxLength={500} placeholder="Reason" className={field} />
            <input name="confirm" required placeholder="Type COMP" className={field} autoComplete="off" />
            <button className="min-h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white">Save complimentary access</button>
          </form>
          {(org.compPlanKey || org.compExpiresAt) && (
            <form action={`/api/admin/workspaces/${org.id}/comp`} method="post" className="mt-4 space-y-2 border-t border-line pt-4">
              <input type="hidden" name="intent" value="clear" />
              <p className="text-xs text-muted">Current override: {org.compPlanKey ?? "unset"} until {when(org.compExpiresAt)}.</p>
              <input name="reason" required minLength={8} maxLength={500} placeholder="Reason for removing it" className={field} />
              <input name="confirm" required placeholder="Type REVOKE_COMP" className={field} autoComplete="off" />
              <button className="min-h-10 rounded-lg border border-line px-4 text-sm font-semibold">Remove complimentary access</button>
            </form>
          )}
        </Action>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Billing</h2>
        <p className="mt-1 text-sm text-muted">
          Stripe is the record of the paid subscription. This page does not cancel, charge, refund, or change it.
          {org.cancelAtPeriodEnd ? " Stripe is already set to cancel at period end." : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {detail.stripe.customer ? (
            <a href={detail.stripe.customer} className="font-medium text-brand underline" target="_blank" rel="noreferrer">
              Stripe customer
            </a>
          ) : (
            <span className="text-muted">No Stripe customer</span>
          )}
          {detail.stripe.subscription ? (
            <a href={detail.stripe.subscription} className="font-medium text-brand underline" target="_blank" rel="noreferrer">
              Stripe subscription
            </a>
          ) : (
            <span className="text-muted">No Stripe subscription</span>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Operational errors</h2>
        <p className="mt-1 text-sm text-muted">Failed call reviews. Recordings and transcripts are not shown.</p>
        {detail.failedCalls.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No failed calls are recorded.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line text-sm">
            {detail.failedCalls.map((call) => (
              <li key={call.id} className="px-3 py-2">
                <span className="font-mono text-xs">{call.id}</span>
                <span className="ml-2 text-muted">{when(call.createdAt)}</span>
                <div>{call.failReason || "No reason recorded"}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Audit history</h2>
        {detail.audits.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No platform changes have been recorded for this workspace.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line text-sm">
            {detail.audits.map((audit) => (
              <li key={audit.id} className="px-3 py-3">
                <div className="font-medium">{audit.action}</div>
                <div className="text-xs text-muted">{when(audit.createdAt)} · {audit.actorEmail}</div>
                {audit.reason && <div className="mt-1">{audit.reason}</div>}
                <div className="mt-1 break-all font-mono text-xs text-muted">Before {audit.beforeJson}</div>
                <div className="break-all font-mono text-xs text-muted">After {audit.afterJson}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function Action({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 mb-3 text-sm text-muted">{note}</p>
      {children}
    </section>
  );
}
