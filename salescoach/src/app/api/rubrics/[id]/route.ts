import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import type { RubricDimension, RubricLevel } from "@/lib/types";

// POST /api/rubrics/[id] — update name/description/dimensions of an org-owned rubric.

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function validateDimensions(
  input: unknown,
): { dimensions: RubricDimension[]; error?: never } | { error: string; dimensions?: never } {
  if (!Array.isArray(input)) return { error: "Dimensions must be an array." };
  if (input.length < 3) return { error: "A rubric needs at least 3 dimensions." };
  const out: RubricDimension[] = [];
  const seenKeys = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "object" || raw === null) return { error: "Each dimension must be an object." };
    const d = raw as Record<string, unknown>;
    const key = typeof d.key === "string" ? d.key.trim() : "";
    const name = typeof d.name === "string" ? d.name.trim() : "";
    const description = typeof d.description === "string" ? d.description.trim() : "";
    const weight = typeof d.weight === "number" ? d.weight : NaN;
    if (!key) return { error: "Every dimension needs a key." };
    if (seenKeys.has(key)) return { error: `Duplicate dimension key "${key}".` };
    seenKeys.add(key);
    if (!name) return { error: "Every dimension needs a name." };
    if (!Number.isFinite(weight) || weight <= 0)
      return { error: `Dimension "${name}" needs a weight greater than 0.` };
    if (!Array.isArray(d.levels) || d.levels.length !== 5)
      return { error: `Dimension "${name}" must have exactly 5 level descriptions.` };
    const levels: RubricLevel[] = [];
    for (let i = 0; i < 5; i++) {
      const lvl = d.levels[i] as Record<string, unknown> | null;
      const levelDesc =
        lvl && typeof lvl === "object" && typeof lvl.description === "string" ? lvl.description.trim() : "";
      if (!levelDesc) return { error: `Dimension "${name}" is missing the level ${i + 1} description.` };
      levels.push({ score: i + 1, description: levelDesc });
    }
    out.push({
      key,
      name,
      description,
      weight,
      levels,
      ...(d.companySpecific === true ? { companySpecific: true } : {}),
    });
  }
  return { dimensions: out };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!isManagerRole(user.role)) return fail("Managers only.", 403);

  const rubric = await db.methodology.findUnique({ where: { id } });
  if (!rubric || rubric.isPreset || rubric.orgId !== user.orgId)
    return fail("Rubric not found for your team.", 404);

  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    description?: unknown;
    dimensions?: unknown;
  } | null;
  if (!body) return fail("Invalid JSON body.");

  const data: { name?: string; description?: string; dimensionsJson?: string } = {};
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return fail("Rubric name cannot be empty.");
    data.name = name.slice(0, 120);
  }
  if (body.description !== undefined) {
    data.description = typeof body.description === "string" ? body.description.trim() : "";
  }
  if (body.dimensions !== undefined) {
    const result = validateDimensions(body.dimensions);
    if (result.error) return fail(result.error);
    data.dimensionsJson = JSON.stringify(result.dimensions);
  }
  if (Object.keys(data).length === 0) return fail("Nothing to update.");

  await db.methodology.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
