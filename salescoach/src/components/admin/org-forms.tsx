"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const inputClass = "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted uppercase tracking-wider">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

/** Create a new tenant. Shows the one-time temporary admin password on success. */
export function CreateOrgForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ name: string; adminEmail: string; temporaryPassword?: string } | null>(
    null,
  );

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        adminName: data.adminName,
        adminEmail: data.adminEmail,
        adminPassword: data.adminPassword || undefined,
      }),
    });
    setBusy(false);
    const payload = (await res.json().catch(() => null)) as
      | { error?: string; name?: string; adminEmail?: string; temporaryPassword?: string }
      | null;
    if (!res.ok) {
      setError(payload?.error ?? "Could not create the organization.");
      return;
    }
    form.reset();
    setCreated({
      name: payload?.name ?? data.name,
      adminEmail: payload?.adminEmail ?? data.adminEmail,
      temporaryPassword: payload?.temporaryPassword,
    });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Organization name">
        <input name="name" required placeholder="Acme Corp" className={inputClass} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Admin name">
          <input name="adminName" placeholder="Jane Doe" className={inputClass} />
        </Field>
        <Field label="Admin email">
          <input name="adminEmail" type="email" required placeholder="jane@acme.com" className={inputClass} />
        </Field>
      </div>
      <Field label="Admin password (optional — generated if blank)">
        <input name="adminPassword" type="password" minLength={10} placeholder="Min 10 characters" className={inputClass} />
      </Field>
      <Button type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create organization"}
      </Button>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {created && (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2.5 text-sm">
          <p className="font-medium text-emerald-300">{created.name} created.</p>
          <p className="text-muted mt-1">
            Admin: <span className="text-foreground">{created.adminEmail}</span>
          </p>
          {created.temporaryPassword && (
            <p className="text-muted mt-1">
              Temporary password (shown once — store securely):{" "}
              <code className="text-foreground bg-surface-2 rounded px-1.5 py-0.5">{created.temporaryPassword}</code>
            </p>
          )}
        </div>
      )}
    </form>
  );
}

/** Invite / create a user inside a specific tenant. */
export function InviteUserForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setBusy(true);
    setError("");
    setNotice("");
    const res = await fetch(`/api/admin/orgs/${orgId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setBusy(false);
    const payload = (await res.json().catch(() => null)) as
      | { error?: string; email?: string; passwordSet?: boolean }
      | null;
    if (!res.ok) {
      setError(payload?.error ?? "Could not create the user.");
      return;
    }
    form.reset();
    setNotice(
      payload?.passwordSet
        ? `${payload.email} created — they can log in now.`
        : `${payload?.email} created without a password — set one below before they can log in.`,
    );
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Name">
          <input name="name" required placeholder="Sam Rep" className={inputClass} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" required placeholder="sam@acme.com" className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Role">
          <select name="role" defaultValue="REP" className={inputClass}>
            <option value="REP">Rep</option>
            <option value="MANAGER">Manager</option>
            <option value="TRAINER">Trainer</option>
            <option value="ADMIN">Admin</option>
          </select>
        </Field>
        <Field label="Title">
          <input name="title" placeholder="Account Executive" className={inputClass} />
        </Field>
        <Field label="Password (min 10 chars)">
          <input name="password" type="password" minLength={10} className={inputClass} />
        </Field>
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create user"}
      </Button>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {notice && <p className="text-xs text-emerald-400">{notice}</p>}
    </form>
  );
}
