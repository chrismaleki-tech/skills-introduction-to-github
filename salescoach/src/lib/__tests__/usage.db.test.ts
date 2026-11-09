// Integration tests for trial usage metering against a real Postgres database.
// Skipped unless USAGE_TEST_DB=1 is set; DATABASE_URL must then point at a
// disposable database that has had `prisma db push` applied. Run with
// `npm run test:db` (which sets USAGE_TEST_DB and clears OPENAI_API_KEY so the
// deterministic mock grader is used).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { db } from "../db";
import { TRIAL_ALLOWANCE } from "../plans";
import { METHODOLOGY_PRESETS } from "../presets";
import * as usage from "../usage";
import { processCall } from "../pipeline";
import { seatSummary } from "../seats";
import { hasSeatFor } from "../invites";
import { parseProvidedTranscript } from "../transcription";

const TEST_DB = process.env.USAGE_TEST_DB === "1" && Boolean(process.env.DATABASE_URL);
process.env.STRIPE_PRO_PRICE_ID ??= "price_pro_test";
process.env.STRIPE_MAX_PRICE_ID ??= "price_max_test";

const DAY = 86_400_000;
const RUN = `t${Date.now().toString(36)}`;
const orgIds: string[] = [];

type OrgRow = Awaited<ReturnType<typeof db.org.create>>;

async function makeOrg(opts: { trialEndsAt?: Date; createdAt?: Date; name?: string } = {}) {
  const org = await db.org.create({
    data: {
      name: opts.name ?? `Usage test ${RUN}`,
      slug: `usage-${RUN}-${orgIds.length}`,
      planStatus: "trialing",
      planKey: "trial",
      trialEndsAt: opts.trialEndsAt ?? new Date(Date.now() + 7 * DAY),
      createdAt: opts.createdAt ?? new Date(Date.now() - 7 * DAY),
    },
  });
  orgIds.push(org.id);
  const methodology = await db.methodology.create({
    data: {
      orgId: org.id,
      name: "Test rubric",
      description: "",
      dimensionsJson: JSON.stringify(METHODOLOGY_PRESETS[0].dimensions),
    },
  });
  await db.companyContext.create({ data: { orgId: org.id, profileJson: "{}" } });
  return db.org.update({ where: { id: org.id }, data: { activeMethodologyId: methodology.id } });
}

async function makeUser(org: OrgRow, n: number, role = "REP") {
  return db.user.create({
    data: { orgId: org.id, email: `${RUN}-${org.slug}-${n}@example.test`, name: `User ${n}`, role },
  });
}

async function makeScenario(org: OrgRow) {
  return db.scenario.create({
    data: {
      orgId: org.id,
      title: "Test scenario",
      personaJson: JSON.stringify({ name: "Dana", title: "COO", company: "Acme", industry: "Logistics", personality: "direct", painPoints: [], objections: [] }),
    },
  });
}

async function makeSession(org: OrgRow, repId: string, scenarioId: string, data: Partial<{ durationSec: number; meteredAt: Date | null; status: string; mode: string }> = {}) {
  return db.roleplaySession.create({
    data: {
      orgId: org.id,
      repId,
      scenarioId,
      mode: data.mode ?? "VOICE",
      status: data.status ?? "ACTIVE",
      durationSec: data.durationSec ?? 0,
      meteredAt: data.meteredAt ?? null,
    },
  });
}

async function makeCall(org: OrgRow, repId: string, data: Partial<{ durationSec: number; source: string; audioPath: string | null; meterStatus: string; meteredSec: number }> = {}) {
  return db.call.create({
    data: {
      orgId: org.id,
      repId,
      source: data.source ?? "UPLOAD",
      durationSec: data.durationSec ?? 600,
      audioPath: data.audioPath ?? null,
      status: "INGESTED",
      meterStatus: data.meterStatus ?? "NONE",
      meteredSec: data.meteredSec ?? 0,
    },
  });
}

