"use client";

export default function PlatformAdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main>
      <h1 className="text-2xl font-semibold">This admin page could not be loaded</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">{error.message || "Something went wrong while reading customer data."}</p>
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
