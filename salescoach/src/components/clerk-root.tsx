import { ClerkProvider } from "@clerk/nextjs";
import { isClerkEnabled } from "@/lib/auth-mode";
import { clerkAppearance } from "@/lib/clerk-appearance";

/**
 * Clerk's client provider for the routes that render Clerk UI (the app,
 * sign-in, sign-up, removed). The public marketing pages deliberately sit
 * outside it so visitors never download clerk-js; see
 * components/marketing/auth-nav.tsx for how signed-in visitors still get
 * their account menu there.
 */
export function ClerkRoot({ children }: { children: React.ReactNode }) {
  if (!isClerkEnabled()) return <>{children}</>;
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/"
      appearance={clerkAppearance}
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
      {children}
    </ClerkProvider>
  );
}
