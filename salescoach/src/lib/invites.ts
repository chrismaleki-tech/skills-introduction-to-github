import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { isClerkEnabled } from "./auth-mode";
import { appUrl } from "./stripe";
import { seatSummary, seatLimitFor, seatLimitMessage, MAX_SEATS } from "./seats";

export const ROLES = ["REP", "MANAGER", "TRAINER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];
export const INVITE_TTL_DAYS = 14;
export const JOIN_COOKIE = "erota_join";

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Managers and trainers can bring in reps and peers; only admins mint admins. */
export function canGrantRole(actorRole: string, role: Role) {
  if (actorRole === "ADMIN") return true;
  return role !== "ADMIN";
}

export function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Split a pasted blob (commas, semicolons, whitespace, newlines) into unique valid emails. */
export function parseEmailList(input: string) {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const piece of input.split(/[\s,;<>]+/)) {
    const email = normalizeEmail(piece);
    if (!email) continue;
    if (!EMAIL_RE.test(email)) {
      invalid.push(piece);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    valid.push(email);
  }
  return { valid, invalid };
}

export function inviteLink(token: string) {
  return `${appUrl()}/join/${token}`;
}

type Actor = { id: string; role: string; orgId: string; name: string };

export type CreateInvitesResult = {
  created: { id: string; email: string; token: string; delivery: "email" | "link" }[];
  skipped: { email: string; reason: string }[];
};

/**
 * Create invites for a batch of emails. Seat-checked as a whole so a 50-rep
 * paste either fits or returns one clear message. Email delivery goes through
 * Clerk when configured; the link always works as a fallback.
 */
export async function createInvites(opts: {
  actor: Actor;
  org: Parameters<typeof seatSummary>[0];
  emails: string[];
  role: Role;
}): Promise<CreateInvitesResult & { seatError?: string }> {
  const { actor, org, role } = opts;
  if (!canGrantRole(actor.role, role)) {
    throw new Error("Only an admin can invite another admin.");
  }
  const emails = [...new Set(opts.emails.map(normalizeEmail))].slice(0, MAX_SEATS);
  const skipped: CreateInvitesResult["skipped"] = [];

  const [members, pending] = await Promise.all([
    db.user.findMany({
      where: { email: { in: emails } },
      select: { email: true, orgId: true, removedAt: true },
    }),
    db.invite.findMany({
      where: { orgId: org.id, email: { in: emails }, status: "pending", expiresAt: { gt: new Date() } },
      select: { email: true },
    }),
  ]);
  const memberByEmail = new Map(members.map((m) => [m.email, m]));
  const pendingSet = new Set(pending.map((p) => p.email));

  const toCreate: string[] = [];
  for (const email of emails) {
    const member = memberByEmail.get(email);
    if (member && member.orgId === org.id && !member.removedAt) {
      skipped.push({ email, reason: "Already on your team." });
      continue;
    }
    if (pendingSet.has(email)) {
      skipped.push({ email, reason: "Already invited." });
      continue;
    }
    toCreate.push(email);
  }

  if (toCreate.length === 0) return { created: [], skipped };

  const summary = await seatSummary(org);
  const seatError = seatLimitMessage(summary, toCreate.length);
  if (seatError) return { created: [], skipped, seatError };

  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
  const rows = await db.$transaction(
    toCreate.map((email) =>
      db.invite.create({
        data: { orgId: org.id, email, role, invitedById: actor.id, expiresAt },
        select: { id: true, email: true, token: true },
      }),
    ),
  );

  const created: CreateInvitesResult["created"] = [];
  for (const row of rows) {
    const clerkInvitationId = await sendClerkInvitation(row.email, row.token, {
      orgId: org.id,
      inviteId: row.id,
      invitedBy: actor.name,
    });
    if (clerkInvitationId) {
      await db.invite.update({ where: { id: row.id }, data: { clerkInvitationId } });
    }
    created.push({ ...row, delivery: clerkInvitationId ? "email" : "link" });
  }
  return { created, skipped };
}

/**
 * Ask Clerk to email the invitation. Returns the Clerk invitation id, or null
 * when Clerk is not configured or declined (for example the address already
 * has an account, in which case the join link is the path).
 */
async function sendClerkInvitation(
  email: string,
  token: string,
  metadata: Record<string, string>,
): Promise<string | null> {
  if (!isClerkEnabled() || !process.env.CLERK_SECRET_KEY) return null;
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const invitation = await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: inviteLink(token),
      publicMetadata: metadata,
      notify: true,
      ignoreExisting: true,
      expiresInDays: INVITE_TTL_DAYS,
    });
    return invitation.id;
  } catch {
    return null;
  }
}

