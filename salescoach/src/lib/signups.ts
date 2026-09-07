import { Prisma } from "@prisma/client";
import { db } from "./db";
import {
  type Attribution,
  parseAttributionCookie,
  ATTRIBUTION_COOKIE,
} from "./attribution";

export type { Attribution };
export { parseAttributionCookie, ATTRIBUTION_COOKIE };

async function linkLeadIfAny(email: string) {
  const lead = await db.lead.findFirst({
    where: { email: email.toLowerCase() },
    orderBy: { createdAt: "desc" },
  });
  return lead?.id ?? null;
}

/**
 * Record (or refresh) a signup. Idempotent on clerkUserId.
 * Prefer calling from Clerk `user.created` webhook; first-login is the fallback.
 */
export async function recordSignup(opts: {
  clerkUserId: string;
  email: string;
  name?: string;
  source: "clerk_webhook" | "first_login" | "invite";
  attribution?: Attribution;
}) {
  const email = opts.email.toLowerCase();
  const leadId = await linkLeadIfAny(email);
  const attr = opts.attribution ?? {};

  const existing = await db.signupEvent.findUnique({ where: { clerkUserId: opts.clerkUserId } });
  if (existing) {
    return db.signupEvent.update({
      where: { id: existing.id },
      data: {
        name: opts.name || existing.name,
        email,
        leadId: existing.leadId ?? leadId ?? undefined,
        utmSource: existing.utmSource || attr.utmSource || "",
        utmMedium: existing.utmMedium || attr.utmMedium || "",
        utmCampaign: existing.utmCampaign || attr.utmCampaign || "",
        utmContent: existing.utmContent || attr.utmContent || "",
        utmTerm: existing.utmTerm || attr.utmTerm || "",
        referrer: existing.referrer || attr.referrer || "",
        landingPath: existing.landingPath || attr.landingPath || "",
      },
    });
  }

  try {
    return await db.signupEvent.create({
      data: {
        clerkUserId: opts.clerkUserId,
        email,
        name: opts.name ?? "",
        source: opts.source,
        status: "signed_up",
        leadId: leadId ?? undefined,
        utmSource: attr.utmSource ?? "",
        utmMedium: attr.utmMedium ?? "",
        utmCampaign: attr.utmCampaign ?? "",
        utmContent: attr.utmContent ?? "",
        utmTerm: attr.utmTerm ?? "",
        referrer: attr.referrer ?? "",
        landingPath: attr.landingPath ?? "",
      },
    });
  } catch (error) {
    // Server Components may resolve the layout and page concurrently on the
    // first request. If both attempt to record the same Clerk user, the unique
    // constraint makes one lose; retry as an update instead of failing signup.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return recordSignup(opts);
    }
    throw error;
  }
}

export async function markSignupProvisioned(opts: {
  clerkUserId: string;
  orgId: string;
  userId: string;
}) {
  const existing = await db.signupEvent.findUnique({ where: { clerkUserId: opts.clerkUserId } });
  if (!existing) return null;
  if (existing.status === "activated" || existing.status === "converted") {
    return db.signupEvent.update({
      where: { id: existing.id },
      data: { orgId: opts.orgId, userId: opts.userId, provisionedAt: existing.provisionedAt ?? new Date() },
    });
  }
  return db.signupEvent.update({
    where: { id: existing.id },
    data: {
      orgId: opts.orgId,
      userId: opts.userId,
      status: "provisioned",
      provisionedAt: existing.provisionedAt ?? new Date(),
    },
  });
}

export async function markSignupActivated(clerkUserId: string) {
  const existing = await db.signupEvent.findUnique({ where: { clerkUserId } });
  if (!existing) return null;
  if (existing.status === "activated" || existing.status === "converted") return existing;
  return db.signupEvent.update({
    where: { id: existing.id },
    data: {
      status: "activated",
      activatedAt: new Date(),
      provisionedAt: existing.provisionedAt ?? new Date(),
    },
  });
}

export async function listSignups(limit = 100) {
  return db.signupEvent.findMany({
    orderBy: { signedUpAt: "desc" },
    take: limit,
    include: { org: { select: { id: true, name: true, slug: true, planStatus: true } } },
  });
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const allow = adminEmails();
  if (allow.length === 0) return false;
  return allow.includes(email.toLowerCase());
}
