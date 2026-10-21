import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { NavLinks, type NavItem } from "@/components/nav";
import { UserSwitcher } from "@/components/user-switcher";
import { AssistantChat } from "@/components/assistant/chat";
import { aiAvailable } from "@/lib/ai";

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
            <span className="text-accent-hover">Sales</span>Coach AI
          </div>
          <div className="text-xs text-muted mt-0.5">{user.org.name}</div>
        </div>
        <div className="p-3 flex-1">
          <NavLinks items={items} />
        </div>
        <div className="p-3 border-t border-line space-y-2">
          {!aiAvailable() && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-2.5 py-2 text-[11px] text-amber-300/90">
              Demo mode: no OPENAI_API_KEY set. Grading, role-play, and the assistant use deterministic engines.
            </div>
          )}
          <div className="text-[11px] text-muted px-1">Viewing as ({user.role.toLowerCase()})</div>
          <UserSwitcher users={users} currentId={user.id} />
        </div>
      </aside>
      <main className="flex-1 min-w-0 px-8 py-8 max-w-6xl">{children}</main>
      <AssistantChat />
    </div>
  );
}
