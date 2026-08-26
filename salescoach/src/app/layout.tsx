import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "SalesCoach AI — AI sales training that grades real calls",
    template: "%s · SalesCoach AI",
  },
  description:
    "Upload sales calls and practice against AI prospects. Get scored 0–100 on your methodology. Built for reps and sales managers. $50/month.",
  openGraph: {
    title: "SalesCoach AI",
    description: "AI sales training: graded call review, AI role-play, and coaching analytics.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
