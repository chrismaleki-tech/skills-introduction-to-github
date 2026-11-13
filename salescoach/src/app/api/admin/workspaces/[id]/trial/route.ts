import { extendWorkspaceTrial, runAdminForm } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await req.formData();
  return runAdminForm(id, "Trial end date updated. The Stripe subscription was not changed.", (actor) =>
    extendWorkspaceTrial(actor, id, {
      date: String(form.get("date") ?? ""),
      reason: String(form.get("reason") ?? ""),
      confirm: String(form.get("confirm") ?? ""),
    }),
  );
}
