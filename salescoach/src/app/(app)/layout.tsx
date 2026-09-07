import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { isDemoAuth, isClerkEnabled } from "@/lib/auth-mode";
import { NavLinks, type NavItem } from "@/components/nav";
import { UserSwitcher } from "@/components/user-switcher";
import { ClerkUserMenu } from "@/components/clerk-user-menu";
import { aiAvailable } from "@/lib/ai";
import { storageBackend } from "@/lib/storage";

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
          { href: "/settings", label: "Settings" },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-line bg-surface flex flex-col">
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
      <main className="flex-1 min-w-0 px-8 py-8 max-w-6xl">{children}</main>
    </div>
  );
}
