"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { SignedOutLinks } from "./auth-nav-links";

// Clerk's SDK (~350 KB of script plus its bot-protection probes) is only worth
// loading on the public landing page for someone who is already signed in.
// The signed-out links are plain HTML, server-rendered, and are what every
// visitor sees first; clerk-js is fetched lazily only when Clerk's own
// "__client_uat" cookie says a session exists on this device.
const ClerkSignedInNav = dynamic(() => import("./auth-nav-clerk").then((m) => m.ClerkSignedInNav), {
  ssr: false,
  loading: () => <SignedOutLinks />,
});

function hasClerkSession() {
  // Clerk sets __client_uat (optionally with a suffix) to the last-updated
  // timestamp; "0" means signed out on this device.
  return document.cookie
    .split("; ")
    .some((c) => c.startsWith("__client_uat") && !/=0?$/.test(c));
}

const noop = () => () => {};

/** Clerk-aware marketing CTAs. Only mount when Clerk keys are configured. */
export function ClerkAuthNav() {
  // Server snapshot is "signed out", so the static HTML and the first client
  // render agree; the cookie is read once hydration is complete.
  const signedIn = useSyncExternalStore(noop, hasClerkSession, () => false);
  return signedIn ? <ClerkSignedInNav /> : <SignedOutLinks />;
}
