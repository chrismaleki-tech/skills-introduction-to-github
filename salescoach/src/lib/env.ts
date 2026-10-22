import { priceIdForPlan } from "./plans";

export function productionConfigIssues() {
  const issues: string[] = [];
  const required = [
    "DATABASE_URL",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "CLERK_WEBHOOK_SECRET",
    "S3_BUCKET",
    "S3_ENDPOINT",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "OPENAI_API_KEY",
    "DEEPGRAM_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_APP_URL",
    "OPS_SECRET",
    "CRON_SECRET",
  ];
  for (const key of required) {
    if (!process.env[key]) issues.push(`${key} is missing`);
  }

  if (!process.env.DATABASE_URL?.startsWith("postgresql:")) {
    issues.push("DATABASE_URL must use PostgreSQL");
  }
  if (!process.env.CLERK_SECRET_KEY?.startsWith("sk_live_")) {
    issues.push("CLERK_SECRET_KEY must be a live production key");
  }
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_live_")) {
    issues.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must be a live production key");
  }
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")) {
    issues.push("STRIPE_SECRET_KEY must be a live production key");
  }
  if (!process.env.STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_")) {
    issues.push("STRIPE_PUBLISHABLE_KEY must be a live production key");
  }
  if (!priceIdForPlan("pro")) issues.push("STRIPE_PRO_PRICE_ID is missing");
  if (!priceIdForPlan("max")) issues.push("STRIPE_MAX_PRICE_ID is missing");
  if (!process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://")) {
    issues.push("NEXT_PUBLIC_APP_URL must use HTTPS");
  }
  return [...new Set(issues)];
}

export function assertProductionConfig() {
  if (process.env.VERCEL_ENV !== "production") return;
  const issues = productionConfigIssues();
  if (issues.length) {
    throw new Error(`Production configuration is incomplete: ${issues.join("; ")}`);
  }
}
