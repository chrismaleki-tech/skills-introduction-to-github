import { redirect } from "next/navigation";
import { isClerkEnabled } from "@/lib/auth-mode";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  if (!isClerkEnabled()) redirect("/dashboard");
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f0f9fb_0%,#ffffff_45%)] px-4">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
