import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { parseCustomization, industryConfigOf } from "@/lib/customization";
import { parseCustomValues, sanitizeCustomValues } from "@/lib/industry";

/** PATCH /api/crm/accounts/[id] — update notes and industry/custom fields. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  const existing = await db.account.findFirst({ where: { id, orgId: user.orgId } });
  if (!existing || (!isManagerRole(user.role) && existing.ownerId !== user.id)) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as {
    notes?: string;
    custom?: Record<string, unknown>;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.notes === "string") data.notes = body.notes.trim();
  if (body.custom !== undefined) {
    const industry = industryConfigOf(parseCustomization(user.org.customizationJson));
    const check = sanitizeCustomValues(industry.accountFields, body.custom);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    data.customJson = JSON.stringify({ ...parseCustomValues(existing.customJson), ...check.values });
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const account = await db.account.update({ where: { id }, data });
  return NextResponse.json({ account });
}