const TRANSCRIPT = ["REP: Hi, this is Jordan from Meridian — do you have a minute?", "PROSPECT: Go ahead, you've got two.", "REP: What does your team use for routing today?", "PROSPECT: Spreadsheets, mostly."].join("\n");

describe("trial usage metering (database)", { skip: TEST_DB ? false : "USAGE_TEST_DB=1 and DATABASE_URL not set" }, () => {
  before(async () => {
    await db.$queryRaw`SELECT 1`;
  });

  after(async () => {
    if (orgIds.length) {
      await db.grade.deleteMany({ where: { orgId: { in: orgIds } } });
      await db.transcript.deleteMany({ where: { call: { orgId: { in: orgIds } } } });
      await db.call.deleteMany({ where: { orgId: { in: orgIds } } });
      await db.roleplaySession.deleteMany({ where: { orgId: { in: orgIds } } });
      await db.scenario.deleteMany({ where: { orgId: { in: orgIds } } });
      await db.invite.deleteMany({ where: { orgId: { in: orgIds } } });
      await db.user.deleteMany({ where: { orgId: { in: orgIds } } });
      await db.companyContext.deleteMany({ where: { orgId: { in: orgIds } } });
      await db.org.updateMany({ where: { id: { in: orgIds } }, data: { activeMethodologyId: null } });
      await db.methodology.deleteMany({ where: { orgId: { in: orgIds } } });
      await db.org.deleteMany({ where: { id: { in: orgIds } } });
    }
    await db.$disconnect();
  });

  describe("AI Role Play", () => {
    it("shares one pool across workspace members and does not grow with seats", async () => {
      const org = await makeOrg();
      const [a, b, c] = await Promise.all([makeUser(org, 1), makeUser(org, 2), makeUser(org, 3)]);
      const scenario = await makeScenario(org);
      await makeSession(org, a.id, scenario.id, { durationSec: 10 * 60, status: "GRADED" });
      await makeSession(org, b.id, scenario.id, { durationSec: 5 * 60, status: "COMPLETED" });
      await makeSession(org, c.id, scenario.id, { durationSec: 90, status: "ACTIVE" });

      const forA = await usage.allowance(org, a.id, "roleplay");
      const forB = await usage.allowance(org, b.id, "roleplay");
      assert.equal(forA.scope, "workspace");
      assert.equal(forA.usedSeconds, 15 * 60 + 90);
      assert.equal(forA.limitSeconds, TRIAL_ALLOWANCE.roleplayMinutes * 60);
      assert.equal(forA.remainingSeconds, 30 * 60 - (15 * 60 + 90));
      assert.deepEqual(forB, forA, "every member sees the same workspace pool");

      await db.invite.create({ data: { orgId: org.id, email: `${RUN}-new@example.test`, role: "REP", invitedById: a.id, expiresAt: new Date(Date.now() + DAY) } });
      const afterInvite = await usage.allowance(org, a.id, "roleplay");
      assert.equal(afterInvite.limitSeconds, forA.limitSeconds, "inviting does not multiply the allowance");
    });

    it("charges the capped liveness gap, not setup time", async () => {
      const org = await makeOrg();
      const rep = await makeUser(org, 1);
      const scenario = await makeScenario(org);
      const session = await makeSession(org, rep.id, scenario.id, { meteredAt: null });

      // First signal (token mint): nothing elapsed yet, nothing charged.
      const t0 = new Date();
      const first = await usage.meterRoleplaySession(session.id, { now: t0 });
      assert.equal(first.chargedSec, 0);
      assert.equal(first.durationSec, 0);

      // 15 s heartbeat → 15 s charged.
      const second = await usage.meterRoleplaySession(session.id, { now: new Date(t0.getTime() + 15_000) });
      assert.equal(second.chargedSec, 15);

      // A 10-minute gap (closed tab) is capped at the voice max gap.
      const third = await usage.meterRoleplaySession(session.id, { now: new Date(t0.getTime() + 15_000 + 600_000) });
      assert.equal(third.chargedSec, usage.ROLEPLAY_MAX_GAP_SECONDS.VOICE);
      assert.equal(third.durationSec, 15 + usage.ROLEPLAY_MAX_GAP_SECONDS.VOICE);
      assert.equal(third.endedReason, null);
    });

    it("is idempotent for duplicate callbacks and multiple tabs", async () => {
      const org = await makeOrg();
      const rep = await makeUser(org, 1);
      const scenario = await makeScenario(org);
      const t0 = new Date();
      const session = await makeSession(org, rep.id, scenario.id, { meteredAt: t0 });
      const at = new Date(t0.getTime() + 20_000);
      const results = await Promise.all([
        usage.meterRoleplaySession(session.id, { now: at }),
        usage.meterRoleplaySession(session.id, { now: at }),
        usage.meterRoleplaySession(session.id, { now: at }),
      ]);
      const total = results.reduce((n, r) => n + r.chargedSec, 0);
      assert.equal(total, 20, "the same 20 seconds are charged once across three concurrent heartbeats");
      const row = await db.roleplaySession.findUniqueOrThrow({ where: { id: session.id } });
      assert.equal(row.durationSec, 20);

      // Ending twice charges nothing extra and keeps the session completed.
      const end1 = await usage.meterRoleplaySession(session.id, { now: new Date(at.getTime() + 5_000), final: true });
      const end2 = await usage.meterRoleplaySession(session.id, { now: new Date(at.getTime() + 60_000), final: true });
      assert.equal(end1.chargedSec, 5);
      assert.equal(end1.status, "COMPLETED");
      assert.equal(end2.chargedSec, 0);
      assert.equal(end2.durationSec, 25);
    });

    it("coordinates concurrent sessions against the shared remainder and never overshoots", async () => {
      const org = await makeOrg();
      const scenario = await makeScenario(org);
      const reps = await Promise.all([1, 2, 3, 4, 5].map((n) => makeUser(org, n)));
      const limit = TRIAL_ALLOWANCE.roleplayMinutes * 60;
      // Leave exactly 100 s in the pool, then have five live sessions each try
      // to charge a 40 s heartbeat at the same instant (200 s of demand).
      await makeSession(org, reps[0].id, scenario.id, { durationSec: limit - 100, status: "GRADED" });
      const t0 = new Date();
      const live = await Promise.all(reps.map((r) => makeSession(org, r.id, scenario.id, { meteredAt: t0 })));
      const at = new Date(t0.getTime() + 40_000);
      const results = await Promise.all(live.map((s) => usage.meterRoleplaySession(s.id, { now: at })));

      const charged = results.reduce((n, r) => n + r.chargedSec, 0);
      assert.equal(charged, 100, "total charged equals exactly the remaining pool");
      const pool = await usage.allowance(org, reps[0].id, "roleplay");
      assert.equal(pool.usedSeconds, limit);
      assert.equal(pool.remainingSeconds, 0);
      const ended = results.filter((r) => r.endedReason === "allowance_exhausted");
      assert.ok(ended.length >= 1, "the session that drained the pool was ended");
      assert.ok(results.every((r) => r.remainingSeconds !== null && r.remainingSeconds >= 0));

      // Nothing new may start, and a later heartbeat on a survivor ends it at zero charge.
      await assert.rejects(usage.assertUsageAvailable(org, reps[1].id, "roleplay", 0), usage.UsageLimitError);
      const survivor = results.find((r) => r.endedReason === null);
      if (survivor) {
        const next = await usage.meterRoleplaySession(survivor.sessionId, { now: new Date(at.getTime() + 15_000) });
        assert.equal(next.chargedSec, 0);
        assert.equal(next.endedReason, "allowance_exhausted");
        assert.equal(next.status, "COMPLETED");
      }
    });

    it("stops exactly at the boundary: the last second is charged, the next is refused", async () => {
      const org = await makeOrg();
      const rep = await makeUser(org, 1);
      const scenario = await makeScenario(org);
      const limit = TRIAL_ALLOWANCE.roleplayMinutes * 60;
      await makeSession(org, rep.id, scenario.id, { durationSec: limit - 1, status: "GRADED" });
      const ok = await usage.assertUsageAvailable(org, rep.id, "roleplay", 0);
      assert.equal(ok.remainingSeconds, 1);

      const t0 = new Date();
      const session = await makeSession(org, rep.id, scenario.id, { meteredAt: t0 });
      const r = await usage.meterRoleplaySession(session.id, { now: new Date(t0.getTime() + 10_000) });
      assert.equal(r.chargedSec, 1);
      assert.equal(r.endedReason, "allowance_exhausted");
      assert.equal(r.status, "COMPLETED");
      assert.equal((await usage.allowance(org, rep.id, "roleplay")).remainingSeconds, 0);
      await assert.rejects(usage.assertUsageAvailable(org, rep.id, "roleplay", 0), /all 30 min of AI Role Play/);
      const block = await usage.startBlockReason(org, rep.id, "roleplay");
      assert.equal(block?.code, "ROLEPLAY_LIMIT_EXCEEDED");
      // Call review is untouched by the role-play pool running dry.
      assert.equal((await usage.allowance(org, rep.id, "call_review")).remainingSeconds, TRIAL_ALLOWANCE.callReviewMinutes * 60);
      assert.equal(await usage.startBlockReason(org, rep.id, "call_review"), null);
    });

    it("ends a session when the trial expires mid-call, keeping the trial dates", async () => {
      const trialEndsAt = new Date(Date.now() + 1_000);
      const org = await makeOrg({ trialEndsAt });
      const rep = await makeUser(org, 1);
      const scenario = await makeScenario(org);
      const t0 = new Date();
      const session = await makeSession(org, rep.id, scenario.id, { meteredAt: t0 });
      assert.equal((await usage.meterRoleplaySession(session.id, { now: t0 })).endedReason, null);

      await new Promise((r) => setTimeout(r, 1_200));
      const r = await usage.meterRoleplaySession(session.id, { now: new Date(t0.getTime() + 1_200) });
      assert.equal(r.endedReason, "trial_expired");
      assert.equal(r.status, "COMPLETED");
      assert.equal(r.chargedSec, 1, "the second that elapsed is charged, nothing after the end");
      const fresh = await db.org.findUniqueOrThrow({ where: { id: org.id } });
      assert.equal(fresh.trialEndsAt?.getTime(), trialEndsAt.getTime(), "expiry is not moved");
      const block = await usage.startBlockReason(fresh, rep.id, "roleplay");
      assert.equal(block?.code, "TRIAL_EXPIRED");
    });
  });

  describe("call review", () => {
    it("reserves before processing, settles on success, and never charges a retry twice", async () => {
      const org = await makeOrg();
      const rep = await makeUser(org, 1);
      const call = await makeCall(org, rep.id, { durationSec: 600 });

      const r1 = await usage.reserveCallReview(call.id, { seconds: 600, estimated: false });
      assert.ok(r1.reserved && !r1.alreadyHeld);
      const held = await usage.allowance(org, rep.id, "call_review");
      assert.equal(held.usedSeconds, 600, "a reservation already counts against the pool");

      // Duplicate job / retry while in flight: same reservation, no new charge.
      const r2 = await usage.reserveCallReview(call.id, { seconds: 600, estimated: false });
      assert.ok(r2.reserved && r2.alreadyHeld);
      assert.equal((await usage.allowance(org, rep.id, "call_review")).usedSeconds, 600);

      await usage.settleCallReview(call.id);
      const settled = await db.call.findUniqueOrThrow({ where: { id: call.id } });
      assert.equal(settled.meterStatus, "SETTLED");
      assert.ok(settled.meteredAt);

      // Re-grading a settled call is free.
      const r3 = await usage.reserveCallReview(call.id, { seconds: 600, estimated: false });
      assert.ok(r3.reserved && r3.alreadyHeld);
      assert.equal((await usage.allowance(org, rep.id, "call_review")).usedSeconds, 600);
    });

    it("releases the reservation when processing fails, then charges a successful retry once", async () => {
      const org = await makeOrg();
      const rep = await makeUser(org, 1);
      const call = await makeCall(org, rep.id, { durationSec: 300 });
      const r = await usage.reserveCallReview(call.id, { seconds: 300, estimated: false });
      assert.ok(r.reserved);
      await usage.releaseCallReview(call.id);
      assert.equal((await usage.allowance(org, rep.id, "call_review")).usedSeconds, 0);
      assert.equal((await db.call.findUniqueOrThrow({ where: { id: call.id } })).meterStatus, "RELEASED");

      const again = await usage.reserveCallReview(call.id, { seconds: 300, estimated: false });
      assert.ok(again.reserved && !again.alreadyHeld);
      assert.equal((await usage.allowance(org, rep.id, "call_review")).usedSeconds, 300);
    });

    it("refuses an oversized recording with the exact shortfall instead of truncating", async () => {
      const org = await makeOrg();
      const rep = await makeUser(org, 1);
      const limit = TRIAL_ALLOWANCE.callReviewMinutes * 60;
      await makeCall(org, rep.id, { durationSec: limit - 600, meterStatus: "SETTLED", meteredSec: limit - 600 });
      const big = await makeCall(org, rep.id, { durationSec: 25 * 60 });
      const r = await usage.reserveCallReview(big.id, { seconds: 25 * 60, estimated: false });
      assert.equal(r.reserved, false);
      if (!r.reserved) {
        assert.equal(r.error.remainingSeconds, 600);
        assert.equal(r.error.requiredSeconds, 1500);
        assert.match(r.error.message, /25 min/);
        assert.match(r.error.message, /10 min/);
      }
      assert.equal((await db.call.findUniqueOrThrow({ where: { id: big.id } })).meterStatus, "NONE");
      // Exactly the remainder fits.
      const fits = await makeCall(org, rep.id, { durationSec: 600 });
      const ok = await usage.reserveCallReview(fits.id, { seconds: 600, estimated: false });
      assert.ok(ok.reserved);
      assert.equal((await usage.allowance(org, rep.id, "call_review")).remainingSeconds, 0);
      // And now even one second is refused.
      const one = await makeCall(org, rep.id, { durationSec: 1 });
      assert.equal((await usage.reserveCallReview(one.id, { seconds: 1, estimated: false })).reserved, false);
    });

    it("counts shared usage across members and legacy graded calls", async () => {
      const org = await makeOrg();
      const [a, b] = await Promise.all([makeUser(org, 1), makeUser(org, 2)]);
      await makeCall(org, a.id, { durationSec: 1200, meterStatus: "SETTLED", meteredSec: 1200 });
      await makeCall(org, b.id, { durationSec: 900, meterStatus: "RESERVED", meteredSec: 900 });
      await makeCall(org, b.id, { durationSec: 999, meterStatus: "RELEASED", meteredSec: 999 });
      // Graded before metering existed: meterStatus NONE but a Grade row.
      const legacy = await makeCall(org, a.id, { durationSec: 300 });
      await db.grade.create({
        data: {
          orgId: org.id,
          subjectType: "CALL",
          callId: legacy.id,
          methodologyId: org.activeMethodologyId!,
          dimensionScoresJson: "[]",
          overallScore: 70,
          band: "strong",
        },
      });
      // Never reviewed: not charged.
      await makeCall(org, b.id, { durationSec: 5000 });

      const pool = await usage.allowance(org, b.id, "call_review");
      assert.equal(pool.usedSeconds, 1200 + 900 + 300);
    });

    it("runs the pipeline end to end: pasted transcript is estimated, settled, and visible on the call", async () => {
      const org = await makeOrg();
      const rep = await makeUser(org, 1);
      const call = await makeCall(org, rep.id, { durationSec: 60 });
      await processCall(call.id, { providedTranscript: TRANSCRIPT });
      const done = await db.call.findUniqueOrThrow({ where: { id: call.id }, include: { grade: true } });
      assert.equal(done.status, "GRADED");
      assert.ok(done.grade);
      assert.equal(done.meterStatus, "SETTLED");
      assert.equal(done.meterEstimated, true);
      const words = usage.transcriptWordCount(parseProvidedTranscript(TRANSCRIPT));
      assert.equal(done.meteredSec, Math.max(60, Math.round((words / usage.TRANSCRIPT_WORDS_PER_MINUTE) * 60)));

      // Processing it again (manager re-grade) does not charge again.
      const before = (await usage.allowance(org, rep.id, "call_review")).usedSeconds;
      await processCall(call.id);
      assert.equal((await usage.allowance(org, rep.id, "call_review")).usedSeconds, before);
    });

    it("pipeline failure releases the reservation and marks the call FAILED", async () => {
      const org = await makeOrg();
      const rep = await makeUser(org, 1);
      const call = await makeCall(org, rep.id, { durationSec: 240 });
      // An empty transcript makes processing fail after the reservation.
      await assert.rejects(processCall(call.id, { providedTranscript: "nothing parseable here" }), /Empty transcript/);
      const failed = await db.call.findUniqueOrThrow({ where: { id: call.id } });
      assert.equal(failed.status, "FAILED");
      assert.equal(failed.meterStatus, "RELEASED");
      assert.equal((await usage.allowance(org, rep.id, "call_review")).usedSeconds, 0);
    });

    it("pipeline refuses when the pool is exhausted and leaves the recording untouched", async () => {
      const org = await makeOrg();
      const rep = await makeUser(org, 1);
      const limit = TRIAL_ALLOWANCE.callReviewMinutes * 60;
      await makeCall(org, rep.id, { durationSec: limit, meterStatus: "SETTLED", meteredSec: limit });
      const call = await makeCall(org, rep.id, { durationSec: 120, audioPath: "s3:fake" });
      await assert.rejects(processCall(call.id, { providedTranscript: TRANSCRIPT }), usage.UsageLimitError);
      const row = await db.call.findUniqueOrThrow({ where: { id: call.id }, include: { transcript: true } });
      assert.equal(row.status, "FAILED");
      assert.equal(row.meterStatus, "NONE");
      assert.equal(row.audioPath, "s3:fake");
      assert.match(row.failReason ?? "", /all 120 min of call review/);
    });
  });

  describe("seats", () => {
    it("enforces five seats including pending invitations", async () => {
      const org = await makeOrg();
      const admin = await makeUser(org, 1, "ADMIN");
      await Promise.all([makeUser(org, 2), makeUser(org, 3)]);
      for (const n of [1, 2]) {
        await db.invite.create({ data: { orgId: org.id, email: `${RUN}-${org.slug}-inv${n}@example.test`, role: "REP", invitedById: admin.id, expiresAt: new Date(Date.now() + DAY) } });
      }
      const summary = await seatSummary(org);
      assert.equal(summary.limit, TRIAL_ALLOWANCE.seats);
      assert.equal(summary.members, 3);
      assert.equal(summary.pendingInvites, 2);
      assert.equal(summary.available, 0);
      await db.$transaction(async (tx) => {
        assert.equal(await hasSeatFor(tx, org.id, null), false, "join link is refused at the cap");
        const invite = await tx.invite.findFirstOrThrow({ where: { orgId: org.id } });
        assert.equal(await hasSeatFor(tx, org.id, invite.id), true, "accepting a pending invite converts its own seat");
      });
      const status = await usage.trialStatus(org);
      assert.equal(status?.seats.used, 5);
      assert.equal(status?.seats.limit, 5);
    });
  });

  describe("existing trial workspaces", () => {
    it("applies the caps to prior usage without touching dates; over-use shows zero remaining", async () => {
      const createdAt = new Date(Date.now() - 10 * DAY);
      const trialEndsAt = new Date(createdAt.getTime() + TRIAL_ALLOWANCE.days * DAY);
      const org = await makeOrg({ createdAt, trialEndsAt });
      const rep = await makeUser(org, 1);
      const scenario = await makeScenario(org);
      await makeSession(org, rep.id, scenario.id, { durationSec: 45 * 60, status: "GRADED" });
      await makeCall(org, rep.id, { durationSec: 20 * 60, meterStatus: "SETTLED", meteredSec: 20 * 60 });

      const status = await usage.trialStatus(org);
      assert.ok(status);
      assert.equal(status.active, true);
      assert.equal(status.daysLeft, 4);
      assert.equal(status.trialEndsAt?.getTime(), trialEndsAt.getTime());
      assert.equal(status.roleplay.usedSeconds, 45 * 60);
      assert.equal(status.roleplay.remainingSeconds, 0, "over-use shows zero, not negative");
      assert.equal(status.callReview.remainingSeconds, 100 * 60, "the other pool keeps working");
      await assert.rejects(usage.assertUsageAvailable(org, rep.id, "roleplay", 0), usage.UsageLimitError);
      assert.equal(await usage.startBlockReason(org, rep.id, "call_review"), null);
    });
  });

  describe("upgrades and paid plans", () => {
    it("switches to per-seat monthly allowances on activation and drops trial restrictions", async () => {
      const org = await makeOrg();
      const [a, b] = await Promise.all([makeUser(org, 1), makeUser(org, 2)]);
      const scenario = await makeScenario(org);
      // Trial fully used up by rep A.
      await makeSession(org, a.id, scenario.id, { durationSec: TRIAL_ALLOWANCE.roleplayMinutes * 60, status: "GRADED" });
      assert.equal((await usage.allowance(org, b.id, "roleplay")).remainingSeconds, 0);

      // Stripe webhook outcome: active Pro subscription, period starting now.
      const periodStart = new Date();
      const paid = await db.org.update({
        where: { id: org.id },
        data: {
          planStatus: "active",
          planKey: "pro",
          stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
          stripeSubscriptionId: `sub_${RUN}_${org.slug}`,
          stripeSeatCount: 5,
          subscriptionStartsAt: periodStart,
          subscriptionEndsAt: new Date(periodStart.getTime() + 30 * DAY),
        },
      });

      assert.equal(await usage.trialStatus(paid), null, "trial card disappears");
      const forB = await usage.allowance(paid, b.id, "roleplay");
      assert.equal(forB.basis, "seat_month");
      assert.equal(forB.scope, "seat");
      assert.equal(forB.limitSeconds, 180 * 60);
      assert.equal(forB.usedSeconds, 0, "trial-era usage (before the period) does not count against the seat");
      assert.equal(await usage.startBlockReason(paid, b.id, "roleplay"), null);

      // Per seat: A's new session does not reduce B's allowance.
      const t0 = new Date();
      const s = await makeSession(paid, a.id, scenario.id, { meteredAt: t0 });
      await usage.meterRoleplaySession(s.id, { now: new Date(t0.getTime() + 30_000) });
      assert.equal((await usage.allowance(paid, a.id, "roleplay")).usedSeconds, 30);
      assert.equal((await usage.allowance(paid, b.id, "roleplay")).usedSeconds, 0);

      // Seat limit now follows Stripe quantity.
      assert.equal((await seatSummary(paid)).limit, 5);
    });

    it("leaves other paid workspaces unaffected by a trial running dry", async () => {
      const paid = await makeOrg({ name: "Paid" });
      const rep = await makeUser(paid, 1);
      const upgraded = await db.org.update({
        where: { id: paid.id },
        data: {
          planStatus: "active",
          planKey: "max",
          stripePriceId: process.env.STRIPE_MAX_PRICE_ID,
          subscriptionStartsAt: new Date(Date.now() - DAY),
          subscriptionEndsAt: new Date(Date.now() + 29 * DAY),
        },
      });
      const a = await usage.allowance(upgraded, rep.id, "call_review");
      assert.equal(a.limitSeconds, 100 * 60 * 60);
      assert.equal(a.basis, "seat_month");
      const call = await makeCall(upgraded, rep.id, { durationSec: 3 * 3600, audioPath: "s3:x" });
      const r = await usage.reserveCallReview(call.id, { seconds: 3 * 3600, estimated: false });
      assert.ok(r.reserved, "a 3-hour recording fits a Max seat even though it exceeds the whole trial pool");
    });
  });
});
