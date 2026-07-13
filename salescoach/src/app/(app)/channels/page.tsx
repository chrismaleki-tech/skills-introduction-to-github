import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { ChannelConnectPanel } from "@/components/crm/outreach";

export default async function ChannelsPage() {
  const user = await currentUser();
  const connections = await db.channelConnection.findMany({
    where: { userId: user.id },
    orderBy: { channel: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="My channels"
        subtitle="Connect your work email and phone so you can reach prospects from the CRM. Conversations stay attached to deals and contacts — phone calls can also be graded by SalesCoach."
      />

      <ChannelConnectPanel
        connections={connections}
        defaultEmail={user.email}
        defaultPhone={user.role === "REP" ? "+1-555-0140" : "+1-555-0100"}
      />

      <Card title="How it works" className="mt-8">
        <ol className="list-decimal pl-5 space-y-2 text-sm text-muted">
          <li>Connect email and/or phone above (demo providers work instantly; Gmail/Outlook/Twilio are ready for real OAuth tokens).</li>
          <li>Open a deal or contact and use <span className="text-foreground">Email prospect</span> or <span className="text-foreground">Call prospect</span>.</li>
          <li>Outbound and inbound messages land in the deal&apos;s Conversations panel and activity timeline.</li>
          <li>Phone calls are graded by SalesCoach automatically; the scorecard writes back onto the deal.</li>
        </ol>
      </Card>
    </div>
  );
}
