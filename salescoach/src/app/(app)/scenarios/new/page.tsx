import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { parseCompanyProfile } from "@/lib/types";
import { voiceAvailable } from "@/lib/roleplay";
import { PageHeader } from "@/components/ui";
import { ScenarioCreator } from "@/components/roleplay/scenario-creator";

export default async function NewScenarioPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) redirect("/scenarios");
  const [context, scenarioCount, params] = await Promise.all([
    db.companyContext.findUnique({ where: { orgId: user.orgId } }),
    db.scenario.count({ where: { orgId: user.orgId } }),
    searchParams,
  ]);
  const profile = parseCompanyProfile(context?.profileJson ?? "{}");
  const path = params.path === "build" || params.path === "website" ? params.path : "quick";

  return (
    <div>
      <PageHeader
        title="New scenario"
        subtitle="Set up who you're calling and why. You'll review everything before the call starts."
        actions={
          <Link href="/scenarios" className="text-sm text-muted hover:text-foreground transition-colors">
            Back to library
          </Link>
        }
      />
      <ScenarioCreator
        defaultOffering={profile.description.slice(0, 300)}
        voiceEnabled={voiceAvailable()}
        seed={scenarioCount}
        initialPath={path}
      />
    </div>
  );
}
