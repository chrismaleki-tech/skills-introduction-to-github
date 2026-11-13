"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import type { ScenarioDraft } from "@/lib/scenario-builder";
import { ATTITUDES, BUSINESS_SIZES, CALL_TYPES, DIFFICULTIES, INTEREST_LEVELS, VOICES } from "@/lib/scenario-options";

// Editable scenario preview. Every creation path ends here, and the edit
// page reuses it. The essentials are visible; everything else sits behind
// "More settings" so a first-time user sees a short form, not a wall.

export interface ScenarioAnalysis {
  source: "website" | "description";
  businessName: string;
  summary: string;
  facts: string[];
  assumptions: string[];
  finalUrl?: string;
}

interface FormState {
  title: string;
  callType: string;
  difficulty: string;
  name: string;
  role: string;
  company: string;
  industry: string;
  businessSize: string;
  attitude: string;
  interest: string;
  offering: string;
  objective: string;
  situation: string;
  personality: string;
  priorities: string;
  painPoints: string;
  objections: string;
  budget: string;
  authority: string;
  notes: string;
  winConditions: string;
  facts: string;
  assumptions: string;
  sourceUrl: string;
  voice: string;
}

const joinLines = (a?: string[]) => (a ?? []).join("\n");
const splitLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

export function draftToForm(d: ScenarioDraft): FormState {
  const p = d.persona;
  return {
    title: d.title,
    callType: d.callType,
    difficulty: d.difficulty,
    name: p.name,
    role: p.title,
    company: p.company,
    industry: p.industry,
    businessSize: p.businessSize ?? "",
    attitude: p.attitude ?? "",
    interest: p.interest ?? "",
    offering: p.offering ?? "",
    objective: p.objective ?? "",
    situation: p.situation ?? "",
    personality: p.personality,
    priorities: joinLines(p.priorities),
    painPoints: joinLines(p.painPoints),
    objections: joinLines(p.objections),
    budget: p.budget,
    authority: p.authority ?? "",
    notes: p.notes,
    winConditions: joinLines(d.winConditions),
    facts: joinLines(p.facts),
    assumptions: joinLines(p.assumptions),
    sourceUrl: p.sourceUrl ?? "",
    voice: p.voice ?? "",
  };
}

function formToPayload(f: FormState) {
  return {
    title: f.title,
    callType: f.callType,
    difficulty: f.difficulty,
    persona: {
      name: f.name,
      title: f.role,
      company: f.company,
      industry: f.industry,
      personality: f.personality,
      painPoints: splitLines(f.painPoints),
      objections: splitLines(f.objections),
      budget: f.budget,
      notes: f.notes,
      attitude: f.attitude || undefined,
      interest: f.interest || undefined,
      priorities: splitLines(f.priorities),
      businessSize: f.businessSize || undefined,
      authority: f.authority || undefined,
      offering: f.offering || undefined,
      objective: f.objective || undefined,
      situation: f.situation || undefined,
      facts: splitLines(f.facts),
      assumptions: splitLines(f.assumptions),
      sourceUrl: f.sourceUrl || undefined,
      voice: f.voice || undefined,
    },
    winConditions: splitLines(f.winConditions),
  };
}

