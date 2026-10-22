import { createHash } from "crypto";
import { db } from "./db";

export async function checkRateLimit(opts: {
  scope: string;
  identity: string;
  limit: number;
  windowSeconds: number;
}) {
  const now = Date.now();
  const windowNumber = Math.floor(now / (opts.windowSeconds * 1000));
  const id = createHash("sha256")
    .update(`${opts.scope}:${opts.identity}:${windowNumber}`)
    .digest("hex");
  const expiresAt = new Date((windowNumber + 1) * opts.windowSeconds * 1000);
  const bucket = await db.rateLimitBucket.upsert({
    where: { id },
    create: { id, expiresAt },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return {
    allowed: bucket.count <= opts.limit,
    remaining: Math.max(0, opts.limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)),
  };
}
