"use client";

import Link from "next/link";
import { ClerkProvider, UserButton, useAuth } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { SignedOutLinks } from "./auth-nav-links";

/**
 * Header for a visitor who already has a Clerk session on this device. Loaded
 * on demand (see auth-nav.tsx), so it brings its own provider: the marketing
 * route group is intentionally outside the app-wide ClerkRoot.
 *
 * Until Clerk confirms a user — while it is loading, and if the session cookie
 * turns out to be stale — the same signed-out links stay in place, so the
 * header never loses its buttons.
 */
export function ClerkSignedInNav() {
  return (
    <ClerkProvider afterSignOutUrl="/" signInUrl="/sign-in" signUpUrl="/sign-up" appearance={clerkAppearance}>
      <HeaderSession />
    </ClerkProvider>
  );
}

function HeaderSession() {
  const { userId } = useAuth();
  if (!userId) return <SignedOutLinks />;
  return (
    <>
      <Link href="/dashboard" className="hover:text-marketing-ink transition-colors">
        Open app
      </Link>
      <UserButton />
    </>
  );
}
