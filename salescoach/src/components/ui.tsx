import Link from "next/link";
import type { ReactNode } from "react";
import { BAND_COLORS, BAND_LABELS, bandFor } from "@/lib/scoring";

// Shared design-system primitives. All feature pages compose these so the app
// stays visually consistent across the parallel-built sections.

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted mt-1 text-sm max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`bg-surface border border-line rounded-xl ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          {title && <h2 className="text-sm font-medium text-muted uppercase tracking-wider">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const band = bandFor(score);
  const sizes = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-2xl px-4 py-2 font-semibold",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border font-medium tabular-nums ${BAND_COLORS[band]} ${sizes[size]}`}
      title={BAND_LABELS[band]}
    >
      {score}
      {size === "lg" && <span className="text-xs font-normal opacity-80">/ 100</span>}
    </span>
  );
}

export function BandPill({ score }: { score: number }) {
  const band = bandFor(score);
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${BAND_COLORS[band]}`}>
      {BAND_LABELS[band]}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    GRADED: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    GRADING: "text-sky-400 bg-sky-400/10 border-sky-400/30",
    TRANSCRIBING: "text-sky-400 bg-sky-400/10 border-sky-400/30",
    QUEUED: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    INGESTED: "text-slate-400 bg-slate-400/10 border-slate-400/30",
    SKIPPED: "text-slate-500 bg-slate-500/10 border-slate-500/30",
    FAILED: "text-rose-400 bg-rose-400/10 border-rose-400/30",
    ACTIVE: "text-sky-400 bg-sky-400/10 border-sky-400/30",
    COMPLETED: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    PENDING: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    IN_PROGRESS: "text-sky-400 bg-sky-400/10 border-sky-400/30",
    draft: "text-slate-400 bg-slate-400/10 border-slate-400/30",
    sent: "text-sky-400 bg-sky-400/10 border-sky-400/30",
    accepted: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    rejected: "text-rose-400 bg-rose-400/10 border-rose-400/30",
    expired: "text-slate-500 bg-slate-500/10 border-slate-500/30",
    pending: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    confirmed: "text-sky-400 bg-sky-400/10 border-sky-400/30",
    fulfilled: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    cancelled: "text-slate-500 bg-slate-500/10 border-slate-500/30",
    partial: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    paid: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    void: "text-rose-400 bg-rose-400/10 border-rose-400/30",
    submitted: "text-sky-400 bg-sky-400/10 border-sky-400/30",
    received: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide ${styles[status] ?? "text-slate-400 bg-slate-400/10 border-slate-400/30"}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function SamplingPill({ status }: { status: string }) {
  const labels: Record<string, string> = {
    WITHIN_THRESHOLD: "Graded · within threshold",
    SAMPLED: "Graded · random sample",
    NOT_SAMPLED: "Not sampled",
    BELOW_MIN_DURATION: "Skipped · too short",
    MANUAL_UPLOAD: "Graded · manual upload",
    REP_FLAGGED: "Graded · rep flagged",
    MANAGER_REQUESTED: "Graded · manager request",
  };
  return <span className="text-xs text-muted">{labels[status] ?? status}</span>;
}

export function Button({
  children,
  variant = "primary",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: "bg-accent hover:bg-accent-hover text-white",
    secondary: "bg-surface-2 hover:bg-line text-foreground border border-line",
    danger: "bg-rose-600/80 hover:bg-rose-600 text-white",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const styles = {
    primary: "bg-accent hover:bg-accent-hover text-white",
    secondary: "bg-surface-2 hover:bg-line text-foreground border border-line",
  };
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${styles[variant]}`}
    >
      {children}
    </Link>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-12 text-muted">
      <p className="font-medium text-foreground/70">{title}</p>
      {hint && <p className="text-sm mt-1">{hint}</p>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-4">
      <div className="text-xs text-muted uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}

export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtDateTime(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
