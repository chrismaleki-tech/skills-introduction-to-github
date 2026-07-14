import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  const accounts = await db.account.findMany({
    where: isManagerRole(user.role) ? { orgId: user.orgId } : { orgId: user.orgId, ownerId: user.id },
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { contacts: true, deals: true, calls: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ accounts });
}

export async function POST(req: Request) {
  const user = await currentUser();
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    domain?: string;
    industry?: string;
    size?: string;
    website?: string;
    notes?: string;
    ownerId?: string | null;
  } | null;
  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const account = await db.account.create({
    data: {
      orgId: user.orgId,
      name,
      domain: body?.domain?.trim() ?? "",
      industry: body?.industry?.trim() ?? "",
      size: body?.size?.trim() ?? "",
      website: body?.website?.trim() ?? "",
      notes: body?.notes?.trim() ?? "",
      ownerId: body?.ownerId || user.id,
    },
  });
  return NextResponse.json({ account });
}
