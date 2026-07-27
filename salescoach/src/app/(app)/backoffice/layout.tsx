import { redirect } from "next/navigation";
import { backofficeActor } from "@/lib/backoffice";
import { BackofficeTabNav } from "@/components/backoffice/tab-nav";

/**
 * Business back office — the customer org's own control plane: team seats,
 * subscription plan & billing preview, org audit trail, and data exports.
 * MANAGER and ADMIN only (the vendor's cross-tenant console lives at /admin).
 */
export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const actor = await backofficeActor();
  if (!actor) redirect("/me");

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <BackofficeTabNav />
        <div className="text-[11px] text-muted mb-8 shrink-0 text-right">
          <span className="rounded-full border border-line px-2 py-0.5">
            {actor.orgAdmin ? "ORG ADMIN" : "MANAGER"}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
