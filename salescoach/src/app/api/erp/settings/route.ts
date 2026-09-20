import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  const [org, taxCodes, fxRates] = await Promise.all([
    db.org.findUniqueOrThrow({
      where: { id: user.orgId },
      select: { id: true, name: true, baseCurrency: true, defaultTaxCode: true },
    }),
    db.taxCode.findMany({ where: { orgId: user.orgId }, orderBy: { code: "asc" } }),
    db.fxRate.findMany({ where: { orgId: user.orgId }, orderBy: [{ currency: "asc" }, { asOf: "desc" }] }),
  ]);
  return NextResponse.json({ org, taxCodes, fxRates });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as {
    kind?: "org" | "tax" | "fx";
    baseCurrency?: string;
    defaultTaxCode?: string;
    code?: string;
    name?: string;
    ratePercent?: number;
    jurisdiction?: string;
    currency?: string;
    rateToBase?: number;
  } | null;

  try {
    if (body?.kind === "org") {
      const org = await db.org.update({
        where: { id: user.orgId },
        data: {
          ...(body.baseCurrency ? { baseCurrency: body.baseCurrency.toUpperCase() } : {}),
          ...(body.defaultTaxCode ? { defaultTaxCode: body.defaultTaxCode } : {}),
        },
      });
      return NextResponse.json({ org });
    }

    if (body?.kind === "tax") {
      const code = body.code?.trim().toUpperCase();
      const name = body.name?.trim();
      if (!code || !name) return NextResponse.json({ error: "code and name required." }, { status: 400 });
      const taxCode = await db.taxCode.upsert({
        where: { orgId_code: { orgId: user.orgId, code } },
        create: {
          orgId: user.orgId,
          code,
          name,
          ratePercent: Math.max(0, Math.round(Number(body.ratePercent) || 0)),
          jurisdiction: body.jurisdiction?.trim() ?? "",
        },
        update: {
          name,
          ratePercent: Math.max(0, Math.round(Number(body.ratePercent) || 0)),
          jurisdiction: body.jurisdiction?.trim() ?? "",
          active: true,
        },
      });
      return NextResponse.json({ taxCode });
    }

    if (body?.kind === "fx") {
      const currency = body.currency?.trim().toUpperCase();
      if (!currency || body.rateToBase == null) {
        return NextResponse.json({ error: "currency and rateToBase required." }, { status: 400 });
      }
      const fxRate = await db.fxRate.create({
        data: {
          orgId: user.orgId,
          currency,
          rateToBase: Math.max(1, Math.round(Number(body.rateToBase))),
          asOf: new Date(),
        },
      });
      return NextResponse.json({ fxRate });
    }

    return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 400 });
  }
}
