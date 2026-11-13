import Link from "next/link";
import { FILTERS, listWorkspaces, PAGE_SIZE, type WorkspaceFilter } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

function parseFilter(value: string | undefined): WorkspaceFilter {
  return FILTERS.includes(value as WorkspaceFilter) ? (value as WorkspaceFilter) : "all";
}

function when(value: Date | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function minutes(seconds: number | null) {
  if (seconds === null) return "No fixed cap";
  return `${Math.max(0, Math.ceil(seconds / 60))} min`;
}

export default async function WorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const filter = parseFilter(params.filter);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const result = await listWorkspaces({ q, filter, page });
  const query = (nextPage: number) => {
    const search = new URLSearchParams();
    if (q.trim()) search.set("q", q.trim());
    if (filter !== "all") search.set("filter", filter);
    if (nextPage > 1) search.set("page", String(nextPage));
    const text = search.toString();
    return text ? `/admin/workspaces?${text}` : "/admin/workspaces";
  };

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Workspaces</h1>
      <p className="mt-1 text-sm text-muted">
        {result.total} matching. Page {result.page} of {result.pages}, {PAGE_SIZE} per page. Usage on a paid plan is
        the first member&apos;s seat for this period; the workspace page lists every member.
      </p>

      <form method="get" className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input
          name="q"
          defaultValue={q}
          placeholder="Name, slug, id, or member email"
          className="min-h-10 flex-1 rounded-lg border border-line px-3 text-sm"
        />
        <select name="filter" defaultValue={filter} className="min-h-10 rounded-lg border border-line px-3 text-sm">
          <option value="all">All</option>
          <option value="trialing">Active trials</option>
          <option value="trial_expired">Expired trials</option>
          <option value="paying">Paying</option>
          <option value="suspended">Paused by Erota</option>
          <option value="comped">Complimentary, in effect</option>
        </select>
        <button type="submit" className="min-h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white">
          Search
        </button>
      </form>

      {result.workspaces.length === 0 ? (
        <p className="mt-8 rounded-lg border border-line px-4 py-8 text-center text-sm text-muted">
          No workspaces match this search.
          {page > 1 && (
            <>
              {" "}
              <Link href={query(1)} className="text-brand underline">
                Back to the first page
              </Link>
            </>
          )}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Workspace</th>
                <th className="px-3 py-2 font-medium">Contact</th>
                <th className="px-3 py-2 font-medium">Access</th>
                <th className="px-3 py-2 font-medium">Allowance</th>
                <th className="px-3 py-2 font-medium">Dates</th>
              </tr>
            </thead>
            <tbody>
              {result.workspaces.map((org) => (
                <tr key={org.id} className="border-t border-line align-top">
                  <td className="px-3 py-3">
                    <Link href={`/admin/workspaces/${org.id}`} className="font-medium text-brand hover:underline">
                      {org.name}
                    </Link>
                    <div className="mt-1 font-mono text-xs text-muted" title={org.id}>
                      {org.id}
                    </div>
                    <div className="text-xs text-muted">{org.users.length} members</div>
                  </td>
                  <td className="px-3 py-3">
                    {org.contact ? (
                      <>
                        <div>{org.contact.name || "Unnamed"}</div>
                        <div className="text-xs text-muted">{org.contact.email}</div>
                        <div className="text-xs text-muted">{org.contact.role.toLowerCase()}</div>
                      </>
                    ) : (
                      <span className="text-muted">No members</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div>{org.access.status}</div>
                    <div className="text-xs text-muted">
                      Stored plan {org.planKey} · Stripe status {org.planStatus}
                    </div>
                    <div className="text-xs text-muted">Trial through {when(org.access.trialEndsAt ?? org.trialEndsAt)}</div>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <div>
                      AI Role Play {minutes(org.usage.roleplay.remainingSeconds)} left of {minutes(org.usage.roleplay.limitSeconds)}
                    </div>
                    <div>
                      Call review {minutes(org.usage.callReview.remainingSeconds)} left of {minutes(org.usage.callReview.limitSeconds)}
                    </div>
                    <div className="text-muted">{org.usage.roleplay.scope === "workspace" ? "Shared by the workspace" : "Per seat this period"}</div>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted">
                    <div>Created {when(org.createdAt)}</div>
                    <div>Last activity {when(org.lastActivity)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {result.page > 1 ? (
            <Link href={query(result.page - 1)} className="text-brand underline">
              Previous
            </Link>
          ) : (
            <span />
          )}
          {result.page < result.pages ? (
            <Link href={query(result.page + 1)} className="text-brand underline">
              Next
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </main>
  );
}
