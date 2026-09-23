"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 40, maxWidth: 640 }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>SalesCoach couldn&apos;t load</h1>
        <p style={{ color: "#555", fontSize: 14, marginBottom: 16 }}>
          {error.message || "Unexpected server error."}
          {error.digest ? ` (digest ${error.digest})` : ""}
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            background: "#2d3e50",
            color: "#fff",
            border: 0,
            borderRadius: 6,
            padding: "8px 14px",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
