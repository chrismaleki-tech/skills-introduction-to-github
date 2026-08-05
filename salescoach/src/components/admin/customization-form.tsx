"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  MODULES,
  START_PAGES,
  isValidAccentColor,
  type Customization,
} from "@/lib/customization";

type PlanOption = { id: string; name: string; seatLimit: number | null };

/**
 * Vendor-side tenant provisioning form (platform console, org drill-down):
 * shape a customer's workspace — brand, accent, start page, module licenses —
 * and move them between editions.
 */
export function TenantCustomizationForm({
  orgId,
  initial,
  currentPlan,
  plans,
}: {
  orgId: string;
  initial: Customization;
  currentPlan: string;
  plans: PlanOption[];
}) {
  const router = useRouter();
  const [brandName, setBrandName] = useState(initial.brandName);
  const [accentColor, setAccentColor] = useState(initial.accentColor);
  const [startPage, setStartPage] = useState(initial.startPage);
  const [modules, setModules] = useState(initial.modules);
  const [plan, setPlan] = useState(currentPlan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const accentInvalid = accentColor !== "" && !isValidAccentColor(accentColor);

  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    const res = await fetch(`/api/admin/orgs/${orgId}/customization`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customization: { brandName, accentColor, startPage, modules },
        plan,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Save failed.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted">Brand name</span>
          <input
            className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
            placeholder="SalesCoach AI (default)"
            value={brandName}
            maxLength={60}
            onChange={(e) => setBrandName(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted">Accent color</span>
          <span className="mt-1 flex items-center gap-2">
            <input
              type="color"
              aria-label="Accent color picker"
              value={isValidAccentColor(accentColor) ? accentColor : "#6366f1"}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-9 w-10 rounded-lg border border-line bg-surface-2 p-1"
            />
            <input
              className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-mono"
              placeholder="#6366f1 (default)"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value.trim())}
            />
            {accentColor && (
              <button
                type="button"
                className="text-xs text-muted hover:text-foreground"
                onClick={() => setAccentColor("")}
              >
                Reset
              </button>
            )}
          </span>
          {accentInvalid && <span className="text-[11px] text-rose-400">Use hex like #0ea5e9.</span>}
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted">Start page after login</span>
          <select
            className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
            value={startPage}
            onChange={(e) => setStartPage(e.target.value)}
          >
            {START_PAGES.map((p) => (
              <option key={p.value} value={p.value} disabled={p.module ? !modules[p.module] : false}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted">Edition (plan)</span>
          <select
            className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.seatLimit != null ? ` — up to ${p.seatLimit} seats` : " — unlimited seats"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Licensed modules</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODULES.map((mod) => (
            <label
              key={mod.id}
              className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                modules[mod.id] ? "border-accent/40 bg-accent/5" : "border-line bg-surface-2 opacity-75"
              }`}
            >
              <input
                type="checkbox"
                checked={modules[mod.id]}
                onChange={(e) => setModules({ ...modules, [mod.id]: e.target.checked })}
                className="mt-0.5 accent-[var(--accent)]"
              />
              <span>
                <span className="block text-sm font-medium">{mod.label}</span>
                <span className="block text-xs text-muted">{mod.blurb}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => void save()} disabled={busy || accentInvalid}>
          {busy ? "Saving…" : "Save customization"}
        </Button>
        {saved && <span className="text-xs text-emerald-400">Saved — the tenant sees it on next page load.</span>}
        {error && <span className="text-xs text-rose-400">{error}</span>}
      </div>
    </div>
  );
}
