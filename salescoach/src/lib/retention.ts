import { db } from "./db";
import { deleteObject } from "./storage";
import { parseRetentionPolicy } from "./pii";

/** Soft-delete aged call transcripts / audio per org retention policy. */
export async function runRetentionSweep(orgId?: string) {
  const orgs = orgId
    ? [await db.org.findUniqueOrThrow({ where: { id: orgId } })]
    : await db.org.findMany();

  let callsCleared = 0;
  let audioDeleted = 0;

  for (const org of orgs) {
    const policy = parseRetentionPolicy(org.retentionPolicyJson);
    if (policy.retainCallDays > 0) {
      const cutoff = new Date(Date.now() - policy.retainCallDays * 86400000);
      const oldCalls = await db.call.findMany({
        where: {
          orgId: org.id,
          callDate: { lt: cutoff },
          OR: [{ transcript: { isNot: null } }, { audioPath: { not: null } }],
        },
        select: { id: true, audioPath: true },
        take: 200,
      });
      for (const c of oldCalls) {
        await db.transcript.updateMany({
          where: { callId: c.id },
          data: {
            fullText: "[RETAINED_EXPIRED — transcript removed by retention policy]",
            segmentsJson: "[]",
          },
        });
        if (c.audioPath) {
          const deleted = await deleteObject(c.audioPath);
          if (deleted) audioDeleted += 1;
          await db.call.update({
            where: { id: c.id },
            data: { audioPath: null },
          });
        }
        callsCleared += 1;
      }
    }
  }

  return { callsCleared, audioDeleted };
}
