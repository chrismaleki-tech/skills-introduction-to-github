import { grantWorkspaceAllowance, runAdminForm } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await req.formData();
  return runAdminForm(id, "Allowance updated. The plan and Stripe subscription were not changed.", (actor) =>
    grantWorkspaceAllowance(actor, id, {
      kind: String(form.get("kind") ?? ""),
      minutes: String(form.get("minutes") ?? ""),
      reason: String(form.get("reason") ?? ""),
      confirm: String(form.get("confirm") ?? ""),
    }),
  );
}
