import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureChartOfAccounts, exportGlCsv, glTrialBalance, postJournal } from "@/lib/erp-deep";
import { currentUser, isManagerRole } from "@/lib/session";

export async function GET(req: Request) {
  const user = await currentUser();
  await ensureChartOfAccounts(user.orgId);
  const url = new URL(req.url);
  if (url.searchParams.get("format") === "csv") {
    const csv = await exportGlCsv(user.orgId);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="gl-export.csv"',
      },
    });
  }

  const [trialBalance, entries, accounts] = await Promise.all([
    glTrialBalance(user.orgId),
    db.journalEntry.findMany({
      where: { orgId: user.orgId },
      include: { lines: { include: { account: true } }, postedBy: { select: { name: true } } },
      orderBy: { postedAt: "desc" },
      take: 40,
    }),
    db.glAccount.findMany({ where: { orgId: user.orgId }, orderBy: { code: "asc" } }),
  ]);
  return NextResponse.json({ trialBalance, entries, accounts });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as {
    memo?: string;
    lines?: Array<{ accountCode: string; debit?: number; credit?: number; memo?: string }>;
  } | null;

  try {
    if (!body?.memo || !body.lines?.length) {
      return NextResponse.json({ error: "memo and lines required." }, { status: 400 });
    }
    const entry = await postJournal({
      orgId: user.orgId,
      userId: user.id,
      memo: body.memo,
      sourceType: "manual",
      lines: body.lines,
    });
    return NextResponse.json({ entry });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 400 });
  }
}
