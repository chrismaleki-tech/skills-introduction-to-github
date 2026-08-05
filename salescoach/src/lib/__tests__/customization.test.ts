import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseCustomization,
  normalizeCustomization,
  moduleForPath,
  isValidAccentColor,
  lightenHex,
  DEFAULT_CUSTOMIZATION,
} from "../customization.ts";

describe("customization parsing", () => {
  it("returns full defaults for empty, null, or garbage JSON", () => {
    assert.deepEqual(parseCustomization("{}"), DEFAULT_CUSTOMIZATION);
    assert.deepEqual(parseCustomization(null), DEFAULT_CUSTOMIZATION);
    assert.deepEqual(parseCustomization("not json"), DEFAULT_CUSTOMIZATION);
  });

  it("merges partial values over defaults", () => {
    const c = parseCustomization(JSON.stringify({ brandName: "Meridian Coach", modules: { erp: false } }));
    assert.equal(c.brandName, "Meridian Coach");
    assert.equal(c.modules.erp, false);
    assert.equal(c.modules.crm, true);
    assert.equal(c.startPage, "default");
  });

  it("drops invalid accent colors and unknown start pages", () => {
    const c = parseCustomization(JSON.stringify({ accentColor: "red", startPage: "/etc/passwd" }));
    assert.equal(c.accentColor, "");
    assert.equal(c.startPage, "default");
    assert.equal(parseCustomization(JSON.stringify({ accentColor: "#0ea5e9" })).accentColor, "#0ea5e9");
  });
});

describe("customization validation", () => {
  it("rejects bad accents, unknown start pages, and all-modules-off", () => {
    assert.equal(normalizeCustomization({ accentColor: "blue" }).ok, false);
    assert.equal(normalizeCustomization({ startPage: "/nope" }).ok, false);
    const allOff = Object.fromEntries(Object.keys(DEFAULT_CUSTOMIZATION.modules).map((k) => [k, false]));
    assert.equal(normalizeCustomization({ modules: allOff }).ok, false);
  });

  it("rejects a start page whose module is disabled", () => {
    const result = normalizeCustomization({ startPage: "/crm", modules: { crm: false } });
    assert.equal(result.ok, false);
  });

  it("accepts a sane payload", () => {
    const result = normalizeCustomization({
      brandName: "Meridian Coach",
      accentColor: "#0ea5e9",
      startPage: "/ask",
      modules: { erp: false },
    });
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.value.modules.erp, false);
      assert.equal(result.value.modules.ask, true);
    }
  });
});

describe("module route mapping", () => {
  it("maps app paths to their owning module", () => {
    assert.equal(moduleForPath("/crm/accounts"), "crm");
    assert.equal(moduleForPath("/erp/invoices/abc"), "erp");
    assert.equal(moduleForPath("/channels"), "conversations");
    assert.equal(moduleForPath("/scenarios/xyz"), "roleplay");
    assert.equal(moduleForPath("/rubrics"), "coaching");
    assert.equal(moduleForPath("/ask"), "ask");
    assert.equal(moduleForPath("/me"), null);
    assert.equal(moduleForPath("/backoffice"), null);
    // Prefix matching must not swallow sibling routes.
    assert.equal(moduleForPath("/callsheet"), null);
  });
});

describe("accent helpers", () => {
  it("validates hex colors", () => {
    assert.ok(isValidAccentColor("#abc"));
    assert.ok(isValidAccentColor("#0ea5e9"));
    assert.ok(!isValidAccentColor("0ea5e9"));
    assert.ok(!isValidAccentColor("#12345"));
    assert.ok(!isValidAccentColor("tomato"));
  });

  it("lightens toward white and expands shorthand", () => {
    assert.equal(lightenHex("#000000", 0.5), "#808080");
    assert.equal(lightenHex("#fff"), "#ffffff");
    assert.equal(lightenHex("junk"), "junk");
  });
});
