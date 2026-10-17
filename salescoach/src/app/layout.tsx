import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Fraunces } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { isClerkEnabled } from "@/lib/auth-mode";
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
    default: "SalesCoach AI by Erota — Coach every rep against your playbook",
    template: "%s · SalesCoach AI",
  },
  description:
    "Turn sales conversations into consistent, quote-backed coaching. Score calls against your methodology, surface skill gaps, and assign focused practice.",
  openGraph: {
    title: "SalesCoach AI by Erota",
    description: "Evidence-backed call coaching and AI role-play built around your sales methodology.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const tree = (
    <html lang="en" className={`${plusJakarta.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );

  if (isClerkEnabled()) {
    return (
      <ClerkProvider
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        signInFallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard"
        afterSignOutUrl="/"
      >
        {tree}
      </ClerkProvider>
    );
  }
  return tree;
}
