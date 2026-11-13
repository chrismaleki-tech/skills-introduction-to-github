-- Trial usage metering: workspace-shared allowances for trialing orgs.
--
-- Apply in one of two ways:
--   a) `npm run db:push` (adds the columns/indexes from schema.prisma), then run
--      ONLY the "Backfill" section below, or
--   b) run this whole file with psql against the target database.
--
-- Both are idempotent. Run the backfill once per database; re-running it only
-- touches rows that are still NONE.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
ALTER TABLE "Call"
  ADD COLUMN IF NOT EXISTS "meterStatus"    TEXT         NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "meteredSec"     INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "meterEstimated" BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "meteredAt"      TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Call_orgId_meterStatus_idx" ON "Call" ("orgId", "meterStatus");

ALTER TABLE "RoleplaySession"
  ADD COLUMN IF NOT EXISTS "meteredAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "RoleplaySession_orgId_status_idx" ON "RoleplaySession" ("orgId", "status");

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------
-- Calls that were already reviewed (have a Grade) before metering existed are
-- recorded as SETTLED for their stated recording length, dated by the grade,
-- so existing trial workspaces see the call review they have already used.
-- Calls without a grade were never reviewed and stay NONE (nothing charged).
-- No usage is invented: a graded call whose stated duration is 0 settles at 0.
UPDATE "Call" c
SET "meterStatus" = 'SETTLED',
    "meteredSec"  = GREATEST(c."durationSec", 0),
    "meteredAt"   = g."createdAt"
FROM "Grade" g
WHERE g."callId" = c."id"
  AND c."meterStatus" = 'NONE';

-- Role-play sessions already carry their billed seconds in "durationSec"; no
-- backfill is needed. Sessions that are still ACTIVE from before this change
-- have no liveness timestamp, so the next heartbeat starts metering from that
-- moment rather than charging the gap.
