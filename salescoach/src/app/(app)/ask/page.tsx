import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { shortNameToken } from "@/lib/assistant";
import { QueryWorkspace } from "@/components/assistant/query-workspace";

export default async function AskPage() {
  const user = await currentUser();
  const [account, rep] = await Promise.all([
    db.account.findFirst({ where: { orgId: user.orgId }, orderBy: { createdAt: "asc" }, select: { name: true } }),
    db.user.findFirst({ where: { orgId: user.orgId, role: "REP" }, orderBy: { createdAt: "asc" }, select: { name: true } }),
  ]);
  return <QueryWorkspace exampleAccount={shortNameToken(account?.name)} exampleRep={shortNameToken(rep?.name)} />;
}
