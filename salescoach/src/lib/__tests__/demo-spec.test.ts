import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateDemoSpec } from "../../../prisma/demo/validate.ts";
import type { DemoTenantSpec } from "../../../prisma/demo/types.ts";

/** Minimal structurally-valid spec used as the mutation baseline. */
function baseSpec(): DemoTenantSpec {
  return {
    orgName: "Testing Tenant",
    company: {
      description: "d",
      valueProps: ["v"],
      products: [],
      personas: [],
      objections: [],
      competitors: [],
      talkTracks: [],
      pricingNotes: "",
    },
    rubric: { presetName: "Discovery Call Fundamentals", name: "Test rubric", description: "d" },
    users: [
      { name: "M", email: "m@t.demo", role: "MANAGER", title: "Mgr" },
      { name: "R1", email: "r1@t.demo", role: "REP", title: "AE" },
      { name: "R2", email: "r2@t.demo", role: "REP", title: "AE" },
    ],
    scenarios: [
      {
        title: "S1",
        callType: "discovery",
        difficulty: "easy",
        persona: { name: "P", title: "T", company: "C", industry: "I", personality: "p", painPoints: [], objections: [], budget: "", notes: "" },
        winConditions: ["w"],
      },
    ],
    transcripts: { good: "REP: hi\nPROSPECT: hi", mid: "m", poor: "p", demo: "d", followups: ["f1", "f2"] },
    prospectNames: ["A", "B", "C", "D"],
    roleplayDialogues: {
      good: [["a", "b"], ["c", "d"], ["e", "f"]],
      poor: [["a", "b"], ["c", "d"], ["e", "f"]],
    },
    accounts: [{ ref: "acme", ownerEmail: "r1@t.demo", name: "Acme" }],
    contacts: [{ ref: "jane", accountRef: "acme", ownerEmail: "r1@t.demo", name: "Jane", title: "Buyer", email: "jane@acme.demo", phone: "+1-555-0100" }],
    deals: [
      { ref: "open1", accountRef: "acme", contactRef: "jane", ownerEmail: "r1@t.demo", name: "Open deal", stage: "proposal", amount: 1000, product: "P", probability: 50, linkRecentCalls: true },
      { ref: "won1", accountRef: "acme", ownerEmail: "r2@t.demo", name: "Won deal", stage: "closed_won", amount: 2000, product: "P", probability: 100 },
    ],
    products: [{ sku: "SKU-1", name: "Widget", description: "d", category: "c", listPrice: 100, cost: 40, unit: "unit", trackInventory: true, initialStock: 10 }],
    warehouse: { code: "MAIN", name: "Main", address: "1 St" },
    quotes: [
      { dealRef: "open1", ownerEmail: "r1@t.demo", title: "Q1", lines: [{ sku: "SKU-1", quantity: 2 }], status: "sent" },
      { dealRef: "won1", ownerEmail: "r2@t.demo", title: "Q2", lines: [{ sku: "SKU-1", quantity: 5 }], status: "accepted" },
    ],
    outreachEmails: [{ fromEmail: "r1@t.demo", contactRef: "jane", dealRef: "open1", subject: "Hi", body: "b" }],
    outreachCalls: [{ fromEmail: "r1@t.demo", contactRef: "jane", dealRef: "open1", notes: "n", durationSec: 60, callType: "discovery" }],
    assignments: [{ repEmail: "r1@t.demo", scenarioTitle: "S1", type: "ROLEPLAY", targetCount: 2, note: "n", dueInDays: 5 }],
  };
}

describe("validateDemoSpec", () => {
  it("accepts a structurally valid spec", () => {
    assert.deepEqual(validateDemoSpec(baseSpec()), []);
  });

  it("rejects unknown rubric presets", () => {
    const spec = baseSpec();
    spec.rubric.presetName = "Nonexistent Method";
    assert.ok(validateDemoSpec(spec).some((m) => m.includes("presetName")));
  });

  it("rejects owners that are not users", () => {
    const spec = baseSpec();
    spec.accounts[0].ownerEmail = "ghost@t.demo";
    assert.ok(validateDemoSpec(spec).some((m) => m.includes("unknown user email")));
  });

  it("rejects dangling refs (account, deal, sku, scenario)", () => {
    const spec = baseSpec();
    spec.contacts[0].accountRef = "missing";
    spec.quotes[0].dealRef = "missing";
    spec.quotes[1].lines[0].sku = "missing";
    spec.assignments[0].scenarioTitle = "missing";
    const problems = validateDemoSpec(spec);
    assert.ok(problems.some((m) => m.includes("unknown accountRef")));
    assert.ok(problems.some((m) => m.includes("unknown dealRef")));
    assert.ok(problems.some((m) => m.includes('unknown sku')));
    assert.ok(problems.some((m) => m.includes("unknown scenarioTitle")));
  });

  it("rejects accepted quotes on open deals (confirming would close them)", () => {
    const spec = baseSpec();
    spec.quotes[0].status = "accepted";
    assert.ok(validateDemoSpec(spec).some((m) => m.includes("closed_won")));
  });

  it("rejects initialStock without inventory tracking or warehouse", () => {
    const spec = baseSpec();
    spec.products[0].trackInventory = false;
    const noTrack = validateDemoSpec(spec);
    assert.ok(noTrack.some((m) => m.includes("requires trackInventory")));

    const spec2 = baseSpec();
    spec2.warehouse = undefined;
    assert.ok(validateDemoSpec(spec2).some((m) => m.includes("no warehouse")));
  });

  it("requires manager, reps, transcripts, and prospect names", () => {
    const spec = baseSpec();
    spec.users = spec.users.filter((u) => u.role !== "MANAGER");
    spec.transcripts.good = " ";
    spec.prospectNames = ["A"];
    const problems = validateDemoSpec(spec);
    assert.ok(problems.some((m) => m.includes("no MANAGER")));
    assert.ok(problems.some((m) => m.includes("transcripts.good")));
    assert.ok(problems.some((m) => m.includes("prospectNames")));
  });

  it("rejects linkRecentCalls on deals owned by non-reps", () => {
    const spec = baseSpec();
    spec.deals[0].ownerEmail = "m@t.demo";
    assert.ok(validateDemoSpec(spec).some((m) => m.includes("linkRecentCalls")));
  });
});
