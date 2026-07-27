import { db } from "@/lib/db";
import { currentUser, demoSwitcherAllowed, isManagerRole, impersonationInfo } from "@/lib/session";
import { isBackofficeRole } from "@/lib/backoffice";
import { consoleActor } from "@/lib/platform-admin";
import { ImpersonationBanner } from "@/components/admin/impersonation";
import { NavLinks, type NavItem } from "@/components/nav";
import { UserSwitcher } from "@/components/user-switcher";
import { AssistantChat } from "@/components/assistant/chat";
import { aiAvailable } from "@/lib/ai";
import { MobileNav } from "@/components/mobile-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const impersonation = await impersonationInfo();
  const console_ = impersonation ? null : await consoleActor();
  const users = await db.user.findMany({
    where: { orgId: user.orgId, disabledAt: null },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, role: true, title: true },
  });

  const manager = isManagerRole(user.role);
  const items: NavItem[] = [
    { href: "/ask", label: "Ask" },
    ...(manager ? [{ href: "/dashboard", label: "Team Dashboard" }] : []),
    { href: "/me", label: "My Performance" },
    { href: "/crm", label: "Pipeline" },
    { href: "/crm/accounts", label: "Accounts" },
    { href: "/crm/contacts", label: "Contacts" },
    { href: "/erp", label: "ERP" },
    { href: "/erp/quotes", label: "Quotes" },
    { href: "/erp/orders", label: "Orders" },
    { href: "/erp/invoices", label: "Invoices" },
    { href: "/conversations", label: "Conversations" },
    { href: "/channels", label: "Channels" },
    { href: "/calls", label: "Calls" },
    { href: "/roleplay", label: "Role-Play" },
    { href: "/scenarios", label: "Scenarios" },
    { href: "/assignments", label: "Assignments" },
    ...(manager
      ? [
          { href: "/calibration", label: "Calibration" },
          { href: "/rubrics", label: "Rubrics" },
          { href: "/company", label: "Company Profile" },
          { href: "/settings", label: "Settings" },
        ]
      : []),
    ...(isBackofficeRole(user.role) ? [{ href: "/backoffice", label: "Back Office" }] : []),
    ...(console_ ? [{ href: "/admin", label: "Platform Console" }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {impersonation && (
        <ImpersonationBanner
          orgName={impersonation.target.org.name}
          targetName={impersonation.target.name}
          adminName={impersonation.admin.name}
          expiresAtMs={impersonation.expiresAtMs}
        />
      )}
      <div className="flex flex-1">
      <aside className="hidden md:flex w-60 shrink-0 border-r border-line bg-surface flex-col">
        <div className="px-4 py-5 border-b border-line">
          <div className="font-semibold tracking-tight text-lg">
            <span className="text-accent-hover">Sales</span>Coach AI
          </div>
          <div className="text-xs text-muted mt-0.5">{user.org.name}</div>
        </div>
        <div className="p-3 flex-1 overflow-y-auto">
          <NavLinks items={items} />
        </div>
        <div className="p-3 border-t border-line space-y-2">
          {!aiAvailable() && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-2.5 py-2 text-[11px] text-amber-300/90">
              Demo mode: no OPENAI_API_KEY set. Grading, role-play, and the assistant use deterministic engines.
            </div>
          )}
          <div className="text-[11px] text-muted px-1">Viewing as ({user.role.toLowerCase()})</div>
          <UserSwitcher users={users} currentId={user.id} allowSwitcher={demoSwitcherAllowed()} />
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <MobileNav
          items={items}
          orgName={user.org.name}
          users={users}
          currentId={user.id}
          role={user.role}
          demoMode={!aiAvailable()}
          allowSwitcher={demoSwitcherAllowed()}
        />
        <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 sm:py-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>
      <AssistantChat />
      </div>
    </div>
  );
}
