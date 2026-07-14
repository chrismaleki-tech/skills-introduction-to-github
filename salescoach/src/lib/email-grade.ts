import { db } from "./db";
import { gradeTranscript } from "./grading";
import { parseCompanyProfile, parseDimensions } from "./types";
import { redactPii, parseRetentionPolicy } from "./pii";

/** Grade an outbound CRM email against the active rubric + company talk tracks. */
export async function gradeOutboundEmail(messageId: string) {
  const message = await db.message.findUniqueOrThrow({
    where: { id: messageId },
    include: { conversation: true },
  });
  if (message.direction !== "OUTBOUND") {
    throw new Error("Only outbound emails are graded.");
  }

  const org = await db.org.findUniqueOrThrow({
    where: { id: message.orgId },
    include: { companyContext: true },
  });
  const retention = parseRetentionPolicy(org.retentionPolicyJson);
  const body = retention.redactPiiInEmailBodies ? redactPii(message.body) : message.body;
  const subject = message.subject;

  if (!org.activeMethodologyId) throw new Error("No active methodology configured.");
  const methodology = await db.methodology.findUniqueOrThrow({
    where: { id: org.activeMethodologyId },
  });

  const segments = [
    {
      speaker: "rep" as const,
      startSec: 0,
      endSec: Math.max(5, body.split(/\s+/).length * 0.4),
      text: `Subject: ${subject}\n\n${body}`,
    },
  ];

  const result = await gradeTranscript({
    segments,
    dimensions: parseDimensions(methodology.dimensionsJson),
    company: parseCompanyProfile(org.companyContext?.profileJson ?? "{}"),
    subjectType: "CALL",
    callType: "email",
    scenarioContext:
      "This is an outbound sales email (not a live call). Grade written discovery, clarity, talk-track adherence, and next-step ask.",
  });

  const data = {
    orgId: message.orgId,
    subjectType: "EMAIL",
    methodologyId: methodology.id,
    dimensionScoresJson: JSON.stringify(result.dimensionScores),
    overallScore: result.overallScore,
    band: result.band,
    strengthsJson: JSON.stringify(result.strengths),
    improvementsJson: JSON.stringify(result.improvements),
    summary: result.summary,
    mechanicsJson: JSON.stringify(result.mechanics),
    gradedBy: result.gradedBy,
  };

  await db.grade.upsert({
    where: { messageId: message.id },
    create: { ...data, messageId: message.id },
    update: data,
  });

  await db.activity.create({
    data: {
      orgId: message.orgId,
      dealId: message.conversation.dealId,
      contactId: message.conversation.contactId,
      accountId: message.conversation.accountId,
      ownerId: message.senderId,
      type: "COACHING",
      subject: `Email coaching · ${result.overallScore}/100`,
      body: result.summary,
      score: result.overallScore,
      band: result.band,
      externalRef: `email-grade:${message.id}`,
      occurredAt: message.occurredAt,
    },
  }).catch(() => undefined);

  return result;
}
