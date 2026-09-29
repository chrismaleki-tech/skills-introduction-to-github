import { db } from "@/lib/db";
import { isManagerRole } from "@/lib/session";
import { parseCompanyProfile } from "@/lib/types";

export interface GettingStartedStep {
  title: string;
  description: string;
  href: string;
  action: string;
  complete: boolean;
}

function hasCompanyProfile(profileJson?: string) {
  if (!profileJson) return false;
  const profile = parseCompanyProfile(profileJson);
  return Boolean(
    profile.description.trim() ||
      profile.valueProps.length ||
      profile.products.length ||
      profile.personas.length ||
      profile.objections.length ||
      profile.competitors.length ||
      profile.talkTracks.length ||
      profile.pricingNotes.trim(),
  );
}

export async function getGettingStartedSteps(user: {
  id: string;
  orgId: string;
  role: string;
  org: { activeMethodologyId: string | null };
}): Promise<GettingStartedStep[]> {
  const manager = isManagerRole(user.role);

  if (manager) {
    const [company, scenarioCount, roleplayCount, callCount] = await Promise.all([
      db.companyContext.findUnique({
        where: { orgId: user.orgId },
        select: { profileJson: true },
      }),
      db.scenario.count({ where: { orgId: user.orgId } }),
      db.roleplaySession.count({
        where: { orgId: user.orgId, repId: user.id, status: "GRADED" },
      }),
      db.call.count({ where: { orgId: user.orgId } }),
    ]);

    return [
      {
        title: "Add your company context",
        description: "Tell the coach about your products, buyers, objections, and value proposition.",
        href: "/company",
        action: "Complete profile",
        complete: hasCompanyProfile(company?.profileJson),
      },
      {
        title: "Confirm your scoring rubric",
        description: "Use the active rubric or customize a preset to match your sales process.",
        href: "/rubrics",
        action: "Review rubrics",
        complete: Boolean(user.org.activeMethodologyId),
      },
      {
        title: "Create a practice scenario",
        description: "Build a buyer persona manually or generate one from your company profile.",
        href: "/scenarios",
        action: "Create scenario",
        complete: scenarioCount > 0,
      },
      {
        title: "Try your first role-play",
        description: "Practice the conversation, end the session, and review your coaching feedback.",
        href: "/roleplay",
        action: "Start role-play",
        complete: roleplayCount > 0,
      },
      {
        title: "Add a real sales call",
        description: "Upload audio or paste a transcript to receive a score and coaching notes.",
        href: "/calls/upload",
        action: "Upload call",
        complete: callCount > 0,
      },
    ];
  }

  const [scenarioCount, roleplayCount, callCount] = await Promise.all([
    db.scenario.count({ where: { orgId: user.orgId } }),
    db.roleplaySession.count({
      where: { orgId: user.orgId, repId: user.id, status: "GRADED" },
    }),
    db.call.count({ where: { orgId: user.orgId, repId: user.id } }),
  ]);

  return [
    {
      title: "Choose a practice scenario",
      description: "Open the scenario library and pick a buyer conversation to practice.",
      href: "/scenarios",
      action: "View scenarios",
      complete: scenarioCount > 0,
    },
    {
      title: "Complete a text role-play",
      description: "Respond as yourself, end the session when finished, and request your grade.",
      href: "/roleplay",
      action: "Start role-play",
      complete: roleplayCount > 0,
    },
    {
      title: "Add a sales call",
      description: "Upload a recording or paste a transcript for coaching on a real conversation.",
      href: "/calls/upload",
      action: "Upload call",
      complete: callCount > 0,
    },
    {
      title: "Review your performance",
      description: "See scores, skill trends, feedback, and open assignments in one place.",
      href: "/me",
      action: "View performance",
      complete: roleplayCount > 0 || callCount > 0,
    },
  ];
}
