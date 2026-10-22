"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { Field, InlineError, InlineSuccess, TextArea, inputCls } from "@/components/settings/fields";
import type { SeatSummary } from "@/lib/seats";

type Member = { id: string; name: string; email: string; role: string; title: string; createdAt: string };
type PendingInvite = { id: string; email: string; role: string; link: string; expiresAt: string; emailed: boolean };

const ROLE_OPTIONS = [
  { value: "REP", label: "Rep", hint: "Uploads calls, runs role-plays, sees their own scores." },
  { value: "MANAGER", label: "Manager", hint: "Everything a rep can do, plus the team dashboard, rubrics, and billing." },
  { value: "TRAINER", label: "Trainer", hint: "Manager access focused on coaching and assignments." },
  { value: "ADMIN", label: "Admin", hint: "Full control, including inviting other admins." },
];

function roleLabel(role: string) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

async function api(path: string, init: RequestInit) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...init });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) throw new Error((data?.error as string) ?? "Request failed.");
  return data ?? {};
}

export function TeamManager({
  me,
  seats,
  hasSubscription,
  paidSeats,
  members,
  invites,
  joinLink,
}: {
  me: { id: string; role: string };
  seats: SeatSummary;
  hasSubscription: boolean;
  paidSeats: number;
  members: Member[];
  invites: PendingInvite[];
  joinLink: string | null;
}) {
  const solo = members.length === 1 && invites.length === 0;
  return (
    <div className="space-y-6">
      <SeatsCard seats={seats} hasSubscription={hasSubscription} paidSeats={paidSeats} />
      <Card title="Invite teammates">
        {solo && (
          <p className="mb-4 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm text-marketing-ink">
            Working solo? You don&apos;t need to do anything here. When you&apos;re ready to coach a team, paste
            their emails below and each person gets a seat on your workspace.
          </p>
        )}
        <InviteForm actorRole={me.role} available={seats.available} />
      </Card>
      {invites.length > 0 && (
        <Card title={`Pending invites (${invites.length})`}>
          <PendingList invites={invites} />
        </Card>
      )}
      <Card title={`Members (${members.length})`}>
        <MembersTable members={members} me={me} />
      </Card>
      <Card title="Team join link">
        <JoinLinkCard joinLink={joinLink} />
      </Card>
    </div>
  );
}

