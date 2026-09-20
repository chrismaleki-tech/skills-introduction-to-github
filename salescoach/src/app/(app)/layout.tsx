import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { isDemoAuth, isClerkEnabled } from "@/lib/auth-mode";
import { NavLinks, type NavItem } from "@/components/nav";
import { UserSwitcher } from "@/components/user-switcher";
import { ClerkUserMenu } from "@/components/clerk-user-menu";
import { aiAvailable } from "@/lib/ai";
import { storageBackend } from "@/lib/storage";
import { billingAccess } from "@/lib/billing";
import { MobileNav } from "@/components/mobile-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const users = await db.user.findMany({
    where: { orgId: user.orgId },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, role: true, title: true },
  });

  const manager = isManagerRole(user.role);
  const items: NavItem[] = [
    ...(manager ? [{ href: "/dashboard", label: "Team Dashboard" }] : []),
    { href: "/me", label: "My Performance" },
    { href: "/calls", label: "Calls" },
    { href: "/roleplay", label: "Role-Play" },
    { href: "/scenarios", label: "Scenarios" },
    { href: "/assignments", label: "Assignments" },
    ...(manager
      ? [
          { href: "/rubrics", label: "Rubrics" },
          { href: "/company", label: "Company Profile" },
          { href: "/billing", label: "Billing" },
          { href: "/settings", label: "Settings" },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between border-b border-line bg-surface/95 px-3 py-2 backdrop-blur md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <MobileNav
            items={items}
            orgName={user.org.name}
            userLabel={`${user.name} · ${user.role.toLowerCase()}`}
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              <span className="text-brand">Sales</span>Coach AI
            </div>
            <div className="max-w-40 truncate text-[11px] text-muted">{user.org.name}</div>
          </div>
        </div>
        {isClerkEnabled() && <ClerkUserMenu />}
      </header>

      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="px-4 py-5 border-b border-line">
          <div className="font-semibold tracking-tight text-lg">
            <span className="text-brand">Sales</span>Coach AI
          </div>
          <div className="text-xs text-muted mt-0.5">{user.org.name}</div>
        </div>
        <div className="p-3 flex-1">
          <NavLinks items={items} />
        </div>
        <div className="p-3 border-t border-line space-y-2">
          {!aiAvailable() && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
              Demo mode: no OPENAI_API_KEY set. Grading and role-play use deterministic engines.
            </div>
          )}
          {storageBackend() === "local" && (
            <div className="rounded-lg border border-line bg-white px-2.5 py-2 text-[11px] text-muted">
              Audio storage: local disk (set S3_* for durable uploads).
            </div>
          )}
          <div className="text-[11px] text-muted px-1">
            {user.name} · {user.role.toLowerCase()}
          </div>
          {isClerkEnabled() && (
            <div className="px-1">
              <ClerkUserMenu />
            </div>
          )}
          {isDemoAuth() && <UserSwitcher users={users} currentId={user.id} />}
        </div>
      </aside>
      <main className="w-full min-w-0 flex-1 px-4 py-5 sm:px-6 md:max-w-6xl md:px-8 md:py-8">
        {(() => {
          const access = billingAccess(user.org);
          if (access.status === "active") return null;
          return (
            <div
              className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
                access.entitled
                  ? "border-brand/30 bg-brand/5 text-marketing-ink"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {access.entitled
                ? `Free trial: ${access.daysLeft} day${access.daysLeft === 1 ? "" : "s"} remaining.`
                : "Your trial or subscription is inactive."}{" "}
              {manager && (
                <a href="/billing" className="font-semibold underline underline-offset-2">
                  {access.entitled ? "Choose a plan" : "Restore access"}
                </a>
              )}
            </div>
          );
        })()}
        {children}
      </main>
    </div>
  );
}
