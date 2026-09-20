"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

/** Clerk-aware marketing CTAs. Only mount when Clerk keys are configured. */
export function ClerkAuthNav() {
  return (
    <>
      <SignedOut>
        <Link href="/sign-in" className="hidden transition-colors hover:text-marketing-ink sm:inline">
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="inline-flex min-h-11 items-center rounded-lg bg-accent px-3 py-2 text-white shadow-sm transition-colors hover:bg-accent-hover sm:px-3.5"
        >
          Start free
        </Link>
      </SignedOut>
      <SignedIn>
        <Link href="/dashboard" className="hover:text-marketing-ink transition-colors">
          Open app
        </Link>
        <UserButton />
      </SignedIn>
    </>
  );
}
