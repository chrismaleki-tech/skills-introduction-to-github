// Platform-owner mutations against a disposable database.
// Skipped unless USAGE_TEST_DB=1 and DATABASE_URL are set. Never point this at production.
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { billingAccess } from "../billing";
import { db } from "../db";
import {
  extendWorkspaceTrial,
  grantWorkspaceAllowance,
  restoreWorkspace,
  setComplimentaryAccess,
  setWorkspaceMemberRole,
  suspendWorkspace,
} from "../platform-admin";
import { allowance, meterRoleplaySession, startBlockReason } from "../usage";

const TEST_DB = process.env.USAGE_TEST_DB === "1" && Boolean(process.env.DATABASE_URL);
const DAY = 86_400_000;
const RUN = `p${Date.now().toString(36)}`;
const orgIds: string[] = [];
const actor = { clerkId: `clerk_${RUN}`, email: `owner-${RUN}@example.com` };

describe("platform owner changes (database)", { skip: TEST_DB ? false : "USAGE_TEST_DB=1 and DATABASE_URL not set" }, () => {
  after(async () => {
    if (orgIds.length === 0) return;
    await db.adminAudit.deleteMany({ where: { orgId: { in: orgIds } } });
    await db.roleplaySession.deleteMany({ where: { orgId: { in: orgIds } } });
    await db.scenario.deleteMany({ where: { orgId: { in: orgIds } } });
    await db.user.deleteMany({ where: { orgId: { in: orgIds } } });
    await db.org.deleteMany({ where: { id: { in: orgIds } } });
    await db.$disconnect();
  });

  it("extends a trial, grants minutes, pauses and restores, and records an audit", async () => {
    process.env.ADMIN_EMAILS = `${actor.email},other@example.com`;
    const org = await db.org.create({
      data: {
        name: `Platform ${RUN}`,
        slug: `platform-${RUN}`,
        planStatus: "trialing",
        planKey: "trial",
        trialEndsAt: new Date(Date.now() - DAY),
      },
    });
    orgIds.push(org.id);
    const rep = await db.user.create({
      data: { orgId: org.id, name: "Rep", email: `rep-${RUN}@example.com`, role: "REP" },
    });

    const extended = await extendWorkspaceTrial(actor, org.id, {
      date: new Date(Date.now() + 10 * DAY).toISOString().slice(0, 10),
      reason: "Customer asked for a longer trial",
      confirm: "EXTEND",
    });
    assert.equal(extended.planStatus, "trialing");
    assert.equal(billingAccess(extended).entitled, true);

    const granted = await grantWorkspaceAllowance(actor, org.id, {
      kind: "roleplay",
      minutes: "10",
      reason: "Add ten role play minutes",
      confirm: "GRANT",
    });
    const cap = await allowance(granted, rep.id, "roleplay");
    assert.equal(cap.limitSeconds, 40 * 60);

    const paused = await suspendWorkspace(actor, org.id, { reason: "Pause for a billing review", confirm: "SUSPEND" });
    assert.equal(billingAccess(paused).status, "suspended");
    assert.equal(paused.planStatus, "trialing");
    const block = await startBlockReason(paused, rep.id, "roleplay");
    assert.equal(block?.code, "WORKSPACE_SUSPENDED");
    const scenario = await db.scenario.create({ data: { orgId: org.id, title: "Pause", personaJson: "{}" } });
    const session = await db.roleplaySession.create({
      data: { orgId: org.id, repId: rep.id, scenarioId: scenario.id, meteredAt: new Date(Date.now() - 5000) },
    });
    assert.equal((await meterRoleplaySession(session.id)).endedReason, "workspace_suspended");

    const restored = await restoreWorkspace(actor, org.id, { reason: "Review finished, restore access", confirm: "RESTORE" });
    assert.equal(restored.suspendedAt, null);
    assert.equal(billingAccess(restored).entitled, true);

    const audits = await db.adminAudit.findMany({ where: { orgId: org.id } });
    assert.equal(audits.length, 4);
    assert.equal(audits.every((row) => row.actorEmail === actor.email && row.reason.length >= 8), true);
  });

  it("keeps Stripe fields unchanged when complimentary access is granted", async () => {
    process.env.ADMIN_EMAILS = actor.email;
    const org = await db.org.create({
      data: {
        name: `Comp ${RUN}`,
        slug: `comp-${RUN}`,
        planStatus: "canceled",
        planKey: "pro",
        stripeSubscriptionId: `sub_${RUN}`,
        subscriptionEndsAt: new Date(Date.now() - DAY),
      },
    });
    orgIds.push(org.id);
    const result = await setComplimentaryAccess(actor, org.id, {
      plan: "max",
      date: new Date(Date.now() + 20 * DAY).toISOString().slice(0, 10),
      reason: "Courtesy access after cancellation",
      confirm: "COMP",
    });
    assert.equal(result.org.planKey, "pro");
    assert.equal(result.org.planStatus, "canceled");
    assert.equal(result.org.stripeSubscriptionId, `sub_${RUN}`);
    assert.equal(result.appliesNow, true);
    assert.equal(billingAccess(result.org).status, "comped");
  });

  it("changes a role only inside that workspace and keeps the last admin", async () => {
    process.env.ADMIN_EMAILS = actor.email;
    const [left, right] = await Promise.all([
      db.org.create({ data: { name: `Left ${RUN}`, slug: `left-${RUN}` } }),
      db.org.create({ data: { name: `Right ${RUN}`, slug: `right-${RUN}` } }),
    ]);
    orgIds.push(left.id, right.id);
    const admin = await db.user.create({
      data: { orgId: left.id, name: "Admin", email: `admin-${RUN}@example.com`, role: "ADMIN" },
    });
    const teammate = await db.user.create({
      data: { orgId: left.id, name: "Teammate", email: `team-${RUN}@example.com`, role: "REP" },
    });
    const outsider = await db.user.create({
      data: { orgId: right.id, name: "Outsider", email: `out-${RUN}@example.com`, role: "ADMIN" },
    });

    await assert.rejects(
      () => setWorkspaceMemberRole(actor, left.id, admin.id, { role: "REP", reason: "Try to remove the only admin", confirm: "ROLE" }),
      /at least one Admin/,
    );
    await assert.rejects(
      () => setWorkspaceMemberRole(actor, left.id, outsider.id, { role: "REP", reason: "Cross workspace role change", confirm: "ROLE" }),
      /not a member/,
    );
    await setWorkspaceMemberRole(actor, left.id, teammate.id, { role: "MANAGER", reason: "Promote this teammate", confirm: "ROLE" });

    const [leftAdmin, leftTeammate, rightAdmin] = await Promise.all([
      db.user.findUnique({ where: { id: admin.id } }),
      db.user.findUnique({ where: { id: teammate.id } }),
      db.user.findUnique({ where: { id: outsider.id } }),
    ]);
    assert.equal(leftAdmin?.role, "ADMIN");
    assert.equal(leftAdmin?.orgId, left.id);
    assert.equal(leftTeammate?.role, "MANAGER");
    assert.equal(leftTeammate?.orgId, left.id);
    assert.equal(rightAdmin?.role, "ADMIN");
    assert.equal(rightAdmin?.orgId, right.id);
  });
});
