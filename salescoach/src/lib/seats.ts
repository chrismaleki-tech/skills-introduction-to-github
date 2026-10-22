import type { Org } from "@prisma/client";
import { db } from "./db";
import { billingAccess } from "./billing";

/**
 * Seats a trialing workspace may fill before subscribing. Large enough for a
 * team lead to evaluate with a few reps; a solo customer never notices it.
 */
export const TRIAL_SEAT_LIMIT = 5;

/** Hard ceiling on one invite batch, matching the checkout seat cap. */
export const MAX_SEATS = 500;

type SeatOrg = Pick<
  Org,
  | "id"
  | "planKey"
  | "planStatus"
  | "trialEndsAt"
  | "createdAt"
  | "subscriptionEndsAt"
  | "stripeSubscriptionId"
  | "stripeSeatCount"
>;

export type SeatSummary = {
  /** null means unlimited (enterprise agreements managed outside Stripe). */
  limit: number | null;
  members: number;
  pendingInvites: number;
  used: number;
  available: number | null;
  /** Why the limit is what it is; drives the upsell copy. */
  basis: "trial" | "subscription" | "enterprise" | "inactive";
};

export function seatLimitFor(org: SeatOrg): { limit: number | null; basis: SeatSummary["basis"] } {
  if (org.planKey === "enterprise" && !org.stripeSubscriptionId) {
    return { limit: null, basis: "enterprise" };
  }
  const access = billingAccess(org);
  if (org.stripeSubscriptionId && (access.status === "active" || access.status === "canceled")) {
    return { limit: Math.max(1, org.stripeSeatCount), basis: "subscription" };
  }
  if (access.status === "trialing") {
    return { limit: TRIAL_SEAT_LIMIT, basis: "trial" };
  }
  // Lapsed trial or unpaid subscription: no new seats until billing is sorted.
  return { limit: 0, basis: "inactive" };
}

export async function seatSummary(org: SeatOrg): Promise<SeatSummary> {
  const [members, pendingInvites] = await Promise.all([
    db.user.count({ where: { orgId: org.id, removedAt: null } }),
    db.invite.count({
      where: { orgId: org.id, status: "pending", expiresAt: { gt: new Date() } },
    }),
  ]);
  const { limit, basis } = seatLimitFor(org);
  const used = members + pendingInvites;
  return {
    limit,
    members,
    pendingInvites,
    used,
    available: limit === null ? null : Math.max(0, limit - used),
    basis,
  };
}

export function seatLimitMessage(summary: SeatSummary, requested: number) {
  if (summary.limit === null) return null;
  if (requested <= (summary.available ?? 0)) return null;
  const noun = requested === 1 ? "seat" : "seats";
  const inUse = `${summary.used} ${summary.used === 1 ? "is" : "are"} in use`;
  switch (summary.basis) {
    case "trial":
      return `Your free trial includes ${summary.limit} seats and ${inUse}. Subscribe to add more ${noun}.`;
    case "subscription":
      return `Your plan has ${summary.limit} seats and ${inUse}. Add ${requested - (summary.available ?? 0)} more to continue.`;
    case "inactive":
      return "Your subscription is not active. Reactivate billing before adding teammates.";
    default:
      return "No seats available.";
  }
}
