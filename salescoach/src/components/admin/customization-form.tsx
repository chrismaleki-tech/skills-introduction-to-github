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
import { INDUSTRY_PACKS, industryPack, type FieldDef, type Terminology } from "@/lib/industry";

const TERM_KEYS: (keyof Terminology)[] = ["deal", "deals", "pipeline", "account", "accounts", "contact", "contacts"];
const FIELD_TYPES = ["text", "number", "date", "select"] as const;

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
  const [industry, setIndustry] = useState(initial.industry);
  const [terminology, setTerminology] = useState<Partial<Terminology>>(initial.terminology);
  const [dealFields, setDealFields] = useState<FieldDef[]>(initial.customDealFields);
  const [accountFields, setAccountFields] = useState<FieldDef[]>(initial.customAccountFields);
  const [showAdvanced, setShowAdvanced] = useState(
    Object.keys(initial.terminology).length > 0 ||
      initial.customDealFields.length > 0 ||
      initial.customAccountFields.length > 0,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const accentInvalid = accentColor !== "" && !isValidAccentColor(accentColor);
  const pack = industryPack(industry);

  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    const res = await fetch(`/api/admin/orgs/${orgId}/customization`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customization: {
          brandName,
          accentColor,
          startPage,
          modules,
          industry,
          terminology,
          customDealFields: dealFields,
          customAccountFields: accountFields,
        },
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

      <div className="border-t border-line pt-4">
        <div className="text-xs uppercase tracking-wider text-muted mb-2">CRM industry pack</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          >
            {INDUSTRY_PACKS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted self-center">{pack.blurb}</p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted mr-1">Stages:</span>
          {pack.stages.map((s) => (
            <span key={s.key} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
              {s.label} <span className="opacity-60">{s.probability}%</span>
            </span>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-muted">
          Terms: {pack.terminology.deal} / {pack.terminology.account} / {pack.terminology.contact} · Fields:{" "}
          {[...pack.dealFields, ...pack.accountFields].map((f) => f.label).join(", ") || "none"}
          {" · "}
          Existing {pack.terminology.deals.toLowerCase()} in retired stages appear in a “Legacy” column until moved.
        </div>

        <button
          type="button"
          className="mt-3 text-xs text-accent-hover hover:underline"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "Hide" : "Show"} advanced: rename terms & add custom fields
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted mb-2">
                Terminology overrides (blank = pack default)
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                {TERM_KEYS.map((key) => (
                  <input
                    key={key}
                    className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs"
                    placeholder={pack.terminology[key]}
                    value={terminology[key] ?? ""}
                    onChange={(e) => setTerminology({ ...terminology, [key]: e.target.value })}
                  />
                ))}
              </div>
            </div>
            <FieldListEditor
              label={`Extra ${pack.terminology.deal.toLowerCase()} fields`}
              fields={dealFields}
              onChange={setDealFields}
            />
            <FieldListEditor
              label={`Extra ${pack.terminology.account.toLowerCase()} fields`}
              fields={accountFields}
              onChange={setAccountFields}
            />
          </div>
        )}
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

/** Owner-defined custom property rows (label + type + select options). */
function FieldListEditor({
  label,
  fields,
  onChange,
}: {
  label: string;
  fields: FieldDef[];
  onChange: (fields: FieldDef[]) => void;
}) {
  function update(index: number, patch: Partial<FieldDef>) {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted mb-2">{label}</div>
      <div className="space-y-2">
        {fields.map((field, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs w-44"
              placeholder="Label"
              value={field.label}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <select
              className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-xs"
              value={field.type}
              onChange={(e) => update(i, { type: e.target.value as FieldDef["type"] })}
            >
              {FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {field.type === "select" && (
              <input
                className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs flex-1 min-w-40"
                placeholder="Options, comma separated"
                value={(field.options ?? []).join(", ")}
                onChange={(e) => update(i, { options: e.target.value.split(",").map((o) => o.trim()) })}
              />
            )}
            <button
              type="button"
              className="text-xs text-muted hover:text-rose-300"
              onClick={() => onChange(fields.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-2 text-xs text-accent-hover hover:underline"
        onClick={() => onChange([...fields, { key: "", label: "", type: "text" }])}
      >
        + Add field
      </button>
    </div>
  );
}
