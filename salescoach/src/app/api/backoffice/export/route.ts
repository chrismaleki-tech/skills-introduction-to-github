import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { backofficeActor } from "@/lib/backoffice";
import { recordAudit } from "@/lib/audit";
import { toCsv, csvResponse, type CsvValue } from "@/lib/csv";

const MAX_ROWS = 5000;

type Export = { headers: string[]; rows: CsvValue[][] };

const EXPORTERS: Record<string, (orgId: string) => Promise<Export>> = {
  async users(orgId) {
    const users = await db.user.findMany({
      where: { orgId },
      orderBy: { name: "asc" },
      take: MAX_ROWS,
    });
    return {
      headers: ["name", "email", "role", "title", "status", "last_login", "created_at"],
      rows: users.map((u) => [
        u.name,
        u.email,
        u.role,
        u.title,
        u.disabledAt ? "deactivated" : "active",
        u.lastLoginAt,
        u.createdAt,
      ]),
    };
  },
  async accounts(orgId) {
    const accounts = await db.account.findMany({ where: { orgId }, orderBy: { name: "asc" }, take: MAX_ROWS });
    return {
      headers: ["name", "domain", "industry", "size", "website", "created_at"],
      rows: accounts.map((a) => [a.name, a.domain, a.industry, a.size, a.website, a.createdAt]),
    };
  },
  async contacts(orgId) {
    const contacts = await db.contact.findMany({
      where: { orgId },
      include: { account: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: MAX_ROWS,
    });
    return {
      headers: ["name", "email", "phone", "title", "account", "created_at"],
      rows: contacts.map((c) => [c.name, c.email, c.phone, c.title, c.account?.name ?? "", c.createdAt]),
    };
  },
  async deals(orgId) {
    const deals = await db.deal.findMany({
      where: { orgId },
      include: { account: { select: { name: true } }, owner: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    });
    return {
      headers: ["name", "stage", "amount", "probability", "owner", "account", "close_date", "created_at"],
      rows: deals.map((d) => [
        d.name,
        d.stage,
        d.amount,
        d.probability,
        d.owner?.email ?? "",
        d.account?.name ?? "",
        d.closeDate,
        d.createdAt,
      ]),
    };
  },
  async calls(orgId) {
    const calls = await db.call.findMany({
      where: { orgId },
      include: { rep: { select: { email: true } } },
      orderBy: { callDate: "desc" },
      take: MAX_ROWS,
    });
    return {
      headers: ["call_date", "rep", "prospect", "call_type", "direction", "duration_sec", "source", "status"],
      rows: calls.map((c) => [
        c.callDate,
        c.rep.email,
        c.prospectName,
        c.callType,
        c.direction,
        c.durationSec,
        c.source,
        c.status,
      ]),
    };
  },
  async grades(orgId) {
    const grades = await db.grade.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, take: MAX_ROWS });
    return {
      headers: ["created_at", "subject_type", "overall_score", "band", "manager_override", "graded_by", "summary"],
      rows: grades.map((g) => [
        g.createdAt,
        g.subjectType,
        g.overallScore,
        g.band,
        g.managerOverrideScore,
        g.gradedBy,
        g.summary,
      ]),
    };
  },
  async audit(orgId) {
    const events = await db.auditEvent.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    });
    return {
      headers: ["created_at", "action", "actor_email", "target_type", "target_id", "ip", "meta"],
      rows: events.map((e) => [e.createdAt, e.action, e.actorEmail, e.targetType, e.targetId, e.ip, e.metaJson]),
    };
  },
  async usage(orgId) {
    const events = await db.usageEvent.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    });
    return {
      headers: ["created_at", "type", "quantity", "subject_type", "subject_id"],
      rows: events.map((e) => [e.createdAt, e.type, e.quantity, e.subjectType, e.subjectId]),
    };
  },
};

/**
 * GET /api/backoffice/export?entity=users|accounts|contacts|deals|calls|grades|audit|usage
 * Org-scoped CSV export. Every export is written to the audit trail.
 */
export async function GET(req: Request) {
  const actor = await backofficeActor();
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const entity = new URL(req.url).searchParams.get("entity") ?? "";
  const exporter = EXPORTERS[entity];
  if (!exporter) {
    return NextResponse.json(
      { error: `Unknown entity. Use: ${Object.keys(EXPORTERS).join(", ")}` },
      { status: 400 },
    );
  }

  const { headers, rows } = await exporter(actor.user.orgId);
  await recordAudit({
    actor: actor.user,
    action: "DATA_EXPORTED",
    targetType: "EXPORT",
    targetId: entity,
    orgId: actor.user.orgId,
    req,
    meta: { entity, rows: rows.length },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(`${entity}-${stamp}.csv`, toCsv(headers, rows));
}
