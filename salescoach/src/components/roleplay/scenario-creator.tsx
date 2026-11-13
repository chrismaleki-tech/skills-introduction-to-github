"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { buildScenarioDraft, QUICK_START_TEMPLATES, type BuilderInput, type ScenarioDraft } from "@/lib/scenario-builder";
import {
  ATTITUDES,
  BUSINESS_SIZES,
  CALL_TYPES,
  DIFFICULTIES,
  INDUSTRIES,
  OBJECTION_FAMILIES,
  OBJECTIVES,
  PROSPECT_ROLES,
  type ObjectionFamily,
} from "@/lib/scenario-options";
import type { ProspectAttitude } from "@/lib/types";
import { Field, ScenarioEditor, type ScenarioAnalysis } from "./scenario-editor";

// Three ways in, one way out: every path produces a ScenarioDraft that the
// user reviews in ScenarioEditor before saving or starting a call.

type Path = "quick" | "build" | "website";

const CUSTOM = "__custom__";

export function ScenarioCreator({
  defaultOffering,
  voiceEnabled,
  seed,
  initialPath = "quick",
  initialTemplate,
}: {
  defaultOffering: string;
  voiceEnabled: boolean;
  seed: number;
  initialPath?: Path;
  initialTemplate?: string;
}) {
  const [path, setPath] = useState<Path>(initialPath);
  const [result, setResult] = useState<{ draft: ScenarioDraft; analysis?: ScenarioAnalysis | null } | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Existing path: draft from the org's company profile (buyer personas,
  // objections, competitors). Kept as a one-click option for teams that
  // have filled the profile in.
  async function fromProfile() {
    setProfileBusy(true);
    setProfileError(null);
    try {
      const res = await fetch("/api/roleplay/scenarios/generate");
      const data = (await res.json().catch(() => ({}))) as Partial<ScenarioDraft> & { error?: string };
      if (!res.ok || !data.persona) {
        setProfileError(data.error ?? "Could not generate from the company profile.");
        return;
      }
      setResult({
        draft: {
          title: data.title ?? "",
          callType: data.callType ?? "discovery",
          difficulty: data.difficulty ?? "medium",
          persona: { ...data.persona, offering: data.persona.offering ?? defaultOffering },
          winConditions: data.winConditions ?? [],
        },
      });
    } catch {
      setProfileError("Network error — try again.");
    } finally {
      setProfileBusy(false);
    }
  }

  if (result) {
    return (
      <ScenarioEditor
        draft={result.draft}
        analysis={result.analysis}
        mode="create"
        voiceEnabled={voiceEnabled}
        onBack={() => setResult(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <PathCard
          active={path === "quick"}
          onClick={() => setPath("quick")}
          title="Quick start"
          blurb="Pick a ready-made call and go. Thirty seconds."
          icon={<BoltIcon />}
        />
        <PathCard
          active={path === "build"}
          onClick={() => setPath("build")}
          title="Build your own"
          blurb="A few dropdowns: who you are calling, why, and how tough."
          icon={<SlidersIcon />}
        />
        <PathCard
          active={path === "website"}
          onClick={() => setPath("website")}
          title="Use a business website"
          blurb="Paste a prospect's site. We'll draft a scenario from it."
          icon={<GlobeIcon />}
        />
      </div>

      {path === "quick" && <QuickStart defaultOffering={defaultOffering} seed={seed} initialTemplate={initialTemplate} onDraft={(draft) => setResult({ draft })} />}
      {path === "build" && <BuildYourOwn defaultOffering={defaultOffering} seed={seed} onDraft={(draft) => setResult({ draft })} />}
      {path === "website" && <FromWebsite defaultOffering={defaultOffering} onDraft={(draft, analysis) => setResult({ draft, analysis })} />}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>Filled in your company profile?</span>
        <button type="button" onClick={() => void fromProfile()} disabled={profileBusy} className="text-brand underline-offset-2 hover:underline disabled:opacity-50">
          {profileBusy ? "Generating..." : "Generate a scenario from it"}
        </button>
        {profileError && <span className="text-rose-700">{profileError}</span>}
      </div>
    </div>
  );
}

function PathCard({ active, onClick, title, blurb, icon }: { active: boolean; onClick: () => void; title: string; blurb: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
        active ? "border-accent bg-brand/5 ring-1 ring-accent" : "border-line bg-surface hover:border-accent/50"
      }`}
    >
      <span className={`mt-0.5 shrink-0 rounded-lg p-2 ${active ? "bg-accent text-white" : "bg-surface-2 text-muted"}`}>{icon}</span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{blurb}</span>
      </span>
    </button>
  );
}

const inputCls =
  "w-full rounded-lg bg-surface-2 border border-line px-3 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:border-accent";

// --- Quick start ---------------------------------------------------------------------

function QuickStart({ defaultOffering, seed, initialTemplate, onDraft }: { defaultOffering: string; seed: number; initialTemplate?: string; onDraft: (d: ScenarioDraft) => void }) {
  const [selected, setSelected] = useState<string>(
    QUICK_START_TEMPLATES.some((t) => t.key === initialTemplate) ? (initialTemplate as string) : QUICK_START_TEMPLATES[1].key,
  );
  const [difficulty, setDifficulty] = useState("medium");
  const [industry, setIndustry] = useState("");
  const [offering, setOffering] = useState(defaultOffering);

  const template = QUICK_START_TEMPLATES.find((t) => t.key === selected) ?? QUICK_START_TEMPLATES[0];
  const preview = useMemo(
    () =>
      buildScenarioDraft({
        callType: template.callType,
        difficulty,
        industry: industry || undefined,
        offering,
        seed: seed + template.key.length,
        ...template.preset,
      }),
    [template, difficulty, industry, offering, seed],
  );

  return (
    <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_START_TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSelected(t.key)}
            aria-pressed={selected === t.key}
            className={`rounded-lg border p-3 text-left transition-colors ${
              selected === t.key ? "border-accent bg-brand/5 ring-1 ring-accent" : "border-line hover:border-accent/50"
            }`}
          >
            <div className="text-sm font-medium">{t.label}</div>
            <div className="mt-0.5 text-xs text-muted">{t.blurb}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Difficulty (optional)">
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inputCls}>
            {DIFFICULTIES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label} — {d.blurb}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Prospect's industry (optional)">
          <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={inputCls}>
            <option value="">Any industry</option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </Field>
        <Field label="What you sell (optional)">
          <input value={offering} onChange={(e) => setOffering(e.target.value)} placeholder="e.g. payroll software for restaurants" className={inputCls} />
        </Field>
      </div>

      <div className="mt-4 rounded-lg border border-line bg-surface-2/60 p-3 text-sm">
        <div className="text-xs font-medium uppercase tracking-wider text-muted">You&apos;ll be calling</div>
        <div className="mt-1 font-medium">
          {preview.persona.name} <span className="font-normal text-muted">— {preview.persona.title}, {preview.persona.company}</span>
        </div>
        <p className="mt-1 text-muted">{preview.persona.situation}</p>
        <p className="mt-1">
          <span className="text-muted">Your goal: </span>
          {preview.persona.objective}
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button onClick={() => onDraft(preview)} className="w-full sm:w-auto">
          Review & start →
        </Button>
      </div>
    </div>
  );
}

// --- Build your own --------------------------------------------------------------------

function SelectOrCustom({
  label,
  options,
  value,
  onChange,
  placeholder,
  allowEmptyLabel,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  allowEmptyLabel?: string;
}) {
  const isPreset = options.includes(value);
  const [custom, setCustom] = useState(!isPreset && value !== "");
  return (
    <Field label={label}>
      <select
        value={custom ? CUSTOM : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            setCustom(true);
            onChange("");
          } else {
            setCustom(false);
            onChange(e.target.value);
          }
        }}
        className={inputCls}
      >
        {allowEmptyLabel !== undefined && <option value="">{allowEmptyLabel}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={CUSTOM}>Something else…</option>
      </select>
      {custom && <input autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} mt-2`} />}
    </Field>
  );
}

