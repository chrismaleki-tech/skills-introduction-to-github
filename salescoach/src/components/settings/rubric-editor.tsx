"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import type { RubricDimension } from "@/lib/types";
import { Field, InlineError, InlineSuccess, TextArea, TextInput } from "./fields";

// Editor for an org-owned rubric. Two concerns, each with its own save:
//  1. Name + description.
//  2. The dimensions array (weights, removals, company-specific additions),
//     staged locally and saved as a whole-array replace.

const LEVEL_SCAFFOLD = [
  "1 = No evidence of this on the call; the rep skips it entirely.",
  "2 = Attempted, but execution is weak or inconsistent.",
  "3 = Solid execution with clear room to improve.",
  "4 = Strong execution with only minor gaps.",
  "5 = Exemplary execution; could be used as a training example.",
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function uniqueKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

async function postRubric(id: string, payload: object): Promise<string | null> {
  const res = await fetch(`/api/rubrics/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.ok) return null;
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Save failed. Please try again.";
}

export function RubricEditor({
  id,
  name,
  description,
  dimensions,
}: {
  id: string;
  name: string;
  description: string;
  dimensions: RubricDimension[];
}) {
  const router = useRouter();

  // Details form
  const [draftName, setDraftName] = useState(name);
  const [draftDesc, setDraftDesc] = useState(description);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [detailsSaved, setDetailsSaved] = useState(false);

  // Dimensions (staged until "Save dimensions")
  const [dims, setDims] = useState<RubricDimension[]>(dimensions);
  const [dirty, setDirty] = useState(false);
  const [dimsBusy, setDimsBusy] = useState(false);
  const [dimsError, setDimsError] = useState("");
  const [dimsSaved, setDimsSaved] = useState(false);

  // Add-dimension form
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addWeight, setAddWeight] = useState("1");
  const [addLevels, setAddLevels] = useState<string[]>(LEVEL_SCAFFOLD);
  const [addError, setAddError] = useState("");

  const totalWeight = dims.reduce((s, d) => s + (Number.isFinite(d.weight) ? d.weight : 0), 0);
  const share = (w: number) =>
    totalWeight > 0 && Number.isFinite(w) ? `${Math.round((w / totalWeight) * 100)}%` : "—";

  function markDimsChanged() {
    setDirty(true);
    setDimsSaved(false);
    setDimsError("");
  }

  async function saveDetails() {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setDetailsError("Rubric name cannot be empty.");
      return;
    }
    setDetailsBusy(true);
    setDetailsError("");
    const err = await postRubric(id, { name: trimmed, description: draftDesc });
    setDetailsBusy(false);
    if (err) {
      setDetailsError(err);
      return;
    }
    setDetailsSaved(true);
    router.refresh();
  }

  function setWeight(key: string, value: number) {
    setDims((ds) => ds.map((d) => (d.key === key ? { ...d, weight: value } : d)));
    markDimsChanged();
  }

  function removeDimension(key: string) {
    const dim = dims.find((d) => d.key === key);
    if (!dim || dims.length <= 3) return;
    if (!confirm(`Remove "${dim.name}" from this rubric? It will no longer be scored on future grades.`))
      return;
    setDims((ds) => ds.filter((d) => d.key !== key));
    markDimsChanged();
  }

  function addDimension() {
    const trimmedName = addName.trim();
    if (!trimmedName) {
      setAddError("Give the dimension a name.");
      return;
    }
    const weight = parseFloat(addWeight);
    if (!Number.isFinite(weight) || weight < 0.5 || weight > 5) {
      setAddError("Weight must be between 0.5 and 5.");
      return;
    }
    if (addLevels.some((l) => !l.trim())) {
      setAddError("Fill in all five level descriptions.");
      return;
    }
    const key = uniqueKey(slugify(trimmedName) || "dimension", new Set(dims.map((d) => d.key)));
    setDims((ds) => [
      ...ds,
      {
        key,
        name: trimmedName,
        description: addDesc.trim(),
        weight,
        levels: addLevels.map((description, i) => ({ score: i + 1, description: description.trim() })),
        companySpecific: true,
      },
    ]);
    markDimsChanged();
    setAddName("");
    setAddDesc("");
    setAddWeight("1");
    setAddLevels(LEVEL_SCAFFOLD);
    setAddError("");
    setShowAdd(false);
  }

  async function saveDimensions() {
    if (dims.some((d) => !Number.isFinite(d.weight) || d.weight <= 0)) {
      setDimsError("Every dimension needs a weight greater than 0.");
      return;
    }
    setDimsBusy(true);
    setDimsError("");
    const err = await postRubric(id, { dimensions: dims });
    setDimsBusy(false);
    if (err) {
      setDimsError(err);
      return;
    }
    setDirty(false);
    setDimsSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card title="Rubric details">
        <div className="space-y-4">
          <Field label="Name">
            <TextInput
              value={draftName}
              onChange={(e) => {
                setDraftName(e.target.value);
                setDetailsSaved(false);
              }}
              maxLength={120}
            />
          </Field>
          <Field label="Description">
            <TextArea
              value={draftDesc}
              onChange={(e) => {
                setDraftDesc(e.target.value);
                setDetailsSaved(false);
              }}
              rows={2}
            />
          </Field>
          <div className="flex items-center gap-3">
            <Button onClick={saveDetails} disabled={detailsBusy}>
              {detailsBusy ? "Saving…" : "Save details"}
            </Button>
            <InlineError message={detailsError} />
            {detailsSaved && <InlineSuccess message="Details saved." />}
          </div>
        </div>
      </Card>

      <Card
        title="Dimensions"
        action={
          <span className="text-xs text-muted tabular-nums">
            {dims.length} dimensions · total weight {totalWeight % 1 === 0 ? totalWeight : totalWeight.toFixed(1)}
          </span>
        }
      >
        <p className="text-sm text-muted mb-4">
          Weight share shows how much of the 0-100 overall score each dimension controls. It recomputes live
          as you edit weights.
        </p>
        <div className="space-y-3">
          {dims.map((d) => (
            <div key={d.key} className="border border-line rounded-lg p-4 bg-surface-2/40">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{d.name}</span>
                <code className="text-[11px] text-muted bg-surface-2 border border-line rounded px-1.5 py-0.5">
                  {d.key}
                </code>
                {d.companySpecific && (
                  <span className="inline-flex rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent-hover">
                    Company-specific
                  </span>
                )}
                <div className="ml-auto flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    Weight
                    <input
                      type="number"
                      min={0.5}
                      max={5}
                      step={0.5}
                      value={Number.isFinite(d.weight) ? d.weight : ""}
                      onChange={(e) => setWeight(d.key, e.target.valueAsNumber)}
                      className="w-20 bg-surface-2 border border-line rounded-lg px-2 py-1 text-sm tabular-nums focus:outline-none focus:border-accent"
                    />
                  </label>
                  <span
                    className="text-xs text-foreground/80 tabular-nums w-16 text-right"
                    title="Share of the overall 0-100 score"
                  >
                    {share(d.weight)} of score
                  </span>
                  <button
                    type="button"
                    onClick={() => removeDimension(d.key)}
                    disabled={dims.length <= 3}
                    title={
                      dims.length <= 3 ? "A rubric needs at least 3 dimensions" : "Remove this dimension"
                    }
                    className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Remove
                  </button>
                </div>
              </div>
              {d.description && <p className="text-sm text-muted mt-2">{d.description}</p>}
              <ol className="mt-3 space-y-1">
                {d.levels.map((l) => (
                  <li key={l.score} className="flex gap-2 text-xs text-muted">
                    <span className="w-3 shrink-0 font-medium text-foreground/70 tabular-nums">{l.score}</span>
                    <span>{l.description}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-line pt-4">
          {!showAdd ? (
            <Button variant="secondary" onClick={() => setShowAdd(true)}>
              Add company-specific dimension
            </Button>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">New company-specific dimension</h3>
              <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
                <Field label="Name">
                  <TextInput
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="e.g. Compliance disclosure"
                    maxLength={80}
                  />
                </Field>
                <Field label="Description">
                  <TextInput
                    value={addDesc}
                    onChange={(e) => setAddDesc(e.target.value)}
                    placeholder="What this dimension measures"
                  />
                </Field>
                <Field label="Weight" hint="0.5 to 5">
                  <TextInput
                    type="number"
                    min={0.5}
                    max={5}
                    step={0.5}
                    value={addWeight}
                    onChange={(e) => setAddWeight(e.target.value)}
                    className="w-24"
                  />
                </Field>
              </div>
              <div className="space-y-3">
                {addLevels.map((level, i) => (
                  <Field key={i} label={`Level ${i + 1}`}>
                    <TextArea
                      value={level}
                      onChange={(e) =>
                        setAddLevels((ls) => ls.map((l, idx) => (idx === i ? e.target.value : l)))
                      }
                      rows={2}
                    />
                  </Field>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={addDimension}>Add dimension</Button>
                <Button variant="secondary" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <InlineError message={addError} />
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button onClick={saveDimensions} disabled={dimsBusy || !dirty}>
            {dimsBusy ? "Saving…" : "Save dimensions"}
          </Button>
          {dirty && <span className="text-sm text-amber-400">Unsaved dimension changes</span>}
          <InlineError message={dimsError} />
          {dimsSaved && !dirty && <InlineSuccess message="Dimensions saved." />}
        </div>
      </Card>

      <p className="text-xs text-muted">
        Changes apply to future grades only; existing grades keep the rubric they were scored with.
      </p>
    </div>
  );
}
