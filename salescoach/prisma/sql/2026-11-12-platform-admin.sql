-- Platform-owner controls. Additive and idempotent.
-- Production: take a backup, run this file once, then deploy the app.
-- Do not also run `prisma db push` against production. That command reconciles
-- the entire schema and can drop columns that are not in schema.prisma.
-- Use `prisma db push` only on a disposable database.
-- This script does not update or delete existing customer rows.

ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "suspendedReason" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "bonusRoleplaySec" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "bonusCallReviewSec" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "compPlanKey" TEXT;
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "compExpiresAt" TIMESTAMP(3);
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "compReason" TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS "AdminAudit" (
  "id" TEXT NOT NULL,
  "actorClerkId" TEXT NOT NULL,
  "actorEmail" TEXT NOT NULL,
  "orgId" TEXT,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "beforeJson" TEXT NOT NULL DEFAULT '{}',
  "afterJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminAudit_orgId_createdAt_idx" ON "AdminAudit"("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAudit_createdAt_idx" ON "AdminAudit"("createdAt");

DO $$ BEGIN
  ALTER TABLE "AdminAudit" ADD CONSTRAINT "AdminAudit_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
