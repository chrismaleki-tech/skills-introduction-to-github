import { NextResponse } from "next/server";
import { isManagerRole, loginWithPassword } from "@/lib/session";
import { recordAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = body?.email?.trim() ?? "";
  const password = body?.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  const result = await loginWithPassword(email, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  // Security activity log: successful sign-ins are org-visible audit events.
  await recordAudit({
    actor: result.user,
    action: "USER_LOGIN",
    targetType: "USER",
    targetId: result.user.id,
    orgId: result.user.orgId,
    req,
  });
  return NextResponse.json({
    userId: result.user.id,
    name: result.user.name,
    role: result.user.role,
    redirect: isManagerRole(result.user.role) ? "/dashboard" : "/me",
  });
}
