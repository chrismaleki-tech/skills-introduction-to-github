import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { isClerkEnabled } from "./auth-mode";
import { isAdminEmail } from "./signups";
import { isRole, type Role } from "./invites";
import { billingAccess, paidSubscriptionEntitled } from "./billing";
import { allowance, allowanceWindow } from "./usage";
import { TRIAL_ALLOWANCE } from "./plans";

export const PAGE_SIZE = 25;
export const FILTERS = ["all", "trialing", "trial_expired", "paying", "suspended", "comped"] as const;
export type WorkspaceFilter = (typeof FILTERS)[number];

const CONFIRM = {
  extend: "EXTEND",
  grant: "GRANT",
  suspend: "SUSPEND",
  restore: "RESTORE",
  role: "ROLE",
  comp: "COMP",
  revokeComp: "REVOKE_COMP",
} as const;

export class PlatformAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformAdminError";
  }
}

const REQUIRED_ORG_COLUMNS = [
  "suspendedAt",
  "suspendedReason",
  "bonusRoleplaySec",
  "bonusCallReviewSec",
  "compPlanKey",
  "compExpiresAt",
  "compReason",
] as const;

/** Hostname and database name only. User, password, and query string are never returned. */
export function databaseIdentity(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) return { host: null as string | null, database: null as string | null };
  try {
    const url = new URL(connectionString);
    const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
    return { host: url.hostname || null, database: database || null };
  } catch {
    return { host: null, database: null };
  }
}

type SchemaClient = Prisma.TransactionClient | typeof db;

