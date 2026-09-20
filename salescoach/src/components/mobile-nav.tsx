"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { NavItem } from "./nav";

export function MobileNav({
  items,
  orgName,
  userLabel,
}: {
  items: NavItem[];
  orgName: string;
  userLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-white text-foreground"
      >
        <span className="flex w-5 flex-col gap-1.5" aria-hidden="true">
          <span className="h-0.5 w-full rounded bg-current" />
          <span className="h-0.5 w-full rounded bg-current" />
          <span className="h-0.5 w-full rounded bg-current" />
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/35"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(19rem,88vw)] flex-col bg-surface shadow-2xl">
            <div className="flex items-start justify-between border-b border-line px-4 py-4">
              <div className="min-w-0">
                <Link href="/" className="text-lg font-semibold tracking-tight">
                  <span className="text-brand">Sales</span>Coach AI
                </Link>
                <div className="mt-0.5 truncate text-xs text-muted">{orgName}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl text-muted"
              >
                ×
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`mb-1 block rounded-lg px-3 py-3 text-base font-medium ${
                      active ? "bg-brand/10 text-brand" : "text-muted hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-line px-4 py-4 text-xs text-muted">{userLabel}</div>
          </aside>
        </div>
      )}
    </>
  );
}
