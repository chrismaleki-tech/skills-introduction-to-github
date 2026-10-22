import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isClerkEnabled } from "@/lib/auth-mode";
import { BrandLockup } from "@/components/brand-logo";
import { StartFreshButton } from "@/components/team/start-fresh-button";
import { ClerkUserMenu } from "@/components/clerk-user-menu";

export const dynamic = "force-dynamic";

// Shown to a signed-in account whose seat was removed. They can wait for a new
// invite (signing in again picks it up) or start a solo workspace of their own.

export default async function RemovedPage() {
  if (!isClerkEnabled()) redirect("/dashboard");
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await db.user.findUnique({ where: { clerkId: userId }, include: { org: true } });
  if (!user || !user.removedAt) redirect("/dashboard");

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-start gap-6 bg-[linear-gradient(180deg,#f0f9fb_0%,#ffffff_45%)] px-3 py-4 sm:justify-center sm:px-4 sm:py-8">
      <Link href="/" aria-label="Erota Sales Intelligence home" className="mt-2 sm:mt-0">
        <BrandLockup size="lg" textClassName="font-display text-marketing-ink" />
      </Link>
      <div className="w-full max-w-[25rem] rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">Your access to {user.org.name} has ended</h1>
        <p className="mt-2 text-sm text-muted">
          An admin removed your seat. If that was a mistake, ask them to invite {user.email} again and
          then sign in; you&apos;ll be placed right back on the team.
        </p>
        <p className="mt-3 text-sm text-muted">
          Or keep practicing on your own: start a personal workspace with a fresh 14-day trial.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <StartFreshButton />
          <div className="flex items-center justify-center gap-2 text-xs text-muted">
            Signed in as {user.email}
            <ClerkUserMenu />
          </div>
        </div>
      </div>
    </div>
  );
}
