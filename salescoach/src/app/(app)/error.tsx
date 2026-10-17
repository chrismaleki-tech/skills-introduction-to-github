"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const msg = error.message || "Something went wrong.";
  const looksLikeDb =
    /database|seeded|prisma|sqlite|unable to open|no such table/i.test(msg);

  return (
    <div className="mx-auto max-w-lg py-16 px-4">
      <h1 className="text-2xl font-semibold text-ink mb-2">App couldn&apos;t load</h1>
      <p className="text-muted text-sm mb-4">
        {looksLikeDb
          ? "The demo database is missing or unreachable. On Vercel, redeploy after the latest build (it seeds prisma/demo.db automatically). For production, switch DATABASE_URL to Postgres."
          : msg}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-accent text-white text-sm px-4 py-2 hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
