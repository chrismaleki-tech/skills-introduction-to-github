"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";

export function NewWarehouseForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/erp/warehouses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "warehouse",
        code: String(fd.get("code") || ""),
        name: String(fd.get("name") || ""),
        address: String(fd.get("address") || ""),
        isDefault: fd.get("isDefault") === "on",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed.");
      return;
    }
    e.currentTarget.reset();
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Code</span>
        <input name="code" required className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" placeholder="WEST" />
      </label>
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Name</span>
        <input name="name" required className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" placeholder="West coast DC" />
      </label>
      <label className="sm:col-span-2 text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Address</span>
        <input name="address" className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      </label>
      <label className="sm:col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" name="isDefault" />
        Default warehouse
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          Add warehouse
        </Button>
        {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
      </div>
    </form>
  );
}

export function TransferForm({
  warehouses,
  products,
}: {
  warehouses: Array<{ id: string; code: string; name: string }>;
  products: Array<{ id: string; sku: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const productId = String(fd.get("productId") || "");
    const quantity = Number(fd.get("quantity") || 0);
    const res = await fetch("/api/erp/warehouses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "transfer",
        fromWarehouseId: String(fd.get("fromWarehouseId") || ""),
        toWarehouseId: String(fd.get("toWarehouseId") || ""),
        notes: String(fd.get("notes") || ""),
        lines: [{ productId, quantity }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed.");
      return;
    }
    if (data.transfer?.id) {
      await fetch("/api/erp/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "post_transfer", transferId: data.transfer.id }),
      });
    }
    e.currentTarget.reset();
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">From</span>
        <select name="fromWarehouseId" required className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} · {w.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">To</span>
        <select name="toWarehouseId" required className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} · {w.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Product</span>
        <select name="productId" required className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} · {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Qty</span>
        <input name="quantity" type="number" min={1} defaultValue={2} required className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending || warehouses.length < 2 || products.length === 0}>
          Transfer & post
        </Button>
        {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
      </div>
    </form>
  );
}

export function NewEmployeeForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/erp/hr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "employee",
        name: String(fd.get("name") || ""),
        email: String(fd.get("email") || ""),
        title: String(fd.get("title") || ""),
        department: String(fd.get("department") || ""),
        salaryAnnual: Number(fd.get("salaryAnnual") || 0),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed.");
      return;
    }
    e.currentTarget.reset();
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Name</span>
        <input name="name" required className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Email</span>
        <input name="email" type="email" className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Title</span>
        <input name="title" className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Department</span>
        <input name="department" defaultValue="Sales" className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Annual salary</span>
        <input name="salaryAnnual" type="number" defaultValue={90000} className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          Add employee
        </Button>
        {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
      </div>
    </form>
  );
}

export function PayrollJournalButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function run() {
    setError(null);
    setOk(null);
    const res = await fetch("/api/erp/hr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "payroll_journal" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed.");
      return;
    }
    setOk(`Posted ${data.entry?.number ?? "JE"}`);
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <Button disabled={pending} onClick={run}>
        Accrue monthly payroll to GL
      </Button>
      {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
      {ok && <p className="text-xs text-emerald-400 mt-2">{ok}</p>}
    </div>
  );
}

