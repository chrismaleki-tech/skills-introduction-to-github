/**
 * Live admin audit against the isolated preview.
 *
 * Reads DATABASE_URL only after previewConnectionTarget accepts it. That helper
 * allows the database name erota_preview and refuses neondb. It does not read
 * any other connection variable. This script never runs prisma db push.
 *
 * Required to execute the authenticated cases, provided outside chat:
 *   ADMIN_PREVIEW_BASE_URL
 *   DATABASE_URL            database name must be erota_preview
 *   CLERK_SECRET_KEY        Clerk Backend API for the preview instance
 *   VERCEL_AUTOMATION_BYPASS_SECRET
 * Optional:
 *   ADMIN_PREVIEW_OWNER_EMAIL   verified platform owner, default johnny.davis@erota.io
 *   CHROME_PATH
 */
import { PrismaClient } from "@prisma/client";
import { previewBaseUrl, previewConnectionTarget } from "../src/lib/preview-target";

type Status = "passed" | "failed" | "unverified";
type Case = { name: string; status: Status; evidence: string };

const cases: Case[] = [];
const RUN = `audit${Date.now().toString(36)}`;
const OWNER_EMAIL = (process.env.ADMIN_PREVIEW_OWNER_EMAIL || "johnny.davis@erota.io").toLowerCase();

function record(name: string, status: Status, evidence: string) {
  cases.push({ name, status, evidence });
}

function sanitize(value: unknown) {
  const text = value instanceof Error ? value.message : String(value);
  return text.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-connection]").replace(/sk_(test|live)_\S+/g, "[redacted-clerk-key]").slice(0, 500);
}

