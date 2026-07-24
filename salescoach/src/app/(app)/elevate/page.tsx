import { Suspense } from "react";
import { redirect } from "next/navigation";
import { consoleActor } from "@/lib/platform-admin";
import { adminSessionMinutes } from "@/lib/config";
import { Card } from "@/components/ui";
import { ElevateForm } from "@/components/admin/elevate-form";

/**
 * Step-up gate in front of the platform console. Even with a live product
 * session (or the dev demo fallback), console access requires re-entering
 * your password to mint a short-lived elevated session.
 */
export default async function ElevatePage() {
  const actor = await consoleActor();
  if (!actor) redirect("/");
  if (actor.elevated) redirect("/admin");

  return (
    <div className="max-w-md mx-auto mt-16">
      <Card title="Platform console — step-up required">
        <p className="text-sm text-muted mb-4">
          You&apos;re signed in as <span className="text-foreground">{actor.user.email}</span> ({actor.role.toLowerCase()}{" "}
          console access). Re-enter your password to unlock the console for {adminSessionMinutes()} minutes. This
          elevation is audited.
        </p>
        <Suspense>
          <ElevateForm />
        </Suspense>
      </Card>
    </div>
  );
}
