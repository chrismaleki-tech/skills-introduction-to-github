import { BAND_LABELS } from "./scoring";
import type { ScoreBand } from "./types";

// Client-safe CRM constants / formatters (no DB imports).

export const DEAL_STAGES = [
  { key: "lead", label: "Lead", probability: 10 },
  { key: "qualified", label: "Qualified", probability: 20 },
  { key: "discovery", label: "Discovery", probability: 35 },
  { key: "demo", label: "Demo", probability: 50 },
  { key: "proposal", label: "Proposal", probability: 65 },
  { key: "negotiation", label: "Negotiation", probability: 80 },
  { key: "closed_won", label: "Closed won", probability: 100 },
  { key: "closed_lost", label: "Closed lost", probability: 0 },
] as const;

export type DealStage = (typeof DEAL_STAGES)[number]["key"];

export const OPEN_STAGES: DealStage[] = DEAL_STAGES.filter(
  (s) => s.key !== "closed_won" && s.key !== "closed_lost",
).map((s) => s.key);

export function stageLabel(stage: string): string {
  // Industry packs introduce org-specific keys; prettify unknown ones.
  return DEAL_STAGES.find((s) => s.key === stage)?.label ?? stage.replaceAll("_", " ");
}

export function stageMeta(stage: string) {
  return DEAL_STAGES.find((s) => s.key === stage) ?? DEAL_STAGES[0];
}

export function fmtMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-US")}`;
  }
}

export function bandLabel(band: ScoreBand | string): string {
  return BAND_LABELS[band as ScoreBand] ?? String(band);
}
