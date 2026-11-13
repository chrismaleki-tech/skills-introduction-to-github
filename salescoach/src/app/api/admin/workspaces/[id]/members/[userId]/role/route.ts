import { runAdminForm, setWorkspaceMemberRole } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params;
  const form = await req.formData();
  return runAdminForm(id, "Workspace role updated.", (actor) =>
    setWorkspaceMemberRole(actor, id, userId, {
      role: String(form.get("role") ?? ""),
      reason: String(form.get("reason") ?? ""),
      confirm: String(form.get("confirm") ?? ""),
    }),
  );
}
