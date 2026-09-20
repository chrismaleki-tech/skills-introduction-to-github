import { redirect } from "next/navigation";
import { isClerkEnabled } from "@/lib/auth-mode";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  if (!isClerkEnabled()) redirect("/dashboard");
  return (
    <div className="flex min-h-[100dvh] w-full items-start justify-center overflow-x-hidden bg-[linear-gradient(180deg,#f0f9fb_0%,#ffffff_45%)] px-3 py-4 sm:items-center sm:px-4 sm:py-8">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
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
