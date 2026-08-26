"use client";

import Link from "next/link";
import { useState } from "react";
import { NavLinks, type NavItem } from "@/components/nav";
import { UserSwitcher } from "@/components/user-switcher";

export function MobileNav({
  items,
  orgName,
  users,
  currentId,
  role,
  demoMode,
  allowSwitcher = true,
}: {
  items: NavItem[];
  orgName: string;
  users: { id: string; name: string; role: string; title: string }[];
  currentId: string;
  role: string;
  demoMode: boolean;
  allowSwitcher?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden border-b border-line bg-surface">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          <span className="text-accent-hover">Sales</span>Coach AI
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted"
          aria-expanded={open}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <div className="border-t border-line px-3 py-3 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="text-xs text-muted px-1">{orgName}</div>
          <div onClick={() => setOpen(false)}>
            <NavLinks items={items} />
          </div>
          {demoMode && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-2.5 py-2 text-[11px] text-amber-300/90">
              Demo mode: deterministic engines (no API key).
            </div>
          )}
          <div className="text-[11px] text-muted px-1">Viewing as ({role.toLowerCase()})</div>
          <UserSwitcher users={users} currentId={currentId} allowSwitcher={allowSwitcher} />
        </div>
      )}
    </div>
  );
}
