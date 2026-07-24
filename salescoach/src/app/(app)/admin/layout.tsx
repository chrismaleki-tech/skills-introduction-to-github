import { redirect } from "next/navigation";
import { platformAdminOrNull } from "@/lib/platform-admin";
import { AdminTabNav } from "@/components/admin/tab-nav";

/**
 * Platform admin console. Gated on PLATFORM_ADMIN_EMAILS — org-level admins
 * manage their own tenant under /settings; this area is cross-tenant.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await platformAdminOrNull();
  if (!admin) redirect("/");
  return (
    <div>
      <AdminTabNav />
      {children}
    </div>
  );
}
