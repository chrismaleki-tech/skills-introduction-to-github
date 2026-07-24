"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";

export function LinkCallToCrmForm({
  callId,
  deals,
  contacts,
  accounts,
  initial,
}: {
  callId: string;
  deals: { id: string; name: string; stage: string }[];
  contacts: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
  initial: { dealId: string | null; contactId: string | null; accountId: string | null };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dealId, setDealId] = useState(initial.dealId ?? "");
  const [contactId, setContactId] = useState(initial.contactId ?? "");
  const [accountId, setAccountId] = useState(initial.accountId ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/calls/${callId}/crm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dealId: dealId || null,
        contactId: contactId || null,
        accountId: accountId || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to link.");
      return;
    }
    setMessage("Linked — coaching scorecards will write back to this deal.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Connect this call to a CRM deal so grading uses deal-stage context and the scorecard
        lands on the deal timeline.
      </p>
      <label className="block text-xs text-muted uppercase tracking-wider">Deal</label>
      <select
        value={dealId}
        onChange={(e) => setDealId(e.target.value)}
        className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
      >
        <option value="">Unlinked</option>
        {deals.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name} · {d.stage.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <label className="block text-xs text-muted uppercase tracking-wider">Contact</label>
      <select
        value={contactId}
        onChange={(e) => setContactId(e.target.value)}
        className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
      >
        <option value="">Inherited from deal / none</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <label className="block text-xs text-muted uppercase tracking-wider">Account</label>
      <select
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
      >
        <option value="">Inherited from deal / none</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {message && <p className="text-xs text-emerald-400">{message}</p>}
      <Button type="button" onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save CRM link"}
      </Button>
    </div>
  );
}

export function LogCallFromDealButton({
  dealId,
  callType = "discovery",
}: {
  dealId: string;
  callType?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [durationSec, setDurationSec] = useState(420);
  const [open, setOpen] = useState(false);

  async function logCall() {
    setError(null);
    if (!transcript.trim()) {
      setError("Paste a call transcript before logging.");
      return;
    }
    const res = await fetch("/api/crm/sync/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dealId,
        durationSec,
        callType,
        transcript: transcript.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to log call.");
      return;
    }
    startTransition(() => {
      router.push(`/calls/${data.callId}`);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Log call → SalesCoach
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-surface-2 p-3">
      <p className="text-xs text-muted">
        Paste the real call transcript (or dialer export). Demo content is no longer auto-injected.
      </p>
      <label className="block text-xs text-muted uppercase tracking-wider">Duration (seconds)</label>
      <input
        type="number"
        min={30}
        value={durationSec}
        onChange={(e) => setDurationSec(Number(e.target.value) || 0)}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
      />
      <label className="block text-xs text-muted uppercase tracking-wider">Transcript</label>
      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        rows={8}
        placeholder={"REP: ...\nPROSPECT: ..."}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm font-mono"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={logCall} disabled={pending}>
          {pending ? "Logging & grading…" : "Log & grade call"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
