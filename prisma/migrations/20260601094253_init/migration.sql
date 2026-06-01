-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('received', 'delivered', 'failed', 'replayed');

-- CreateEnum
CREATE TYPE "ReplayStatus" AS ENUM ('success', 'failed');

-- CreateEnum
CREATE TYPE "EvalRunStatus" AS ENUM ('pass', 'fail');

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'received',
    "headers" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReplayAt" TIMESTAMP(3),
    "targetId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplayTarget" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplayTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplayAttempt" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "ReplayStatus" NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplayAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvalTestCase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "eventId" TEXT,
    "targetId" TEXT,
    "expectedStatus" INTEGER NOT NULL,
    "expectedBodyIncludes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvalTestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvalRun" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "replayAttemptId" TEXT,
    "status" "EvalRunStatus" NOT NULL,
    "expectedStatus" INTEGER NOT NULL,
    "actualStatus" INTEGER,
    "evidence" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_idx" ON "WebhookEvent"("provider");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_idx" ON "WebhookEvent"("status");

-- CreateIndex
CREATE INDEX "WebhookEvent_receivedAt_idx" ON "WebhookEvent"("receivedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_eventType_idx" ON "WebhookEvent"("eventType");

-- CreateIndex
CREATE INDEX "ReplayTarget_provider_idx" ON "ReplayTarget"("provider");

-- CreateIndex
CREATE INDEX "ReplayTarget_isActive_idx" ON "ReplayTarget"("isActive");

-- CreateIndex
CREATE INDEX "ReplayAttempt_eventId_idx" ON "ReplayAttempt"("eventId");

-- CreateIndex
CREATE INDEX "ReplayAttempt_targetId_idx" ON "ReplayAttempt"("targetId");

-- CreateIndex
CREATE INDEX "ReplayAttempt_status_idx" ON "ReplayAttempt"("status");

-- CreateIndex
CREATE INDEX "ReplayAttempt_attemptedAt_idx" ON "ReplayAttempt"("attemptedAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "EvalTestCase_isActive_idx" ON "EvalTestCase"("isActive");

-- CreateIndex
CREATE INDEX "EvalRun_testCaseId_idx" ON "EvalRun"("testCaseId");

-- CreateIndex
CREATE INDEX "EvalRun_status_idx" ON "EvalRun"("status");

-- CreateIndex
CREATE INDEX "EvalRun_createdAt_idx" ON "EvalRun"("createdAt");

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "ReplayTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplayAttempt" ADD CONSTRAINT "ReplayAttempt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "WebhookEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplayAttempt" ADD CONSTRAINT "ReplayAttempt_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "ReplayTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalTestCase" ADD CONSTRAINT "EvalTestCase_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "WebhookEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalTestCase" ADD CONSTRAINT "EvalTestCase_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "ReplayTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalRun" ADD CONSTRAINT "EvalRun_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "EvalTestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalRun" ADD CONSTRAINT "EvalRun_replayAttemptId_fkey" FOREIGN KEY ("replayAttemptId") REFERENCES "ReplayAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
