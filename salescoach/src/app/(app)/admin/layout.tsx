import { redirect } from "next/navigation";
import { consoleActor } from "@/lib/platform-admin";
import { AdminTabNav } from "@/components/admin/tab-nav";

/**
 * Platform admin console — a separate control plane from the product app.
 * Requires a workforce-allowlisted email (PLATFORM_ADMIN_EMAILS full access,
 * PLATFORM_SUPPORT_EMAILS read + impersonate) AND a short-lived elevated
 * session minted by step-up re-authentication at /elevate.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await consoleActor();
  if (!actor) redirect("/");
  if (!actor.elevated) redirect("/elevate?next=/admin");

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <AdminTabNav />
        <div className="text-[11px] text-muted mb-8 shrink-0 text-right">
          <span className="rounded-full border border-line px-2 py-0.5 mr-2">{actor.role}</span>
          elevated · {actor.elevationMinutesLeft}m left
        </div>
      </div>
      {children}
    </div>
  );
}
