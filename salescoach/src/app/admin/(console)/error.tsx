"use client";

export default function PlatformAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main>
      <h1 className="text-2xl font-semibold">This admin page could not be loaded</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        The server render failed. In production the browser reports that as React error #441 and hides the original
        exception. Match the digest below to the Vercel runtime log.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-sm">Digest: {error.digest}</p>
      ) : (
        <p className="mt-3 max-w-xl text-sm text-muted">{error.message}</p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-4 min-h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white"
      >
        Try again
      </button>
    </main>
  );
}
