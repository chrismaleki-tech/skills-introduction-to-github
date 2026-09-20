import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import type { CompanyProfile } from "@/lib/types";

// POST /api/company — upsert the org's CompanyContext with a sanitized CompanyProfile.

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strArr = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const objArr = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null) : [];

function cleanProfile(raw: Record<string, unknown>): CompanyProfile {
  return {
    description: str(raw.description),
    pricingNotes: str(raw.pricingNotes),
    valueProps: strArr(raw.valueProps),
    talkTracks: strArr(raw.talkTracks),
    products: objArr(raw.products)
      .map((p) => ({
        name: str(p.name),
        description: str(p.description),
        idealFor: str(p.idealFor),
        differentiators: strArr(p.differentiators),
      }))
      .filter((p) => p.name || p.description || p.idealFor || p.differentiators.length > 0),
    personas: objArr(raw.personas)
      .map((p) => ({
        title: str(p.title),
        industry: str(p.industry),
        notes: str(p.notes),
        painPoints: strArr(p.painPoints),
      }))
      .filter((p) => p.title || p.industry || p.notes || p.painPoints.length > 0),
    objections: objArr(raw.objections)
      .map((o) => ({ objection: str(o.objection), approvedResponse: str(o.approvedResponse) }))
      .filter((o) => o.objection || o.approvedResponse),
    competitors: objArr(raw.competitors)
      .map((c) => ({ name: str(c.name), positioning: str(c.positioning) }))
      .filter((c) => c.name || c.positioning),
  };
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const profileJson = JSON.stringify(cleanProfile(body));
  await db.companyContext.upsert({
    where: { orgId: user.orgId },
    create: { orgId: user.orgId, profileJson },
    update: { profileJson },
  });
  return NextResponse.json({ ok: true });
}
