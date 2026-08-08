"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DEAL_STAGES } from "@/lib/crm-constants";
import { Button } from "@/components/ui";

/** Industry-configurable stage option shape (defaults to the generic pack). */
type StageOption = { key: string; label: string; probability?: number };
const GENERIC: StageOption[] = DEAL_STAGES.map((s) => ({ key: s.key, label: s.label }));

export function DealStageSelect({
  dealId,
  stage,
  stages = GENERIC,
}: {
  dealId: string;
  stage: string;
  stages?: StageOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(stage);
  const [error, setError] = useState<string | null>(null);

  async function onChange(next: string) {
    setValue(next);
    setError(null);
    const res = await fetch(`/api/crm/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: next }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update stage.");
      setValue(stage);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
      >
        {stages.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
        {!stages.some((s) => s.key === stage) && (
          <option value={stage}>{stage.replaceAll("_", " ")} (legacy)</option>
        )}
      </select>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

export function NewDealForm({
  accounts,
  contacts,
  owners,
  defaultOwnerId,
  stages = GENERIC,
  dealNoun = "deal",
  accountNoun = "account",
  contactNoun = "contact",
}: {
  accounts: { id: string; name: string }[];
  contacts: { id: string; name: string; accountId: string | null }[];
  owners: { id: string; name: string }[];
  defaultOwnerId: string;
  stages?: StageOption[];
  dealNoun?: string;
  accountNoun?: string;
  contactNoun?: string;
}) {
  const openStages = stages.filter((s) => !s.key.startsWith("closed"));
  const defaultStage = openStages[1]?.key ?? openStages[0]?.key ?? "lead";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      stage: String(fd.get("stage") ?? defaultStage),
      amount: Number(fd.get("amount") ?? 0),
      product: String(fd.get("product") ?? ""),
      nextStep: String(fd.get("nextStep") ?? ""),
      accountId: String(fd.get("accountId") || "") || null,
      contactId: String(fd.get("contactId") || "") || null,
      ownerId: String(fd.get("ownerId") || "") || defaultOwnerId,
    };
    const res = await fetch("/api/crm/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? `Failed to create ${dealNoun.toLowerCase()}.`);
      return;
    }
    setOpen(false);
    startTransition(() => {
      router.push(`/crm/deals/${data.deal.id}`);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        New {dealNoun.toLowerCase()}
      </Button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md space-y-3 rounded-xl border border-line bg-surface p-4"
    >
      <div className="text-sm font-medium">Create {dealNoun.toLowerCase()}</div>
      <input
        name="name"
        required
        placeholder={`${dealNoun} name`}
        className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <select name="stage" defaultValue={defaultStage} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
          {openStages.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          name="amount"
          type="number"
          min={0}
          placeholder="Amount ($)"
          className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
        />
      </div>
      <input
        name="product"
        placeholder="Product"
        className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
      />
      <select name="accountId" className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
        <option value="">No {accountNoun.toLowerCase()}</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <select name="contactId" className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
        <option value="">No {contactNoun.toLowerCase()}</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        name="ownerId"
        defaultValue={defaultOwnerId}
        className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
      >
        {owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <input
        name="nextStep"
        placeholder="Next step"
        className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Create"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function NewAccountForm({ accountNoun = "account" }: { accountNoun?: string } = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/crm/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(fd.get("name") ?? ""),
        domain: String(fd.get("domain") ?? ""),
        industry: String(fd.get("industry") ?? ""),
        size: String(fd.get("size") ?? ""),
        website: String(fd.get("website") ?? ""),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? `Failed to create ${accountNoun.toLowerCase()}.`);
      return;
    }
    setOpen(false);
    startTransition(() => {
      router.push(`/crm/accounts/${data.account.id}`);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        New {accountNoun.toLowerCase()}
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md space-y-3 rounded-xl border border-line bg-surface p-4">
      <div className="text-sm font-medium">Create {accountNoun.toLowerCase()}</div>
      <input name="name" required placeholder="Company name" className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      <input name="domain" placeholder="Domain" className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <input name="industry" placeholder="Industry" className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
        <input name="size" placeholder="Size (e.g. 50-200)" className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      </div>
      <input name="website" placeholder="Website" className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Create"}</Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

export function NewContactForm({
  accounts,
  contactNoun = "contact",
  accountNoun = "account",
}: {
  accounts: { id: string; name: string }[];
  contactNoun?: string;
  accountNoun?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/crm/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        title: String(fd.get("title") ?? ""),
        accountId: String(fd.get("accountId") || "") || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? `Failed to create ${contactNoun.toLowerCase()}.`);
      return;
    }
    setOpen(false);
    startTransition(() => router.refresh());
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        New {contactNoun.toLowerCase()}
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md space-y-3 rounded-xl border border-line bg-surface p-4">
      <div className="text-sm font-medium">Create {contactNoun.toLowerCase()}</div>
      <input name="name" required placeholder="Full name" className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      <input name="title" placeholder="Title" className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      <input name="email" type="email" placeholder="Email" className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      <input name="phone" placeholder="Phone" className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      <select name="accountId" className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
        <option value="">No {accountNoun.toLowerCase()}</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Create"}</Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
