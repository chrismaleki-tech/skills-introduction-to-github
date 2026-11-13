-- Production platform-owner migration for database neondb.
-- Reviewed additive DDL from 2026-11-12-platform-admin.sql.
-- Run this once in Neon, with the production branch selected and the database
-- dropdown set to neondb, after a backup of neondb exists.
-- The guard and the schema changes are one statement. A different database
-- aborts before any column or table is added.
-- Do not run prisma db push. This script does not update or delete customer rows.

DO $migration$
BEGIN
  IF current_database() IS DISTINCT FROM 'neondb' THEN
    RAISE EXCEPTION
      'Refusing to run: selected database is "%", expected neondb',
      current_database();
  END IF;

  EXECUTE 'ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3)';
  EXECUTE 'ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "suspendedReason" TEXT NOT NULL DEFAULT ''''';
  EXECUTE 'ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "bonusRoleplaySec" INTEGER NOT NULL DEFAULT 0';
  EXECUTE 'ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "bonusCallReviewSec" INTEGER NOT NULL DEFAULT 0';
  EXECUTE 'ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "compPlanKey" TEXT';
  EXECUTE 'ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "compExpiresAt" TIMESTAMP(3)';
  EXECUTE 'ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "compReason" TEXT NOT NULL DEFAULT ''''';

  EXECUTE $sql$
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
    )
  $sql$;

  EXECUTE 'CREATE INDEX IF NOT EXISTS "AdminAudit_orgId_createdAt_idx" ON "AdminAudit"("orgId", "createdAt")';
  EXECUTE 'CREATE INDEX IF NOT EXISTS "AdminAudit_createdAt_idx" ON "AdminAudit"("createdAt")';

  BEGIN
    EXECUTE $sql$
      ALTER TABLE "AdminAudit" ADD CONSTRAINT "AdminAudit_orgId_fkey"
        FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE
    $sql$;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END
$migration$;
