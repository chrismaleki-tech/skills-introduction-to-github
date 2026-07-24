"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orgs", label: "Organizations" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/presets", label: "Presets" },
  { href: "/admin/audit", label: "Audit" },
];

export function AdminTabNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1.5 mb-8 border-b border-line pb-3">
      {TABS.map((tab) => {
        const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-accent text-white" : "text-muted hover:text-foreground hover:bg-surface-2"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