export function ScenarioEditor({
  draft,
  mode,
  scenarioId,
  voiceEnabled,
  analysis,
  onBack,
}: {
  draft: ScenarioDraft;
  mode: "create" | "edit";
  scenarioId?: string;
  voiceEnabled: boolean;
  analysis?: ScenarioAnalysis | null;
  onBack?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => draftToForm(draft));
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState<"save" | "start" | "startText" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const problems = useMemo(() => {
    const list: string[] = [];
    if (!form.title.trim()) list.push("Add a title.");
    if (!form.name.trim()) list.push("Give the prospect a name.");
    return list;
  }, [form.title, form.name]);

  async function persist(): Promise<string | null> {
    const res = await fetch(mode === "edit" && scenarioId ? `/api/roleplay/scenarios/${scenarioId}` : "/api/roleplay/scenarios", {
      method: mode === "edit" ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(form)),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!res.ok || !data.id) {
      setError(data.error ?? "Could not save the scenario.");
      return null;
    }
    return data.id;
  }

  async function save() {
    if (busy || problems.length) return;
    setBusy("save");
    setError(null);
    try {
      const id = await persist();
      if (!id) return;
      router.push(`/scenarios/${id}`);
      router.refresh();
      return;
    } catch {
      setError("Network error while saving — try again.");
    }
    setBusy(null);
  }

  async function saveAndStart(sessionMode: "VOICE" | "TEXT") {
    if (busy || problems.length) return;
    setBusy(sessionMode === "VOICE" ? "start" : "startText");
    setError(null);
    try {
      const id = await persist();
      if (!id) {
        setBusy(null);
        return;
      }
      const res = await fetch("/api/roleplay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: id, mode: sessionMode }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        // Scenario is saved; surface the start problem and take them to it.
        setError(data.error ?? "Saved the scenario, but could not start the session.");
        setBusy(null);
        router.push(`/scenarios/${id}`);
        return;
      }
      router.push(`/roleplay/${data.id}`);
      return;
    } catch {
      setError("Network error — try again.");
    }
    setBusy(null);
  }

  const inputCls =
    "w-full rounded-lg bg-surface-2 border border-line px-3 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:border-accent";
  const difficultyBlurb = DIFFICULTIES.find((d) => d.value === form.difficulty)?.blurb;

  return (
    <div className="space-y-5">
      {analysis && (
        <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium">
              {analysis.source === "website" ? "What we found on the website" : "From your description"}
            </h3>
            {analysis.finalUrl && (
              <a href={analysis.finalUrl} target="_blank" rel="noreferrer noopener" className="text-xs text-muted underline-offset-2 hover:underline break-all">
                {analysis.finalUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            )}
          </div>
          <p className="mt-1.5 text-sm">{analysis.summary}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-emerald-700">
                {analysis.source === "website" ? "Stated on the site" : "From what you told us"}
              </div>
              <ul className="mt-1.5 space-y-1 text-sm">
                {analysis.facts.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 text-emerald-700">•</span>
                    {f}
                  </li>
                ))}
                {analysis.facts.length === 0 && <li className="text-muted">Nothing specific could be extracted.</li>}
              </ul>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-amber-700">Assumed for the simulation</div>
              <ul className="mt-1.5 space-y-1 text-sm">
                {analysis.assumptions.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 text-amber-700">•</span>
                    {a}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">The prospect contact is fictional. Edit anything below before you start.</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            {mode === "edit" ? "Edit scenario" : "Review your scenario"}
          </h2>
          {onBack && (
            <button type="button" onClick={onBack} className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline">
              ← Start over
            </button>
          )}
        </div>

        <div className="mt-4 space-y-4">
          <Field label="Title">
            <input value={form.title} onChange={set("title")} placeholder="Discovery: COO at a regional distributor" className={inputCls} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Call type">
              <select value={form.callType} onChange={set("callType")} className={inputCls}>
                {CALL_TYPES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Difficulty" hint={difficultyBlurb}>
              <select value={form.difficulty} onChange={set("difficulty")} className={inputCls}>
                {DIFFICULTIES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prospect's attitude">
              <select value={form.attitude} onChange={set("attitude")} className={inputCls}>
                <option value="">Let the personality decide</option>
                {ATTITUDES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prospect's name" hint="Fictional">
              <input value={form.name} onChange={set("name")} placeholder="Dana Whitfield" className={inputCls} />
            </Field>
            <Field label="Prospect's role">
              <input value={form.role} onChange={set("role")} placeholder="VP of Operations" className={inputCls} />
            </Field>
            <Field label="Company">
              <input value={form.company} onChange={set("company")} placeholder="Northgate Distribution" className={inputCls} />
            </Field>
            <Field label="Industry">
              <input value={form.industry} onChange={set("industry")} placeholder="Wholesale distribution" className={inputCls} />
            </Field>
          </div>

          <Field label="What you sell" hint="So the prospect reacts to your actual offering">
            <input value={form.offering} onChange={set("offering")} placeholder="Inventory software for multi-warehouse distributors" className={inputCls} />
          </Field>
          <Field label="Your objective for this call" hint="Also used when grading the call">
            <input value={form.objective} onChange={set("objective")} placeholder="Uncover their top two pain points and book a demo" className={inputCls} />
          </Field>
          <Field label="Situation" hint="How this call came about">
            <textarea value={form.situation} onChange={set("situation")} rows={2} className={inputCls} />
          </Field>
          <Field label="Objections they'll raise (one per line)">
            <textarea value={form.objections} onChange={set("objections")} rows={3} className={inputCls} placeholder={"We already have a provider for this.\nThere's no budget this year."} />
          </Field>

          <button type="button" onClick={() => setMore((v) => !v)} className="text-sm text-brand underline-offset-2 hover:underline">
            {more ? "Hide more settings" : "More settings (personality, pain points, voice, win conditions…)"}
          </button>

          {more && (
            <div className="space-y-4 border-t border-line pt-4">
              <Field label="Personality" hint="How they come across on the call">
                <textarea value={form.personality} onChange={set("personality")} rows={2} className={inputCls} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Starting interest">
                  <select value={form.interest} onChange={set("interest")} className={inputCls}>
                    <option value="">Default for difficulty</option>
                    {INTEREST_LEVELS.map((i) => (
                      <option key={i.value} value={i.value}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Business size">
                  <input list="business-sizes" value={form.businessSize} onChange={set("businessSize")} placeholder="50-500 people" className={inputCls} />
                  <datalist id="business-sizes">
                    {BUSINESS_SIZES.map((b) => (
                      <option key={b.value} value={b.label} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Prospect's voice" hint={voiceEnabled ? "Marin and Cedar sound most natural" : "Voice is not configured on this server"}>
                  <select value={form.voice} onChange={set("voice")} className={inputCls} disabled={!voiceEnabled}>
                    <option value="">Automatic (Marin or Cedar)</option>
                    {VOICES.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label} — {v.blurb}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Pain points they'll reveal with good discovery (one per line)">
                  <textarea value={form.painPoints} onChange={set("painPoints")} rows={3} className={inputCls} />
                </Field>
                <Field label="What they're measured on (one per line)">
                  <textarea value={form.priorities} onChange={set("priorities")} rows={3} className={inputCls} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Budget posture">
                  <input value={form.budget} onChange={set("budget")} className={inputCls} />
                </Field>
                <Field label="Decision authority">
                  <input value={form.authority} onChange={set("authority")} className={inputCls} />
                </Field>
              </div>
              <Field label="Other context the prospect knows">
                <textarea value={form.notes} onChange={set("notes")} rows={2} className={inputCls} />
              </Field>
              <Field label="What a winning call accomplishes (one per line)" hint="Shown to the rep and used for grading">
                <textarea value={form.winConditions} onChange={set("winConditions")} rows={3} className={inputCls} />
              </Field>
              {(form.facts || form.assumptions || form.sourceUrl) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Verified facts about the business (one per line)">
                    <textarea value={form.facts} onChange={set("facts")} rows={3} className={inputCls} />
                  </Field>
                  <Field label="Simulation assumptions (one per line)">
                    <textarea value={form.assumptions} onChange={set("assumptions")} rows={3} className={inputCls} />
                  </Field>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
        )}
        {problems.length > 0 && !error && (
          <div className="mt-4 text-xs text-muted">{problems.join(" ")}</div>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="secondary" onClick={() => void save()} disabled={busy !== null || problems.length > 0} className="w-full sm:w-auto">
            {busy === "save" ? "Saving..." : mode === "edit" ? "Save changes" : "Save to library"}
          </Button>
          {voiceEnabled ? (
            <Button onClick={() => void saveAndStart("VOICE")} disabled={busy !== null || problems.length > 0} className="w-full sm:w-auto sm:min-w-56">
              <MicIcon />
              {busy === "start" ? "Starting..." : mode === "edit" ? "Save & start voice role-play" : "Start voice role-play"}
            </Button>
          ) : (
            <Button onClick={() => void saveAndStart("TEXT")} disabled={busy !== null || problems.length > 0} className="w-full sm:w-auto">
              {busy === "startText" ? "Starting..." : "Save & start text role-play"}
            </Button>
          )}
        </div>
        {voiceEnabled && (
          <div className="mt-2 text-right">
            <button type="button" onClick={() => void saveAndStart("TEXT")} disabled={busy !== null || problems.length > 0} className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50">
              {busy === "startText" ? "Starting..." : "Prefer to type? Start a text role-play"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="block text-xs text-muted">{label}</span>
        {hint && <span className="text-[11px] text-muted/80">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function MicIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}
