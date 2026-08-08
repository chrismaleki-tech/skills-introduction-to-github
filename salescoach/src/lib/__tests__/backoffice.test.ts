import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  PLANS,
  planFor,
  seatLimitReached,
  buildStatement,
  currentPeriodStart,
  monthlyRunRate,
} from "../billing.ts";
import { toCsv } from "../csv.ts";

const period = { periodStart: currentPeriodStart(), periodEnd: new Date() };

describe("plans", () => {
  it("resolves stored plan strings and falls back to trial", () => {
    assert.equal(planFor("growth").name, "Growth");
    assert.equal(planFor("nonsense").id, "trial");
    assert.equal(planFor("").id, "trial");
  });

  it("enforces seat limits, with scale unlimited", () => {
    assert.equal(seatLimitReached(PLANS.trial, 5), true);
    assert.equal(seatLimitReached(PLANS.trial, 4), false);
    assert.equal(seatLimitReached(PLANS.scale, 10_000), false);
  });

  it("computes committed monthly run rate from seats", () => {
    assert.equal(monthlyRunRate(PLANS.growth, 8), 8 * 49);
    assert.equal(monthlyRunRate(PLANS.trial, 5), 0);
  });
});

describe("statement math", () => {
  it("bills seats at the plan price", () => {
    const statement = buildStatement({ plan: PLANS.starter, activeSeats: 8, usage: [], ...period });
    const seats = statement.lines[0];
    assert.equal(seats.quantity, 8);
    assert.equal(seats.amount, 8 * 29);
    assert.equal(statement.total, 8 * 29);
  });

  it("charges nothing while usage stays within included volumes", () => {
    const statement = buildStatement({
      plan: PLANS.growth,
      activeSeats: 10,
      usage: [
        { type: "CALL_GRADED", count: 500, quantity: 500 },
        { type: "ASK_QUERY", count: 100, quantity: 100 },
      ],
      ...period,
    });
    const graded = statement.lines.find((l) => l.item === "Graded activities")!;
    assert.equal(graded.quantity, 0);
    assert.equal(graded.amount, 0);
    assert.equal(statement.total, 10 * 49);
  });

  it("bills overage beyond the included volume, combining graded types", () => {
    const statement = buildStatement({
      plan: PLANS.starter,
      activeSeats: 1,
      usage: [
        { type: "CALL_GRADED", count: 150, quantity: 150 },
        { type: "ROLEPLAY_GRADED", count: 100, quantity: 100 },
      ],
      ...period,
    });
    // 250 graded, 200 included on Starter → 50 over at $0.50.
    const graded = statement.lines.find((l) => l.item === "Graded activities")!;
    assert.equal(graded.quantity, 50);
    assert.equal(graded.amount, 25);
    assert.equal(statement.total, 29 + 25);
  });

  it("never bills overage on scale (unlimited included)", () => {
    const statement = buildStatement({
      plan: PLANS.scale,
      activeSeats: 100,
      usage: [{ type: "ASK_QUERY", count: 1_000_000, quantity: 1_000_000 }],
      ...period,
    });
    const ask = statement.lines.find((l) => l.item === "Ask queries")!;
    assert.equal(ask.amount, 0);
    assert.equal(statement.total, 100 * 79);
  });
});

describe("csv export", () => {
  it("escapes quotes, commas, and newlines", () => {
    const csv = toCsv(["name", "notes"], [['Acme "West", Inc.', "line1\nline2"]]);
    assert.equal(csv, 'name,notes\r\n"Acme ""West"", Inc.","line1\nline2"\r\n');
  });

  it("neutralizes spreadsheet formula injection", () => {
    const csv = toCsv(["v"], [["=SUM(A1:A9)"], ["+1234"], ["@cmd"]]);
    assert.ok(csv.includes("'=SUM(A1:A9)"));
    assert.ok(csv.includes("'+1234"));
    assert.ok(csv.includes("'@cmd"));
  });

  it("renders dates as ISO and empty for null", () => {
    const when = new Date("2026-07-01T12:00:00Z");
    const csv = toCsv(["at", "gone"], [[when, null]]);
    assert.ok(csv.includes("2026-07-01T12:00:00.000Z,"));
  });
});