export async function revokeInvite(actor: Actor, inviteId: string) {
  const invite = await db.invite.findFirst({ where: { id: inviteId, orgId: actor.orgId } });
  if (!invite) throw new Error("Invite not found.");
  if (invite.status !== "pending") return invite;
  if (invite.clerkInvitationId && isClerkEnabled()) {
    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const client = await clerkClient();
      await client.invitations.revokeInvitation(invite.clerkInvitationId);
    } catch {
      // Already accepted or expired on Clerk's side; local status is what gates access.
    }
  }
  return db.invite.update({ where: { id: invite.id }, data: { status: "revoked" } });
}

/** Extend expiry and re-send the email. Keeps the same link. */
export async function resendInvite(actor: Actor, inviteId: string) {
  const invite = await db.invite.findFirst({ where: { id: inviteId, orgId: actor.orgId } });
  if (!invite || invite.status !== "pending") throw new Error("Invite is no longer pending.");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
  const clerkInvitationId = await sendClerkInvitation(invite.email, invite.token, {
    orgId: invite.orgId,
    inviteId: invite.id,
    invitedBy: actor.name,
  });
  return db.invite.update({
    where: { id: invite.id },
    data: { expiresAt, clerkInvitationId: clerkInvitationId ?? invite.clerkInvitationId },
  });
}

export type JoinTarget =
  | { kind: "invite"; inviteId: string; orgId: string; orgName: string; role: Role; email: string }
  | { kind: "join_code"; orgId: string; orgName: string; role: "REP" }
  | null;

/** Resolve a /join/<token> into either a specific invite or an org join link. */
export async function resolveJoinToken(token: string): Promise<JoinTarget> {
  if (!token || token.length > 64) return null;
  const invite = await db.invite.findUnique({
    where: { token },
    include: { org: { select: { id: true, name: true } } },
  });
  if (invite) {
    if (invite.status !== "pending" || invite.expiresAt.getTime() < Date.now()) return null;
    return {
      kind: "invite",
      inviteId: invite.id,
      orgId: invite.orgId,
      orgName: invite.org.name,
      role: isRole(invite.role) ? invite.role : "REP",
      email: invite.email,
    };
  }
  const org = await db.org.findUnique({ where: { joinCode: token }, select: { id: true, name: true } });
  if (org) return { kind: "join_code", orgId: org.id, orgName: org.name, role: "REP" };
  return null;
}

/**
 * Inside a provisioning transaction: find where a brand-new Clerk user should
 * land. Pending invite by verified email wins; then a join link they followed.
 */
export async function pendingPlacementFor(
  tx: Prisma.TransactionClient,
  email: string,
  joinToken?: string | null,
): Promise<{ orgId: string; role: Role; inviteId: string | null } | null> {
  const invite = await tx.invite.findFirst({
    where: { email: normalizeEmail(email), status: "pending", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (invite) {
    return { orgId: invite.orgId, role: isRole(invite.role) ? invite.role : "REP", inviteId: invite.id };
  }
  if (joinToken) {
    const byToken = await tx.invite.findUnique({ where: { token: joinToken } });
    if (byToken && byToken.status === "pending" && byToken.expiresAt.getTime() > Date.now()) {
      // Link forwarded to a different address than it was sent to; still honor it.
      return { orgId: byToken.orgId, role: isRole(byToken.role) ? byToken.role : "REP", inviteId: byToken.id };
    }
    const org = await tx.org.findUnique({ where: { joinCode: joinToken }, select: { id: true } });
    if (org) return { orgId: org.id, role: "REP", inviteId: null };
  }
  return null;
}

/** Seat check usable inside a transaction (mirrors seatSummary). */
export async function hasSeatFor(tx: Prisma.TransactionClient, orgId: string, inviteId: string | null) {
  const org = await tx.org.findUnique({ where: { id: orgId } });
  if (!org) return false;
  const { limit } = seatLimitFor(org);
  if (limit === null) return true;
  const [members, pending] = await Promise.all([
    tx.user.count({ where: { orgId, removedAt: null } }),
    tx.invite.count({
      where: { orgId, status: "pending", expiresAt: { gt: new Date() }, ...(inviteId ? { id: { not: inviteId } } : {}) },
    }),
  ]);
  // An accepted invite converts its reserved seat into a member, so exclude it.
  return members + pending < limit;
}

export async function markInviteAccepted(tx: Prisma.TransactionClient, inviteId: string, userId: string) {
  await tx.invite.update({
    where: { id: inviteId },
    data: { status: "accepted", acceptedAt: new Date(), acceptedUserId: userId },
  });
}

/**
 * Move an existing signed-in user into another org via invite or join link.
 * Refuses to strand a team by pulling out its only admin.
 */
export async function joinOrgAsExistingUser(userId: string, target: NonNullable<JoinTarget>) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, include: { org: true } });
    if (!user) throw new Error("User not found.");
    if (user.orgId === target.orgId) {
      if (user.removedAt) {
        await tx.user.update({ where: { id: user.id }, data: { removedAt: null, role: target.role } });
      }
      if (target.kind === "invite") await markInviteAccepted(tx, target.inviteId, user.id);
      return { moved: false, orgName: target.orgName };
    }
    if (target.kind === "invite" && normalizeEmail(target.email) !== user.email) {
      throw new Error(`This invite was sent to ${target.email}. Sign in with that address to accept it.`);
    }
    const activeMembers = await tx.user.count({ where: { orgId: user.orgId, removedAt: null } });
    if (activeMembers > 1 && user.role === "ADMIN") {
      const otherAdmins = await tx.user.count({
        where: { orgId: user.orgId, role: "ADMIN", removedAt: null, id: { not: user.id } },
      });
      if (otherAdmins === 0) {
        throw new Error(
          `You are the only admin of ${user.org.name}. Promote another admin there before joining a different team.`,
        );
      }
    }
    const ok = await hasSeatFor(tx, target.orgId, target.kind === "invite" ? target.inviteId : null);
    if (!ok) throw new Error(`${target.orgName} has no open seats right now. Ask your admin to add one.`);

    await tx.user.update({
      where: { id: user.id },
      data: { orgId: target.orgId, role: target.role, removedAt: null },
    });
    if (target.kind === "invite") await markInviteAccepted(tx, target.inviteId, user.id);
    return { moved: true, orgName: target.orgName };
  });
}

