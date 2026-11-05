import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const data = body as { name?: unknown; email?: unknown; company?: unknown; source?: unknown };
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const company = typeof data.company === "string" ? data.company.trim() : "";
  const source = typeof data.source === "string" ? data.source.trim().slice(0, 64) : "website";

  if (name.length < 2 || name.length > 120) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return NextResponse.json({ error: "Please enter a valid work email." }, { status: 400 });
  }
  if (company.length > 160) {
    return NextResponse.json({ error: "Company name is too long." }, { status: 400 });
  }

  const lead = await db.lead.create({
    data: { name, email, company, source },
  });

  return NextResponse.json({ ok: true, id: lead.id });
}
