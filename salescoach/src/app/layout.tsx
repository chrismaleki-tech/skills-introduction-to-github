import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Erota — Practice your next sales call before it counts",
    template: "%s · Erota Sales Intelligence",
  },
  description:
    "Voice sales practice with realistic AI prospects. Handle tough objections out loud, get scored on your team's methodology, and walk into your next customer call prepared.",
  openGraph: {
    title: "Erota — Practice your next sales call before it counts",
    description:
      "Talk with realistic AI prospects, handle tough objections, and get actionable feedback before your next customer call.",
    type: "website",
    siteName: "Erota Sales Intelligence",
  },
  twitter: {
    card: "summary_large_image",
    title: "Erota — Practice your next sales call before it counts",
    description:
      "Voice sales practice with realistic AI prospects, scored on your team's methodology.",
  },
};

// Clerk's provider is mounted per route group (see components/clerk-root.tsx)
// rather than here, so the public marketing pages ship without clerk-js.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
