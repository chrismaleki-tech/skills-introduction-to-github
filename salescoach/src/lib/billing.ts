import type { Org } from "@prisma/client";
import { TRIAL_ALLOWANCE } from "./plans";

type BillingOrg = Pick<Org, "planStatus" | "trialEndsAt" | "createdAt" | "subscriptionEndsAt"> &
  Partial<Pick<Org, "suspendedAt" | "suspendedReason" | "compPlanKey" | "compExpiresAt">>;

export type BillingAccess = {
  entitled: boolean;
  status: string;
  trialEndsAt: Date | null;
  daysLeft: number;
  /** Set when a platform owner has paused the workspace. Shown to the customer. */
  suspendedReason?: string;
  /** Set when complimentary access, not Stripe, is what entitles the workspace. */
  compPlanKey?: string;
  compExpiresAt?: Date;
};

const COMP_PLANS = new Set(["pro", "max"]);

/** A paid Stripe subscription is still inside its entitled period. */
export function paidSubscriptionEntitled(
  org: Pick<Org, "planStatus" | "subscriptionEndsAt">,
  now = new Date(),
) {
  if (org.planStatus === "active") return true;
  return Boolean(org.planStatus === "canceled" && org.subscriptionEndsAt && org.subscriptionEndsAt.getTime() > now.getTime());
}

/** Complimentary access is in force only when it has not expired and Stripe is not already entitling the workspace. */
export function complimentaryAccess(
  org: Partial<Pick<Org, "compPlanKey" | "compExpiresAt" | "planStatus" | "subscriptionEndsAt">>,
  now = new Date(),
) {
  if (!org.compPlanKey || !COMP_PLANS.has(org.compPlanKey) || !org.compExpiresAt) return null;
  if (org.compExpiresAt.getTime() <= now.getTime()) return null;
  if (org.planStatus && paidSubscriptionEntitled(org as Pick<Org, "planStatus" | "subscriptionEndsAt">, now)) return null;
  return { planKey: org.compPlanKey, expiresAt: org.compExpiresAt };
}

export function billingAccess(org: BillingOrg, now = new Date()): BillingAccess {
  if (org.suspendedAt) {
    return {
      entitled: false,
      status: "suspended",
      trialEndsAt: org.trialEndsAt,
      daysLeft: 0,
      suspendedReason: org.suspendedReason || "",
    };
  }

  if (paidSubscriptionEntitled(org, now)) {
    if (org.planStatus === "active") {
      return { entitled: true, status: "active", trialEndsAt: null, daysLeft: 0 };
    }
    return { entitled: true, status: "canceled", trialEndsAt: null, daysLeft: 0 };
  }

  const comp = complimentaryAccess(org, now);
  if (comp) {
    return {
      entitled: true,
      status: "comped",
      trialEndsAt: null,
      daysLeft: Math.max(0, Math.ceil((comp.expiresAt.getTime() - now.getTime()) / 86_400_000)),
      compPlanKey: comp.planKey,
      compExpiresAt: comp.expiresAt,
    };
  }

  const fallbackTrialEnd = new Date(org.createdAt.getTime() + TRIAL_ALLOWANCE.days * 24 * 60 * 60 * 1000);
  const trialEndsAt = org.trialEndsAt ?? fallbackTrialEnd;
  const daysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000));
  if (org.planStatus === "trialing" && trialEndsAt.getTime() > now.getTime()) {
    return { entitled: true, status: "trialing", trialEndsAt, daysLeft };
  }

  return { entitled: false, status: org.planStatus, trialEndsAt, daysLeft: 0 };
}

export function billingError(org: BillingOrg, now = new Date()) {
  const access = billingAccess(org, now);
  if (access.entitled) return null;
  if (access.status === "suspended") {
    const reason = access.suspendedReason ? ` ${access.suspendedReason}` : "";
    return {
      error: `Erota has paused AI Role Play and call review for this workspace.${reason} This is not a subscription cancellation, and everything you saved is still here to view.`,
      code: "WORKSPACE_SUSPENDED",
      billingUrl: "/billing",
    };
  }
  if (org.planStatus === "trialing") {
    return {
      error: `Your ${TRIAL_ALLOWANCE.days}-day free trial has ended. Upgrade to Pro or Max to keep using AI Role Play and call review; everything you saved is still here to view.`,
      code: "TRIAL_EXPIRED",
      billingUrl: "/billing",
    };
  }
  return {
    error: "A paid subscription is required to use this feature.",
    code: "SUBSCRIPTION_REQUIRED",
    billingUrl: "/billing",
  };
}