/**
 * A removed member signing back in: if someone has re-invited them (or they
 * followed a join link), place them there. Returns the refreshed user or null.
 */
export async function reactivateIfInvited(userId: string, email: string, joinToken?: string | null) {
  return db.$transaction(async (tx) => {
    const placement = await pendingPlacementFor(tx, email, joinToken);
    if (!placement) return null;
    if (!(await hasSeatFor(tx, placement.orgId, placement.inviteId))) return null;
    const user = await tx.user.update({
      where: { id: userId },
      data: { orgId: placement.orgId, role: placement.role, removedAt: null },
      include: { org: true },
    });
    if (placement.inviteId) await markInviteAccepted(tx, placement.inviteId, user.id);
    return user;
  });
}

/** Soft-remove a teammate. Their calls and scores stay attributed to them. */
export async function removeMember(actor: Actor, memberId: string) {
  if (memberId === actor.id) throw new Error("You can't remove yourself. Ask another admin, or delete the workspace.");
  const member = await db.user.findFirst({ where: { id: memberId, orgId: actor.orgId, removedAt: null } });
  if (!member) throw new Error("Member not found.");
  if (member.role === "ADMIN" && actor.role !== "ADMIN") throw new Error("Only an admin can remove another admin.");
  return db.user.update({ where: { id: member.id }, data: { removedAt: new Date() } });
}

export async function changeMemberRole(actor: Actor, memberId: string, role: Role) {
  if (!canGrantRole(actor.role, role)) throw new Error("Only an admin can grant the admin role.");
  const member = await db.user.findFirst({ where: { id: memberId, orgId: actor.orgId, removedAt: null } });
  if (!member) throw new Error("Member not found.");
  if (member.role === "ADMIN" && actor.role !== "ADMIN") throw new Error("Only an admin can change another admin's role.");
  if (member.role === "ADMIN" && role !== "ADMIN") {
    const otherAdmins = await db.user.count({
      where: { orgId: actor.orgId, role: "ADMIN", removedAt: null, id: { not: member.id } },
    });
    if (otherAdmins === 0) throw new Error("Your team needs at least one admin.");
  }
  return db.user.update({ where: { id: member.id }, data: { role } });
}

export async function setJoinLink(orgId: string, enabled: boolean) {
  if (!enabled) {
    return db.org.update({ where: { id: orgId }, data: { joinCode: null }, select: { joinCode: true } });
  }
  const existing = await db.org.findUnique({ where: { id: orgId }, select: { joinCode: true } });
  if (existing?.joinCode) return existing;
  const { randomBytes } = await import("node:crypto");
  const joinCode = `j_${randomBytes(12).toString("base64url")}`;
  return db.org.update({ where: { id: orgId }, data: { joinCode }, select: { joinCode: true } });
}
