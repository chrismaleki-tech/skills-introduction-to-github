import Link from "next/link";
import { adminSchemaStatus, requirePlatformOwnerPage } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/workspaces", label: "Workspaces" },
  { href: "/admin/signups", label: "Signups" },
];

export default async function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePlatformOwnerPage();
  const schema = await adminSchemaStatus();
  return (
    <div className="min-h-screen bg-white text-marketing-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">Erota platform</div>
            <div className="text-sm">Signed in as {actor.email}</div>
          </div>
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="font-medium text-brand hover:underline">
                {link.label}
              </Link>
            ))}
            <Link href="/me" className="text-muted hover:underline">
              Customer app
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{schema.ready ? children : <SchemaRequired schema={schema} />}</div>
    </div>
  );
}

function SchemaRequired({
  schema,
}: {
  schema: Awaited<ReturnType<typeof adminSchemaStatus>>;
}) {
  const where = [schema.host, schema.database].filter(Boolean).join(" / ") || "the database in DATABASE_URL";
  return (
    <main className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">This database is not ready for the dashboard</h1>
      <p className="mt-3 text-sm">
        You are signed in as a platform owner. The overview did not fail the permission check. It queries{" "}
        <code className="rounded bg-surface-2 px-1 text-xs">Org.suspendedAt</code> and the{" "}
        <code className="rounded bg-surface-2 px-1 text-xs">AdminAudit</code> table. Those objects are not on{" "}
        <span className="font-medium">{where}</span>
        {schema.reachable ? "" : ", or that database could not be read"}.
      </p>
      <p className="mt-3 text-sm text-muted">
        The browser message “Minified React error #441” is only the production stand-in for that server exception. It
        is not a separate React bug in the page.
      </p>
      {!schema.reachable ? null : (
        <p className="mt-3 text-sm">
          Missing: {schema.missingColumns.length ? schema.missingColumns.join(", ") : "none"}. AdminAudit table:{" "}
          {schema.auditTable ? "present" : "absent"}.
        </p>
      )}
      <p className="mt-3 text-sm">
        If this host is the production database, stop. Do not run the migration against it from this preview. Point
        the preview’s <code className="rounded bg-surface-2 px-1 text-xs">DATABASE_URL</code> at a separate test
        database, redeploy the preview, then run <code className="rounded bg-surface-2 px-1 text-xs">salescoach/prisma/sql/2026-11-12-platform-admin.sql</code>{" "}
        once on that test database. Do not also run <code className="rounded bg-surface-2 px-1 text-xs">prisma db push</code>.
      </p>
    </main>
  );
}
