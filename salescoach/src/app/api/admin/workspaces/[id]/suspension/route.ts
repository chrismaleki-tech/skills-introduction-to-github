import { restoreWorkspace, runAdminForm, suspendWorkspace } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await req.formData();
  const input = { reason: String(form.get("reason") ?? ""), confirm: String(form.get("confirm") ?? "") };
  if (form.get("intent") === "restore") {
    return runAdminForm(id, "Workspace access restored. The Stripe subscription was not changed.", (actor) =>
      restoreWorkspace(actor, id, input),
    );
  }
  return runAdminForm(id, "Workspace paused. This is not a Stripe cancellation.", (actor) => suspendWorkspace(actor, id, input));
}
