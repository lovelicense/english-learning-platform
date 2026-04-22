-- CreateEnum
CREATE TYPE "ConversationMode" AS ENUM ('ENGLISH_AI', 'KOREAN_AI');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConversationSpeaker" AS ENUM ('USER', 'AI');

-- CreateEnum
CREATE TYPE "ConversationLanguage" AS ENUM ('EN', 'KO', 'MIXED');

-- CreateTable
CREATE TABLE "ConversationSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "ConversationMode" NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "topic" TEXT,
    "scenario" TEXT,
    "goal" TEXT,
    "summary" TEXT,
    "aiOutputMode" TEXT,
    "userInputMode" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationTurn" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "turnIndex" INTEGER NOT NULL,
    "speaker" "ConversationSpeaker" NOT NULL,
    "language" "ConversationLanguage" NOT NULL,
    "originalText" TEXT NOT NULL,
    "correctedText" TEXT,
    "naturalText" TEXT,
    "correctionNote" TEXT,
    "intent" TEXT,
    "contextNote" TEXT,
    "inputMode" TEXT,
    "outputMode" TEXT,
    "audioKey" TEXT,
    "ttsKey" TEXT,
    "dialogueAudioKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationTurn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationSession_userId_mode_createdAt_idx" ON "ConversationSession"("userId", "mode", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationSession_userId_status_updatedAt_idx" ON "ConversationSession"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ConversationTurn_userId_createdAt_idx" ON "ConversationTurn"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationTurn_sessionId_speaker_createdAt_idx" ON "ConversationTurn"("sessionId", "speaker", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationTurn_sessionId_turnIndex_key" ON "ConversationTurn"("sessionId", "turnIndex");

-- AddForeignKey
ALTER TABLE "ConversationSession" ADD CONSTRAINT "ConversationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTurn" ADD CONSTRAINT "ConversationTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTurn" ADD CONSTRAINT "ConversationTurn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
