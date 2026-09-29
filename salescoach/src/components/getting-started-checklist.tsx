import Link from "next/link";
import type { GettingStartedStep } from "@/lib/getting-started";

export function GettingStartedChecklist({
  steps,
  compact = false,
}: {
  steps: GettingStartedStep[];
  compact?: boolean;
}) {
  const completed = steps.filter((step) => step.complete).length;
  const percent = Math.round((completed / steps.length) * 100);
  const nextStep = steps.find((step) => !step.complete);

  if (compact && !nextStep) return null;

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-brand/30 bg-surface">
      <div className="bg-brand/5 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">Getting started</p>
            <h2 className="mt-1 text-lg font-semibold">
              {completed === steps.length ? "You’re ready to coach" : "Set up your workspace"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {completed} of {steps.length} steps complete
            </p>
          </div>
          {compact && (
            <Link
              href="/getting-started"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-medium hover:bg-surface-2 sm:min-h-0"
            >
              View full guide
            </Link>
          )}
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-white"
          role="progressbar"
          aria-label="Getting started progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {compact && nextStep ? (
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">NEXT STEP</p>
            <p className="mt-1 font-medium">{nextStep.title}</p>
            <p className="mt-1 text-sm text-muted">{nextStep.description}</p>
          </div>
          <Link
            href={nextStep.href}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-hover sm:min-h-0"
          >
            {nextStep.action}
          </Link>
        </div>
      ) : (
        <ol className="divide-y divide-line">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  step.complete ? "bg-emerald-100 text-emerald-700" : "bg-surface-2 text-muted"
                }`}
                aria-label={step.complete ? "Complete" : "Not complete"}
              >
                {step.complete ? "✓" : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className={`font-medium ${step.complete ? "text-muted line-through" : ""}`}>{step.title}</p>
                    <p className="mt-1 text-sm text-muted">{step.description}</p>
                  </div>
                  <Link
                    href={step.href}
                    className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-brand hover:underline sm:min-h-0"
                  >
                    {step.complete ? "Review" : step.action} →
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