/** Read-only check. Does not add columns or write customer data. */
export async function adminSchemaStatus(client: SchemaClient = db) {
  const identity = databaseIdentity();
  try {
    const columns = await client.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Org'
        AND column_name IN (
          'suspendedAt',
          'suspendedReason',
          'bonusRoleplaySec',
          'bonusCallReviewSec',
          'compPlanKey',
          'compExpiresAt',
          'compReason'
        )
    `;
    const audit = await client.$queryRaw<Array<{ present: boolean | string | null }>>`
      SELECT (to_regclass('public."AdminAudit"') IS NOT NULL) AS present
    `;
    const found = new Set(columns.map((row) => row.column_name));
    const missingColumns = REQUIRED_ORG_COLUMNS.filter((name) => !found.has(name));
    const present = audit[0]?.present;
    const auditTable = present === true || present === "t" || present === "true";
    return {
      ready: missingColumns.length === 0 && auditTable,
      missingColumns,
      auditTable,
      host: identity.host,
      database: identity.database,
      reachable: true,
    };
  } catch {
    return {
      ready: false,
      missingColumns: [...REQUIRED_ORG_COLUMNS],
      auditTable: false,
      host: identity.host,
      database: identity.database,
      reachable: false,
    };
  }
}

export type OwnerActor = { clerkId: string; email: string };

/** Exact allowlist match. A workspace role and an email domain never qualify. */
export function isPlatformOwnerEmail(email: string | null | undefined) {
  return isAdminEmail(email);
}

export type ClerkEmailIdentity = {
  emailAddress?: string | null;
  verification?: { status?: string | null } | null;
};

/**
 * The allowlist is compared only to an email Clerk has verified.
 * An unverified address is ignored even when it is typed into ADMIN_EMAILS.
 */
export function platformOwnerEmailFromClerk(input: {
  primary?: ClerkEmailIdentity | null;
  emails?: ClerkEmailIdentity[] | null;
}): { email: string | null; denial: "unverified" | "not_allowlisted" | null } {
  const verified = (input.emails ?? []).filter(
    (entry) => entry.verification?.status === "verified" && entry.emailAddress,
  );
  const primary = input.primary?.verification?.status === "verified" ? input.primary.emailAddress : null;
  const ordered = [...(primary ? [primary] : []), ...verified.map((entry) => entry.emailAddress as string)];
  const seen = new Set<string>();
  for (const raw of ordered) {
    const email = raw.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    if (isPlatformOwnerEmail(email)) return { email, denial: null };
  }
  if (!primary && verified.length === 0) return { email: null, denial: "unverified" };
  const display = (primary ?? verified[0]?.emailAddress ?? "").toLowerCase();
  return { email: display || null, denial: "not_allowlisted" };
}

export function assertAdminReason(reason: string) {
  const trimmed = reason.trim().replace(/\s+/g, " ");
  if (trimmed.length < 8) throw new PlatformAdminError("Enter a reason of at least 8 characters.");
  if (trimmed.length > 500) throw new PlatformAdminError("Keep the reason under 500 characters.");
  return trimmed;
}

export function assertConfirmToken(value: string, expected: string) {
  if (value.trim() !== expected) throw new PlatformAdminError(`Type ${expected} to confirm this change.`);
}

/** End of the given UTC calendar day. The trial or override remains valid through that date. */
export function parseAdminDate(value: string, now = new Date()) {
  const raw = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new PlatformAdminError("Use a date in YYYY-MM-DD form.");
  const date = new Date(`${raw}T23:59:59.000Z`);
  if (Number.isNaN(date.getTime())) throw new PlatformAdminError("That date is not valid.");
  if (date.getTime() <= now.getTime()) throw new PlatformAdminError("Choose a date in the future.");
  if (date.getTime() - now.getTime() > 366 * 2 * 86_400_000) {
    throw new PlatformAdminError("Choose a date within two years.");
  }
  return date;
}

export function parseGrantMinutes(value: string) {
  if (!/^\d+$/.test(value.trim())) throw new PlatformAdminError("Enter a whole number of minutes.");
  const minutes = Number(value.trim());
  if (minutes < 1 || minutes > 10_000) throw new PlatformAdminError("Grant between 1 and 10000 minutes.");
  return minutes;
}

export function demotionRemovesLastAdmin(input: { role: string; next: string; otherAdmins: number }) {
  return input.role === "ADMIN" && input.next !== "ADMIN" && input.otherAdmins < 1;
}

/** The update is scoped to one workspace so a member id from another workspace cannot match. */
export function memberRoleWhere(orgId: string, userId: string, currentRole: string) {
  return { id: userId, orgId, removedAt: null as null, role: currentRole };
}

export type OwnerGate =
  | { ok: true; actor: OwnerActor }
  | { ok: false; status: 401 | 403 | 503; error: string; email?: string };

export async function platformOwnerFromClerk(): Promise<OwnerGate> {
  if (!isClerkEnabled()) {
    return { ok: false, status: 503, error: "Platform admin requires Clerk sign-in." };
  }
  if (!process.env.ADMIN_EMAILS?.trim()) {
    return { ok: false, status: 503, error: "ADMIN_EMAILS is not configured." };
  }
  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) return { ok: false, status: 401, error: "Sign in required." };
  const clerkUser = await currentUser();
  const decision = platformOwnerEmailFromClerk({
    primary: clerkUser?.primaryEmailAddress,
    emails: clerkUser?.emailAddresses,
  });
  if (!decision.email || decision.denial) {
    return {
      ok: false,
      status: 403,
      error:
        decision.denial === "unverified"
          ? "Clerk has not verified an email address for this account."
          : "This account is not a platform owner.",
      email: decision.email ?? undefined,
    };
  }
  return { ok: true, actor: { clerkId: userId, email: decision.email } };
}

export async function requirePlatformOwnerApi() {
  const gate = await platformOwnerFromClerk();
  if (!gate.ok) {
    return { actor: null, response: NextResponse.json({ error: gate.error }, { status: gate.status }) };
  }
  return { actor: gate.actor, response: null };
}

export async function isCurrentUserPlatformOwner() {
  try {
    const gate = await platformOwnerFromClerk();
    return gate.ok;
  } catch {
    return false;
  }
}

export async function requirePlatformOwnerPage() {
  const gate = await platformOwnerFromClerk();
  if (gate.ok) return gate.actor;
  if (gate.status === 401) redirect("/sign-in");
  redirect("/admin/access");
}

function assertActor(actor: OwnerActor) {
  if (!actor.clerkId || !isPlatformOwnerEmail(actor.email)) {
    throw new PlatformAdminError("Not a platform owner.");
  }
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  actor: OwnerActor,
  orgId: string,
  action: string,
  reason: string,
  before: unknown,
  after: unknown,
) {
  await tx.adminAudit.create({
    data: {
      actorClerkId: actor.clerkId,
      actorEmail: actor.email,
      orgId,
      action,
      reason,
      beforeJson: JSON.stringify(before),
      afterJson: JSON.stringify(after),
    },
  });
}

export async function extendWorkspaceTrial(
  actor: OwnerActor,
  orgId: string,
  input: { date: string; reason: string; confirm: string },
) {
  assertActor(actor);
  assertConfirmToken(input.confirm, CONFIRM.extend);
  const reason = assertAdminReason(input.reason);
  const trialEndsAt = parseAdminDate(input.date);
  return db.$transaction(async (tx) => {
    const org = await tx.org.findUnique({ where: { id: orgId } });
    if (!org) throw new PlatformAdminError("Workspace not found.");
    if (org.planStatus !== "trialing" || paidSubscriptionEntitled(org)) {
      throw new PlatformAdminError(
        "This workspace is not on a trial. Extending a date does not change Stripe. Use complimentary access for a lapsed subscription.",
      );
    }
    const before = { trialEndsAt: org.trialEndsAt?.toISOString() ?? null, planStatus: org.planStatus, planKey: org.planKey };
    const updated = await tx.org.update({ where: { id: org.id }, data: { trialEndsAt } });
    await writeAudit(tx, actor, org.id, "trial.extend", reason, before, {
      trialEndsAt: updated.trialEndsAt?.toISOString() ?? null,
      planStatus: updated.planStatus,
      planKey: updated.planKey,
    });
    return updated;
  });
}

export async function grantWorkspaceAllowance(
  actor: OwnerActor,
  orgId: string,
  input: { kind: string; minutes: string; reason: string; confirm: string },
) {
  assertActor(actor);
  assertConfirmToken(input.confirm, CONFIRM.grant);
  const reason = assertAdminReason(input.reason);
  const minutes = parseGrantMinutes(input.minutes);
  const field = input.kind === "roleplay" ? "bonusRoleplaySec" : input.kind === "call_review" ? "bonusCallReviewSec" : null;
  if (!field) throw new PlatformAdminError("Choose AI Role Play or call review.");
  const seconds = minutes * 60;
  return db.$transaction(async (tx) => {
    const org = await tx.org.findUnique({ where: { id: orgId } });
    if (!org) throw new PlatformAdminError("Workspace not found.");
    const before = { bonusRoleplaySec: org.bonusRoleplaySec, bonusCallReviewSec: org.bonusCallReviewSec };
    const updated = await tx.org.update({
      where: { id: org.id },
      data: { [field]: { increment: seconds } },
    });
    await writeAudit(tx, actor, org.id, "allowance.grant", reason, before, {
      bonusRoleplaySec: updated.bonusRoleplaySec,
      bonusCallReviewSec: updated.bonusCallReviewSec,
      grantedKind: input.kind,
      grantedSeconds: seconds,
    });
    return updated;
  });
}

export async function suspendWorkspace(
  actor: OwnerActor,
  orgId: string,
  input: { reason: string; confirm: string },
) {
  assertActor(actor);
  assertConfirmToken(input.confirm, CONFIRM.suspend);
  const reason = assertAdminReason(input.reason);
  return db.$transaction(async (tx) => {
    const org = await tx.org.findUnique({ where: { id: orgId } });
    if (!org) throw new PlatformAdminError("Workspace not found.");
    if (org.suspendedAt) throw new PlatformAdminError("This workspace is already paused.");
    const before = { suspendedAt: null, planStatus: org.planStatus };
    const updated = await tx.org.update({
      where: { id: org.id },
      data: { suspendedAt: new Date(), suspendedReason: reason },
    });
    await writeAudit(tx, actor, org.id, "access.suspend", reason, before, {
      suspendedAt: updated.suspendedAt?.toISOString() ?? null,
      planStatus: updated.planStatus,
    });
    return updated;
  });
}

export async function restoreWorkspace(
  actor: OwnerActor,
  orgId: string,
  input: { reason: string; confirm: string },
) {
  assertActor(actor);
  assertConfirmToken(input.confirm, CONFIRM.restore);
  const reason = assertAdminReason(input.reason);
  return db.$transaction(async (tx) => {
    const org = await tx.org.findUnique({ where: { id: orgId } });
    if (!org) throw new PlatformAdminError("Workspace not found.");
    if (!org.suspendedAt) throw new PlatformAdminError("This workspace is not paused.");
    const before = { suspendedAt: org.suspendedAt.toISOString(), planStatus: org.planStatus };
    const updated = await tx.org.update({
      where: { id: org.id },
      data: { suspendedAt: null, suspendedReason: "" },
    });
    await writeAudit(tx, actor, org.id, "access.restore", reason, before, {
      suspendedAt: null,
      planStatus: updated.planStatus,
    });
    return updated;
  });
}

export async function setComplimentaryAccess(
  actor: OwnerActor,
  orgId: string,
  input: { plan: string; date: string; reason: string; confirm: string },
) {
  assertActor(actor);
  assertConfirmToken(input.confirm, CONFIRM.comp);
  const reason = assertAdminReason(input.reason);
  if (input.plan !== "pro" && input.plan !== "max") throw new PlatformAdminError("Choose Pro or Max.");
  const compExpiresAt = parseAdminDate(input.date);
  return db.$transaction(async (tx) => {
    const org = await tx.org.findUnique({ where: { id: orgId } });
    if (!org) throw new PlatformAdminError("Workspace not found.");
    const before = {
      compPlanKey: org.compPlanKey,
      compExpiresAt: org.compExpiresAt?.toISOString() ?? null,
      planKey: org.planKey,
      planStatus: org.planStatus,
      stripeSubscriptionId: org.stripeSubscriptionId ? "present" : null,
    };
    const updated = await tx.org.update({
      where: { id: org.id },
      data: { compPlanKey: input.plan, compExpiresAt, compReason: reason },
    });
    if (
      updated.planKey !== org.planKey ||
      updated.planStatus !== org.planStatus ||
      updated.stripeSubscriptionId !== org.stripeSubscriptionId
    ) {
      throw new PlatformAdminError("Complimentary access must not change the Stripe subscription.");
    }
    await writeAudit(tx, actor, org.id, "comp.set", reason, before, {
      compPlanKey: updated.compPlanKey,
      compExpiresAt: updated.compExpiresAt?.toISOString() ?? null,
      planKey: updated.planKey,
      planStatus: updated.planStatus,
      appliesNow: !paidSubscriptionEntitled(updated) && !updated.suspendedAt,
    });
    return { org: updated, appliesNow: !paidSubscriptionEntitled(updated) && !updated.suspendedAt };
  });
}

export async function clearComplimentaryAccess(
  actor: OwnerActor,
  orgId: string,
  input: { reason: string; confirm: string },
) {
  assertActor(actor);
  assertConfirmToken(input.confirm, CONFIRM.revokeComp);
  const reason = assertAdminReason(input.reason);
  return db.$transaction(async (tx) => {
    const org = await tx.org.findUnique({ where: { id: orgId } });
    if (!org) throw new PlatformAdminError("Workspace not found.");
    if (!org.compPlanKey && !org.compExpiresAt) throw new PlatformAdminError("No complimentary access is set.");
    const before = { compPlanKey: org.compPlanKey, compExpiresAt: org.compExpiresAt?.toISOString() ?? null };
    const updated = await tx.org.update({
      where: { id: org.id },
      data: { compPlanKey: null, compExpiresAt: null, compReason: "" },
    });
    await writeAudit(tx, actor, org.id, "comp.clear", reason, before, { compPlanKey: null, compExpiresAt: null });
    return updated;
  });
}

export async function setWorkspaceMemberRole(
  actor: OwnerActor,
  orgId: string,
  userId: string,
  input: { role: string; reason: string; confirm: string },
) {
  assertActor(actor);
  assertConfirmToken(input.confirm, CONFIRM.role);
  const reason = assertAdminReason(input.reason);
  if (!isRole(input.role)) throw new PlatformAdminError("Choose a workspace role.");
  const next = input.role as Role;
  return db.$transaction(async (tx) => {
    const member = await tx.user.findFirst({ where: { id: userId, orgId, removedAt: null } });
    if (!member) throw new PlatformAdminError("That person is not a member of this workspace.");
    if (member.role === next) throw new PlatformAdminError("That is already their role.");
    const otherAdmins = await tx.user.count({
      where: { orgId, role: "ADMIN", removedAt: null, id: { not: member.id } },
    });
    if (demotionRemovesLastAdmin({ role: member.role, next, otherAdmins })) {
      throw new PlatformAdminError("A workspace needs at least one Admin. Grant Admin to someone else first.");
    }
    const changed = await tx.user.updateMany({
      where: memberRoleWhere(orgId, member.id, member.role),
      data: { role: next },
    });
    if (changed.count !== 1) throw new PlatformAdminError("Membership changed before this update. Refresh and try again.");
    await writeAudit(
      tx,
      actor,
      orgId,
      "member.role",
      reason,
      { userId: member.id, email: member.email, role: member.role },
      { userId: member.id, email: member.email, role: next },
    );
    return { userId: member.id, role: next };
  });
}

function trialEnd(org: { trialEndsAt: Date | null; createdAt: Date }) {
  return org.trialEndsAt ?? new Date(org.createdAt.getTime() + TRIAL_ALLOWANCE.days * 86_400_000);
}

function payingWhere(now: Date): Prisma.OrgWhereInput {
  return {
    OR: [{ planStatus: "active" }, { planStatus: "canceled", subscriptionEndsAt: { gt: now } }],
  };
}

export function workspaceFilterWhere(filter: WorkspaceFilter, now = new Date()): Prisma.OrgWhereInput | null {
  if (filter === "all") return null;
  if (filter === "suspended") return { suspendedAt: { not: null } };
  if (filter === "paying") return payingWhere(now);
  if (filter === "trialing") {
    const fallbackStart = new Date(now.getTime() - TRIAL_ALLOWANCE.days * 86_400_000);
    return {
      suspendedAt: null,
      planStatus: "trialing",
      OR: [{ trialEndsAt: { gt: now } }, { trialEndsAt: null, createdAt: { gt: fallbackStart } }],
    };
  }
  if (filter === "trial_expired") {
    const fallbackStart = new Date(now.getTime() - TRIAL_ALLOWANCE.days * 86_400_000);
    return {
      suspendedAt: null,
      planStatus: "trialing",
      OR: [{ trialEndsAt: { lte: now } }, { trialEndsAt: null, createdAt: { lte: fallbackStart } }],
    };
  }
  return {
    suspendedAt: null,
    compPlanKey: { in: ["pro", "max"] },
    compExpiresAt: { gt: now },
    NOT: payingWhere(now),
  };
}

export async function platformOverview(now = new Date()) {
  const orgs = await db.org.findMany({
    select: {
      planStatus: true,
      trialEndsAt: true,
      createdAt: true,
      subscriptionEndsAt: true,
      suspendedAt: true,
    },
  });
  const users = await db.user.count({ where: { removedAt: null } });
  let activeTrials = 0;
  let expiredTrials = 0;
  let paying = 0;
  let suspended = 0;
  for (const org of orgs) {
    if (org.suspendedAt) suspended += 1;
    const isPaying = org.planStatus === "active" || Boolean(org.planStatus === "canceled" && org.subscriptionEndsAt && org.subscriptionEndsAt > now);
    if (isPaying) paying += 1;
    if (!org.suspendedAt && org.planStatus === "trialing") {
      if (trialEnd(org) > now) activeTrials += 1;
      else expiredTrials += 1;
    }
  }
  return { workspaces: orgs.length, users, activeTrials, expiredTrials, paying, suspended };
}

const listSelect = {
  id: true,
  name: true,
  slug: true,
  createdAt: true,
  planKey: true,
  planStatus: true,
  trialEndsAt: true,
  subscriptionStartsAt: true,
  subscriptionEndsAt: true,
  stripePriceId: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  suspendedAt: true,
  suspendedReason: true,
  bonusRoleplaySec: true,
  bonusCallReviewSec: true,
  compPlanKey: true,
  compExpiresAt: true,
  users: {
    where: { removedAt: null },
    orderBy: { createdAt: "asc" as const },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  },
} satisfies Prisma.OrgSelect;

export async function listWorkspaces(input: { q: string; filter: WorkspaceFilter; page: number }) {
  const now = new Date();
  const page = Number.isInteger(input.page) && input.page > 0 ? input.page : 1;
  const query = input.q.trim();
  const and: Prisma.OrgWhereInput[] = [];
  const filter = workspaceFilterWhere(input.filter, now);
  if (filter) and.push(filter);
  if (query) {
    and.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { slug: { contains: query, mode: "insensitive" } },
        { id: query },
        { users: { some: { removedAt: null, email: { contains: query, mode: "insensitive" } } } },
      ],
    });
  }
  const where: Prisma.OrgWhereInput = and.length ? { AND: and } : {};
  const [total, orgs] = await Promise.all([
    db.org.count({ where }),
    db.org.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: listSelect,
    }),
  ]);
  const ids = orgs.map((org) => org.id);
  const activity = await lastActivityFor(ids);
  const usage = await Promise.all(
    orgs.map(async (org) => {
      const repId = org.users[0]?.id ?? "none";
      const [roleplay, callReview] = await Promise.all([
        allowance(org, repId, "roleplay", db, now),
        allowance(org, repId, "call_review", db, now),
      ]);
      return { roleplay, callReview };
    }),
  );
  return {
    page,
    pageSize: PAGE_SIZE,
    total,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    workspaces: orgs.map((org, index) => ({
      ...org,
      access: billingAccess(org, now),
      contact: contactFor(org.users),
      lastActivity: activity.get(org.id) ?? null,
      usage: usage[index]!,
    })),
  };
}

function contactFor(users: { name: string; email: string; role: string; createdAt: Date }[]) {
  return users.find((user) => user.role === "ADMIN") ?? users[0] ?? null;
}

async function lastActivityFor(orgIds: string[]) {
  const map = new Map<string, Date>();
  if (orgIds.length === 0) return map;
  const [calls, sessions] = await Promise.all([
    db.call.groupBy({ by: ["orgId"], where: { orgId: { in: orgIds } }, _max: { createdAt: true } }),
    db.roleplaySession.groupBy({ by: ["orgId"], where: { orgId: { in: orgIds } }, _max: { startedAt: true } }),
  ]);
  for (const row of calls) consider(map, row.orgId, row._max.createdAt);
  for (const row of sessions) consider(map, row.orgId, row._max.startedAt);
  return map;
}

function consider(map: Map<string, Date>, orgId: string, value: Date | null) {
  if (!value) return;
  const current = map.get(orgId);
  if (!current || value > current) map.set(orgId, value);
}

export function stripeDashboardLinks(org: { stripeCustomerId: string | null; stripeSubscriptionId: string | null }) {
  return {
    customer: org.stripeCustomerId ? `https://dashboard.stripe.com/customers/${encodeURIComponent(org.stripeCustomerId)}` : null,
    subscription: org.stripeSubscriptionId
      ? `https://dashboard.stripe.com/subscriptions/${encodeURIComponent(org.stripeSubscriptionId)}`
      : null,
  };
}

