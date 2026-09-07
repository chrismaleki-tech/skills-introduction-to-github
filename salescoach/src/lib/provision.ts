import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { METHODOLOGY_PRESETS } from "./presets";
import { EMPTY_COMPANY_PROFILE } from "./types";
import { markSignupProvisioned, recordSignup, type Attribution } from "./signups";

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
 * Provision a brand-new customer org for a signed-up user.
 * Clones the Discovery preset as their active rubric and creates empty company context.
 * Also advances the SignupEvent funnel to `provisioned`.
 */
export async function provisionOrgForUser(opts: {
  clerkId: string;
  email: string;
  name: string;
  orgName?: string;
  source?: "clerk_webhook" | "first_login" | "invite";
  attribution?: Attribution;
}) {
  await ensureGlobalPresets();

  await recordSignup({
    clerkUserId: opts.clerkId,
    email: opts.email,
    name: opts.name,
    source: opts.source ?? "first_login",
    attribution: opts.attribution,
  });

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

    const displayName = opts.name?.trim() || opts.email.split("@")[0] || "Founder";
    const orgName = opts.orgName?.trim() || `${displayName}'s team`;
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
      await tx.org.update({
        where: { id: org.id },
        data: { activeMethodologyId: cloned.id },
      });
    }

    return tx.user.create({
      data: {
        clerkId: opts.clerkId,
        orgId: org.id,
        email: opts.email.toLowerCase(),
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
