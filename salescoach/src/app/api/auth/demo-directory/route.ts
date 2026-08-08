import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { demoSwitcherAllowed } from "@/lib/session";

/**
 * Demo workspace directory for the login screen. Only exists in demo mode
 * (ALLOW_DEMO_SWITCHER) — in production this returns an empty list, so no
 * tenant names or emails leak from a real deployment.
 */
export async function GET() {
  if (!demoSwitcherAllowed()) return NextResponse.json({ workspaces: [] });

  const orgs = await db.org.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      name: true,
      users: {
        where: { role: { in: ["MANAGER", "REP"] } },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: { name: true, email: true, role: true, title: true },
      },
    },
  });

  const workspaces = orgs
    .map((org) => {
      const manager = org.users.find((u) => u.role === "MANAGER");
      const rep = org.users.find((u) => u.role === "REP");
      return manager
        ? {
            org: org.name,
            manager: { name: manager.name, email: manager.email, title: manager.title },
            rep: rep ? { name: rep.name, email: rep.email, title: rep.title } : null,
          }
        : null;
    })
    .filter(Boolean);

  return NextResponse.json({ workspaces });
}
