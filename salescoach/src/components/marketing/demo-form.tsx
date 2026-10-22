"use client";

import { useState } from "react";

const inputCls =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-marketing-ink outline-none focus:border-brand";

export function DemoForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company,
          source: ["website-team-demo", role, teamSize].filter(Boolean).join("|"),
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-brand/25 bg-brand/5 px-5 py-6">
        <p className="font-display text-xl font-semibold text-marketing-ink">Thanks—we have your request.</p>
        <p className="mt-2 text-sm text-muted">
          We’ll follow up about your team and workflow. Meanwhile you can explore the product.
        </p>
        <a
          href="/dashboard"
          className="mt-5 inline-flex rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
        >
          Open the demo
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className={inputCls}
          autoComplete="name"
        />
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Work email"
          className={inputCls}
          autoComplete="email"
        />
      </div>
      <input
        required
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        placeholder="Company"
        className={inputCls}
        autoComplete="organization"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          required
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={inputCls}
          aria-label="Your role"
        >
          <option value="">Your role</option>
          <option value="sales-leader">Sales leader</option>
          <option value="enablement">Sales enablement</option>
          <option value="frontline-manager">Frontline manager</option>
          <option value="founder">Founder</option>
          <option value="other">Other</option>
        </select>
        <select
          required
          value={teamSize}
          onChange={(e) => setTeamSize(e.target.value)}
          className={inputCls}
          aria-label="Sales team size"
        >
          <option value="">Sales team size</option>
          <option value="1-5">1–5 reps</option>
          <option value="6-20">6–20 reps</option>
          <option value="21-50">21–50 reps</option>
          <option value="51+">51+ reps</option>
        </select>
      </div>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover transition-colors disabled:opacity-60"
      >
        {pending ? "Sending…" : "Discuss a team pilot"}
      </button>
      <p className="text-xs text-muted">No spam. We’ll only use this to discuss your evaluation or pilot.</p>
    </form>
  );
}