export function NewProjectForm({
  deals,
  accounts,
}: {
  deals: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/erp/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "project",
        name: String(fd.get("name") || ""),
        code: String(fd.get("code") || "") || undefined,
        dealId: String(fd.get("dealId") || "") || null,
        accountId: String(fd.get("accountId") || "") || null,
        budgetHours: Number(fd.get("budgetHours") || 0),
        budgetAmount: Number(fd.get("budgetAmount") || 0),
        tasks: String(fd.get("task") || "")
          ? [{ title: String(fd.get("task")), estimateHrs: Number(fd.get("estimateHrs") || 8) }]
          : [],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed.");
      return;
    }
    e.currentTarget.reset();
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2 text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Project name</span>
        <input name="name" required className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Code</span>
        <input name="code" placeholder="Auto" className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Budget hours</span>
        <input name="budgetHours" type="number" defaultValue={80} className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Deal</span>
        <select name="dealId" className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
          <option value="">None</option>
          {deals.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Account</span>
        <select name="accountId" className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
          <option value="">None</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">First task</span>
        <input name="task" defaultValue="Kickoff" className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Estimate hrs</span>
        <input name="estimateHrs" type="number" defaultValue={8} className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          Create project
        </Button>
        {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
      </div>
    </form>
  );
}

export function LogTimeForm({
  projects,
}: {
  projects: Array<{ id: string; code: string; name: string; tasks: Array<{ id: string; title: string }> }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");

  const tasks = projects.find((p) => p.id === projectId)?.tasks ?? [];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/erp/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "time",
        projectId: String(fd.get("projectId") || ""),
        taskId: String(fd.get("taskId") || "") || null,
        hours: Number(fd.get("hours") || 1),
        notes: String(fd.get("notes") || ""),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed.");
      return;
    }
    e.currentTarget.reset();
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Project</span>
        <select
          name="projectId"
          required
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Task</span>
        <select name="taskId" className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
          <option value="">General</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Hours</span>
        <input name="hours" type="number" min={1} defaultValue={4} required className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Notes</span>
        <input name="notes" className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending || projects.length === 0}>
          Log time
        </Button>
        {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
      </div>
    </form>
  );
}

export function TaxFxForms({
  baseCurrency,
  defaultTaxCode,
}: {
  baseCurrency: string;
  defaultTaxCode: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function saveOrg(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/erp/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "org",
        baseCurrency: String(fd.get("baseCurrency") || ""),
        defaultTaxCode: String(fd.get("defaultTaxCode") || ""),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed.");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function addTax(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/erp/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "tax",
        code: String(fd.get("code") || ""),
        name: String(fd.get("name") || ""),
        ratePercent: Number(fd.get("ratePercent") || 0),
        jurisdiction: String(fd.get("jurisdiction") || ""),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed.");
      return;
    }
    e.currentTarget.reset();
    startTransition(() => router.refresh());
  }

  async function addFx(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const rate = Number(fd.get("rate") || 1);
    const res = await fetch("/api/erp/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "fx",
        currency: String(fd.get("currency") || ""),
        rateToBase: Math.round(rate * 10000),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed.");
      return;
    }
    e.currentTarget.reset();
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <form onSubmit={saveOrg} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-xs text-muted uppercase tracking-wider">Base currency</span>
          <input name="baseCurrency" defaultValue={baseCurrency} className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="text-xs text-muted uppercase tracking-wider">Default tax code</span>
          <input name="defaultTaxCode" defaultValue={defaultTaxCode} className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending} variant="secondary">
            Save org defaults
          </Button>
        </div>
      </form>

      <form onSubmit={addTax} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-xs text-muted uppercase tracking-wider">Tax code</span>
          <input name="code" required placeholder="US-NY" className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="text-xs text-muted uppercase tracking-wider">Name</span>
          <input name="name" required placeholder="New York sales tax" className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="text-xs text-muted uppercase tracking-wider">Rate %</span>
          <input name="ratePercent" type="number" defaultValue={8} className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="text-xs text-muted uppercase tracking-wider">Jurisdiction</span>
          <input name="jurisdiction" className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            Add tax code
          </Button>
        </div>
      </form>

      <form onSubmit={addFx} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-xs text-muted uppercase tracking-wider">Currency</span>
          <input name="currency" required placeholder="EUR" className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="text-xs text-muted uppercase tracking-wider">Rate to base</span>
          <input name="rate" type="number" step="0.0001" defaultValue={1.08} className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            Add FX rate
          </Button>
          {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
        </div>
      </form>
    </div>
  );
}