async function main() {
  const baseRaw = process.env.ADMIN_PREVIEW_BASE_URL?.trim();
  const databaseRaw = process.env.DATABASE_URL;
  const clerkKey = process.env.CLERK_SECRET_KEY?.trim() || "";
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() || "";

  let base: URL | null = null;
  try {
    base = previewBaseUrl(baseRaw);
  } catch (error) {
    record("preview url", "unverified", sanitize(error));
  }

  let target: { host: string; database: string } | null = null;
  try {
    target = previewConnectionTarget(process.env.DATABASE_URL);
    record("database target", "passed", `host ${target.host}, database ${target.database}`);
  } catch (error) {
    record("database target", "unverified", sanitize(error));
  }

  if (!base) return finish(2);
  const origin = base.origin;

  const probe = await probePreview(origin, bypass);
  if (!probe.reachable) {
    record("signed-out /admin", "unverified", probe.evidence);
    record("signed-out admin API", "unverified", probe.evidence);
    record("ordinary member", "unverified", "Blocked before Clerk. " + probe.evidence);
    record("workspace Admin", "unverified", "Blocked before Clerk. " + probe.evidence);
    record("unverified account", "unverified", "Blocked before Clerk. " + probe.evidence);
    record("owner read", "unverified", "Blocked before Clerk. " + probe.evidence);
    record("confirmation and audit", "unverified", "Blocked before a disposable workspace could be created.");
    record("workspace isolation", "unverified", "Blocked before a disposable workspace could be created.");
    record("entitlement enforcement", "unverified", "Blocked before a disposable workspace could be created.");
    if (!bypass) record("setup", "unverified", "VERCEL_AUTOMATION_BYPASS_SECRET is not set. Deployment protection is still enabled; this run did not ask for it to be turned off.");
    if (!clerkKey) record("setup", "unverified", "CLERK_SECRET_KEY is not set.");
    if (!target) record("setup", "unverified", "DATABASE_URL for erota_preview is not available to this run.");
    return finish(2);
  }
  record("deployment protection", "passed", probe.evidence);

  await signedOut(origin, bypass);

  if (!clerkKey || !target) {
    record("ordinary member", "unverified", missingAuth(clerkKey, target));
    record("workspace Admin", "unverified", missingAuth(clerkKey, target));
    record("unverified account", "unverified", missingAuth(clerkKey, target));
    record("owner read", "unverified", missingAuth(clerkKey, target));
    record("confirmation and audit", "unverified", missingAuth(clerkKey, target));
    record("workspace isolation", "unverified", missingAuth(clerkKey, target));
    record("entitlement enforcement", "unverified", missingAuth(clerkKey, target));
    return finish(2);
  }

  const db = new PrismaClient({ datasourceUrl: databaseRaw });
  const createdClerkIds: string[] = [];
  try {
    const current = await db.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
    const name = current[0]?.current_database;
    if (name !== "erota_preview") {
      record("database session", "failed", `current_database() is ${name ?? "unknown"}. No rows were written.`);
      return finish(1);
    }
    record("database session", "passed", "current_database() is erota_preview");

    const owner = await clerkUsersByEmail(clerkKey, OWNER_EMAIL);
    if (owner.length !== 1) {
      record("owner account", "unverified", `Clerk returned ${owner.length} users for ${OWNER_EMAIL}. No sign-in token was created.`);
      return finish(2);
    }
    const ownerId = String(owner[0].id);

    const member = await createClerkUser(clerkKey, `preview-audit+rep+${RUN}@example.com`, true);
    createdClerkIds.push(member.id);
    const admin = await createClerkUser(clerkKey, `preview-audit+admin+${RUN}@example.com`, true);
    createdClerkIds.push(admin.id);
    const unverified = await createClerkUser(clerkKey, `preview-audit+unverified+${RUN}@example.com`, false);
    createdClerkIds.push(unverified.id);

    const future = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const orgA = await db.org.create({
      data: { name: `Preview audit ${RUN} A`, slug: `preview-audit-${RUN}-a`, planStatus: "trialing", planKey: "trial", trialEndsAt: new Date(Date.now() + 3 * 86_400_000) },
    });
    const orgB = await db.org.create({
      data: { name: `Preview audit ${RUN} B`, slug: `preview-audit-${RUN}-b`, planStatus: "trialing", planKey: "trial", trialEndsAt: new Date(Date.now() + 3 * 86_400_000) },
    });
    const rep = await db.user.create({
      data: { orgId: orgA.id, clerkId: member.id, name: "Preview rep", email: member.email, role: "REP" },
    });
    const workspaceAdmin = await db.user.create({
      data: { orgId: orgA.id, clerkId: admin.id, name: "Preview admin", email: admin.email, role: "ADMIN" },
    });
    const outsider = await db.user.create({
      data: { orgId: orgB.id, clerkId: unverified.id, name: "Other workspace", email: `preview-audit+other+${RUN}@example.com`, role: "ADMIN" },
    });
    const scenario = await db.scenario.create({ data: { orgId: orgA.id, title: `Audit ${RUN}`, personaJson: "{}" } });

    await withSession(origin, bypass, clerkKey, member.id, async (page) => {
      const adminPage = await page.goto(`${origin}/admin`, { waitUntil: "domcontentloaded" });
      const landed = page.url();
      const body = await page.locator("body").innerText();
      const refused = landed.includes("/admin/access") || /not a platform owner/i.test(body);
      record(
        "ordinary member",
        refused && !/Signed in as/i.test(body) ? "passed" : "failed",
        `landed ${new URL(landed).pathname}, http ${adminPage?.status() ?? "none"}`,
      );
      const api = await apiFetch(page, "/api/admin/signups");
      record(
        "ordinary member API",
        api.status === 403 && !api.text.includes("trial.extend") ? "passed" : "failed",
        `GET /api/admin/signups ${api.status}`,
      );
    });

    await withSession(origin, bypass, clerkKey, admin.id, async (page) => {
      await page.goto(`${origin}/admin`, { waitUntil: "domcontentloaded" });
      const body = await page.locator("body").innerText();
      const api = await apiFetch(page, "/api/admin/signups");
      const mutation = await apiForm(page, `/api/admin/workspaces/${orgA.id}/suspension`, { reason: "A workspace Admin must not pause the org", confirm: "SUSPEND" });
      const paused = await db.org.findUnique({ where: { id: orgA.id }, select: { suspendedAt: true } });
      const audits = await db.adminAudit.count({ where: { orgId: orgA.id } });
      const ok = /not a platform owner/i.test(body) && api.status === 403 && paused?.suspendedAt == null && audits === 0 && !mutation.text.includes("paused");
      record("workspace Admin", ok ? "passed" : "failed", `API ${api.status}, suspendedAt ${paused?.suspendedAt ? "set" : "null"}, audits ${audits}`);
    });

    await withSession(origin, bypass, clerkKey, unverified.id, async (page) => {
      await page.goto(`${origin}/admin`, { waitUntil: "domcontentloaded" });
      const body = await page.locator("body").innerText();
      const api = await apiFetch(page, "/api/admin/signups");
      const ok = /not verified/i.test(body) && api.status === 403;
      record("unverified account", ok ? "passed" : "failed", `API ${api.status}. An unverified address is ignored before the allowlist.`);
    });

    await withSession(origin, bypass, clerkKey, ownerId, async (page) => {
      await page.goto(`${origin}/admin`, { waitUntil: "domcontentloaded" });
      const home = await page.locator("body").innerText();
      const list = await page.goto(`${origin}/admin/workspaces`, { waitUntil: "domcontentloaded" });
      const detail = await page.goto(`${origin}/admin/workspaces/${orgA.id}`, { waitUntil: "domcontentloaded" });
      const detailText = await page.locator("body").innerText();
      const ownerOk = /Signed in as/i.test(home) && (list?.status() ?? 500) < 400 && (detail?.status() ?? 500) < 400 && detailText.includes(orgA.name) && !detailText.includes("1970");
      record("owner read", ownerOk ? "passed" : "failed", `detail http ${detail?.status() ?? "none"}; trial copy omits 1970: ${!detailText.includes("1970")}`);

      const bad = await apiForm(page, `/api/admin/workspaces/${orgA.id}/trial`, {
        date: future,
        reason: "Wrong confirmation must not extend this disposable trial",
        confirm: "NO",
      });
      const unchanged = await db.org.findUnique({ where: { id: orgA.id }, select: { trialEndsAt: true } });
      const auditsAfterBad = await db.adminAudit.count({ where: { orgId: orgA.id } });
      const good = await apiForm(page, `/api/admin/workspaces/${orgA.id}/trial`, {
        date: future,
        reason: "Automated preview check of a disposable workspace",
        confirm: "EXTEND",
      });
      const changed = await db.org.findUnique({ where: { id: orgA.id }, select: { trialEndsAt: true } });
      const audit = await db.adminAudit.findFirst({ where: { orgId: orgA.id, action: "trial.extend" }, orderBy: { createdAt: "desc" } });
      const confirmOk =
        auditsAfterBad === 0 &&
        unchanged?.trialEndsAt?.toISOString() !== changed?.trialEndsAt?.toISOString() &&
        audit?.actorEmail === OWNER_EMAIL &&
        audit.reason.includes("disposable") &&
        audit.beforeJson.includes("trialEndsAt") &&
        audit.afterJson.includes(future.slice(0, 4)) &&
        good.url.includes("ok=") &&
        bad.url.includes("error=");
      record("confirmation and audit", confirmOk ? "passed" : "failed", `bad ${bad.status}, good ${good.status}, audit ${audit?.action ?? "missing"} by ${audit?.actorEmail ?? "nobody"}`);

      const cross = await apiForm(page, `/api/admin/workspaces/${orgA.id}/members/${outsider.id}/role`, {
        role: "REP",
        reason: "This member belongs to the other disposable workspace",
        confirm: "ROLE",
      });
      const [stillAdmin, stillRep] = await Promise.all([
        db.user.findUnique({ where: { id: outsider.id }, select: { role: true, orgId: true } }),
        db.user.findUnique({ where: { id: rep.id }, select: { role: true, orgId: true } }),
      ]);
      const isolated = stillAdmin?.role === "ADMIN" && stillAdmin.orgId === orgB.id && stillRep?.role === "REP" && stillRep.orgId === orgA.id && cross.url.includes("error=");
      record("workspace isolation", isolated ? "passed" : "failed", `cross-workspace role post landed ${cross.url.includes("error=") ? "on an error" : "without an error"}`);

      const suspend = await apiForm(page, `/api/admin/workspaces/${orgA.id}/suspension`, {
        reason: "Pause the disposable workspace for the entitlement check",
        confirm: "SUSPEND",
      });
      await withSession(origin, bypass, clerkKey, member.id, async (memberPage) => {
        const blocked = await apiJson(memberPage, "/api/roleplay", { scenarioId: scenario.id, mode: "TEXT" });
        const code = readCode(blocked.text);
        record(
          "entitlement enforcement",
          blocked.status === 402 && code === "WORKSPACE_SUSPENDED" && suspend.url.includes("ok=") ? "passed" : "failed",
          `role-play start ${blocked.status} ${code ?? "no code"}. Stripe was not called; suspension is a local entitlement.`,
        );
      });
      await apiForm(page, `/api/admin/workspaces/${orgA.id}/suspension`, {
        reason: "Restore the disposable workspace after the entitlement check",
        confirm: "RESTORE",
      });
      const restored = await db.org.findUnique({ where: { id: orgA.id }, select: { suspendedAt: true, planStatus: true, stripeSubscriptionId: true } });
      if (restored?.suspendedAt || restored?.stripeSubscriptionId) {
        record("restore disposable workspace", "failed", "The disposable workspace was left paused or gained a Stripe id.");
      } else {
        record("restore disposable workspace", "passed", `plan status ${restored?.planStatus}, suspendedAt null, no Stripe subscription id`);
      }
    });

    if (workspaceAdmin.role !== "ADMIN" || workspaceAdmin.orgId !== orgA.id) {
      record("workspace Admin fixture", "failed", "The disposable workspace Admin was not stored on workspace A.");
    }
  } catch (error) {
    record("authenticated run", "failed", sanitize(error));
  } finally {
    await cleanup(db, createdClerkIds, clerkKey);
    await db.$disconnect();
  }
  return finish(cases.some((item) => item.status === "failed") ? 1 : cases.some((item) => item.status === "unverified") ? 2 : 0);
}

