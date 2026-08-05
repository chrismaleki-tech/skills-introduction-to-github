/**
 * SaaS subscription plans + monthly statement math for the org back office.
 * Pure functions over UsageEvent summaries so the numbers are testable and a
 * real payment provider (Stripe) can be wired out of band later: these
 * statements are previews, not ledger entries.
 */

export type PlanId = "trial" | "starter" | "growth" | "scale";

export type Plan = {
  id: PlanId;
  name: string;
  blurb: string;
  /** null = unlimited seats */
  seatLimit: number | null;
  /** USD per active seat per month */
  seatPriceMonthly: number;
  /** Monthly included volumes before overage billing kicks in. */
  included: { gradedActivities: number; askQueries: number; voiceSessions: number };
  /** USD per unit beyond the included volume. */
  overage: { gradedActivity: number; askQuery: number; voiceSession: number };
};

export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: "trial",
    name: "Trial",
    blurb: "Evaluate SalesCoach with a small team. No charge, hard usage caps.",
    seatLimit: 5,
    seatPriceMonthly: 0,
    included: { gradedActivities: 50, askQueries: 200, voiceSessions: 10 },
    overage: { gradedActivity: 0, askQuery: 0, voiceSession: 0 },
  },
  starter: {
    id: "starter",
    name: "Starter",
    blurb: "For a single sales team getting structured coaching in place.",
    seatLimit: 10,
    seatPriceMonthly: 29,
    included: { gradedActivities: 200, askQueries: 1000, voiceSessions: 50 },
    overage: { gradedActivity: 0.5, askQuery: 0.02, voiceSession: 0.4 },
  },
  growth: {
    id: "growth",
    name: "Growth",
    blurb: "Multiple teams, CRM + ERP modules, higher included volumes.",
    seatLimit: 25,
    seatPriceMonthly: 49,
    included: { gradedActivities: 1000, askQueries: 5000, voiceSessions: 250 },
    overage: { gradedActivity: 0.4, askQuery: 0.015, voiceSession: 0.3 },
  },
  scale: {
    id: "scale",
    name: "Scale",
    blurb: "Unlimited seats and volume for org-wide rollouts.",
    seatLimit: null,
    seatPriceMonthly: 79,
    included: {
      gradedActivities: Number.POSITIVE_INFINITY,
      askQueries: Number.POSITIVE_INFINITY,
      voiceSessions: Number.POSITIVE_INFINITY,
    },
    overage: { gradedActivity: 0, askQuery: 0, voiceSession: 0 },
  },
};

export const PLAN_ORDER: PlanId[] = ["trial", "starter", "growth", "scale"];

export function isPlanId(value: string): value is PlanId {
  return value in PLANS;
}

/** Resolve an org's stored plan string, falling back to trial. */
export function planFor(planId: string): Plan {
  return isPlanId(planId) ? PLANS[planId] : PLANS.trial;
}

/** True when the plan cannot take another active seat. */
export function seatLimitReached(plan: Plan, activeSeats: number): boolean {
  return plan.seatLimit != null && activeSeats >= plan.seatLimit;
}

export type UsageRow = { type: string; count: number; quantity: number };

export type StatementLine = {
  item: string;
  detail: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type Statement = {
  planId: PlanId;
  periodStart: Date;
  periodEnd: Date;
  lines: StatementLine[];
  total: number;
};

function usageCount(usage: UsageRow[], types: string[]): number {
  return usage.filter((row) => types.includes(row.type)).reduce((sum, row) => sum + row.count, 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** First moment of the current calendar month (statement period start). */
export function currentPeriodStart(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Build the current-period statement preview: seats plus metered overages
 * beyond the plan's included volumes. Included usage renders as a $0 line so
 * the org can see what it consumed even when nothing is owed.
 */
export function buildStatement(input: {
  plan: Plan;
  activeSeats: number;
  usage: UsageRow[];
  periodStart: Date;
  periodEnd: Date;
}): Statement {
  const { plan, activeSeats, usage } = input;
  const lines: StatementLine[] = [];

  lines.push({
    item: `${plan.name} plan seats`,
    detail: plan.seatLimit != null ? `${activeSeats} of ${plan.seatLimit} seats` : `${activeSeats} seats`,
    quantity: activeSeats,
    unitPrice: plan.seatPriceMonthly,
    amount: round2(activeSeats * plan.seatPriceMonthly),
  });

  const meters: {
    item: string;
    used: number;
    included: number;
    overagePrice: number;
  }[] = [
    {
      item: "Graded activities",
      used: usageCount(usage, ["CALL_GRADED", "ROLEPLAY_GRADED", "EMAIL_GRADED"]),
      included: plan.included.gradedActivities,
      overagePrice: plan.overage.gradedActivity,
    },
    {
      item: "Ask queries",
      used: usageCount(usage, ["ASK_QUERY"]),
      included: plan.included.askQueries,
      overagePrice: plan.overage.askQuery,
    },
    {
      item: "Voice role-play sessions",
      used: usageCount(usage, ["VOICE_SESSION"]),
      included: plan.included.voiceSessions,
      overagePrice: plan.overage.voiceSession,
    },
  ];

  for (const meter of meters) {
    const over = Math.max(0, meter.used - meter.included);
    const includedLabel = Number.isFinite(meter.included) ? `${meter.included} included` : "unlimited";
    lines.push({
      item: meter.item,
      detail: `${meter.used} used · ${includedLabel}${over > 0 ? ` · ${over} over` : ""}`,
      quantity: over,
      unitPrice: meter.overagePrice,
      amount: round2(over * meter.overagePrice),
    });
  }

  return {
    planId: plan.id,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    lines,
    total: round2(lines.reduce((sum, line) => sum + line.amount, 0)),
  };
}

export function fmtUsd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Committed monthly seat revenue for a tenant (usage overage excluded). */
export function monthlyRunRate(plan: Plan, activeSeats: number): number {
  return Math.round(activeSeats * plan.seatPriceMonthly * 100) / 100;
}
