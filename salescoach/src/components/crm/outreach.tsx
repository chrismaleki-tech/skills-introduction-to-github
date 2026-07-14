"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EMAIL_PROVIDERS, PHONE_PROVIDERS } from "@/lib/channels-ready";
import { Button } from "@/components/ui";

type Connection = {
  id: string;
  channel: string;
  provider: string;
  address: string;
  status: string;
};

export function ChannelConnectPanel({
  connections,
  defaultEmail,
  defaultPhone,
}: {
  connections: Connection[];
  defaultEmail: string;
  defaultPhone?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const email = connections.find((c) => c.channel === "EMAIL");
  const phone = connections.find((c) => c.channel === "PHONE");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ConnectCard
        title="Work email"
        description="Connect your inbox to email prospects from deals and contacts. Threads stay on the CRM timeline."
        channel="EMAIL"
        connection={email}
        providers={EMAIL_PROVIDERS}
        defaultAddress={defaultEmail}
        defaultProvider="demo_email"
        placeholder="you@company.com"
        pending={pending}
        onDone={() => startTransition(() => router.refresh())}
      />
      <ConnectCard
        title="Phone / dialer"
        description="Connect your work number or dialer so outbound calls to prospects are logged here and can be graded by SalesCoach."
        channel="PHONE"
        connection={phone}
        providers={PHONE_PROVIDERS}
        defaultAddress={defaultPhone || "+1-555-0100"}
        defaultProvider="demo_phone"
        placeholder="+1-555-0100"
        pending={pending}
        onDone={() => startTransition(() => router.refresh())}
      />
    </div>
  );
}

function ConnectCard({
  title,
  description,
  channel,
  connection,
  providers,
  defaultAddress,
  defaultProvider,
  placeholder,
  pending,
  onDone,
}: {
  title: string;
  description: string;
  channel: "EMAIL" | "PHONE";
  connection?: Connection;
  providers: readonly { key: string; label: string }[];
  defaultAddress: string;
  defaultProvider: string;
  placeholder: string;
  pending: boolean;
  onDone: () => void;
}) {
  const [provider, setProvider] = useState(connection?.provider || defaultProvider);
  const [address, setAddress] = useState(connection?.address || defaultAddress);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const connected = connection?.status === "CONNECTED";

  async function connect() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, provider, address, action: "connect" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not connect.");
      return;
    }
    onDone();
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, action: "disconnect" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not disconnect.");
      return;
    }
    onDone();
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5 space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium">{title}</h3>
          {connected ? (
            <span className="text-[11px] rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-400 px-2 py-0.5">
              Connected
            </span>
          ) : (
            <span className="text-[11px] rounded-full border border-line text-muted px-2 py-0.5">
              Not connected
            </span>
          )}
        </div>
        <p className="text-sm text-muted mt-1">{description}</p>
      </div>

      <label className="block text-xs text-muted uppercase tracking-wider">Provider</label>
      <select
        value={provider}
        onChange={(e) => setProvider(e.target.value)}
        className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
      >
        {providers.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>

      <label className="block text-xs text-muted uppercase tracking-wider">
        {channel === "EMAIL" ? "Email address" : "Phone number"}
      </label>
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
      />

      {provider !== "demo_email" && provider !== "demo_phone" && (
        <p className="text-xs text-amber-300/90">
          OAuth/token exchange for {provider} is production-shaped here — demo mode still stores the
          connection locally so you can send and log conversations immediately.
        </p>
      )}

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={connect} disabled={busy || pending}>
          {busy ? "Saving…" : connected ? "Update connection" : "Connect"}
        </Button>
        {connected && (
          <Button type="button" variant="secondary" onClick={disconnect} disabled={busy || pending}>
            Disconnect
          </Button>
        )}
      </div>
    </div>
  );
}

export function EmailComposer({
  dealId,
  contactId,
  accountId,
  defaultTo,
  contactName,
  emailConnected,
}: {
  dealId?: string | null;
  contactId?: string | null;
  accountId?: string | null;
  defaultTo: string;
  contactName?: string;
  emailConnected: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(
    contactName ? `Following up — ${contactName}` : "Following up",
  );
  const [body, setBody] = useState(
    `Hi${contactName ? ` ${contactName.split(" ")[0]}` : ""},\n\nWanted to follow up on our conversation and share a short next step.\n\nBest regards`,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function send() {
    setError(null);
    setOk(null);
    const res = await fetch("/api/channels/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body, dealId, contactId, accountId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Send failed.");
      return;
    }
    setOk("Sent — conversation saved in CRM" + (data.replyId ? " (demo reply included)." : "."));
    setOpen(false);
    startTransition(() => router.refresh());
  }

  if (!emailConnected) {
    return (
      <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-sm text-amber-200/90">
        Connect your email in{" "}
        <Link href="/channels" className="underline hover:text-accent-hover">
          Channels
        </Link>{" "}
        to email this prospect from the CRM.
      </div>
    );
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <Button type="button" onClick={() => setOpen(true)}>
          Email prospect
        </Button>
        {ok && <p className="text-xs text-emerald-400">{ok}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface-2/50 p-4">
      <div className="text-sm font-medium">New email</div>
      <input
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="prospect@company.com"
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
      />
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject"
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={7}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed"
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" onClick={send} disabled={pending}>
          {pending ? "Sending…" : "Send"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function PhoneDialer({
  dealId,
  contactId,
  accountId,
  defaultTo,
  contactName,
  phoneConnected,
  callType,
}: {
  dealId?: string | null;
  contactId?: string | null;
  accountId?: string | null;
  defaultTo: string;
  contactName?: string;
  phoneConnected: boolean;
  callType?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultTo);
  const [notes, setNotes] = useState(
    `Discovery follow-up with ${contactName || "prospect"} — confirm pain and book next step.`,
  );
  const [durationSec, setDurationSec] = useState(240);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function dial() {
    setError(null);
    setOk(null);
    const res = await fetch("/api/channels/phone/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        notes,
        durationSec,
        dealId,
        contactId,
        accountId,
        callType: callType ?? "discovery",
        gradeWithSalesCoach: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Call failed.");
      return;
    }
    setOk(
      `Call logged${data.gradeScore != null ? ` · Coach ${data.gradeScore}` : ""}${
        data.callId ? ` — open in SalesCoach` : ""
      }.`,
    );
    setOpen(false);
    startTransition(() => {
      if (data.callId) router.push(`/calls/${data.callId}`);
      else router.refresh();
    });
  }

  if (!phoneConnected) {
    return (
      <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-sm text-amber-200/90">
        Connect your phone in{" "}
        <Link href="/channels" className="underline hover:text-accent-hover">
          Channels
        </Link>{" "}
        to call this prospect from the CRM.
      </div>
    );
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          Call prospect
        </Button>
        {ok && <p className="text-xs text-emerald-400">{ok}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface-2/50 p-4">
      <div className="text-sm font-medium">Place call</div>
      <input
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="+1-555-0142"
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="Call agenda / notes"
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
      />
      <label className="block text-xs text-muted">Duration (seconds)</label>
      <input
        type="number"
        min={30}
        value={durationSec}
        onChange={(e) => setDurationSec(Number(e.target.value))}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
      />
      <p className="text-xs text-muted">
        Demo dialer logs the call into the CRM conversation and grades it in SalesCoach automatically.
      </p>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" onClick={dial} disabled={pending}>
          {pending ? "Calling & grading…" : "Start call"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