function missingAuth(clerkKey: string, target: { host: string; database: string } | null) {
  const missing = [clerkKey ? "" : "CLERK_SECRET_KEY", target ? "" : "an accepted DATABASE_URL"].filter(Boolean);
  return `Missing ${missing.join(" and ")}. No Clerk user or workspace was created.`;
}

async function probePreview(origin: string, bypass: string) {
  try {
    const response = await fetch(`${origin}/api/health`, { headers: bypassHeaders(bypass), redirect: "manual" });
    const location = response.headers.get("location") ?? "";
    if (location.includes("vercel.com/sso-api") || response.status === 401 && (await response.text()).includes("Protected by Vercel")) {
      return { reachable: false, evidence: `Preview returned ${response.status} to Vercel authentication before the app.` };
    }
    if (response.status >= 400) {
      return { reachable: false, evidence: `Preview /api/health returned ${response.status}.` };
    }
    return { reachable: true, evidence: `/api/health returned ${response.status} from the app.` };
  } catch (error) {
    return { reachable: false, evidence: sanitize(error) };
  }
}

async function signedOut(origin: string, bypass: string) {
  const headers = bypassHeaders(bypass);
  const page = await fetch(`${origin}/admin`, { headers, redirect: "manual" });
  const pageLocation = page.headers.get("location") ?? "";
  const api = await fetch(`${origin}/api/admin/signups`, { headers, redirect: "manual" });
  const apiText = await api.text();
  const post = await fetch(`${origin}/api/admin/workspaces/preview-audit-missing/trial`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/x-www-form-urlencoded" },
    body: "date=2027-01-01&reason=should-not-apply-at-all&confirm=EXTEND",
    redirect: "manual",
  });
  const postText = await post.text();
  const pageOk = page.status === 307 || page.status === 302 ? pageLocation.includes("/sign-in") : page.status === 401;
  const apiOk = (api.status === 401 || api.status === 403) && !apiText.includes("@") && !apiText.includes("trial.extend");
  const postOk = (post.status === 401 || post.status === 403) && !postText.includes("Trial end date updated");
  record("signed-out /admin", pageOk ? "passed" : "failed", `status ${page.status}, location ${pageLocation ? new URL(pageLocation, origin).pathname : "none"}`);
  record("signed-out admin API", apiOk && postOk ? "passed" : "failed", `GET ${api.status}, POST trial ${post.status}`);
}

