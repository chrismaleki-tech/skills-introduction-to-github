import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEAL_STAGES, type DealStage } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  const deal = await db.deal.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      account: true,
      contact: true,
      owner: { select: { id: true, name: true, email: true } },
      calls: {
        include: { grade: true, rep: { select: { id: true, name: true } } },
        orderBy: { callDate: "desc" },
        take: 20,
      },
      activities: {
        include: { owner: { select: { id: true, name: true } } },
        orderBy: { occurredAt: "desc" },
        take: 40,
      },
    },
  });
  if (!deal || (!isManagerRole(user.role) && deal.ownerId !== user.id)) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  return NextResponse.json({ deal });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  const existing = await db.deal.findFirst({ where: { id, orgId: user.orgId } });
  if (!existing || (!isManagerRole(user.role) && existing.ownerId !== user.id)) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }

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
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.product === "string") data.product = body.product.trim();
  if (typeof body.nextStep === "string") data.nextStep = body.nextStep.trim();
  if (typeof body.notes === "string") data.notes = body.notes.trim();
  if (body.amount != null) data.amount = Math.max(0, Math.round(Number(body.amount)) || 0);
  if (body.probability != null) {
    data.probability = Math.min(100, Math.max(0, Math.round(Number(body.probability))));
  }
  if (body.accountId !== undefined) data.accountId = body.accountId || null;
  if (body.contactId !== undefined) data.contactId = body.contactId || null;
  if (body.ownerId !== undefined) data.ownerId = body.ownerId || null;
  if (body.closeDate !== undefined) {
    data.closeDate = body.closeDate ? new Date(body.closeDate) : null;
  }
  if (body.stage) {
    const stage = body.stage as DealStage;
    if (!DEAL_STAGES.some((s) => s.key === stage)) {
      return NextResponse.json({ error: "Invalid stage." }, { status: 400 });
    }
    data.stage = stage;
    if (body.probability == null) {
      data.probability = DEAL_STAGES.find((s) => s.key === stage)?.probability ?? existing.probability;
    }
  }

  const deal = await db.deal.update({ where: { id }, data });

  if (body.stage && body.stage !== existing.stage) {
    await db.activity.create({
      data: {
        orgId: user.orgId,
        dealId: deal.id,
        accountId: deal.accountId,
        contactId: deal.contactId,
        ownerId: user.id,
        type: "NOTE",
        subject: `Stage → ${body.stage.replaceAll("_", " ")}`,
        body: `Moved from ${existing.stage.replaceAll("_", " ")} to ${body.stage.replaceAll("_", " ")}.`,
      },
    });
  }

  return NextResponse.json({ deal });
}
