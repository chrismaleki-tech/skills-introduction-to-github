import { redirect } from "next/navigation";
import { isClerkEnabled } from "@/lib/auth-mode";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  if (!isClerkEnabled()) redirect("/dashboard");
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f0f9fb_0%,#ffffff_45%)] px-4">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
