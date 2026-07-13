import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEAL_STAGES, type DealStage } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  const where = isManagerRole(user.role)
    ? { orgId: user.orgId }
    : { orgId: user.orgId, ownerId: user.id };

  const deals = await db.deal.findMany({
    where,
    include: {
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true, title: true } },
      owner: { select: { id: true, name: true } },
      _count: { select: { calls: true, activities: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
  });
  return NextResponse.json({ deals, stages: DEAL_STAGES });
}

export async function POST(req: Request) {
  const user = await currentUser();
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    stage?: string;
    amount?: number;
    product?: string;
    probability?: number;
    nextStep?: string;
    notes?: string;
    accountId?: string | null;
    contactId?: string | null;
    ownerId?: string | null;
    closeDate?: string | null;
  } | null;

  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const stage = (body?.stage ?? "lead") as DealStage;
  if (!DEAL_STAGES.some((s) => s.key === stage)) {
    return NextResponse.json({ error: "Invalid stage." }, { status: 400 });
  }

  const amount = Math.max(0, Math.round(Number(body?.amount ?? 0)) || 0);
  const probability =
    body?.probability != null
      ? Math.min(100, Math.max(0, Math.round(Number(body.probability))))
      : (DEAL_STAGES.find((s) => s.key === stage)?.probability ?? 10);

  const deal = await db.deal.create({
    data: {
      orgId: user.orgId,
      name,
      stage,
      amount,
      product: body?.product?.trim() ?? "",
      probability,
      nextStep: body?.nextStep?.trim() ?? "",
      notes: body?.notes?.trim() ?? "",
      accountId: body?.accountId || null,
      contactId: body?.contactId || null,
      ownerId: body?.ownerId || user.id,
      closeDate: body?.closeDate ? new Date(body.closeDate) : null,
    },
  });

  await db.activity.create({
    data: {
      orgId: user.orgId,
      dealId: deal.id,
      accountId: deal.accountId,
      contactId: deal.contactId,
      ownerId: user.id,
      type: "NOTE",
      subject: "Deal created",
      body: `Opened in ${stage.replaceAll("_", " ")}` + (amount ? ` at $${amount.toLocaleString()}` : ""),
    },
  });

  return NextResponse.json({ deal });
}
