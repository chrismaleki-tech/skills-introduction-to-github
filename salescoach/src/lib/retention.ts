import { db } from "./db";
import { parseRetentionPolicy } from "./pii";

/** Soft-delete aged call transcripts / email bodies per org retention policy. */
export async function runRetentionSweep(orgId?: string) {
  const orgs = orgId
    ? [await db.org.findUniqueOrThrow({ where: { id: orgId } })]
    : await db.org.findMany();

  let callsCleared = 0;
  let emailsCleared = 0;

  for (const org of orgs) {
    const policy = parseRetentionPolicy(org.retentionPolicyJson);
    if (policy.retainCallDays > 0) {
      const cutoff = new Date(Date.now() - policy.retainCallDays * 86400000);
      const oldCalls = await db.call.findMany({
        where: { orgId: org.id, callDate: { lt: cutoff }, transcript: { isNot: null } },
        select: { id: true },
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
        callsCleared += 1;
      }
    }
    if (policy.retainEmailDays > 0) {
      const cutoff = new Date(Date.now() - policy.retainEmailDays * 86400000);
      const result = await db.message.updateMany({
        where: {
          orgId: org.id,
          occurredAt: { lt: cutoff },
          NOT: { body: "[RETAINED_EXPIRED — body removed by retention policy]" },
        },
        data: { body: "[RETAINED_EXPIRED — body removed by retention policy]" },
      });
      emailsCleared += result.count;
    }
  }

  return { callsCleared, emailsCleared };
}
