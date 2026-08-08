import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  INDUSTRY_PACKS,
  industryPack,
  resolveIndustry,
  stageNearProbability,
  openStagesIn,
  sanitizeCustomValues,
  sanitizeFieldDefs,
  parseCustomValues,
} from "../industry.ts";
import { parseCustomization, industryConfigOf, normalizeCustomization } from "../customization.ts";

describe("industry packs", () => {
  it("every pack ends in the stable closed_won / closed_lost keys", () => {
    for (const pack of INDUSTRY_PACKS) {
      const keys = pack.stages.map((s) => s.key);
      assert.ok(keys.includes("closed_won"), `${pack.id} missing closed_won`);
      assert.ok(keys.includes("closed_lost"), `${pack.id} missing closed_lost`);
      assert.equal(new Set(keys).size, keys.length, `${pack.id} has duplicate stage keys`);
      assert.ok(pack.stages.find((s) => s.key === "closed_won")!.probability === 100);
    }
  });

  it("unknown pack ids fall back to generic", () => {
    assert.equal(industryPack("nope").id, "generic");
  });

  it("resolves terminology overrides and merged custom fields", () => {
    const config = resolveIndustry({
      industry: "real_estate",
      terminology: { deal: "Sale", deals: "" },
      customDealFields: [{ key: "hoa_fee", label: "HOA fee", type: "number" }],
      customAccountFields: [],
    });
    assert.equal(config.terms.deal, "Sale"); // overridden
    assert.equal(config.terms.deals, "Listings"); // blank override ignored
    assert.equal(config.terms.account, "Property");
    assert.ok(config.dealFields.some((f) => f.key === "hoa_fee"));
    assert.ok(config.dealFields.some((f) => f.key === "listing_price"));
  });

  it("picks ERP nudge stages by probability in any pack", () => {
    const realEstate = industryPack("real_estate").stages;
    assert.equal(stageNearProbability(realEstate, 65).key, "offer"); // 55 is closest ≤ 65
    assert.equal(stageNearProbability(realEstate, 80).key, "under_contract");
    const generic = industryPack("generic").stages;
    assert.equal(stageNearProbability(generic, 65).key, "proposal");
    assert.equal(stageNearProbability(generic, 80).key, "negotiation");
    // Never returns a closed stage.
    for (const pack of INDUSTRY_PACKS) {
      assert.ok(!stageNearProbability(pack.stages, 100).key.startsWith("closed"));
    }
  });

  it("openStagesIn excludes only the closed pair", () => {
    const stages = industryPack("insurance").stages;
    assert.equal(openStagesIn(stages).length, stages.length - 2);
  });
});

describe("custom field values", () => {
  const fields = industryPack("real_estate").dealFields;

  it("accepts typed values and rejects unknown keys and bad types", () => {
    const ok = sanitizeCustomValues(fields, { listing_price: "985000", address: "48 Bayshore Dr" });
    assert.ok(ok.ok);
    if (ok.ok) assert.equal(ok.values.listing_price, 985000);
    assert.equal(sanitizeCustomValues(fields, { bogus: 1 }).ok, false);
    assert.equal(sanitizeCustomValues(fields, { listing_price: "lots" }).ok, false);
  });

  it("validates select options", () => {
    const accountFields = industryPack("real_estate").accountFields;
    assert.ok(sanitizeCustomValues(accountFields, { property_type: "Condo" }).ok);
    assert.equal(sanitizeCustomValues(accountFields, { property_type: "Castle" }).ok, false);
  });

  it("parses stored values tolerantly", () => {
    assert.deepEqual(parseCustomValues('{"a":1,"b":"x","c":{"nested":true}}'), { a: 1, b: "x" });
    assert.deepEqual(parseCustomValues("garbage"), {});
  });

  it("sanitizes owner-defined field definitions", () => {
    const good = sanitizeFieldDefs([{ label: "HOA Fee ($)", type: "number" }]);
    assert.ok(good.ok);
    if (good.ok) assert.equal(good.fields[0].key, "hoa_fee_");
    assert.equal(sanitizeFieldDefs([{ label: "Pick one", type: "select" }]).ok, false);
    assert.equal(sanitizeFieldDefs([{ label: "", type: "text" }]).ok, false);
  });
});

describe("customization + industry integration", () => {
  it("round-trips an industry configuration through parse", () => {
    const parsed = parseCustomization(
      JSON.stringify({
        industry: "real_estate",
        terminology: { contact: "Homebuyer" },
        customDealFields: [{ label: "HOA fee", type: "number" }],
      }),
    );
    const config = industryConfigOf(parsed);
    assert.equal(config.packId, "real_estate");
    assert.equal(config.terms.contact, "Homebuyer");
    assert.ok(config.dealFields.some((f) => f.key === "hoa_fee"));
  });

  it("normalize rejects unknown packs and bad field defs", () => {
    assert.equal(normalizeCustomization({ industry: "crypto" }).ok, false);
    assert.equal(
      normalizeCustomization({ customDealFields: [{ label: "x", type: "wat" }] }).ok,
      false,
    );
  });
});
