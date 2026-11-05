import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { resolveUnmatchedIngest } from "@/lib/unmatched";

export async function GET() {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }
  const items = await db.unmatchedIngest.findMany({
    where: { orgId: user.orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as {
    id?: string;
    action?: "resolve" | "dismiss";
    repId?: string;
  } | null;
  if (!body?.id || !body.action) {
    return NextResponse.json({ error: "id and action required." }, { status: 400 });
  }

  if (body.action === "dismiss") {
    const item = await db.unmatchedIngest.updateMany({
      where: { id: body.id, orgId: user.orgId, status: "PENDING" },
      data: { status: "DISMISSED", resolvedAt: new Date(), resolvedRepId: user.id, note: "Dismissed" },
    });
    return NextResponse.json({ ok: item.count > 0 });
  }

  if (!body.repId) {
    return NextResponse.json({ error: "repId required to resolve." }, { status: 400 });
  }
  try {
    const row = await resolveUnmatchedIngest({
      id: body.id,
      orgId: user.orgId,
      repId: body.repId,
      resolverUserId: user.id,
    });
    return NextResponse.json({ item: row });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Resolve failed." },
      { status: 400 },
    );
  }
}
