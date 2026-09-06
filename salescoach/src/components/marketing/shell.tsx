import Link from "next/link";

export function MarketingHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight text-marketing-ink">
          <span className="text-brand">Sales</span>Coach AI
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-muted">
          <a href="#how-it-works" className="hidden sm:inline hover:text-marketing-ink transition-colors">
            How it works
          </a>
          <a href="#pricing" className="hidden sm:inline hover:text-marketing-ink transition-colors">
            Pricing
          </a>
          <Link href="/dashboard" className="hover:text-marketing-ink transition-colors">
            Open app
          </Link>
          <a
            href="#demo"
            className="rounded-lg bg-accent px-3.5 py-2 text-white shadow-sm hover:bg-accent-hover transition-colors"
          >
            Book a demo
          </a>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-display text-lg font-semibold text-marketing-ink">
            <span className="text-brand">Sales</span>Coach AI
          </div>
          <p className="mt-1 text-sm text-muted">AI sales training for modern revenue teams.</p>
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-muted">
          <a href="#pricing" className="hover:text-marketing-ink">
            Pricing
          </a>
          <Link href="/privacy" className="hover:text-marketing-ink">
            Privacy
          </Link>
          <Link href="/dashboard" className="hover:text-marketing-ink">
            Open app
          </Link>
          <a href="mailto:hello@salescoach.ai" className="hover:text-marketing-ink">
            hello@salescoach.ai
          </a>
        </div>
      </div>
    </footer>
  );
}
