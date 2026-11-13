import Link from "next/link";
import { requirePlatformOwnerPage } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/workspaces", label: "Workspaces" },
  { href: "/admin/signups", label: "Signups" },
];

export default async function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePlatformOwnerPage();
  return (
    <div className="min-h-screen bg-white text-marketing-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">Erota platform</div>
            <div className="text-sm">Signed in as {actor.email}</div>
          </div>
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="font-medium text-brand hover:underline">
                {link.label}
              </Link>
            ))}
            <Link href="/me" className="text-muted hover:underline">
              Customer app
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
