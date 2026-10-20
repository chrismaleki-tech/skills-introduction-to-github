import { redirect } from "next/navigation";
import Link from "next/link";
import { isClerkEnabled } from "@/lib/auth-mode";
import { BrandLockup } from "@/components/brand-logo";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  if (!isClerkEnabled()) redirect("/dashboard");
  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-start gap-6 overflow-x-hidden bg-[linear-gradient(180deg,#f0f9fb_0%,#ffffff_45%)] px-3 py-4 sm:justify-center sm:px-4 sm:py-8">
      <Link href="/" aria-label="Erota Sales Intelligence home" className="mt-2 sm:mt-0">
        <BrandLockup size="lg" textClassName="font-display text-marketing-ink" />
      </Link>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
        appearance={{
          elements: {
            rootBox: "w-full max-w-md",
            cardBox: "w-full max-w-full",
            card: "w-full max-w-full shadow-sm sm:shadow-lg",
            headerTitle: "text-xl sm:text-2xl",
            headerSubtitle: "text-sm",
            formFieldInput: "min-h-11 text-base",
            formButtonPrimary: "min-h-11",
            socialButtonsBlockButton: "min-h-11",
          },
        }}
      />
    </div>
  );
}