export async function workspaceDetail(orgId: string) {
  const org = await db.org.findUnique({
    where: { id: orgId },
    include: {
      users: { where: { removedAt: null }, orderBy: [{ role: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!org) return null;
  const now = new Date();
  const window = allowanceWindow(org, now);
  const range = { gte: window.start, ...(window.end ? { lt: window.end } : {}) };
  const [removedMembers, failedCalls, audits, roleplayUsed, callReviewMetered, callReviewLegacy, roleplayByRep, callsByRep] =
    await Promise.all([
      db.user.count({ where: { orgId, removedAt: { not: null } } }),
      db.call.findMany({
        where: { orgId, status: "FAILED" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, createdAt: true, failReason: true, status: true },
      }),
      db.adminAudit.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.roleplaySession.aggregate({ _sum: { durationSec: true }, where: { orgId, startedAt: range } }),
      db.call.aggregate({
        _sum: { meteredSec: true },
        where: {
          orgId,
          meterStatus: { in: ["RESERVED", "SETTLED"] },
          OR: [{ meteredAt: range }, { meteredAt: null, createdAt: range }],
        },
      }),
      db.call.aggregate({
        _sum: { durationSec: true },
        where: { orgId, meterStatus: "NONE", grade: { is: { subjectType: "CALL", createdAt: range } } },
      }),
      db.roleplaySession.groupBy({ by: ["repId"], where: { orgId, startedAt: range }, _sum: { durationSec: true } }),
      db.call.groupBy({
        by: ["repId"],
        where: { orgId, meterStatus: { in: ["RESERVED", "SETTLED"] }, OR: [{ meteredAt: range }, { meteredAt: null, createdAt: range }] },
        _sum: { meteredSec: true },
      }),
    ]);
  const activity = await lastActivityFor([orgId]);
  return {
    org,
    access: billingAccess(org, now),
    window,
    removedMembers,
    failedCalls,
    audits,
    contact: contactFor(org.users),
    lastActivity: activity.get(orgId) ?? null,
    stripe: stripeDashboardLinks(org),
    usage: {
      roleplayUsed: roleplayUsed._sum.durationSec ?? 0,
      callReviewUsed: (callReviewMetered._sum.meteredSec ?? 0) + (callReviewLegacy._sum.durationSec ?? 0),
      roleplayByRep: new Map(roleplayByRep.map((row) => [row.repId, row._sum.durationSec ?? 0])),
      callReviewByRep: new Map(callsByRep.map((row) => [row.repId, row._sum.meteredSec ?? 0])),
    },
    paidEntitled: paidSubscriptionEntitled(org, now),
  };
}

export async function runAdminForm(
  orgId: string,
  success: string,
  action: (actor: OwnerActor) => Promise<unknown>,
) {
  const gate = await platformOwnerFromClerk();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  let message: string | null = null;
  try {
    await action(gate.actor);
  } catch (error) {
    message = error instanceof PlatformAdminError ? error.message : "The change was not saved.";
  }
  const key = message ? "error" : "ok";
  redirect(`/admin/workspaces/${orgId}?${key}=${encodeURIComponent(message ?? success)}`);
}
