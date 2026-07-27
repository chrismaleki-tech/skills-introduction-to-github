"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

type PlanCard = {
  id: string;
  name: string;
  blurb: string;
  seatLimit: number | null;
  seatPriceMonthly: number;
};

export function PlanPicker({ plans, currentPlan }: { plans: PlanCard[]; currentPlan: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function choose(planId: string, name: string) {
    if (!window.confirm(`Switch the organization to the ${name} plan?`)) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/backoffice/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planId }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Plan change failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const current = plan.id === currentPlan;
          return (
            <div
              key={plan.id}
              className={`rounded-lg border px-3 py-3 flex flex-col gap-2 ${
                current ? "border-accent bg-accent/5" : "border-line bg-surface-2"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{plan.name}</span>
                {current && (
                  <span className="rounded-full border border-accent/50 text-accent-hover px-2 py-0.5 text-[10px] uppercase tracking-wider">
                    Current
                  </span>
                )}
              </div>
              <div className="text-lg font-semibold">
                ${plan.seatPriceMonthly}
                <span className="text-xs text-muted font-normal"> /seat·mo</span>
              </div>
              <div className="text-xs text-muted">
                {plan.seatLimit != null ? `Up to ${plan.seatLimit} seats` : "Unlimited seats"}
              </div>
              <p className="text-xs text-muted flex-1">{plan.blurb}</p>
              {!current && (
                <Button
                  variant="secondary"
                  className="!px-2.5 !py-1.5 !text-xs justify-center"
                  disabled={busy}
                  onClick={() => void choose(plan.id, plan.name)}
                >
                  Switch to {plan.name}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
    </div>
  );
}

export function BillingEmailForm({ billingEmail }: { billingEmail: string }) {
  const router = useRouter();
  const [value, setValue] = useState(billingEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    const res = await fetch("/api/backoffice/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billingEmail: value }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Could not save.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="finance@company.com"
        className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm w-64"
      />
      <Button variant="secondary" className="!px-3 !py-2 !text-xs" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save billing contact"}
      </Button>
      {saved && <span className="text-xs text-emerald-400">Saved.</span>}
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}
