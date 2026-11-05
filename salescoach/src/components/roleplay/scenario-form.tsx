"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

// Scenario builder for managers/trainers. "Generate from company profile"
// pre-fills the form with a server-built draft grounded in the org's company
// context; every field stays editable before saving.

interface FormState {
  title: string;
  callType: string;
  difficulty: string;
  personaName: string;
  personaTitle: string;
  company: string;
  industry: string;
  personality: string;
  painPoints: string; // one per line
  objections: string; // one per line
  budget: string;
  notes: string;
  winConditions: string; // one per line
}

const EMPTY_FORM: FormState = {
  title: "",
  callType: "discovery",
  difficulty: "medium",
  personaName: "",
  personaTitle: "",
  company: "",
  industry: "",
  personality: "",
  painPoints: "",
  objections: "",
  budget: "",
  notes: "",
  winConditions: "",
};

interface GeneratedDraft {
  title?: string;
  callType?: string;
  difficulty?: string;
  persona?: {
    name?: string;
    title?: string;
    company?: string;
    industry?: string;
    personality?: string;
    painPoints?: string[];
    objections?: string[];
    budget?: string;
    notes?: string;
  };
  winConditions?: string[];
  error?: string;
}

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

export function ScenarioForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/roleplay/scenarios/generate");
      const draft = (await res.json().catch(() => ({}))) as GeneratedDraft;
      if (!res.ok) {
        setError(draft.error ?? "Could not generate a draft.");
        return;
      }
      const p = draft.persona ?? {};
      setForm({
        title: draft.title ?? "",
        callType: draft.callType ?? "discovery",
        difficulty: draft.difficulty ?? "medium",
        personaName: p.name ?? "",
        personaTitle: p.title ?? "",
        company: p.company ?? "",
        industry: p.industry ?? "",
        personality: p.personality ?? "",
        painPoints: (p.painPoints ?? []).join("\n"),
        objections: (p.objections ?? []).join("\n"),
        budget: p.budget ?? "",
        notes: p.notes ?? "",
        winConditions: (draft.winConditions ?? []).join("\n"),
      });
    } catch {
      setError("Network error while generating — try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/roleplay/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          callType: form.callType,
          difficulty: form.difficulty,
          persona: {
            name: form.personaName,
            title: form.personaTitle,
            company: form.company,
            industry: form.industry,
            personality: form.personality,
            painPoints: lines(form.painPoints),
            objections: lines(form.objections),
            budget: form.budget,
            notes: form.notes,
          },
          winConditions: lines(form.winConditions),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save the scenario.");
        return;
      }
      setForm(EMPTY_FORM);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error while saving — try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>New scenario</Button>;
  }

  const inputCls =
    "w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:border-accent";

  return (
    <form onSubmit={save} className="bg-surface border border-line rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider">New scenario</h2>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => void generate()} disabled={generating || saving}>
            {generating ? "Generating..." : "Generate from company profile"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Title" className="sm:col-span-1">
          <input required value={form.title} onChange={set("title")} placeholder="Practice: CFO discovery" className={inputCls} />
        </Field>
        <Field label="Call type">
          <select value={form.callType} onChange={set("callType")} className={inputCls}>
            <option value="cold_call">Cold call</option>
            <option value="discovery">Discovery</option>
            <option value="demo">Demo</option>
            <option value="negotiation">Negotiation</option>
            <option value="renewal">Renewal</option>
          </select>
        </Field>
        <Field label="Difficulty">
          <select value={form.difficulty} onChange={set("difficulty")} className={inputCls}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Persona name">
          <input required value={form.personaName} onChange={set("personaName")} placeholder="Dana Whitfield" className={inputCls} />
        </Field>
        <Field label="Persona title">
          <input value={form.personaTitle} onChange={set("personaTitle")} placeholder="VP of Operations" className={inputCls} />
        </Field>
        <Field label="Company">
          <input value={form.company} onChange={set("company")} placeholder="Northgate Distribution" className={inputCls} />
        </Field>
        <Field label="Industry">
          <input value={form.industry} onChange={set("industry")} placeholder="Wholesale distribution" className={inputCls} />
        </Field>
      </div>

      <Field label="Personality">
        <textarea
          value={form.personality}
          onChange={set("personality")}
          rows={2}
          placeholder="Skeptical, time-pressed, data-driven. Warms up when the rep shows they did their homework."
          className={inputCls}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Pain points (one per line)">
          <textarea
            value={form.painPoints}
            onChange={set("painPoints")}
            rows={3}
            placeholder={"Missed shipments from count drift\nNo visibility across warehouses"}
            className={inputCls}
          />
        </Field>
        <Field label="Objections (one per line)">
          <textarea
            value={form.objections}
            onChange={set("objections")}
            rows={3}
            placeholder={"It's too expensive.\nOur ERP already has an inventory module."}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Budget posture">
          <input value={form.budget} onChange={set("budget")} placeholder="Has authority, wants payback math first" className={inputCls} />
        </Field>
        <Field label="Notes">
          <input value={form.notes} onChange={set("notes")} placeholder="Also evaluating StockPilot" className={inputCls} />
        </Field>
      </div>

      <Field label="Win conditions (one per line)">
        <textarea
          value={form.winConditions}
          onChange={set("winConditions")}
          rows={3}
          placeholder={"Surface at least two pain points\nSecure a concrete next step with a date"}
          className={inputCls}
        />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving || generating}>
          {saving ? "Saving..." : "Create scenario"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs text-muted mb-1.5">{label}</span>
      {children}
    </label>
  );
}
