import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLANS, TRIAL_ALLOWANCE } from "../plans";
import { billingAccess, billingError } from "../billing";
import {
  allowanceFor,
  allowanceWindow,
  limitSecondsFor,
  meterSecondsForCall,
  TRANSCRIPT_WORDS_PER_MINUTE,
  UsageLimitError,
  usageLimitPayload,
} from "../usage";
import { seatLimitFor, seatLimitMessage, TRIAL_SEAT_LIMIT } from "../seats";

const DAY = 86_400_000;

function trialOrg(overrides: Partial<Parameters<typeof allowanceWindow>[0]> = {}) {
  const createdAt = new Date("2026-11-01T00:00:00Z");
  return {
    id: "org_test",
    createdAt,
    planKey: "trial",
    planStatus: "trialing",
    trialEndsAt: new Date(createdAt.getTime() + TRIAL_ALLOWANCE.days * DAY),
    stripePriceId: null,
    subscriptionStartsAt: null,
    subscriptionEndsAt: null,
    ...overrides,
  };
}

describe("trial plan configuration", () => {
  it("is the single source of truth for the trial", () => {
    assert.equal(TRIAL_ALLOWANCE.days, 14);
    assert.equal(TRIAL_ALLOWANCE.roleplayMinutes, 30);
    assert.equal(TRIAL_ALLOWANCE.callReviewMinutes, 120);
    assert.equal(TRIAL_ALLOWANCE.seats, 5);
    assert.equal(PLANS.trial.trialAllowance, TRIAL_ALLOWANCE);
    assert.equal(TRIAL_SEAT_LIMIT, TRIAL_ALLOWANCE.seats);
    assert.equal(limitSecondsFor("trial", "roleplay"), 30 * 60);
    assert.equal(limitSecondsFor("trial", "call_review"), 120 * 60);
  });

  it("leaves paid plans untouched (per seat, per month)", () => {
    assert.equal(PLANS.pro.pricePerSeat, 55);
    assert.equal(PLANS.max.pricePerSeat, 100);
    assert.equal(limitSecondsFor("pro", "roleplay"), 180 * 60);
    assert.equal(limitSecondsFor("pro", "call_review"), 25 * 60 * 60);
    assert.equal(limitSecondsFor("max", "roleplay"), 480 * 60);
    assert.equal(limitSecondsFor("max", "call_review"), 100 * 60 * 60);
    assert.equal(limitSecondsFor("enterprise", "roleplay"), null);
    assert.equal(PLANS.pro.trialAllowance, undefined);
  });

  it("states the trial terms in the marketing feature list", () => {
    const features = PLANS.trial.features.join(" | ");
    for (const expected of [
      "14-day free trial",
      "30 minutes of AI Role Play",
      "2 hours of call review",
      "Up to 5 seats",
      "Usage shared across your workspace for the full trial",
    ]) {
      assert.ok(features.includes(expected), `missing "${expected}" in ${features}`);
    }
  });
});

describe("allowance windows", () => {
  it("trial: one workspace pool for the whole trial", () => {
    const org = trialOrg();
    const w = allowanceWindow(org, new Date("2026-11-05T00:00:00Z"));
    assert.equal(w.basis, "trial");
    assert.equal(w.scope, "workspace");
    assert.equal(w.start.getTime(), org.createdAt.getTime());
    assert.equal(w.end?.getTime(), org.trialEndsAt?.getTime());
  });

  it("paid: per seat within the billing period", () => {
    process.env.STRIPE_PRO_PRICE_ID = "price_pro_test";
    const org = trialOrg({
      planKey: "pro",
      planStatus: "active",
      stripePriceId: "price_pro_test",
      subscriptionStartsAt: new Date("2026-11-03T00:00:00Z"),
      subscriptionEndsAt: new Date("2026-12-03T00:00:00Z"),
    });
    const w = allowanceWindow(org);
    assert.equal(w.basis, "seat_month");
    assert.equal(w.scope, "seat");
    assert.equal(w.start.toISOString(), "2026-11-03T00:00:00.000Z");
    assert.equal(w.end?.toISOString(), "2026-12-03T00:00:00.000Z");
  });

  it("enterprise: unlimited", () => {
    const w = allowanceWindow(trialOrg({ planKey: "enterprise", planStatus: "active" }));
    assert.equal(w.basis, "unlimited");
    assert.equal(allowanceFor("roleplay", null, 99_999, w).remainingSeconds, null);
  });

  it("remaining never goes negative when prior usage exceeds a new cap", () => {
    const w = allowanceWindow(trialOrg());
    const a = allowanceFor("roleplay", 30 * 60, 45 * 60, w);
    assert.equal(a.usedSeconds, 45 * 60);
    assert.equal(a.remainingSeconds, 0);
  });

  it("exact boundary: using the full allowance leaves zero, one second less leaves one", () => {
    const w = allowanceWindow(trialOrg());
    assert.equal(allowanceFor("roleplay", 1800, 1800, w).remainingSeconds, 0);
    assert.equal(allowanceFor("roleplay", 1800, 1799, w).remainingSeconds, 1);
  });
});

describe("trial expiry", () => {
  it("is enforced by date even with unused minutes", () => {
    const org = trialOrg({ trialEndsAt: new Date(Date.now() - DAY) });
    const access = billingAccess(org);
    assert.equal(access.entitled, false);
    const err = billingError(org);
    assert.equal(err?.code, "TRIAL_EXPIRED");
    assert.match(err!.error, /free trial has ended/);
    assert.equal(err?.billingUrl, "/billing");
  });

  it("keeps the original dates (no restart) and reports days left", () => {
    const org = trialOrg({ trialEndsAt: new Date(Date.now() + 2.5 * DAY) });
    const access = billingAccess(org);
    assert.equal(access.entitled, true);
    assert.equal(access.daysLeft, 3);
    assert.equal(access.trialEndsAt, org.trialEndsAt);
  });
});