function SeatsCard({ seats, hasSubscription, paidSeats }: { seats: SeatSummary; hasSubscription: boolean; paidSeats: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState(String(Math.max(paidSeats, seats.used)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const pct = seats.limit ? Math.min(100, Math.round((seats.used / seats.limit) * 100)) : 0;
  const full = seats.limit !== null && seats.used >= seats.limit;

  async function updateSeats() {
    const next = Number(draft);
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const data = await api("/api/billing/seats", { method: "POST", body: JSON.stringify({ seats: next }) });
      setSaved(`Plan updated to ${data.seats as number} seats. Prorated charges appear on your next invoice.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update seats.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Seats">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-semibold tabular-nums">
            {seats.used}
            <span className="text-base font-normal text-muted">
              {seats.limit === null ? " seats in use · unlimited" : ` of ${seats.limit} seats in use`}
            </span>
          </div>
          <div className="mt-1 text-sm text-muted">
            {seats.members} {seats.members === 1 ? "member" : "members"}
            {seats.pendingInvites > 0 && ` · ${seats.pendingInvites} pending ${seats.pendingInvites === 1 ? "invite" : "invites"}`}
            {seats.basis === "trial" && " · free trial"}
            {seats.basis === "enterprise" && " · enterprise agreement"}
          </div>
          {seats.limit !== null && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div className={`h-full rounded-full ${full ? "bg-rose-500" : "bg-brand"}`} style={{ width: `${pct}%` }} />
            </div>
          )}
          {seats.basis === "trial" && (
            <p className="mt-3 text-sm text-muted">
              Trials include {seats.limit} seats so a lead can try Erota with a few reps.{" "}
              <Link href="/billing" className="font-semibold text-brand hover:underline">
                Choose a plan
              </Link>{" "}
              to bring on the whole team.
            </p>
          )}
          {seats.basis === "inactive" && (
            <p className="mt-3 text-sm text-rose-700">
              Billing is inactive, so new seats are paused.{" "}
              <Link href="/billing" className="font-semibold underline underline-offset-2">
                Restore access
              </Link>
            </p>
          )}
        </div>
        {hasSubscription && seats.basis === "subscription" && (
          <div className="w-full sm:w-56">
            <Field label="Paid seats" hint="Billed per seat, prorated today.">
              <input
                type="number"
                min={Math.max(1, seats.used)}
                max={500}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setSaved("");
                  setError("");
                }}
                className={inputCls}
              />
            </Field>
            <Button className="mt-2 w-full" onClick={updateSeats} disabled={busy || Number(draft) === paidSeats}>
              {busy ? "Updating…" : "Update seats"}
            </Button>
          </div>
        )}
      </div>
      <div className="mt-3">
        <InlineError message={error} />
        <InlineSuccess message={saved} />
      </div>
    </Card>
  );
}

function InviteForm({ actorRole, available }: { actorRole: string; available: number | null }) {
  const router = useRouter();
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("REP");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [seatLimited, setSeatLimited] = useState(false);
  const [result, setResult] = useState<{
    created: { email: string; link: string; delivery: "email" | "link" }[];
    skipped: { email: string; reason: string }[];
    invalid: string[];
  } | null>(null);

  const roleOptions = ROLE_OPTIONS.filter((r) => actorRole === "ADMIN" || r.value !== "ADMIN");
  const count = emails.split(/[\s,;<>]+/).filter((p) => p.includes("@")).length;

  async function send() {
    setBusy(true);
    setError("");
    setSeatLimited(false);
    setResult(null);
    try {
      const data = await api("/api/team/invites", { method: "POST", body: JSON.stringify({ emails, role }) });
      setResult(data as NonNullable<typeof result>);
      setEmails("");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not send invites.";
      setError(message);
      setSeatLimited(/seat|subscribe|plan/i.test(message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
        <Field
          label="Email addresses"
          hint="Paste one per line, or separated by commas. A whole roster from a spreadsheet works."
        >
          <TextArea
            rows={5}
            value={emails}
            onChange={(e) => {
              setEmails(e.target.value);
              setError("");
            }}
            placeholder={"maria@acme.com\njames@acme.com, priya@acme.com"}
          />
        </Field>
        <Field label="Role" hint={roleOptions.find((r) => r.value === role)?.hint}>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
            {roleOptions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={send} disabled={busy || count === 0}>
          {busy ? "Sending…" : count > 1 ? `Send ${count} invites` : "Send invite"}
        </Button>
        {available !== null && (
          <span className="text-xs text-muted">
            {available} {available === 1 ? "seat" : "seats"} available
          </span>
        )}
      </div>
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}{" "}
          {seatLimited && (
            <Link href="/billing" className="font-semibold underline underline-offset-2">
              Manage plan
            </Link>
          )}
        </div>
      )}
      {result && (
        <div className="space-y-2 text-sm">
          {result.created.length > 0 && (
            <InlineSuccess
              message={`${result.created.length} ${result.created.length === 1 ? "invite" : "invites"} sent.${
                result.created.some((c) => c.delivery === "link")
                  ? " Some addresses could not be emailed; share their links from the pending list below."
                  : ""
              }`}
            />
          )}
          {result.skipped.map((s) => (
            <p key={s.email} className="text-muted">
              {s.email}: {s.reason}
            </p>
          ))}
          {result.invalid.length > 0 && (
            <p className="text-amber-700">Not valid emails: {result.invalid.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt("Copy this link", text);
        }
      }}
      className="text-xs font-medium text-brand hover:underline"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function PendingList({ invites }: { invites: PendingInvite[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function act(id: string, action: "resend" | "revoke") {
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      if (action === "resend") {
        await api(`/api/team/invites/${id}`, { method: "POST", body: JSON.stringify({ action: "resend" }) });
        setNotice("Invite re-sent and extended by 14 days.");
      } else {
        await api(`/api/team/invites/${id}`, { method: "DELETE" });
        setNotice("Invite revoked; its link no longer works.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line">
        {invites.map((invite) => (
          <li key={invite.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{invite.email}</div>
              <div className="text-xs text-muted">
                {roleLabel(invite.role)} · {invite.emailed ? "emailed" : "link only"} · expires{" "}
                {new Date(invite.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <CopyButton text={invite.link} />
              <button
                type="button"
                disabled={busyId === invite.id}
                onClick={() => act(invite.id, "resend")}
                className="text-xs font-medium text-brand hover:underline disabled:opacity-50"
              >
                Resend
              </button>
              <button
                type="button"
                disabled={busyId === invite.id}
                onClick={() => act(invite.id, "revoke")}
                className="text-xs font-medium text-rose-700 hover:underline disabled:opacity-50"
              >
                Revoke
              </button>
            </div>
          </li>
        ))}
      </ul>
      <InlineError message={error} />
      <InlineSuccess message={notice} />
    </div>
  );
}

function MembersTable({ members, me }: { members: Member[]; me: { id: string; role: string } }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const canEdit = (member: Member) => member.id !== me.id && (me.role === "ADMIN" || member.role !== "ADMIN");
  const roleOptions = ROLE_OPTIONS.filter((r) => me.role === "ADMIN" || r.value !== "ADMIN");

  async function setRole(member: Member, role: string) {
    setBusyId(member.id);
    setError("");
    try {
      await api(`/api/team/members/${member.id}`, { method: "PATCH", body: JSON.stringify({ role }) });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change role.");
    } finally {
      setBusyId("");
    }
  }

  async function remove(member: Member) {
    if (!window.confirm(`Remove ${member.name} from the team? Their calls and scores stay in your history; their seat frees up.`)) return;
    setBusyId(member.id);
    setError("");
    try {
      await api(`/api/team/members/${member.id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove member.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-3">
      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-2 font-medium sm:px-2">Name</th>
              <th className="px-2 py-2 font-medium">Role</th>
              <th className="px-2 py-2 font-medium">Joined</th>
              <th className="px-4 py-2 sm:px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-4 py-3 sm:px-2">
                  <div className="font-medium">
                    {member.id === me.id ? (
                      <>
                        {member.name} <span className="text-xs font-normal text-muted">(you)</span>
                      </>
                    ) : (
                      <Link href={`/team/${member.id}`} className="hover:text-brand">
                        {member.name}
                      </Link>
                    )}
                  </div>
                  <div className="text-xs text-muted">{member.email}</div>
                </td>
                <td className="px-2 py-3">
                  {canEdit(member) ? (
                    <select
                      value={member.role}
                      disabled={busyId === member.id}
                      onChange={(e) => setRole(member, e.target.value)}
                      className={`${inputCls} w-auto py-1`}
                    >
                      {roleOptions.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    roleLabel(member.role)
                  )}
                </td>
                <td className="px-2 py-3 text-muted">
                  {new Date(member.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="px-4 py-3 text-right sm:px-2">
                  {canEdit(member) && (
                    <button
                      type="button"
                      disabled={busyId === member.id}
                      onClick={() => remove(member)}
                      className="text-xs font-medium text-rose-700 hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <InlineError message={error} />
    </div>
  );
}

function JoinLinkCard({ joinLink }: { joinLink: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle(enabled: boolean) {
    setBusy(true);
    setError("");
    try {
      await api("/api/team/join-link", { method: "POST", body: JSON.stringify({ enabled }) });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Handy for onboarding a big group at once: anyone with this link joins as a rep while you have open
        seats. Turn it off any time and the old link stops working.
      </p>
      {joinLink ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="flex-1 truncate rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">{joinLink}</code>
          <div className="flex items-center gap-3">
            <CopyButton text={joinLink} />
            <Button variant="secondary" onClick={() => toggle(false)} disabled={busy}>
              Disable link
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => toggle(true)} disabled={busy}>
          {busy ? "Creating…" : "Create join link"}
        </Button>
      )}
      <InlineError message={error} />
    </div>
  );
}
