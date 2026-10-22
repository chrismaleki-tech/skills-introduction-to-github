import Link from "next/link";
import { redirect } from "next/navigation";
import { isClerkEnabled } from "@/lib/auth-mode";
import { resolveJoinToken } from "@/lib/invites";
import { currentUser } from "@/lib/session";
import { BrandLockup } from "@/components/brand-logo";
import { JoinTeamButton } from "@/components/team/join-team-button";

export const dynamic = "force-dynamic";

function roleLabel(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export default async function JoinConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const target = await resolveJoinToken(token);

  if (target && isClerkEnabled()) {
    const { auth } = await import("@clerk/nextjs/server");
    if (!(await auth()).userId) redirect(`/join/${encodeURIComponent(token)}`);
  }

  const user = target ? await currentUser() : null;
  if (user && target && user.orgId === target.orgId) redirect("/getting-started?joined=1");

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-start gap-6 bg-[linear-gradient(180deg,#f0f9fb_0%,#ffffff_45%)] px-3 py-4 sm:justify-center sm:px-4 sm:py-8">
      <Link href="/" aria-label="Erota Sales Intelligence home" className="mt-2 sm:mt-0">
        <BrandLockup size="lg" textClassName="font-display text-marketing-ink" />
      </Link>
      <div className="w-full max-w-[25rem] rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
        {!target || !user ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight">This invite link is no longer valid</h1>
            <p className="mt-2 text-sm text-muted">
              It may have expired, been revoked, or already been used. Ask your team admin to send a new
              one.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold hover:bg-surface-2"
            >
              Go to my workspace
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight">Join {target.orgName}?</h1>
            <p className="mt-2 text-sm text-muted">
              You&apos;ll join as a <span className="font-medium text-foreground">{roleLabel(target.role)}</span>.
              You&apos;re currently in <span className="font-medium text-foreground">{user.org.name}</span>; your
              account moves to {target.orgName} and that team keeps its own data.
            </p>
            {target.kind === "invite" && target.email !== user.email && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This invite was sent to {target.email}. You are signed in as {user.email}; sign in with the
                invited address to accept it.
              </p>
            )}
            <div className="mt-6 flex flex-col gap-2">
              <JoinTeamButton token={token} orgName={target.orgName} />
              <Link
                href="/dashboard"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold hover:bg-surface-2"
              >
                Not now
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
