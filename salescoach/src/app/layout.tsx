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
