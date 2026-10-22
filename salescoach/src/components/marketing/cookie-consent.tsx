"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { COOKIE_CONSENT_EVENT, COOKIE_CONSENT_KEY } from "@/lib/consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(!window.localStorage.getItem(COOKIE_CONSENT_KEY));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function choose(value: "accepted" | "declined") {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: value }));
    setVisible(false);
  }

  if (!visible) return null;
  return (
    <aside className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-xl border border-line bg-white p-4 shadow-xl sm:bottom-5 sm:flex sm:items-center sm:gap-5">
      <p className="text-xs leading-relaxed text-muted">
        We use an optional first-party cookie to remember campaign attribution. Authentication cookies are required for
        the app. Learn more in our{" "}
        <Link href="/privacy" className="font-semibold text-brand hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
      <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
        <button
          type="button"
          onClick={() => choose("declined")}
          className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-marketing-ink"
        >
          Decline optional
        </button>
        <button
          type="button"
          onClick={() => choose("accepted")}
          className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white"
        >
          Accept
        </button>
      </div>
    </aside>
  );
}
