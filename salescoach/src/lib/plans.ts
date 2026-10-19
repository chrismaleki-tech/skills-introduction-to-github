export type PlanKey = "trial" | "pro" | "max" | "enterprise";
export type CheckoutPlanKey = Extract<PlanKey, "pro" | "max">;

export type PlanDefinition = {
  key: PlanKey;
  name: string;
  pricePerSeat: number | null;
  roleplayMinutesPerSeat: number | null;
  callScoringMinutesPerSeat: number | null;
  description: string;
  features: string[];
};

export const PLANS: Record<PlanKey, PlanDefinition> = {
  trial: {
    key: "trial",
    name: "Free Trial",
    pricePerSeat: 0,
    roleplayMinutesPerSeat: null,
    callScoringMinutesPerSeat: null,
    description: "Explore the core sales intelligence workflow before choosing a paid plan.",
    features: [
      "AI role-play trial",
      "AI call review trial",
      "AI Sales Manager trial",
      "Metrics and analytics",
      "Custom scoring",
      "Standard support",
      "Security controls",
    ],
  },
  pro: {
    key: "pro",
    name: "Pro",
    pricePerSeat: 55,
    roleplayMinutesPerSeat: 180,
    callScoringMinutesPerSeat: 25 * 60,
    description: "For growing sales teams building a consistent coaching cadence.",
    features: [
      "180 minutes of AI role-play",
      "25 hours of live call scoring",
      "AI Call Review",
      "AI Role-play",
      "Metrics and data",
      "AI Sales Manager",
      "Security controls",
    ],
  },
  max: {
    key: "max",
    name: "Max",
    pricePerSeat: 100,
    roleplayMinutesPerSeat: 480,
    callScoringMinutesPerSeat: 100 * 60,
    description: "For high-volume teams that need more practice and call intelligence.",
    features: [
      "480 minutes of AI role-play",
      "100 hours of live call scoring",
      "AI Call Review",
      "AI Role-play",
      "Metrics and data",
      "AI Sales Manager",
      "Security controls",
    ],
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    pricePerSeat: null,
    roleplayMinutesPerSeat: null,
    callScoringMinutesPerSeat: null,
    description: "A tailored rollout for organizations with advanced operational requirements.",
    features: [
      "AI role-play",
      "Live call scoring",
      "Custom done-for-you setup",
      "Done-for-you customization",
      "Advanced analytics",
      "Dedicated account manager",
      "SSO and advanced security",
    ],
  },
};

export function isCheckoutPlan(value: string): value is CheckoutPlanKey {
  return value === "pro" || value === "max";
}

export function priceIdForPlan(plan: CheckoutPlanKey): string | undefined {
  if (plan === "max") return process.env.STRIPE_MAX_PRICE_ID;
  return process.env.STRIPE_PRO_PRICE_ID;
}

export function planForPriceId(priceId: string | null | undefined): PlanKey {
  if (!priceId) return "trial";
  if (process.env.STRIPE_MAX_PRICE_ID === priceId) return "max";
  if (
    process.env.STRIPE_PRO_PRICE_ID === priceId ||
    process.env.STRIPE_PRICE_ID === priceId
  ) {
    return "pro";
  }
  // Unknown paid prices fail closed to Pro limits. Enterprise access is set
  // explicitly through planKey rather than inferred from an arbitrary price.
  return "pro";
}
