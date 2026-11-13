import { AttributionCapture } from "@/components/marketing/attribution-capture";
import { CookieConsent } from "@/components/marketing/cookie-consent";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/shell";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-marketing-bg text-marketing-ink">
      <AttributionCapture />
      <CookieConsent />
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </div>
  );
}
