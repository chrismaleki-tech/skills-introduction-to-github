"use client";

import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

/** Clerk-aware marketing CTAs. Only mount when Clerk keys are configured. */
export function ClerkAuthNav() {
  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button type="button" className="hover:text-marketing-ink transition-colors">
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button
            type="button"
            className="rounded-lg bg-accent px-3.5 py-2 text-white shadow-sm hover:bg-accent-hover transition-colors"
          >
            Start free
          </button>
        </SignUpButton>
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
