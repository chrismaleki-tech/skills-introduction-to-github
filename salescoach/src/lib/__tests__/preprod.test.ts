import { createHmac } from "crypto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideSampling, durationBand } from "../sampling.ts";
import { redactPii } from "../pii.ts";
import { mintSessionToken, verifySessionToken } from "../session-token.ts";
import { providerReady } from "../channels-ready.ts";

describe("sampling", () => {
  it("grades everything under the monthly threshold", () => {
    const decision = decideSampling(
      {
        minDurationSec: 60,
        sampleThreshold: 10,
        sampleSize: 10,
        gradeManualUploads: true,
        autoMatchCrm: true,
        gradeOutboundEmails: true,
      },
      { durationSec: 300, source: "WEBHOOK" },
      {
        eligibleCallsThisMonth: 3,
        autoGradedThisMonth: 2,
        sampledInSameDurationBand: 1,
        dayOfMonth: 28,
        daysInMonth: 30,
      },
      () => 0.99,
    );
    assert.equal(decision.grade, true);
    assert.equal(decision.samplingStatus, "WITHIN_THRESHOLD");
  });

  it("skips short calls", () => {
    const decision = decideSampling(
      {
        minDurationSec: 60,
        sampleThreshold: 10,
        sampleSize: 10,
        gradeManualUploads: true,
        autoMatchCrm: true,
        gradeOutboundEmails: true,
      },
      { durationSec: 20, source: "WEBHOOK" },
      {
        eligibleCallsThisMonth: 1,
        autoGradedThisMonth: 0,
        sampledInSameDurationBand: 0,
        dayOfMonth: 1,
        daysInMonth: 30,
      },
    );
    assert.equal(decision.grade, false);
    assert.equal(decision.samplingStatus, "BELOW_MIN_DURATION");
  });

  it("bands durations", () => {
    assert.equal(durationBand(120), "short");
    assert.equal(durationBand(600), "medium");
    assert.equal(durationBand(2000), "long");
  });
});

describe("pii redaction", () => {
  it("redacts email phone ssn and card-like numbers", () => {
    const out = redactPii(
      "Email me at alex@acme.com or +1 555-123-4567. SSN 123-45-6789 card 4111 1111 1111 1111",
    );
    assert.match(out, /REDACTED_EMAIL/);
    assert.match(out, /REDACTED_PHONE/);
    assert.match(out, /REDACTED_SSN/);
    assert.match(out, /REDACTED_CARD/);
  });
});

describe("signed session tokens", () => {
  it("round-trips a valid token", () => {
    process.env.SESSION_SECRET = "test-secret-for-unit-tests-only";
    const token = mintSessionToken("user_abc", 1);
    assert.equal(verifySessionToken(token), "user_abc");
  });

  it("rejects tampered tokens", () => {
    process.env.SESSION_SECRET = "test-secret-for-unit-tests-only";
    const token = mintSessionToken("user_abc", 1);
    const bad = token.slice(0, -4) + "xxxx";
    assert.equal(verifySessionToken(bad), null);
  });

  it("rejects expired tokens", () => {
    process.env.SESSION_SECRET = "test-secret-for-unit-tests-only";
    const exp = Date.now() - 1000;
    const payload = `user_abc.${exp}`;
    const sig = createHmac("sha256", process.env.SESSION_SECRET)
      .update(payload)
      .digest("base64url");
    assert.equal(verifySessionToken(`${payload}.${sig}`), null);
  });
});

describe("channel provider readiness", () => {
  it("demo providers are always ready", () => {
    assert.equal(providerReady("demo_email").ok, true);
    assert.equal(providerReady("demo_phone").ok, true);
  });

  it("twilio requires env", () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    const r = providerReady("twilio");
    assert.equal(r.ok, false);
    assert.match(r.reason || "", /TWILIO/);
  });
});
