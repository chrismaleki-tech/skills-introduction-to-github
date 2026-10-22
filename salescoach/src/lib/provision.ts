import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { METHODOLOGY_PRESETS } from "./presets";
import { EMPTY_COMPANY_PROFILE } from "./types";
import { markSignupProvisioned, recordSignup, type Attribution } from "./signups";
import { hasSeatFor, markInviteAccepted, pendingPlacementFor } from "./invites";

function slugify(input: string) {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || "workspace";
}

async function uniqueSlug(tx: Prisma.TransactionClient, base: string) {
  const slug = slugify(base);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    const exists = await tx.org.findUnique({ where: { slug: candidate } });
    if (!exists) return candidate;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

/** Ensure global methodology presets exist (idempotent). */
export async function ensureGlobalPresets() {
  for (const preset of METHODOLOGY_PRESETS) {
    const existing = await db.methodology.findFirst({
      where: { isPreset: true, orgId: null, name: preset.name },
    });
    if (existing) continue;
    await db.methodology.create({
      data: {
        name: preset.name,
        description: preset.description,
        isPreset: true,
        orgId: null,
        dimensionsJson: JSON.stringify(preset.dimensions),
      },
    });
  }
}

/**
 * Create a fresh trialing workspace with the Discovery preset cloned as the
 * active rubric and an empty company profile. Used for solo sign-ups and for
 * people who leave a team and want their own space.
 */
export async function createOrgWithDefaults(tx: Prisma.TransactionClient, orgName: string) {
  const slug = await uniqueSlug(tx, orgName);
  const discovery = await tx.methodology.findFirst({
    where: { isPreset: true, orgId: null, name: "Discovery Call Fundamentals" },
  });

  const org = await tx.org.create({
    data: {
      name: orgName,
      slug,
      onboardingComplete: false,
      planStatus: "trialing",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      companyContext: {
        create: { profileJson: JSON.stringify(EMPTY_COMPANY_PROFILE) },
      },
    },
  });

  if (discovery) {
    const cloned = await tx.methodology.create({
      data: {
        orgId: org.id,
        name: discovery.name,
        description: discovery.description,
        isPreset: false,
        dimensionsJson: discovery.dimensionsJson,
      },
    });
    return tx.org.update({
      where: { id: org.id },
      data: { activeMethodologyId: cloned.id },
    });
  }
  return org;
}

/**
 * Provision a signed-up user. Three outcomes, in priority order:
 * 1. Account already exists (by Clerk id, or by verified email) → re-link.
 * 2. A pending invite for the email, or a join link they followed → join that
 *    team in the invited role, no new org.
 * 3. Otherwise a brand-new solo workspace (the B2C path), with them as admin.
 * Also advances the SignupEvent funnel to `provisioned`.
 */
export async function provisionOrgForUser(opts: {
  clerkId: string;
  email: string;
  name: string;
  orgName?: string;
  source?: "clerk_webhook" | "first_login" | "invite";
  attribution?: Attribution;
  /** Token from the `erota_join` cookie (invite token or org join code). */
  joinToken?: string | null;
}) {
  await ensureGlobalPresets();

  await recordSignup({
    clerkUserId: opts.clerkId,
    email: opts.email,
    name: opts.name,
    source: opts.source ?? "first_login",
    attribution: opts.attribution,
  });

  const email = opts.email.toLowerCase();
  const user = await db.$transaction(async (tx) => {
    // Next.js can render a page and its layout in parallel. Serialize initial
    // provisioning per Clerk user so exactly one Org/User is ever created.
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtext(${opts.clerkId}))::text AS acquired
    `;

    const existing = await tx.user.findUnique({
      where: { clerkId: opts.clerkId },
      include: { org: true },
    });
    if (existing) return existing;

    const placement = await pendingPlacementFor(tx, email, opts.joinToken);

    // The same person can arrive with a new Clerk user id (invited seat that was
    // pre-created by email, or a Clerk instance migration). Clerk has verified
    // the address, so re-link the existing account instead of creating a second
    // org and tripping the unique email constraint.
    const byEmail = await tx.user.findUnique({
      where: { email },
      include: { org: true },
    });
    if (byEmail) {
      // A removed teammate who was re-invited comes back into the inviting org.
      const rejoin =
        byEmail.removedAt && placement && (await hasSeatFor(tx, placement.orgId, placement.inviteId));
      const updated = await tx.user.update({
        where: { id: byEmail.id },
        data: rejoin
          ? { clerkId: opts.clerkId, orgId: placement.orgId, role: placement.role, removedAt: null }
          : { clerkId: opts.clerkId },
        include: { org: true },
      });
      if (rejoin && placement.inviteId) await markInviteAccepted(tx, placement.inviteId, updated.id);
      return updated;
    }

    const displayName = opts.name?.trim() || email.split("@")[0] || "Founder";

    if (placement && (await hasSeatFor(tx, placement.orgId, placement.inviteId))) {
      const member = await tx.user.create({
        data: {
          clerkId: opts.clerkId,
          orgId: placement.orgId,
          email,
          name: displayName,
          role: placement.role,
        },
        include: { org: true },
      });
      if (placement.inviteId) await markInviteAccepted(tx, placement.inviteId, member.id);
      return member;
    }

    const orgName = opts.orgName?.trim() || `${displayName}'s team`;
    const org = await createOrgWithDefaults(tx, orgName);

    return tx.user.create({
      data: {
        clerkId: opts.clerkId,
        orgId: org.id,
        email,
        name: displayName,
        role: "ADMIN",
        title: "Founder",
      },
      include: { org: true },
    });
  }, { maxWait: 10_000, timeout: 20_000 });

  await markSignupProvisioned({
    clerkUserId: opts.clerkId,
    orgId: user.orgId,
    userId: user.id,
  });

  return user;
}

/**
 * Give an existing account its own brand-new workspace. Used when someone was
 * removed from a team (or chooses to leave one) and wants to continue solo.
 */
export async function startFreshWorkspace(userId: string) {
  await ensureGlobalPresets();
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found.");
    const org = await createOrgWithDefaults(tx, `${user.name || user.email.split("@")[0]}'s team`);
    return tx.user.update({
      where: { id: user.id },
      data: { orgId: org.id, role: "ADMIN", title: user.title || "Founder", removedAt: null },
      include: { org: true },
    });
  });
}
