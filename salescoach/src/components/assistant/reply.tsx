"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type AssistantSource = "crm" | "erp" | "trainer";
export type AssistantDomain = "all" | AssistantSource;
export type AssistantLinkItem = { href: string; label: string };

export const SOURCE_LABEL: Record<AssistantSource, string> = {
  crm: "CRM",
  erp: "ERP",
  trainer: "Sales trainer",
};

export const SOURCE_TONE: Record<AssistantSource, string> = {
  crm: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  erp: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  trainer: "border-amber-400/30 bg-amber-400/10 text-amber-200",
};

/** Lightweight markdown: **bold**, newlines, bullet lines. */
export function ReplyBody({ content, invert = false }: { content: string; invert?: boolean }) {
  const lines = content.split("\n");
  return (
    <div className={`space-y-1 ${invert ? "text-white" : ""}`}>
      {lines.map((line, i) => {
        const bullet = /^[•\-]\s+/.test(line);
        const text = bullet ? line.replace(/^[•\-]\s+/, "") : line;
        return (
          <p key={i} className={bullet ? "pl-3 relative" : undefined}>
            {bullet && <span className="absolute left-0 opacity-70">•</span>}
            {renderInline(text, invert)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string, invert: boolean): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className={invert ? "font-semibold text-white" : "font-semibold text-foreground"}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function SourceBadges({ sources }: { sources?: AssistantSource[] }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {sources.map((s) => (
        <span
          key={s}
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide ${SOURCE_TONE[s]}`}
        >
          {SOURCE_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

export function ReplyLinks({
  links,
  onNavigate,
}: {
  links?: AssistantLinkItem[];
  onNavigate?: () => void;
}) {
  if (!links?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {links.map((l) => (
        <Link
          key={l.href + l.label}
          href={l.href}
          onClick={onNavigate}
          className="inline-flex rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] text-accent-hover hover:bg-accent/20 transition-colors"
        >
          {l.label} →
        </Link>
      ))}
    </div>
  );
}

export function DomainTabs({
  value,
  onChange,
  compact = false,
}: {
  value: AssistantDomain;
  onChange: (d: AssistantDomain) => void;
  compact?: boolean;
}) {
  const tabs: { key: AssistantDomain; label: string }[] = [
    { key: "all", label: compact ? "All" : "All systems" },
    { key: "crm", label: "CRM" },
    { key: "erp", label: "ERP" },
    { key: "trainer", label: compact ? "Trainer" : "Sales trainer" },
  ];
  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${compact ? "" : "border-b border-line pb-3"}`}
      role="tablist"
      aria-label="System scope"
    >
      {tabs.map(({ key, label }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={`relative px-2.5 py-1 text-xs sm:text-sm transition-colors ${
              active ? "text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
            {active && !compact && (
              <span className="absolute inset-x-2 -bottom-[13px] h-0.5 rounded-full bg-accent" />
            )}
            {active && compact && (
              <span className="absolute inset-x-1 -bottom-0.5 h-0.5 rounded-full bg-accent" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function ResultCard({ data }: { data?: unknown }) {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.kind === "pipeline") {
    const stages = Array.isArray(d.stages) ? (d.stages as { label: string; count: number; value: number }[]) : [];
    return (
      <div className="mt-3 rounded-xl border border-line bg-background/50 p-3">
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <Stat label="Deals" value={String(d.count ?? 0)} />
          <Stat label="Pipeline" value={money(Number(d.total ?? 0))} />
          <Stat label="Weighted" value={money(Number(d.weighted ?? 0))} />
        </div>
        {stages.length > 0 && (
          <div className="space-y-1.5">
            {stages
              .filter((s) => s.count > 0)
              .map((s) => (
                <div key={s.label} className="flex items-center justify-between text-xs">
                  <span className="text-muted">{s.label}</span>
                  <span className="tabular-nums">
                    {s.count} · {money(s.value)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  }
  if (d.kind === "finance") {
    return (
      <div className="mt-3 rounded-xl border border-line bg-background/50 p-3 grid grid-cols-2 gap-2">
        <Stat label="Open quotes" value={`${d.openQuoteCount} · ${money(Number(d.openQuoteValue ?? 0))}`} />
        <Stat label="Open orders" value={`${d.openOrderCount} · ${money(Number(d.openOrderValue ?? 0))}`} />
        <Stat label="AR" value={money(Number(d.arBalance ?? 0))} />
        <Stat label="Cash collected" value={money(Number(d.revenue ?? 0))} />
      </div>
    );
  }
  return null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2/60 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-sm font-medium tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

export function MessageActions({
  content,
  onRegenerate,
}: {
  content: string;
  onRegenerate?: () => void;
}) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        className="text-[10px] text-muted hover:text-foreground transition-colors"
        onClick={() => void navigator.clipboard?.writeText(content)}
      >
        Copy
      </button>
      {onRegenerate && (
        <button
          type="button"
          className="text-[10px] text-muted hover:text-foreground transition-colors"
          onClick={onRegenerate}
        >
          Regenerate
        </button>
      )}
    </div>
  );
}

