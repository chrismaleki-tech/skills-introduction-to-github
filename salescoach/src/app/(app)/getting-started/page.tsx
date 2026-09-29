import Link from "next/link";
import { GettingStartedChecklist } from "@/components/getting-started-checklist";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { getGettingStartedSteps } from "@/lib/getting-started";
import { currentUser, isManagerRole } from "@/lib/session";

const practiceTips = [
  "Open Role-Play and choose a scenario.",
  "Read the buyer briefing and the goals for a winning conversation.",
  "Select Start text role-play, then type your opener.",
  "Send at least two responses. Enter sends; Shift+Enter starts a new line.",
  "Select End session & get graded, then review your score, strengths, and next steps.",
];

export default async function GettingStartedPage() {
  const user = await currentUser();
  const manager = isManagerRole(user.role);
  const steps = await getGettingStartedSteps(user);

  return (
    <div>
      <PageHeader
        title="Getting Started"
        subtitle="Follow your live checklist, learn the core workflow, and get useful coaching from your first session."
      />

      <GettingStartedChecklist steps={steps} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Quick walkthrough">
          <ol className="space-y-4">
            {practiceTips.map((tip, index) => (
              <li key={tip} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                  {index + 1}
                </span>
                <span className="pt-0.5">{tip}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5">
            <LinkButton href="/roleplay">Start practicing</LinkButton>
          </div>
        </Card>

        <Card title={manager ? "Set up your team" : "Your weekly routine"}>
          {manager ? (
            <div className="space-y-4 text-sm">
              <GuideItem
                title="Ground the AI in your business"
                body="Add products, buyer personas, common objections, competitors, and approved responses in Company Profile."
                href="/company"
                link="Open Company Profile"
              />
              <GuideItem
                title="Define what good sounds like"
                body="Review the active rubric. Every real call and role-play uses it for consistent scoring."
                href="/rubrics"
                link="Review Rubrics"
              />
              <GuideItem
                title="Give reps focused practice"
                body="Create scenarios, then assign a scenario or call upload with a target and due date."
                href="/assignments"
                link="Create an Assignment"
              />
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <GuideItem
                title="Check assignments"
                body="Start with work assigned by your manager so practice stays focused on the right skills."
                href="/assignments"
                link="View Assignments"
              />
              <GuideItem
                title="Practice and apply"
                body="Complete a short role-play, then use the feedback in a real call."
                href="/roleplay"
                link="Open Role-Play"
              />
              <GuideItem
                title="Review your trend"
                body="Use My Performance to compare recent scores and identify the next skill to improve."
                href="/me"
                link="View My Performance"
              />
            </div>
          )}
        </Card>

        <Card title="Grade a real call">
          <div className="space-y-3 text-sm text-muted">
            <p>
              Go to <strong className="text-foreground">Calls → Upload call</strong>. Add the call type,
              direction, duration, and prospect name.
            </p>
            <p>
              Upload an MP3, WAV, M4A, or WebM file, or paste a transcript with each line beginning with{" "}
              <code className="text-foreground">REP:</code> or <code className="text-foreground">PROSPECT:</code>.
            </p>
            <p>The scorecard appears after processing with strengths, improvements, and skill-level feedback.</p>
          </div>
          <div className="mt-5">
            <LinkButton href="/calls/upload" variant="secondary">
              Upload a call
            </LinkButton>
          </div>
        </Card>

        <Card title="Where to find results">
          <ul className="space-y-3 text-sm">
            <li>
              <strong>My Performance:</strong>{" "}
              <span className="text-muted">your scores, trends, skill breakdown, and open assignments.</span>
            </li>
            <li>
              <strong>Calls:</strong>{" "}
              <span className="text-muted">uploaded and connected calls, transcripts, and scorecards.</span>
            </li>
            <li>
              <strong>Role-Play:</strong>{" "}
              <span className="text-muted">available practice scenarios and previous sessions.</span>
            </li>
            {manager && (
              <li>
                <strong>Team Dashboard:</strong>{" "}
                <span className="text-muted">team trends, skill gaps, coverage, and coaching priorities.</span>
              </li>
            )}
          </ul>
        </Card>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-surface px-4 py-4 text-sm text-muted sm:px-5">
        Still stuck? Email{" "}
        <a className="font-medium text-brand hover:underline" href="mailto:hello@erota.io">
          hello@erota.io
        </a>
        .
      </div>
    </div>
  );
}

function GuideItem({
  title,
  body,
  href,
  link,
}: {
  title: string;
  body: string;
  href: string;
  link: string;
}) {
  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-muted">{body}</p>
      <Link href={href} className="mt-1.5 inline-block font-medium text-brand hover:underline">
        {link} →
      </Link>
    </div>
  );
}
