import Link from "next/link";

/** Header links for a visitor without a session: plain HTML, no auth SDK. */
export function SignedOutLinks() {
  return (
    <>
      <Link href="/sign-in" className="hidden transition-colors hover:text-marketing-ink sm:inline">
        Sign in
      </Link>
      <Link
        href="/start"
        className="inline-flex min-h-11 items-center whitespace-nowrap rounded-lg bg-accent px-3 py-2 text-white shadow-sm transition-colors hover:bg-accent-hover sm:px-3.5"
      >
        Try AI Role Play
      </Link>
    </>
  );
}
