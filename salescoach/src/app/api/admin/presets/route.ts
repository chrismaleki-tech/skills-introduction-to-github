import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireConsole } from "@/lib/platform-admin";
import { METHODOLOGY_PRESETS } from "@/lib/presets";
import { recordAudit } from "@/lib/audit";

/**
 * Global methodology presets live only in the demo seed script, which wipes
 * the database — unusable on a production DB. These endpoints let a platform
 * admin inspect and install the preset library so new tenants have rubrics
 * to clone.
 */

export async function GET() {
  const actor = await requireConsole("SUPPORT");
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const installed = await db.methodology.findMany({
    where: { isPreset: true, orgId: null },
    select: { id: true, name: true, description: true, createdAt: true, _count: { select: { grades: true } } },
    orderBy: { name: "asc" },
  });
  const installedNames = new Set(installed.map((p) => p.name));
  const missing = METHODOLOGY_PRESETS.filter((p) => !installedNames.has(p.name)).map((p) => ({
    name: p.name,
    description: p.description,
    dimensions: p.dimensions.length,
  }));
  return NextResponse.json({ installed, missing });
}

/** POST /api/admin/presets — install any presets missing from the database. */
export async function POST(req: Request) {
  const actor = await requireConsole("ADMIN");
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const installed = await db.methodology.findMany({
    where: { isPreset: true, orgId: null },
    select: { name: true },
  });
  const installedNames = new Set(installed.map((p) => p.name));

  const created: string[] = [];
  for (const preset of METHODOLOGY_PRESETS) {
    if (installedNames.has(preset.name)) continue;
    await db.methodology.create({
      data: {
        name: preset.name,
        description: preset.description,
        isPreset: true,
        dimensionsJson: JSON.stringify(preset.dimensions),
      },
    });
    created.push(preset.name);
  }
  if (created.length) {
    await recordAudit({
      actor: actor.user,
      consoleRole: actor.role,
      action: "PRESETS_INSTALLED",
      targetType: "METHODOLOGY",
      req,
      meta: { created },
    });
  }
  return NextResponse.json({ ok: true, created });
}
