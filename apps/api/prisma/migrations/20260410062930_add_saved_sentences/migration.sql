-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecordingSource" AS ENUM ('WEB', 'MOBILE', 'MANUAL_UPLOAD');

-- CreateEnum
CREATE TYPE "RecordingSessionStatus" AS ENUM ('CREATED', 'UPLOADING', 'UPLOADED', 'QUEUED', 'PROCESSING', 'PROCESSED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecordingPartStatus" AS ENUM ('PRESIGNED', 'UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecordingJobType" AS ENUM ('TRANSCRIBE_PART', 'ANALYZE_SESSION', 'GENERATE_EXPRESSION', 'GENERATE_TTS');

-- CreateEnum
CREATE TYPE "RecordingJobTargetType" AS ENUM ('RECORDING_SESSION', 'RECORDING_PART', 'RECORDING', 'EXPRESSION');

-- CreateEnum
CREATE TYPE "RecordingJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecordingJobPriority" AS ENUM ('HIGH', 'NORMAL', 'LOW');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "audioKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "RecordingStatus" NOT NULL DEFAULT 'UPLOADED',
    "diarization" BOOLEAN NOT NULL DEFAULT false,
    "analysisSummary" TEXT,
    "analysisRelationship" TEXT,
    "analysisSituation" TEXT,
    "analysisTone" TEXT,
    "analysisUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utterance" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "speakerLabel" TEXT NOT NULL,
    "koreanText" TEXT NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "isMine" BOOLEAN NOT NULL DEFAULT false,
    "analysisIntent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Utterance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expression" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "utteranceId" TEXT,
    "savedSentenceId" TEXT,
    "koreanText" TEXT NOT NULL,
    "englishBase" TEXT NOT NULL,
    "englishEasy" TEXT NOT NULL,
    "englishNatural" TEXT NOT NULL,
    "note" TEXT,
    "userMemo" TEXT,
    "ttsKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSentence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "koreanText" TEXT NOT NULL,
    "relationship" TEXT,
    "situation" TEXT,
    "tone" TEXT,
    "analysisSummary" TEXT,
    "analysisIntent" TEXT,
    "analysisUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSentence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expressionId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "audioKey" TEXT,
    "mode" TEXT,
    "testType" TEXT,
    "promptKorean" TEXT,
    "promptContext" TEXT,
    "recognizedAnswer" TEXT,
    "score" INTEGER NOT NULL,
    "meaningScore" INTEGER,
    "naturalnessScore" INTEGER,
    "grammarScore" INTEGER,
    "feedback" TEXT NOT NULL,
    "strengthComment" TEXT,
    "correctionComment" TEXT,
    "suggestedAnswer" TEXT,
    "suggestedAnswerAlt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "RecordingSource" NOT NULL,
    "status" "RecordingSessionStatus" NOT NULL DEFAULT 'CREATED',
    "title" TEXT,
    "expectedPartCount" INTEGER,
    "uploadedPartCount" INTEGER NOT NULL DEFAULT 0,
    "totalDurationMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RecordingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingPart" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "recordingId" TEXT,
    "partNumber" INTEGER NOT NULL,
    "audioKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "durationMs" INTEGER,
    "sizeBytes" INTEGER,
    "status" "RecordingPartStatus" NOT NULL DEFAULT 'PRESIGNED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordingPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "partId" TEXT,
    "type" "RecordingJobType" NOT NULL,
    "targetType" "RecordingJobTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "RecordingJobStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" "RecordingJobPriority" NOT NULL DEFAULT 'NORMAL',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "payload" JSONB,
    "runAfter" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RecordingJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingPart_recordingId_key" ON "RecordingPart"("recordingId");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingPart_sessionId_partNumber_key" ON "RecordingPart"("sessionId", "partNumber");

-- CreateIndex
CREATE INDEX "RecordingJob_status_priority_createdAt_idx" ON "RecordingJob"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "RecordingJob_sessionId_createdAt_idx" ON "RecordingJob"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "RecordingJob_partId_createdAt_idx" ON "RecordingJob"("partId", "createdAt");

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utterance" ADD CONSTRAINT "Utterance_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expression" ADD CONSTRAINT "Expression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expression" ADD CONSTRAINT "Expression_utteranceId_fkey" FOREIGN KEY ("utteranceId") REFERENCES "Utterance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expression" ADD CONSTRAINT "Expression_savedSentenceId_fkey" FOREIGN KEY ("savedSentenceId") REFERENCES "SavedSentence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSentence" ADD CONSTRAINT "SavedSentence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeLog" ADD CONSTRAINT "PracticeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeLog" ADD CONSTRAINT "PracticeLog_expressionId_fkey" FOREIGN KEY ("expressionId") REFERENCES "Expression"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingSession" ADD CONSTRAINT "RecordingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingPart" ADD CONSTRAINT "RecordingPart_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RecordingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingPart" ADD CONSTRAINT "RecordingPart_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingJob" ADD CONSTRAINT "RecordingJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingJob" ADD CONSTRAINT "RecordingJob_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RecordingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingJob" ADD CONSTRAINT "RecordingJob_partId_fkey" FOREIGN KEY ("partId") REFERENCES "RecordingPart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
