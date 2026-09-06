import { NextResponse } from "next/server";
import {
  connectChannel,
  disconnectChannel,
  getUserConnections,
  type ChannelKind,
} from "@/lib/channels";
import { currentUser } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  const connections = await getUserConnections(user.id);
  return NextResponse.json({ connections });
}

export async function POST(req: Request) {
  const user = await currentUser();
  const body = (await req.json().catch(() => null)) as {
    channel?: string;
    provider?: string;
    address?: string;
    action?: "connect" | "disconnect";
  } | null;

  const channel = body?.channel as ChannelKind | undefined;
  if (channel !== "EMAIL" && channel !== "PHONE") {
    return NextResponse.json({ error: "channel must be EMAIL or PHONE." }, { status: 400 });
  }

  try {
    if (body?.action === "disconnect") {
      const conn = await disconnectChannel(user.id, channel);
      return NextResponse.json({ connection: conn });
    }
    const connection = await connectChannel({
      orgId: user.orgId,
      userId: user.id,
      channel,
      provider: body?.provider?.trim() || (channel === "EMAIL" ? "demo_email" : "demo_phone"),
      address: body?.address ?? "",
    });
    return NextResponse.json({ connection });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update connection." },
      { status: 400 },
    );
  }
}
