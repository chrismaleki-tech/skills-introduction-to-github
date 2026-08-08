/**
 * Pure referential-integrity validation for DemoTenantSpec files.
 * Deliberately import-light (types + presets only) so unit tests can load it
 * without pulling the database or pipeline modules.
 */

import { METHODOLOGY_PRESETS } from "../../src/lib/presets";
import type { DemoTenantSpec } from "./types";

/** Returns a list of problems (empty = valid). */
export function validateDemoSpec(spec: DemoTenantSpec): string[] {
  const problems: string[] = [];
  const p = (msg: string) => problems.push(msg);

  if (!spec.orgName.trim()) p("orgName is empty");

  const emails = spec.users.map((u) => u.email.toLowerCase());
  if (new Set(emails).size !== emails.length) p("duplicate user emails");
  if (!spec.users.some((u) => u.role === "MANAGER")) p("no MANAGER user");
  const reps = spec.users.filter((u) => u.role === "REP");
  if (reps.length < 2) p("need at least 2 REP users");
  const emailSet = new Set(emails);
  const repSet = new Set(reps.map((u) => u.email.toLowerCase()));
  const knownEmail = (email: string, where: string) => {
    if (!emailSet.has(email.toLowerCase())) p(`${where}: unknown user email "${email}"`);
  };

  if (!METHODOLOGY_PRESETS.some((preset) => preset.name === spec.rubric.presetName)) {
    p(`rubric.presetName "${spec.rubric.presetName}" is not a known preset`);
  }

  const scenarioTitles = new Set(spec.scenarios.map((s) => s.title));
  if (scenarioTitles.size !== spec.scenarios.length) p("duplicate scenario titles");
  if (spec.scenarios.length < 1) p("need at least 1 scenario");

  for (const key of ["good", "mid", "poor", "demo"] as const) {
    if (!spec.transcripts[key]?.trim()) p(`transcripts.${key} is empty`);
  }
  if (spec.transcripts.followups.length < 2) p("need at least 2 follow-up transcripts");
  if (spec.prospectNames.length < 4) p("need at least 4 prospectNames");
  if (spec.roleplayDialogues.good.length < 3 || spec.roleplayDialogues.poor.length < 3) {
    p("roleplayDialogues.good and .poor each need at least 3 exchanges");
  }

  const accountRefs = new Set(spec.accounts.map((a) => a.ref));
  if (accountRefs.size !== spec.accounts.length) p("duplicate account refs");
  const contactRefs = new Set(spec.contacts.map((c) => c.ref));
  if (contactRefs.size !== spec.contacts.length) p("duplicate contact refs");
  const dealRefs = new Set(spec.deals.map((d) => d.ref));
  if (dealRefs.size !== spec.deals.length) p("duplicate deal refs");
  const skus = new Set(spec.products.map((prod) => prod.sku));
  if (skus.size !== spec.products.length) p("duplicate product skus");

  for (const account of spec.accounts) knownEmail(account.ownerEmail, `account ${account.ref}`);
  for (const contact of spec.contacts) {
    knownEmail(contact.ownerEmail, `contact ${contact.ref}`);
    if (!accountRefs.has(contact.accountRef)) p(`contact ${contact.ref}: unknown accountRef "${contact.accountRef}"`);
  }
  const dealByRef = new Map(spec.deals.map((d) => [d.ref, d]));
  for (const deal of spec.deals) {
    knownEmail(deal.ownerEmail, `deal ${deal.ref}`);
    if (deal.accountRef && !accountRefs.has(deal.accountRef)) p(`deal ${deal.ref}: unknown accountRef`);
    if (deal.contactRef && !contactRefs.has(deal.contactRef)) p(`deal ${deal.ref}: unknown contactRef`);
    if (deal.linkRecentCalls && !repSet.has(deal.ownerEmail.toLowerCase())) {
      p(`deal ${deal.ref}: linkRecentCalls requires a REP owner (only REPs have seeded calls)`);
    }
  }
  for (const product of spec.products) {
    if (product.initialStock != null && !product.trackInventory) {
      p(`product ${product.sku}: initialStock requires trackInventory`);
    }
  }
  if (spec.products.some((prod) => prod.initialStock != null) && !spec.warehouse) {
    p("initialStock used but no warehouse defined");
  }
  for (const quote of spec.quotes) {
    knownEmail(quote.ownerEmail, `quote "${quote.title}"`);
    const deal = dealByRef.get(quote.dealRef);
    if (!deal) p(`quote "${quote.title}": unknown dealRef "${quote.dealRef}"`);
    if (quote.status === "accepted" && deal && deal.stage !== "closed_won") {
      p(`quote "${quote.title}": accepted quotes must target a closed_won deal (confirming closes the deal)`);
    }
    if (quote.status !== "accepted" && deal && deal.stage.startsWith("closed")) {
      p(`quote "${quote.title}": open quotes cannot target the closed deal "${deal.ref}"`);
    }
    if (!quote.lines.length) p(`quote "${quote.title}": no lines`);
    for (const line of quote.lines) {
      if (!skus.has(line.sku)) p(`quote "${quote.title}": unknown sku "${line.sku}"`);
    }
  }
  for (const email of spec.outreachEmails) {
    knownEmail(email.fromEmail, `outreach email "${email.subject}"`);
    if (!contactRefs.has(email.contactRef)) p(`outreach email "${email.subject}": unknown contactRef`);
    if (email.dealRef && !dealRefs.has(email.dealRef)) p(`outreach email "${email.subject}": unknown dealRef`);
  }
  for (const call of spec.outreachCalls) {
    knownEmail(call.fromEmail, `outreach call "${call.notes.slice(0, 30)}"`);
    if (!contactRefs.has(call.contactRef)) p(`outreach call: unknown contactRef "${call.contactRef}"`);
    if (call.dealRef && !dealRefs.has(call.dealRef)) p(`outreach call: unknown dealRef "${call.dealRef}"`);
  }
  for (const assignment of spec.assignments) {
    if (!repSet.has(assignment.repEmail.toLowerCase())) p(`assignment: "${assignment.repEmail}" is not a REP`);
    if (assignment.type === "ROLEPLAY") {
      if (!assignment.scenarioTitle || !scenarioTitles.has(assignment.scenarioTitle)) {
        p(`assignment for ${assignment.repEmail}: unknown scenarioTitle "${assignment.scenarioTitle}"`);
      }
    }
  }
  return problems;
}

