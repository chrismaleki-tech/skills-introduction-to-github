import Link from "next/link";
import { redirect } from "next/navigation";
import { isClerkEnabled } from "@/lib/auth-mode";
import { isAdminEmail, listSignups, adminEmails } from "@/lib/signups";

export const dynamic = "force-dynamic";

export default async function AdminSignupsPage() {
  if (!isClerkEnabled()) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Signups</h1>
        <p className="mt-2 text-muted text-sm">Enable Clerk to use the signup admin view.</p>
      </main>
    );
  }

  if (adminEmails().length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Signups</h1>
        <p className="mt-2 text-muted text-sm">
          Set <code className="text-xs bg-surface-2 px-1 rounded">ADMIN_EMAILS</code> in Vercel to your
          email (comma-separated) to unlock this page.
        </p>
      </main>
    );
  }

  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress;
  if (!isAdminEmail(email)) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Forbidden</h1>
        <p className="mt-2 text-muted text-sm">Your account is not in ADMIN_EMAILS.</p>
      </main>
    );
  }

  const signups = await listSignups(200);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Signups</h1>
          <p className="text-sm text-muted mt-1">
            {signups.length} captured · funnel: signed_up → provisioned → activated
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-brand hover:underline">
          Back to app
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
              signups.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="px-3 py-2 whitespace-nowrap text-muted">
                    {new Date(s.signedUpAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{s.email}</div>
                    {s.name ? <div className="text-xs text-muted">{s.name}</div> : null}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{s.status}</span>
                  </td>
                  <td className="px-3 py-2 text-muted">{s.source}</td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {[s.utmSource, s.utmMedium, s.utmCampaign].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {s.org ? (
                      <div>
                        <div>{s.org.name}</div>
                        <div className="text-xs text-muted">{s.org.planStatus}</div>
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
