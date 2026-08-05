import { db } from "./db";
import { planFor, monthlyRunRate } from "./billing";

/**
 * Dogfooding: the platform owner manages customers inside their own product.
 * Every customer tenant is mirrored into the vendor workspace's CRM as an
 * Account plus a subscription Deal (amount = monthly run rate), and notable
 * provisioning events land on the account timeline as Activities. Sync is
 * best-effort (like metering): a CRM hiccup must never fail the triggering
 * admin action.
 */

export async function vendorOrg() {
  return db.org.findFirst({ where: { kind: "vendor" }, select: { id: true } });
}

function dealStageFor(planId: string): string {
  // Trials are still being won; paid editions are closed-won subscriptions.
  return planId === "trial" ? "demo" : "closed_won";
}

/** Mirror one customer tenant into the vendor CRM (account + deal upsert). */
export async function syncTenantToVendorCrm(orgId: string): Promise<void> {
  try {
    const [vendor, org] = await Promise.all([
      vendorOrg(),
      db.org.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          kind: true,
          plan: true,
          billingEmail: true,
          createdAt: true,
          vendorAccountId: true,
          vendorDealId: true,
        },
      }),
    ]);
    if (!vendor || !org || org.kind !== "customer") return;

    const plan = planFor(org.plan);
    const activeSeats = await db.user.count({ where: { orgId: org.id, disabledAt: null } });
    const mrr = monthlyRunRate(plan, activeSeats);
    const owner = await db.user.findFirst({
      where: { orgId: vendor.id, disabledAt: null, role: { in: ["MANAGER", "ADMIN"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    const accountData = {
      orgId: vendor.id,
      ownerId: owner?.id ?? null,
      name: org.name,
      domain: org.billingEmail.split("@")[1] ?? "",
      industry: "SalesCoach customer",
      size: `${activeSeats} seats`,
      website: "",
      notes: `${plan.name} edition · tenant since ${org.createdAt.toISOString().slice(0, 10)} · billing ${
        org.billingEmail || "unset"
      }`,
    };

    let accountId = org.vendorAccountId;
    const existingAccount = accountId
      ? await db.account.findFirst({ where: { id: accountId, orgId: vendor.id } })
      : null;
    if (existingAccount) {
      await db.account.update({ where: { id: existingAccount.id }, data: accountData });
    } else {
      accountId = (await db.account.create({ data: accountData })).id;
    }

    const dealData = {
      orgId: vendor.id,
      accountId,
      ownerId: owner?.id ?? null,
      name: `${org.name} — ${plan.name} subscription`,
      stage: dealStageFor(plan.id),
      amount: Math.round(mrr * 12),
      product: `SalesCoach ${plan.name}`,
      probability: plan.id === "trial" ? 50 : 100,
      nextStep: plan.id === "trial" ? "Convert trial to a paid edition" : "Renewal / expansion check-in",
      notes: `${activeSeats} active seats · ${plan.seatLimit != null ? `limit ${plan.seatLimit}` : "unlimited"} · MRR $${mrr}`,
    };

    let dealId = org.vendorDealId;
    const existingDeal = dealId ? await db.deal.findFirst({ where: { id: dealId, orgId: vendor.id } }) : null;
    if (existingDeal) {
      await db.deal.update({ where: { id: existingDeal.id }, data: dealData });
    } else {
      dealId = (await db.deal.create({ data: dealData })).id;
    }

    if (accountId !== org.vendorAccountId || dealId !== org.vendorDealId) {
      await db.org.update({
        where: { id: org.id },
        data: { vendorAccountId: accountId, vendorDealId: dealId },
      });
    }
  } catch (error) {
    console.error("vendor CRM sync failed", error);
  }
}

/** Drop a provisioning/lifecycle note onto the customer's vendor-CRM timeline. */
export async function logVendorActivity(orgId: string, subject: string, body: string): Promise<void> {
  try {
    const vendor = await vendorOrg();
    const org = await db.org.findUnique({
      where: { id: orgId },
      select: { kind: true, vendorAccountId: true, vendorDealId: true },
    });
    if (!vendor || !org?.vendorAccountId || org.kind !== "customer") return;
    await db.activity.create({
      data: {
        orgId: vendor.id,
        accountId: org.vendorAccountId,
        dealId: org.vendorDealId,
        type: "note",
        subject,
        body,
        occurredAt: new Date(),
      },
    });
  } catch (error) {
    console.error("vendor CRM activity failed", error);
  }
}
