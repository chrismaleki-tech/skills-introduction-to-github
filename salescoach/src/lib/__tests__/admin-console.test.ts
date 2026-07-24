import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { mintScopedToken, verifyScopedToken, scopedTokenExpiry } from "../session-token.ts";
import { maskEmail } from "../pii.ts";
import { consoleRoleForEmail } from "../config.ts";

describe("scoped tokens (elevation / impersonation)", () => {
  it("round-trips a subject within its lifetime", () => {
    const token = mintScopedToken("elev", "user_123", 10);
    assert.equal(verifyScopedToken("elev", token), "user_123");
    assert.ok((scopedTokenExpiry(token) ?? 0) > Date.now());
  });

  it("rejects the wrong scope", () => {
    const token = mintScopedToken("imp", "target:admin", 10);
    assert.equal(verifyScopedToken("elev", token), null);
    assert.equal(verifyScopedToken("imp", token), "target:admin");
  });

  it("rejects expired tokens", () => {
    const token = mintScopedToken("elev", "user_123", -1);
    assert.equal(verifyScopedToken("elev", token), null);
  });

  it("rejects tampered tokens", () => {
    const token = mintScopedToken("elev", "user_123", 10);
    const tampered = token.replace("user_123", "user_456");
    assert.equal(verifyScopedToken("elev", tampered), null);
    assert.equal(verifyScopedToken("elev", "garbage"), null);
    assert.equal(verifyScopedToken("elev", null), null);
  });
});

describe("PII masking", () => {
  it("masks the local part and domain but keeps the shape", () => {
    const masked = maskEmail("jane@acme.com");
    assert.ok(masked.startsWith("j"));
    assert.ok(masked.includes("@a"));
    assert.ok(masked.endsWith(".com"));
    assert.ok(!masked.includes("jane"));
    assert.ok(!masked.includes("acme"));
  });

  it("handles malformed input without throwing", () => {
    assert.equal(maskEmail("not-an-email"), "•••");
    assert.ok(maskEmail("a@b.c").length > 0);
  });
});

describe("console roles", () => {
  it("resolves ADMIN and SUPPORT from allowlists, case-insensitively", () => {
    process.env.PLATFORM_ADMIN_EMAILS = "Boss@Company.com";
    process.env.PLATFORM_SUPPORT_EMAILS = "help@company.com, other@company.com";
    assert.equal(consoleRoleForEmail("boss@company.com"), "ADMIN");
    assert.equal(consoleRoleForEmail("HELP@company.com"), "SUPPORT");
    assert.equal(consoleRoleForEmail("random@company.com"), null);
    // ADMIN allowlist wins if an email is on both lists.
    process.env.PLATFORM_SUPPORT_EMAILS = "boss@company.com";
    assert.equal(consoleRoleForEmail("boss@company.com"), "ADMIN");
    delete process.env.PLATFORM_ADMIN_EMAILS;
    delete process.env.PLATFORM_SUPPORT_EMAILS;
  });
});
