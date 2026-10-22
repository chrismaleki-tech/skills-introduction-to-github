import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { isClerkEnabled } from "@/lib/auth-mode";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Erota Sales Intelligence — Coach every rep against your playbook",
    template: "%s · Erota Sales Intelligence",
  },
  description:
    "Turn sales conversations into consistent, quote-backed coaching. Score calls against your methodology, surface skill gaps, and assign focused practice.",
  openGraph: {
    title: "Erota Sales Intelligence",
    description: "Evidence-backed call coaching and AI role-play built around your sales methodology.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const tree = (
    <html lang="en" className={`${plusJakarta.variable} h-full antialiased`}>
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
        appearance={{
          layout: {
            logoImageUrl: "/brand/erota-mark.png",
            logoPlacement: "inside",
            termsPageUrl: "/terms",
            privacyPageUrl: "/privacy",
          },
          variables: { colorPrimary: "#0091ae" },
        }}
        localization={{
          signIn: {
            start: {
              title: "Sign in to Erota Sales Intelligence",
              subtitle: "Welcome back. Sign in to continue to your workspace.",
            },
          },
          signUp: {
            start: {
              title: "Create your Erota Sales Intelligence account",
              subtitle: "Start your free trial. No credit card required.",
            },
          },
        }}
      >
        {tree}
      </ClerkProvider>
    );
  }
  return tree;
}
