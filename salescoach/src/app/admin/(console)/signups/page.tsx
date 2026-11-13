import Link from "next/link";
import { listSignups } from "@/lib/signups";

export const dynamic = "force-dynamic";

export default async function AdminSignupsPage() {
  const signups = await listSignups(200);

  return (
    <main>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Signups</h1>
          <p className="mt-1 text-sm text-muted">
            {signups.length} captured · funnel: signed_up → provisioned → activated
          </p>
        </div>
        <Link href="/admin" className="text-sm text-brand hover:underline">
          Overview
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">UTM</th>
              <th className="px-3 py-2 font-medium">Org</th>
            </tr>
          </thead>
          <tbody>
            {signups.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted">
                  No signups yet. New Clerk accounts appear here via webhook or first login.
                </td>
              </tr>
            ) : (
              signups.map((signup) => (
                <tr key={signup.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{new Date(signup.signedUpAt).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{signup.email}</div>
                    {signup.name ? <div className="text-xs text-muted">{signup.name}</div> : null}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{signup.status}</span>
                  </td>
                  <td className="px-3 py-2 text-muted">{signup.source}</td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {[signup.utmSource, signup.utmMedium, signup.utmCampaign].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {signup.org ? (
                      <div>
                        <Link href={`/admin/workspaces/${signup.org.id}`} className="text-brand hover:underline">
                          {signup.org.name}
                        </Link>
                        <div className="text-xs text-muted">{signup.org.planStatus}</div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
