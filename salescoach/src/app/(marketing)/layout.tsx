import { MarketingFooter, MarketingHeader } from "@/components/marketing/shell";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-marketing-bg text-marketing-ink">
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </div>
  );
}
