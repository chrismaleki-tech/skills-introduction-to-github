import { db } from "./db";
import { productionConfigIssues } from "./env";
import { probeStorage } from "./storage";

async function probeOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is missing");
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
}

async function probeDeepgram() {
  if (!process.env.DEEPGRAM_API_KEY) throw new Error("DEEPGRAM_API_KEY is missing");
  const response = await fetch("https://api.deepgram.com/v1/projects", {
    headers: { authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Deepgram returned ${response.status}`);
}

async function probeStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is missing");
  const response = await fetch("https://api.stripe.com/v1/account", {
    headers: {
      authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Stripe returned ${response.status}`);
}

async function result(check: () => Promise<unknown>) {
  try {
    await check();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runDiagnostics() {
  const [database, storage, openai, deepgram, stripe] = await Promise.all([
    result(async () => {
      await db.$queryRaw`SELECT 1`;
    }),
    result(probeStorage),
    result(probeOpenAI),
    result(probeDeepgram),
    result(probeStripe),
  ]);
  const configurationIssues = productionConfigIssues();
  const checks = { database, storage, openai, deepgram, stripe };
  return {
    ok:
      Object.values(checks).every((check) => check.ok) &&
      configurationIssues.length === 0,
    checks,
    configurationIssues,
  };
}
