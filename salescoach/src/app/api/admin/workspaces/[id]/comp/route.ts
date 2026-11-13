import { clearComplimentaryAccess, runAdminForm, setComplimentaryAccess } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await req.formData();
  if (form.get("intent") === "clear") {
    return runAdminForm(id, "Complimentary access removed. The Stripe subscription was not changed.", (actor) =>
      clearComplimentaryAccess(actor, id, {
        reason: String(form.get("reason") ?? ""),
        confirm: String(form.get("confirm") ?? ""),
      }),
    );
  }
  return runAdminForm(id, "Complimentary access saved. The Stripe subscription was not changed.", (actor) =>
    setComplimentaryAccess(actor, id, {
      plan: String(form.get("plan") ?? ""),
      date: String(form.get("date") ?? ""),
      reason: String(form.get("reason") ?? ""),
      confirm: String(form.get("confirm") ?? ""),
    }),
  );
}
