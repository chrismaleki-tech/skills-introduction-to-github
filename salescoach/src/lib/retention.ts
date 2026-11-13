import { db } from "./db";
import { deleteAudio } from "./storage";

const BATCH_SIZE = 100;

export async function deleteCall(callId: string, orgId: string) {
  const call = await db.call.findFirst({
    where: { id: callId, orgId },
    select: { id: true, audioPath: true },
  });
  if (!call) return false;
  if (call.audioPath) await deleteAudio(call.audioPath);

  await db.$transaction([
    db.grade.deleteMany({ where: { callId: call.id } }),
    db.transcript.deleteMany({ where: { callId: call.id } }),
    db.call.delete({ where: { id: call.id } }),
  ]);
  return true;
}

export async function runRetention(now = new Date()) {
  const expiredRateLimits = await db.rateLimitBucket.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  const expiredLeads = await db.lead.deleteMany({
    where: { createdAt: { lt: daysBefore(now, 365) } },
  });
  const orgs = await db.org.findMany({
    select: {
      id: true,
      audioRetentionDays: true,
      dataRetentionDays: true,
    },
  });
  let audioDeleted = 0;
  let callsDeleted = 0;
  let roleplaysDeleted = 0;

  for (const org of orgs) {
    const audioBefore = daysBefore(now, org.audioRetentionDays);
    const expiredAudio = await db.call.findMany({
      where: {
        orgId: org.id,
        audioPath: { not: null },
        callDate: { lt: audioBefore },
      },
      select: { id: true, audioPath: true },
      take: BATCH_SIZE,
    });
    for (const call of expiredAudio) {
      if (!call.audioPath) continue;
      await deleteAudio(call.audioPath);
      await db.call.update({
        where: { id: call.id },
        data: { audioPath: null },
      });
      audioDeleted += 1;
    }

    const dataBefore = daysBefore(now, org.dataRetentionDays);
    const expiredCalls = await db.call.findMany({
      where: { orgId: org.id, callDate: { lt: dataBefore } },
      select: { id: true, audioPath: true },
      take: BATCH_SIZE,
    });
    for (const call of expiredCalls) {
      if (call.audioPath) await deleteAudio(call.audioPath);
      await db.$transaction([
        db.grade.deleteMany({ where: { callId: call.id } }),
        db.transcript.deleteMany({ where: { callId: call.id } }),
        db.call.delete({ where: { id: call.id } }),
      ]);
      callsDeleted += 1;
    }

    const expiredRoleplays = await db.roleplaySession.findMany({
      where: { orgId: org.id, startedAt: { lt: dataBefore } },
      select: { id: true },
      take: BATCH_SIZE,
    });
    for (const roleplay of expiredRoleplays) {
      await db.$transaction([
        db.grade.deleteMany({ where: { roleplayId: roleplay.id } }),
        db.roleplaySession.delete({ where: { id: roleplay.id } }),
      ]);
      roleplaysDeleted += 1;
    }
  }

  return {
    audioDeleted,
    callsDeleted,
    roleplaysDeleted,
    leadsDeleted: expiredLeads.count,
    rateLimitBucketsDeleted: expiredRateLimits.count,
  };
}

function daysBefore(now: Date, days: number) {
  return new Date(now.getTime() - Math.max(1, days) * 86_400_000);
}
