import { db } from "./db";

/**
 * Credit a rep's open assignments when they finish qualifying work: a graded
 * role-play against the assigned scenario, or an uploaded call. Keeps the
 * stored doneCount/status in step with what the Assignments page computes live,
 * so My Performance and the rep detail page agree with it.
 */
export async function advanceAssignments(input: {
  repId: string;
  type: "ROLEPLAY" | "UPLOAD_CALLS";
  scenarioId?: string | null;
  at?: Date;
}) {
  const at = input.at ?? new Date();
  const open = await db.assignment.findMany({
    where: {
      assignedToId: input.repId,
      type: input.type,
      status: { not: "COMPLETED" },
      createdAt: { lte: at },
      ...(input.type === "ROLEPLAY" ? { scenarioId: input.scenarioId ?? "__none__" } : {}),
    },
  });
  for (const a of open) {
    const doneCount = a.doneCount + 1;
    const complete = doneCount >= a.targetCount;
    await db.assignment.update({
      where: { id: a.id },
      data: {
        doneCount,
        status: complete ? "COMPLETED" : "IN_PROGRESS",
        completedAt: complete ? at : null,
      },
    });
  }
  return open.length;
}