describe("call review metering", () => {
  it("meters recordings by stated duration, never processing time", () => {
    const m = meterSecondsForCall({ source: "UPLOAD", durationSec: 25 * 60, hasAudio: true, segments: null });
    assert.deepEqual(m, { seconds: 1500, estimated: false });
  });

  it("trusts provider webhooks' stated duration", () => {
    const segments = Array.from({ length: 200 }, (_, i) => ({ speaker: "rep" as const, startSec: i, endSec: i + 1, text: "one two three four five six seven eight nine ten" }));
    const m = meterSecondsForCall({ source: "WEBHOOK", durationSec: 60, hasAudio: false, segments });
    assert.deepEqual(m, { seconds: 60, estimated: false });
  });

  it("estimates pasted transcripts at 150 wpm and flags them", () => {
    // 1500 words → 10 minutes at the documented pace.
    const words = Array.from({ length: 1500 }, () => "word").join(" ");
    const segments = [{ speaker: "rep" as const, startSec: 0, endSec: 1, text: words }];
    const stated = meterSecondsForCall({ source: "UPLOAD", durationSec: 60, hasAudio: false, segments });
    assert.equal(TRANSCRIPT_WORDS_PER_MINUTE, 150);
    assert.deepEqual(stated, { seconds: 600, estimated: true });
    // A larger stated duration wins; still marked as an estimate because
    // nothing was measured.
    const longer = meterSecondsForCall({ source: "UPLOAD", durationSec: 900, hasAudio: false, segments });
    assert.deepEqual(longer, { seconds: 900, estimated: true });
  });
});

describe("limit errors", () => {
  it("explains an oversized recording without truncating it", () => {
    const err = new UsageLimitError({
      kind: "call_review",
      basis: "trial",
      usedSeconds: 110 * 60,
      limitSeconds: 120 * 60,
      requiredSeconds: 25 * 60,
      periodEnd: null,
    });
    assert.equal(err.remainingSeconds, 600);
    assert.match(err.message, /This recording is 25 min/);
    assert.match(err.message, /10 min of trial call review left/);
    assert.match(err.message, /Upload a recording of 10 min or less, or upgrade/);
    const payload = usageLimitPayload(err);
    assert.equal(payload.code, "CALL_REVIEW_LIMIT_EXCEEDED");
    assert.equal(payload.requiredSeconds, 1500);
    assert.equal(payload.remainingSeconds, 600);
    assert.equal(payload.billingUrl, "/billing");
  });

  it("names the exhausted pool and points at upgrading", () => {
    const err = new UsageLimitError({
      kind: "roleplay",
      basis: "trial",
      usedSeconds: 1800,
      limitSeconds: 1800,
      requiredSeconds: 0,
      periodEnd: null,
    });
    assert.match(err.message, /all 30 min of AI Role Play included in the free trial/);
    assert.match(err.message, /Upgrade to Pro or Max/);
    assert.equal(err.code, "ROLEPLAY_LIMIT_EXCEEDED");
  });

  it("uses monthly wording for paid seats", () => {
    const err = new UsageLimitError({
      kind: "roleplay",
      basis: "seat_month",
      usedSeconds: 180 * 60,
      limitSeconds: 180 * 60,
      requiredSeconds: 0,
      periodEnd: new Date(),
    });
    assert.match(err.message, /monthly AI Role Play allowance of 180 min/);
  });
});

describe("seat limits", () => {
  it("caps trialing workspaces at five seats including pending invites", () => {
    const org = {
      id: "o",
      planKey: "trial",
      planStatus: "trialing",
      trialEndsAt: new Date(Date.now() + DAY),
      createdAt: new Date(),
      subscriptionEndsAt: null,
      stripeSubscriptionId: null,
      stripeSeatCount: 1,
    };
    assert.deepEqual(seatLimitFor(org), { limit: 5, basis: "trial" });
    const summary = { limit: 5, members: 3, pendingInvites: 2, used: 5, available: 0, basis: "trial" as const };
    assert.match(seatLimitMessage(summary, 1)!, /free trial includes 5 seats and 5 are in use/);
    assert.equal(seatLimitMessage({ ...summary, pendingInvites: 1, used: 4, available: 1 }, 1), null);
  });

  it("blocks new seats once the trial has lapsed", () => {
    const org = {
      id: "o",
      planKey: "trial",
      planStatus: "trialing",
      trialEndsAt: new Date(Date.now() - DAY),
      createdAt: new Date(Date.now() - 20 * DAY),
      subscriptionEndsAt: null,
      stripeSubscriptionId: null,
      stripeSeatCount: 1,
    };
    assert.deepEqual(seatLimitFor(org), { limit: 0, basis: "inactive" });
  });

  it("uses the Stripe seat count once subscribed", () => {
    const org = {
      id: "o",
      planKey: "pro",
      planStatus: "active",
      trialEndsAt: null,
      createdAt: new Date(),
      subscriptionEndsAt: new Date(Date.now() + 30 * DAY),
      stripeSubscriptionId: "sub_1",
      stripeSeatCount: 12,
    };
    assert.deepEqual(seatLimitFor(org), { limit: 12, basis: "subscription" });
  });
});
