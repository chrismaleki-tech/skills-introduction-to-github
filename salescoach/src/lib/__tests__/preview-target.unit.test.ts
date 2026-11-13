import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { assertClerkDevelopmentKey, previewBaseUrl, previewConnectionTarget } from "../preview-target";

describe("preview audit target", () => {
  it("accepts only the erota_preview database and returns no credentials", () => {
    const target = previewConnectionTarget(
      "postgresql://appuser:s3cret-password@ep-lingering-meadow-auxhogg-pooler.c-10.us-east-1.aws.neon.tech/erota_preview?sslmode=require",
    );
    assert.deepEqual(target, {
      host: "ep-lingering-meadow-auxhogg-pooler.c-10.us-east-1.aws.neon.tech",
      database: "erota_preview",
    });
    assert.equal(JSON.stringify(target).includes("s3cret-password"), false);
    assert.throws(() => previewConnectionTarget(undefined), /DATABASE_URL is not set/);
    assert.throws(
      () => previewConnectionTarget("postgresql://appuser:s3cret@ep-example.neon.tech/neondb"),
      /neondb/,
    );
    assert.throws(
      () => previewConnectionTarget("postgresql://appuser:s3cret@ep-example.neon.tech/other_db"),
      /other_db/,
    );
  });

  it("accepts only a Clerk development secret and does not echo the key", () => {
    const development = "sk_test_development_instance_key";
    assert.equal(assertClerkDevelopmentKey(`  ${development}  `), development);
    assert.throws(() => assertClerkDevelopmentKey("sk_live_production_instance_key"), (error: unknown) => {
      assert.match(String(error), /development secret key/);
      assert.equal(String(error).includes("sk_live_production_instance_key"), false);
      return true;
    });
    assert.throws(() => assertClerkDevelopmentKey(""), /CLERK_SECRET_KEY is not set/);
  });

  it("refuses the production Vercel hostname", () => {
    const url = previewBaseUrl("https://erota-salescoach-4aifo311h-johnny-davis-chris-maleki.vercel.app/admin?ok=1");
    assert.equal(url.origin, "https://erota-salescoach-4aifo311h-johnny-davis-chris-maleki.vercel.app");
    assert.equal(url.pathname, "/");
    assert.throws(() => previewBaseUrl("https://erota-salescoach.vercel.app"), /production deployment/);
    assert.throws(() => previewBaseUrl("https://app.erota.io"), /Point ADMIN_PREVIEW_BASE_URL/);
    assert.throws(() => previewBaseUrl("http://example.vercel.app"), /https/);
  });

  it("the production migration refuses every database except neondb", () => {
    const sql = readFileSync(new URL("../../../prisma/sql/2026-11-12-platform-admin-production.sql", import.meta.url), "utf8");
    assert.match(sql, /current_database\(\) IS DISTINCT FROM 'neondb'/);
    assert.equal(sql.includes("erota_preview"), false);
    assert.match(sql, /Do not run prisma db push/);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS "suspendedAt"/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS "AdminAudit"/);
  });

  it("the live script does not read the all-environment unpooled URL", () => {
    const script = readFileSync(new URL("../../../scripts/admin-preview-audit.ts", import.meta.url), "utf8");
    assert.equal(script.includes("DATABASE_URL_UNPOOLED"), false);
    assert.match(script, /previewConnectionTarget\(process\.env\.DATABASE_URL\)/);
    assert.match(script, /prisma db push/);
  });
});