function BuildYourOwn({ defaultOffering, seed, onDraft }: { defaultOffering: string; seed: number; onDraft: (d: ScenarioDraft) => void }) {
  const [offering, setOffering] = useState(defaultOffering);
  const [industry, setIndustry] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [businessSize, setBusinessSize] = useState("mid");
  const [callType, setCallType] = useState("discovery");
  const [objective, setObjective] = useState<string>("");
  const [difficulty, setDifficulty] = useState("medium");
  const [attitude, setAttitude] = useState<ProspectAttitude | "">("");
  const [objection, setObjection] = useState<ObjectionFamily>("auto");
  const [customObjection, setCustomObjection] = useState("");
  const [advanced, setAdvanced] = useState(false);

  const preview = useMemo(() => {
    const input: BuilderInput = {
      callType,
      difficulty,
      industry: industry || undefined,
      role: role || undefined,
      businessSize,
      offering,
      objective: objective || undefined,
      attitude: attitude || undefined,
      objectionFamily: objection,
      customObjection,
      seed: seed + 7,
    };
    return buildScenarioDraft(input);
  }, [callType, difficulty, industry, role, businessSize, offering, objective, attitude, objection, customObjection, seed]);

  return (
    <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="space-y-4">
        <Field label="What you sell" hint="The prospect reacts to this">
          <input value={offering} onChange={(e) => setOffering(e.target.value)} placeholder="e.g. field-service scheduling software for HVAC companies" className={inputCls} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectOrCustom label="Prospect's industry" options={INDUSTRIES} value={industry} onChange={setIndustry} placeholder="e.g. Dental practices" allowEmptyLabel="Any industry" />
          <SelectOrCustom label="Prospect's role" options={PROSPECT_ROLES} value={role} onChange={setRole} placeholder="e.g. Director of Facilities" allowEmptyLabel="Pick a realistic buyer for me" />
          <Field label="Business size">
            <select value={businessSize} onChange={(e) => setBusinessSize(e.target.value)} className={inputCls}>
              {BUSINESS_SIZES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Call type">
            <select value={callType} onChange={(e) => setCallType(e.target.value)} className={inputCls}>
              {CALL_TYPES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label} — {c.blurb}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <SelectOrCustom label="Main sales objective" options={OBJECTIVES} value={objective} onChange={setObjective} placeholder="e.g. Get them to agree to a 2-week pilot" allowEmptyLabel="Default for this call type" />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Difficulty">
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inputCls}>
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label} — {d.blurb}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prospect's attitude">
            <select value={attitude} onChange={(e) => setAttitude(e.target.value as ProspectAttitude | "")} className={inputCls}>
              <option value="">Typical for this call type</option>
              {ATTITUDES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label} — {a.blurb}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <button type="button" onClick={() => setAdvanced((v) => !v)} className="text-sm text-brand underline-offset-2 hover:underline">
          {advanced ? "Hide advanced settings" : "Advanced settings (main objection)"}
        </button>
        {advanced && (
          <Field label="Main objection">
            <select value={objection} onChange={(e) => setObjection(e.target.value as ObjectionFamily)} className={inputCls}>
              {OBJECTION_FAMILIES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {objection === "custom" && (
              <input autoFocus value={customObjection} onChange={(e) => setCustomObjection(e.target.value)} placeholder="In the prospect's words…" className={`${inputCls} mt-2`} />
            )}
          </Field>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-line bg-surface-2/60 p-3 text-sm">
        <div className="text-xs font-medium uppercase tracking-wider text-muted">Preview</div>
        <div className="mt-1 font-medium">
          {preview.persona.name} <span className="font-normal text-muted">— {preview.persona.title}, {preview.persona.company}</span>
        </div>
        <p className="mt-1 text-muted">{preview.persona.situation}</p>
        {preview.persona.objections[0] && (
          <p className="mt-1 italic text-muted">&ldquo;{preview.persona.objections[0]}&rdquo;</p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button onClick={() => onDraft(preview)} className="w-full sm:w-auto">
          Review & start →
        </Button>
      </div>
    </div>
  );
}

// --- Use a business website ------------------------------------------------------------

function FromWebsite({ defaultOffering, onDraft }: { defaultOffering: string; onDraft: (d: ScenarioDraft, a: ScenarioAnalysis) => void }) {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [offering, setOffering] = useState(defaultOffering);
  const [objective, setObjective] = useState("");
  const [callType, setCallType] = useState("discovery");
  const [difficulty, setDifficulty] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = (url.trim() || description.trim()) && offering.trim() && !loading;

  async function analyze() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/roleplay/scenarios/from-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), description: description.trim(), offering: offering.trim(), objective: objective.trim(), callType, difficulty }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        draft?: ScenarioDraft;
        analysis?: ScenarioAnalysis;
        error?: string;
        needsDescription?: boolean;
      };
      if (!res.ok || !data.draft || !data.analysis) {
        setError(data.error ?? "Could not analyze that website.");
        if (data.needsDescription) setShowDescription(true);
        return;
      }
      onDraft(data.draft, data.analysis);
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="space-y-4">
        <Field label="Prospect's business website" hint="Public pages only">
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.example.com"
            className={inputCls}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void analyze();
              }
            }}
          />
        </Field>

        {!showDescription ? (
          <button type="button" onClick={() => setShowDescription(true)} className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline">
            No website, or it can&apos;t be read? Describe the business instead
          </button>
        ) : (
          <Field label="Describe the business" hint="Used instead of (or alongside) the website">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="A 40-location dental group in Texas that recently acquired two practices and is standardizing its front-office systems."
              className={inputCls}
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What you sell" hint="The website is about them, not you">
            <input value={offering} onChange={(e) => setOffering(e.target.value)} placeholder="e.g. patient-scheduling software" className={inputCls} />
          </Field>
          <Field label="Your call objective" hint="Optional — we'll suggest one">
            <input list="objective-options" value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="e.g. Book a demo with the practice manager" className={inputCls} />
            <datalist id="objective-options">
              {OBJECTIVES.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </Field>
          <Field label="Call type">
            <select value={callType} onChange={(e) => setCallType(e.target.value)} className={inputCls}>
              {CALL_TYPES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Difficulty">
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inputCls}>
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
          {showDescription && !description.trim() && <span className="block mt-1 text-xs">Add a short description of the business above and try again.</span>}
        </div>
      )}
      {!offering.trim() && (
        <p className="mt-3 text-xs text-muted">Tell us what you sell so the prospect can react to your offering — the website only tells us about them.</p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          We read the public homepage only, keep website facts separate from what we invent, and never name real employees.
        </p>
        <Button onClick={() => void analyze()} disabled={!canSubmit} className="w-full sm:w-auto sm:min-w-44">
          {loading ? (
            <>
              <Spinner /> Reading the site...
            </>
          ) : (
            "Draft my scenario →"
          )}
        </Button>
      </div>
    </div>
  );
}

// --- icons --------------------------------------------------------------------------------

function Spinner() {
  return <span aria-hidden="true" className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}
function BoltIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}
function SlidersIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}
