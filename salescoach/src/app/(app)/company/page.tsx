import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { parseCompanyProfile } from "@/lib/types";
import { fmtDateTime, PageHeader } from "@/components/ui";
import { CompanyEditor } from "@/components/settings/company-editor";

// Company profile: the context layer that grounds grading feedback and
// role-play persona generation. Created on first save if it does not exist.

export default async function CompanyPage() {
  const user = await currentUser();
  if (!isManagerRole(user.role)) redirect("/me");

  const context = await db.companyContext.findUnique({ where: { orgId: user.orgId } });
  const profile = parseCompanyProfile(context?.profileJson ?? "{}");

  return (
    <div>
      <PageHeader
        title="Company Profile"
        subtitle="Everything here feeds every grade and every generated role-play persona: the grader rewards reps who use your value props and approved objection responses, and role-play prospects are built from your personas and competitors."
        actions={
          context ? (
            <span className="text-xs text-muted">Last updated {fmtDateTime(context.updatedAt)}</span>
          ) : (
            <span className="text-xs text-muted">Not saved yet</span>
          )
        }
      />
      <CompanyEditor profile={profile} />
    </div>
  );
}
