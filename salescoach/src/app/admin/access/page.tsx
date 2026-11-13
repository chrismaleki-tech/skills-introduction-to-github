import Link from "next/link";
import { redirect } from "next/navigation";
import { platformOwnerFromClerk } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export default async function PlatformAccessPage() {
  const gate = await platformOwnerFromClerk();
  if (gate.ok) redirect("/admin");

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Erota platform</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {gate.status === 403 ? "This account is not a platform owner" : "Platform admin is not available yet"}
      </h1>
      <p className="mt-3 text-sm text-muted">
        A workspace Admin manages one customer workspace. A platform owner is an Erota operator named in the
        server allowlist. Being a workspace Admin, or having an @erota.io address, does not grant this dashboard.
      </p>

      {gate.status === 403 && (
        <p className="mt-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
          {gate.error}
          {gate.email ? (
            <>
              {" "}
              The verified address checked was <span className="font-medium">{gate.email}</span>.
            </>
          ) : null}{" "}
          An unverified address is ignored, even if it is listed in the server allowlist. A workspace Admin role is
          not checked and cannot grant this page.
        </p>
      )}

      {gate.status === 503 && !process.env.ADMIN_EMAILS?.trim() && (
        <p className="mt-4 text-sm">
          The server has no <code className="rounded bg-surface-2 px-1 text-xs">ADMIN_EMAILS</code> value, so nobody
          can be authorized.
        </p>
      )}

      {gate.status === 503 && !process.env.CLERK_SECRET_KEY && (
        <p className="mt-4 text-sm">Platform admin uses Clerk. This server does not have Clerk configured.</p>
      )}

      <h2 className="mt-8 text-lg font-semibold">Authorize an existing account</h2>
      <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm">
        <li>
          Sign up or sign in at Erota with the exact email you want to use.{" "}
          <code className="rounded bg-surface-2 px-1 text-xs">ADMIN_EMAILS</code> does not create a Clerk account. If
          sign-in says the account cannot be found, use Sign up with that same email first.
        </li>
        <li>
          In the Vercel project <span className="font-medium">erota-salescoach</span>, open Settings, then Environment
          Variables. Edit the existing <code className="rounded bg-surface-2 px-1 text-xs">ADMIN_EMAILS</code> value.
          Do not add a second variable with the same name. Add the email, separated by a comma, for Production and
          redeploy so the server reads it.
        </li>
        <li>
          Sign in with that account and open <Link href="/admin" className="text-brand underline">/admin</Link>.
        </li>
      </ol>
      <p className="mt-6 text-sm text-muted">
        Public signup never grants platform access. No password is created here.
      </p>
    </main>
  );
}
