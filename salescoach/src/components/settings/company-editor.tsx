"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import type { CompanyProfile } from "@/lib/types";
import { Field, InlineError, InlineSuccess, TextArea, TextInput } from "./fields";

// Whole-profile editor. Line-based list fields (value props, talk tracks,
// differentiators, pain points) are edited as one-per-line textareas and split
// on save; repeatable object lists are controlled card lists.

type ProductDraft = { name: string; description: string; idealFor: string; differentiators: string };
type PersonaDraft = { title: string; industry: string; notes: string; painPoints: string };
type ObjectionDraft = { objection: string; approvedResponse: string };
type CompetitorDraft = { name: string; positioning: string };

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

function updateAt<T>(arr: T[], i: number, patch: Partial<T>): T[] {
  return arr.map((item, idx) => (idx === i ? { ...item, ...patch } : item));
}

function removeAt<T>(arr: T[], i: number): T[] {
  return arr.filter((_, idx) => idx !== i);
}

export function CompanyEditor({ profile }: { profile: CompanyProfile }) {
  const router = useRouter();

  const [description, setDescription] = useState(profile.description);
  const [pricingNotes, setPricingNotes] = useState(profile.pricingNotes);
  const [valueProps, setValueProps] = useState(profile.valueProps.join("\n"));
  const [talkTracks, setTalkTracks] = useState(profile.talkTracks.join("\n"));
  const [products, setProducts] = useState<ProductDraft[]>(
    profile.products.map((p) => ({ ...p, differentiators: p.differentiators.join("\n") })),
  );
  const [personas, setPersonas] = useState<PersonaDraft[]>(
    profile.personas.map((p) => ({ ...p, painPoints: p.painPoints.join("\n") })),
  );
  const [objections, setObjections] = useState<ObjectionDraft[]>(profile.objections);
  const [competitors, setCompetitors] = useState<CompetitorDraft[]>(profile.competitors);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function touch() {
    setSaved(false);
    setError("");
  }

  async function save() {
    setSaving(true);
    setError("");
    const payload: CompanyProfile = {
      description: description.trim(),
      pricingNotes: pricingNotes.trim(),
      valueProps: lines(valueProps),
      talkTracks: lines(talkTracks),
      products: products.map((p) => ({
        name: p.name.trim(),
        description: p.description.trim(),
        idealFor: p.idealFor.trim(),
        differentiators: lines(p.differentiators),
      })),
      personas: personas.map((p) => ({
        title: p.title.trim(),
        industry: p.industry.trim(),
        notes: p.notes.trim(),
        painPoints: lines(p.painPoints),
      })),
      objections: objections.map((o) => ({
        objection: o.objection.trim(),
        approvedResponse: o.approvedResponse.trim(),
      })),
      competitors: competitors.map((c) => ({ name: c.name.trim(), positioning: c.positioning.trim() })),
    };
    const res = await fetch("/api/company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Save failed. Please try again.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const itemCls = "border border-line rounded-lg p-4 bg-surface-2/40 space-y-3";
  const removeBtn = (onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="text-xs text-rose-400 hover:text-rose-300 shrink-0"
    >
      Remove
    </button>
  );

  return (
    <div className="space-y-6">
      <Card title="Company overview">
        <div className="space-y-4">
          <Field label="Description" hint="What the company sells and to whom.">
            <TextArea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                touch();
              }}
              rows={4}
            />
          </Field>
          <Field label="Pricing notes" hint="How pricing works, discount rules, what reps may commit to.">
            <TextArea
              value={pricingNotes}
              onChange={(e) => {
                setPricingNotes(e.target.value);
                touch();
              }}
              rows={3}
            />
          </Field>
        </div>
      </Card>

      <Card title="Value props">
        <Field label="Value propositions" hint="One per line. The grader rewards reps who use these.">
          <TextArea
            value={valueProps}
            onChange={(e) => {
              setValueProps(e.target.value);
              touch();
            }}
            rows={5}
          />
        </Field>
      </Card>

      <Card title="Talk tracks">
        <Field label="Approved talk tracks" hint="One per line. Phrasing reps are encouraged to use.">
          <TextArea
            value={talkTracks}
            onChange={(e) => {
              setTalkTracks(e.target.value);
              touch();
            }}
            rows={5}
          />
        </Field>
      </Card>

      <Card title="Products">
        <div className="space-y-3">
          {products.length === 0 && (
            <p className="text-sm text-muted">No products yet. Add what the team sells.</p>
          )}
          {products.map((p, i) => (
            <div key={i} className={itemCls}>
              <div className="flex items-start gap-3">
                <div className="grid gap-3 sm:grid-cols-2 flex-1">
                  <Field label="Name">
                    <TextInput
                      value={p.name}
                      onChange={(e) => {
                        setProducts(updateAt(products, i, { name: e.target.value }));
                        touch();
                      }}
                    />
                  </Field>
                  <Field label="Ideal for">
                    <TextInput
                      value={p.idealFor}
                      onChange={(e) => {
                        setProducts(updateAt(products, i, { idealFor: e.target.value }));
                        touch();
                      }}
                      placeholder="e.g. mid-market RevOps teams"
                    />
                  </Field>
                </div>
                {removeBtn(() => {
                  setProducts(removeAt(products, i));
                  touch();
                })}
              </div>
              <Field label="Description">
                <TextArea
                  value={p.description}
                  onChange={(e) => {
                    setProducts(updateAt(products, i, { description: e.target.value }));
                    touch();
                  }}
                  rows={2}
                />
              </Field>
              <Field label="Differentiators" hint="One per line.">
                <TextArea
                  value={p.differentiators}
                  onChange={(e) => {
                    setProducts(updateAt(products, i, { differentiators: e.target.value }));
                    touch();
                  }}
                  rows={3}
                />
              </Field>
            </div>
          ))}
          <Button
            variant="secondary"
            onClick={() => {
              setProducts([...products, { name: "", description: "", idealFor: "", differentiators: "" }]);
              touch();
            }}
          >
            Add product
          </Button>
        </div>
      </Card>

      <Card title="Buyer personas">
        <div className="space-y-3">
          {personas.length === 0 && (
            <p className="text-sm text-muted">
              No personas yet. Role-play prospects are generated from these.
            </p>
          )}
          {personas.map((p, i) => (
            <div key={i} className={itemCls}>
              <div className="flex items-start gap-3">
                <div className="grid gap-3 sm:grid-cols-2 flex-1">
                  <Field label="Title">
                    <TextInput
                      value={p.title}
                      onChange={(e) => {
                        setPersonas(updateAt(personas, i, { title: e.target.value }));
                        touch();
                      }}
                      placeholder="e.g. VP of Sales"
                    />
                  </Field>
                  <Field label="Industry">
                    <TextInput
                      value={p.industry}
                      onChange={(e) => {
                        setPersonas(updateAt(personas, i, { industry: e.target.value }));
                        touch();
                      }}
                    />
                  </Field>
                </div>
                {removeBtn(() => {
                  setPersonas(removeAt(personas, i));
                  touch();
                })}
              </div>
              <Field label="Pain points" hint="One per line.">
                <TextArea
                  value={p.painPoints}
                  onChange={(e) => {
                    setPersonas(updateAt(personas, i, { painPoints: e.target.value }));
                    touch();
                  }}
                  rows={3}
                />
              </Field>
              <Field label="Notes">
                <TextArea
                  value={p.notes}
                  onChange={(e) => {
                    setPersonas(updateAt(personas, i, { notes: e.target.value }));
                    touch();
                  }}
                  rows={2}
                />
              </Field>
            </div>
          ))}
          <Button
            variant="secondary"
            onClick={() => {
              setPersonas([...personas, { title: "", industry: "", notes: "", painPoints: "" }]);
              touch();
            }}
          >
            Add persona
          </Button>
        </div>
      </Card>

      <Card title="Objections & approved responses">
        <p className="text-sm text-muted mb-4">
          The grader checks reps against these: when a prospect raises one of these objections, the rep is
          scored on whether they answer with the approved response.
        </p>
        <div className="space-y-3">
          {objections.length === 0 && (
            <p className="text-sm text-muted">No objections yet. Add the ones your reps hear most.</p>
          )}
          {objections.map((o, i) => (
            <div key={i} className={itemCls}>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <Field label="Objection">
                    <TextInput
                      value={o.objection}
                      onChange={(e) => {
                        setObjections(updateAt(objections, i, { objection: e.target.value }));
                        touch();
                      }}
                      placeholder='e.g. "You are too expensive."'
                    />
                  </Field>
                </div>
                {removeBtn(() => {
                  setObjections(removeAt(objections, i));
                  touch();
                })}
              </div>
              <Field label="Approved response">
                <TextArea
                  value={o.approvedResponse}
                  onChange={(e) => {
                    setObjections(updateAt(objections, i, { approvedResponse: e.target.value }));
                    touch();
                  }}
                  rows={3}
                />
              </Field>
            </div>
          ))}
          <Button
            variant="secondary"
            onClick={() => {
              setObjections([...objections, { objection: "", approvedResponse: "" }]);
              touch();
            }}
          >
            Add objection
          </Button>
        </div>
      </Card>

      <Card title="Competitors">
        <div className="space-y-3">
          {competitors.length === 0 && (
            <p className="text-sm text-muted">No competitors yet. Add who you sell against.</p>
          )}
          {competitors.map((c, i) => (
            <div key={i} className={itemCls}>
              <div className="flex items-start gap-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_2fr] flex-1">
                  <Field label="Name">
                    <TextInput
                      value={c.name}
                      onChange={(e) => {
                        setCompetitors(updateAt(competitors, i, { name: e.target.value }));
                        touch();
                      }}
                    />
                  </Field>
                  <Field label="Positioning" hint="How we win against them.">
                    <TextInput
                      value={c.positioning}
                      onChange={(e) => {
                        setCompetitors(updateAt(competitors, i, { positioning: e.target.value }));
                        touch();
                      }}
                    />
                  </Field>
                </div>
                {removeBtn(() => {
                  setCompetitors(removeAt(competitors, i));
                  touch();
                })}
              </div>
            </div>
          ))}
          <Button
            variant="secondary"
            onClick={() => {
              setCompetitors([...competitors, { name: "", positioning: "" }]);
              touch();
            }}
          >
            Add competitor
          </Button>
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-1 px-1 py-3 bg-background/90 backdrop-blur border-t border-line flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
        <InlineError message={error} />
        {saved && <InlineSuccess message="Profile saved. Future grades and role-plays will use it." />}
      </div>
    </div>
  );
}