function bypassHeaders(bypass: string): Record<string, string> {
  if (!bypass) return {};
  return { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" };
}

async function withSession(origin: string, bypass: string, clerkKey: string, userId: string, run: (page: import("playwright-core").Page) => Promise<void>) {
  const { chromium } = await import("playwright-core");
  const token = await createSignInToken(clerkKey, userId);
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const context = await browser.newContext({ extraHTTPHeaders: bypassHeaders(bypass) });
    const page = await context.newPage();
    await page.goto(`${origin}/sign-in?__clerk_ticket=${encodeURIComponent(token)}`, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForTimeout(1000);
    await run(page);
  } finally {
    await browser.close();
  }
}

async function apiFetch(page: import("playwright-core").Page, path: string) {
  return page.evaluate(async (target) => {
    const response = await fetch(target, { credentials: "include" });
    return { status: response.status, text: (await response.text()).slice(0, 400), url: response.url };
  }, path);
}

async function apiForm(page: import("playwright-core").Page, path: string, fields: Record<string, string>) {
  return page.evaluate(async ({ target, fields: bodyFields }) => {
    const body = new URLSearchParams(bodyFields);
    const response = await fetch(target, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    return { status: response.status, text: (await response.text()).slice(0, 400), url: response.url };
  }, { target: path, fields });
}

async function apiJson(page: import("playwright-core").Page, path: string, body: unknown) {
  return page.evaluate(async ({ target, payload }) => {
    const response = await fetch(target, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { status: response.status, text: (await response.text()).slice(0, 400), url: response.url };
  }, { target: path, payload: body });
}

function readCode(text: string) {
  try {
    const parsed = JSON.parse(text) as { code?: string };
    return parsed.code ?? null;
  } catch {
    return null;
  }
}

async function clerk(clerkKey: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${clerkKey}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Clerk ${path} returned ${response.status}: ${text.slice(0, 180)}`);
  return text ? JSON.parse(text) : null;
}

async function clerkUsersByEmail(clerkKey: string, email: string) {
  const rows = await clerk(clerkKey, `/users?email_address=${encodeURIComponent(email)}`);
  return Array.isArray(rows) ? rows as Array<{ id: string }> : [];
}

async function createClerkUser(clerkKey: string, email: string, verified: boolean) {
  const user = await clerk(clerkKey, "/users", {
    method: "POST",
    body: JSON.stringify({ email_address: [email], skip_password_requirement: true }),
  }) as { id: string; email_addresses?: Array<{ id: string }> };
  if (verified) {
    const emailId = user.email_addresses?.[0]?.id;
    if (!emailId) throw new Error("Clerk did not return an email id to verify.");
    await clerk(clerkKey, `/email_addresses/${emailId}`, { method: "PATCH", body: JSON.stringify({ verified: true }) });
  }
  return { id: user.id, email };
}

async function createSignInToken(clerkKey: string, userId: string) {
  const token = await clerk(clerkKey, "/sign_in_tokens", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 300 }),
  }) as { token?: string };
  if (!token.token) throw new Error("Clerk did not return a sign-in token.");
  return token.token;
}

async function cleanup(db: PrismaClient, clerkIds: string[], clerkKey: string) {
  const prefixed = await db.org.findMany({ where: { slug: { startsWith: `preview-audit-${RUN}` } }, select: { id: true } });
  const linked = clerkIds.length
    ? await db.user.findMany({ where: { clerkId: { in: clerkIds } }, select: { orgId: true } })
    : [];
  const candidateIds = [...new Set([...prefixed.map((org) => org.id), ...linked.map((user) => user.orgId)])];
  const ids: string[] = [];
  for (const orgId of candidateIds) {
    const [org, members] = await Promise.all([
      db.org.findUnique({ where: { id: orgId }, select: { slug: true } }),
      db.user.findMany({ where: { orgId }, select: { clerkId: true } }),
    ]);
    const onlyCreatedUsers = members.length > 0 && members.every((member) => member.clerkId && clerkIds.includes(member.clerkId));
    if (org?.slug.startsWith(`preview-audit-${RUN}`) || onlyCreatedUsers) ids.push(orgId);
  }
  if (ids.length) {
    await db.adminAudit.deleteMany({ where: { orgId: { in: ids } } });
    await db.signupEvent.deleteMany({ where: { OR: [{ orgId: { in: ids } }, { clerkUserId: { in: clerkIds } }] } });
    await db.roleplaySession.deleteMany({ where: { orgId: { in: ids } } });
    await db.scenario.deleteMany({ where: { orgId: { in: ids } } });
    await db.user.deleteMany({ where: { orgId: { in: ids } } });
    await db.org.deleteMany({ where: { id: { in: ids } } });
  } else if (clerkIds.length) {
    await db.signupEvent.deleteMany({ where: { clerkUserId: { in: clerkIds } } });
  }
  if (!clerkKey) return;
  for (const id of clerkIds) {
    await fetch(`https://api.clerk.com/v1/users/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${clerkKey}` } }).catch(() => undefined);
  }
}

function finish(code: number) {
  const summary = {
    passed: cases.filter((item) => item.status === "passed").length,
    failed: cases.filter((item) => item.status === "failed").length,
    unverified: cases.filter((item) => item.status === "unverified").length,
    cases,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(code);
}

main().catch((error) => {
  record("runner", "failed", sanitize(error));
  finish(1);
});
