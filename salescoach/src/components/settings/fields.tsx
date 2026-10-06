"use client";

import type { ReactNode } from "react";

// Small form primitives shared by the settings-area client components
// (rubric editor, company profile editor, team settings forms).

export const inputCls =
  "w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm placeholder:text-muted/60 focus:outline-none focus:border-accent transition-colors";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} leading-relaxed ${props.className ?? ""}`} />;
}

export function InlineError({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-sm text-rose-400">{message}</p>;
}

export function InlineSuccess({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-sm text-emerald-400">{message}</p>;
}
