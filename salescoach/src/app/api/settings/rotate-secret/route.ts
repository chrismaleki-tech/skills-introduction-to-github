import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";

// POST /api/settings/rotate-secret — mint a fresh webhook secret for the org.
// Existing integrations must be updated with the new value.

export async function POST() {
  const user = await currentUser();
  if (!isManagerRole(user.role)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const secret = `whsec_${randomUUID().replace(/-/g, "")}`;
  await db.org.update({ where: { id: user.orgId }, data: { webhookSecret: secret } });
  return NextResponse.json({ ok: true, secret });
}
