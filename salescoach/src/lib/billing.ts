import type { Org } from "@prisma/client";

type BillingOrg = Pick<
  Org,
  "planStatus" | "trialEndsAt" | "createdAt" | "subscriptionEndsAt"
>;

export type BillingAccess = {
  entitled: boolean;
  status: string;
  trialEndsAt: Date | null;
  daysLeft: number;
};

export function billingAccess(org: BillingOrg): BillingAccess {
  if (org.planStatus === "active") {
    return { entitled: true, status: "active", trialEndsAt: null, daysLeft: 0 };
  }

  const fallbackTrialEnd = new Date(org.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
  const trialEndsAt = org.trialEndsAt ?? fallbackTrialEnd;
  const daysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000));
  if (org.planStatus === "trialing" && trialEndsAt.getTime() > Date.now()) {
    return { entitled: true, status: "trialing", trialEndsAt, daysLeft };
  }

  // Keep access through the paid period when cancellation is scheduled.
  if (
    org.planStatus === "canceled" &&
    org.subscriptionEndsAt &&
    org.subscriptionEndsAt.getTime() > Date.now()
  ) {
    return { entitled: true, status: "canceled", trialEndsAt: null, daysLeft: 0 };
  }

  return { entitled: false, status: org.planStatus, trialEndsAt, daysLeft: 0 };
}

export function billingError(org: BillingOrg) {
  const access = billingAccess(org);
  if (access.entitled) return null;
  return {
    error: "A paid subscription is required to use this feature.",
    code: "SUBSCRIPTION_REQUIRED",
    billingUrl: "/billing",
  };
}
