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
