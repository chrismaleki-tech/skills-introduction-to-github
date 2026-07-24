import { NextResponse } from "next/server";
import { currentUser, isManagerRole } from "@/lib/session";
import { usageSummary } from "@/lib/metering";

/** Usage metering summary for the current org (last 30 days). */
export async function GET() {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const since = new Date(Date.now() - 30 * 86400000);
  const summary = await usageSummary(user.orgId, since);
  return NextResponse.json({ since: since.toISOString(), summary });
}
