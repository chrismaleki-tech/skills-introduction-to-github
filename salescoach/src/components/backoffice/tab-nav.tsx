"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/backoffice", label: "Overview" },
  { href: "/backoffice/team", label: "Team" },
  { href: "/backoffice/billing", label: "Plan & Billing" },
  { href: "/backoffice/audit", label: "Audit" },
  { href: "/backoffice/exports", label: "Exports" },
];

export function BackofficeTabNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1.5 mb-8 border-b border-line pb-3">
      {TABS.map((tab) => {
        const active =
          tab.href === "/backoffice" ? pathname === "/backoffice" : pathname.startsWith(tab.href);
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
