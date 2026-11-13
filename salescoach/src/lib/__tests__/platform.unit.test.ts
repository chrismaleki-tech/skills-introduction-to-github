import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { billingAccess, billingError, complimentaryAccess, paidSubscriptionEntitled } from "../billing";
import { isClerkEnabled } from "../auth-mode";
import { TRIAL_ALLOWANCE } from "../plans";
import {
  assertAdminReason,
  assertConfirmToken,
  demotionRemovesLastAdmin,
  isPlatformOwnerEmail,
  memberRoleWhere,
  parseAdminDate,
  parseGrantMinutes,
  PlatformAdminError,
  requirePlatformOwnerApi,
  workspaceFilterWhere,
} from "../platform-admin";
import { seatLimitFor } from "../seats";
import { limitSecondsForOrg, resolvedPlanKey } from "../usage";
import { POST as extendTrial } from "../../app/api/admin/workspaces/[id]/trial/route";

const previousAllowlist = process.env.ADMIN_EMAILS;

afterEach(() => {
  if (previousAllowlist === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = previousAllowlist;
});

function org(overrides: Record<string, unknown> = {}) {
  const createdAt = new Date("2026-11-01T00:00:00Z");
  return {
    id: "org_test",
    createdAt,
    planKey: "trial",
    planStatus: "trialing",
    trialEndsAt: new Date("2026-11-20T00:00:00Z"),
    stripePriceId: null as string | null,
    stripeSubscriptionId: null as string | null,
    stripeSeatCount: 1,
    subscriptionStartsAt: null as Date | null,
    subscriptionEndsAt: null as Date | null,
    suspendedAt: null as Date | null,
    suspendedReason: "",
    compPlanKey: null as string | null,
    compExpiresAt: null as Date | null,
    bonusRoleplaySec: 0,
    bonusCallReviewSec: 0,
    ...overrides,
  };
}

describe("platform owner allowlist", () => {
  it("matches the verified email exactly and ignores the domain and workspace role", () => {
    process.env.ADMIN_EMAILS = "owner@example.com, second@example.com";
    assert.equal(isPlatformOwnerEmail("owner@example.com"), true);
    assert.equal(isPlatformOwnerEmail("Second@Example.com"), true);
    assert.equal(isPlatformOwnerEmail("anyone@erota.io"), false);
    assert.equal(isPlatformOwnerEmail("owner@example.com.evil"), false);
    assert.equal(isPlatformOwnerEmail("ADMIN"), false);
    assert.equal(isPlatformOwnerEmail(null), false);
    process.env.ADMIN_EMAILS = "";
    assert.equal(isPlatformOwnerEmail("owner@example.com"), false);
  });

  it("does not authorize anyone when Clerk is off", async () => {
    if (isClerkEnabled()) return;
    const gate = await requirePlatformOwnerApi();
    assert.equal(gate.actor, null);
    assert.equal(gate.response?.status, 503);
    const body = new FormData();
    body.set("date", "2027-01-01");
    body.set("reason", "should not apply");
    body.set("confirm", "EXTEND");
    const response = await extendTrial(new Request("http://local/api/admin/workspaces/org_missing/trial", { method: "POST", body }), {
      params: Promise.resolve({ id: "org_missing" }),
    });
    assert.equal(response.status, 503);
    const payload = (await response.json()) as { error?: string };
    assert.match(payload.error ?? "", /Clerk/);
  });
});

describe("suspension and complimentary access", () => {
  it("pauses an active Stripe subscription without treating it as canceled", () => {
    const paused = org({
      planKey: "pro",
      planStatus: "active",
      stripeSubscriptionId: "sub_123",
      suspendedAt: new Date(),
      suspendedReason: "Billing dispute.",
    });
    const access = billingAccess(paused);
    assert.equal(access.entitled, false);
    assert.equal(access.status, "suspended");
    assert.equal(billingError(paused)?.code, "WORKSPACE_SUSPENDED");
    assert.match(billingError(paused)!.error, /not a subscription cancellation/);
    assert.match(billingError(paused)!.error, /Billing dispute/);
    assert.equal(paused.planStatus, "active");
    assert.equal(seatLimitFor(paused).limit, 0);
  });

  it("entitles complimentary Pro without writing the stored plan", () => {
    const row = org({
      planStatus: "canceled",
      subscriptionEndsAt: new Date("2026-01-01T00:00:00Z"),
      compPlanKey: "pro",
      compExpiresAt: new Date("2027-01-01T00:00:00Z"),
    });
    const access = billingAccess(row, new Date("2026-11-12T00:00:00Z"));
    assert.equal(access.entitled, true);
    assert.equal(access.status, "comped");
    assert.equal(access.compPlanKey, "pro");
    assert.equal(row.planKey, "trial");
    assert.equal(row.planStatus, "canceled");
    assert.equal(seatLimitFor(row).basis, "comp");
    assert.equal(resolvedPlanKey(row, new Date("2026-11-12T00:00:00Z")), "pro");
  });

  it("does not let complimentary access override a paid period", () => {
    const paid = org({
      planKey: "pro",
      planStatus: "active",
      stripePriceId: "price_max_test",
      compPlanKey: "max",
      compExpiresAt: new Date("2027-01-01T00:00:00Z"),
    });
    process.env.STRIPE_MAX_PRICE_ID = "price_max_test";
    const now = new Date("2026-11-12T00:00:00Z");
    assert.equal(paidSubscriptionEntitled(paid, now), true);
    assert.equal(complimentaryAccess(paid, now), null);
    const access = billingAccess(paid, now);
    assert.equal(access.status, "active");
    assert.equal(access.compPlanKey, undefined);
    assert.equal(resolvedPlanKey(paid, now), "max");
    assert.equal(paid.planStatus, "active");
  });
});

describe("allowance grants and admin validation", () => {
  it("adds granted seconds and leaves an unlimited plan unlimited", () => {
    assert.equal(limitSecondsForOrg({ bonusRoleplaySec: 600 }, "trial", "roleplay"), TRIAL_ALLOWANCE.roleplayMinutes * 60 + 600);
    assert.equal(limitSecondsForOrg({ bonusRoleplaySec: 600 }, "enterprise", "roleplay"), null);
    assert.equal(limitSecondsForOrg({ bonusCallReviewSec: -5 }, "trial", "call_review"), TRIAL_ALLOWANCE.callReviewMinutes * 60);
  });

  it("rejects a past trial date, a missing confirmation, and removing the last admin", () => {
    assert.throws(() => parseAdminDate("2020-01-01", new Date("2026-11-12T00:00:00Z")), PlatformAdminError);
    const future = parseAdminDate("2026-12-01", new Date("2026-11-12T00:00:00Z"));
    assert.equal(future.toISOString(), "2026-12-01T23:59:59.000Z");
    assert.throws(() => assertConfirmToken("extend", "EXTEND"), PlatformAdminError);
    assert.equal(assertAdminReason("  customer asked  "), "customer asked");
    assert.equal(parseGrantMinutes("15"), 15);
    assert.throws(() => parseGrantMinutes("0"), PlatformAdminError);
    assert.equal(demotionRemovesLastAdmin({ role: "ADMIN", next: "REP", otherAdmins: 0 }), true);
    assert.equal(demotionRemovesLastAdmin({ role: "ADMIN", next: "REP", otherAdmins: 1 }), false);
    assert.deepEqual(memberRoleWhere("org_a", "user_b", "REP"), { id: "user_b", orgId: "org_a", removedAt: null, role: "REP" });
  });

  it("counts complimentary access only when it is actually in effect", () => {
    const now = new Date("2026-11-12T00:00:00Z");
    const comped = workspaceFilterWhere("comped", now);
    assert.equal(JSON.stringify(comped).includes("\"pro\""), true);
    assert.equal(JSON.stringify(comped).includes("suspendedAt"), true);
    const paying = workspaceFilterWhere("paying", now);
    assert.equal(JSON.stringify(paying).includes("canceled"), true);
  });
});
