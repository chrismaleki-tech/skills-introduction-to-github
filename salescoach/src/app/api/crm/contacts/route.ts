import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  const contacts = await db.contact.findMany({
    where: isManagerRole(user.role) ? { orgId: user.orgId } : { orgId: user.orgId, ownerId: user.id },
    include: {
      account: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      _count: { select: { deals: true, calls: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ contacts });
}

export async function POST(req: Request) {
  const user = await currentUser();
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    email?: string;
    phone?: string;
    title?: string;
    notes?: string;
    accountId?: string | null;
    ownerId?: string | null;
  } | null;
  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const contact = await db.contact.create({
    data: {
      orgId: user.orgId,
      name,
      email: body?.email?.trim() ?? "",
      phone: body?.phone?.trim() ?? "",
      title: body?.title?.trim() ?? "",
      notes: body?.notes?.trim() ?? "",
      accountId: body?.accountId || null,
      ownerId: body?.ownerId || user.id,
    },
  });
  return NextResponse.json({ contact });
}
