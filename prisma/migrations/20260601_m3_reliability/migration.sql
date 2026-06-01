-- Milestone 3: reliability hardening
-- Idempotent migration: the /api/admin/migrate endpoint splits on ";\n"
-- and treats "already exists" errors as skip, so this script is safe to
-- re-apply.

ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'dead_letter';

CREATE TYPE "BackoffStrategy" AS ENUM ('none', 'fixed', 'exponential');

CREATE TYPE "SignatureStatus" AS ENUM ('not_configured', 'verified', 'failed');

ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "externalEventId" TEXT;

ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;

ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "duplicateCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "signatureStatus" "SignatureStatus" NOT NULL DEFAULT 'not_configured';

ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "signatureHeaderName" TEXT;

ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "signatureVerifiedAt" TIMESTAMP(3);

ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "signatureFailureReason" TEXT;

ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "deadLetterReason" TEXT;

ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "deadLetteredAt" TIMESTAMP(3);

ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "deadLetterReviewedAt" TIMESTAMP(3);

ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "deadLetterReviewedBy" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_dedupeKey_key" ON "WebhookEvent" ("dedupeKey");

CREATE INDEX IF NOT EXISTS "WebhookEvent_signatureStatus_idx" ON "WebhookEvent" ("signatureStatus");

CREATE INDEX IF NOT EXISTS "WebhookEvent_deadLetteredAt_idx" ON "WebhookEvent" ("deadLetteredAt");

ALTER TABLE "ReplayTarget" ADD COLUMN IF NOT EXISTS "isRetryEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ReplayTarget" ADD COLUMN IF NOT EXISTS "maxAttempts" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "ReplayTarget" ADD COLUMN IF NOT EXISTS "backoffStrategy" "BackoffStrategy" NOT NULL DEFAULT 'none';

ALTER TABLE "ReplayTarget" ADD COLUMN IF NOT EXISTS "backoffBaseMs" INTEGER NOT NULL DEFAULT 500;

ALTER TABLE "ReplayTarget" ADD COLUMN IF NOT EXISTS "timeoutMs" INTEGER NOT NULL DEFAULT 15000;

ALTER TABLE "ReplayTarget" ADD COLUMN IF NOT EXISTS "retryOnStatuses" JSONB NOT NULL DEFAULT '[500,502,503,504]'::jsonb;

ALTER TABLE "ReplayTarget" ADD COLUMN IF NOT EXISTS "isSignatureVerificationEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ReplayTarget" ADD COLUMN IF NOT EXISTS "signatureHeaderName" TEXT;

ALTER TABLE "ReplayTarget" ADD COLUMN IF NOT EXISTS "signatureAlgorithm" TEXT;

ALTER TABLE "ReplayTarget" ADD COLUMN IF NOT EXISTS "signingSecretEnvVar" TEXT;

ALTER TABLE "ReplayAttempt" ADD COLUMN IF NOT EXISTS "runId" TEXT;

ALTER TABLE "ReplayAttempt" ADD COLUMN IF NOT EXISTS "attemptNumber" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "ReplayAttempt" ADD COLUMN IF NOT EXISTS "isAutomatic" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ReplayAttempt" ADD COLUMN IF NOT EXISTS "backoffDelayMs" INTEGER;

CREATE INDEX IF NOT EXISTS "ReplayAttempt_runId_idx" ON "ReplayAttempt" ("runId");

ALTER TABLE "EvalTestCase" ADD COLUMN IF NOT EXISTS "expectedMaxDurationMs" INTEGER;

ALTER TABLE "EvalTestCase" ADD COLUMN IF NOT EXISTS "assertions" JSONB;
