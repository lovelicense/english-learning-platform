-- CreateEnum
CREATE TYPE "CefrLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- CreateEnum
CREATE TYPE "LearningProgressStatus" AS ENUM ('COLLECTED', 'RECOGNIZED', 'PRACTICING', 'USABLE_IN_SPEAKING', 'AUTOMATED');

-- CreateEnum
CREATE TYPE "MatchSource" AS ENUM ('RULE', 'LLM', 'MANUAL');

-- CreateEnum
CREATE TYPE "VocabularyPartOfSpeech" AS ENUM (
  'NOUN',
  'VERB',
  'ADJECTIVE',
  'ADVERB',
  'PRONOUN',
  'PREPOSITION',
  'CONJUNCTION',
  'INTERJECTION',
  'PHRASE',
  'OTHER'
);

-- CreateTable
CREATE TABLE "PatternCategory" (
  "id" TEXT NOT NULL,
  "level" "CefrLevel" NOT NULL,
  "code" TEXT NOT NULL,
  "nameKo" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "description" TEXT,
  "targetCount" INTEGER NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PatternCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternTemplate" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "templateText" TEXT NOT NULL,
  "meaningKo" TEXT NOT NULL,
  "usageNote" TEXT,
  "difficulty" INTEGER,
  "exampleEn" TEXT,
  "exampleKo" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PatternTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpressionPatternMatch" (
  "id" TEXT NOT NULL,
  "expressionId" TEXT NOT NULL,
  "patternTemplateId" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "matchedBy" "MatchSource" NOT NULL DEFAULT 'RULE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExpressionPatternMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPatternProgress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "patternTemplateId" TEXT NOT NULL,
  "status" "LearningProgressStatus" NOT NULL DEFAULT 'COLLECTED',
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "failCount" INTEGER NOT NULL DEFAULT 0,
  "responseWithin1sCount" INTEGER NOT NULL DEFAULT 0,
  "lastPracticedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserPatternProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabularyCategory" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "nameKo" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VocabularyCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabularyItem" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT,
  "level" "CefrLevel" NOT NULL,
  "lemma" TEXT NOT NULL,
  "partOfSpeech" "VocabularyPartOfSpeech" NOT NULL,
  "meaningKo" TEXT NOT NULL,
  "exampleEn" TEXT,
  "exampleKo" TEXT,
  "frequencyRank" INTEGER,
  "isCore" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VocabularyItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabularyVariant" (
  "id" TEXT NOT NULL,
  "vocabularyItemId" TEXT NOT NULL,
  "surfaceForm" TEXT NOT NULL,
  "variantType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VocabularyVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpressionVocabularyMatch" (
  "id" TEXT NOT NULL,
  "expressionId" TEXT NOT NULL,
  "vocabularyItemId" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "matchedBy" "MatchSource" NOT NULL DEFAULT 'RULE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExpressionVocabularyMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserVocabularyProgress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "vocabularyItemId" TEXT NOT NULL,
  "status" "LearningProgressStatus" NOT NULL DEFAULT 'COLLECTED',
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "failCount" INTEGER NOT NULL DEFAULT 0,
  "responseWithin1sCount" INTEGER NOT NULL DEFAULT 0,
  "lastPracticedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserVocabularyProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabularyGoal" (
  "id" TEXT NOT NULL,
  "level" "CefrLevel" NOT NULL,
  "targetCount" INTEGER NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VocabularyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatternCategory_level_code_key" ON "PatternCategory"("level", "code");

-- CreateIndex
CREATE INDEX "PatternCategory_level_sortOrder_idx" ON "PatternCategory"("level", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PatternTemplate_categoryId_templateText_key" ON "PatternTemplate"("categoryId", "templateText");

-- CreateIndex
CREATE INDEX "PatternTemplate_categoryId_active_idx" ON "PatternTemplate"("categoryId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ExpressionPatternMatch_expressionId_patternTemplateId_key" ON "ExpressionPatternMatch"("expressionId", "patternTemplateId");

-- CreateIndex
CREATE INDEX "ExpressionPatternMatch_patternTemplateId_isPrimary_idx" ON "ExpressionPatternMatch"("patternTemplateId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "UserPatternProgress_userId_patternTemplateId_key" ON "UserPatternProgress"("userId", "patternTemplateId");

-- CreateIndex
CREATE INDEX "UserPatternProgress_userId_status_idx" ON "UserPatternProgress"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyCategory_code_key" ON "VocabularyCategory"("code");

-- CreateIndex
CREATE INDEX "VocabularyCategory_sortOrder_idx" ON "VocabularyCategory"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyItem_level_lemma_partOfSpeech_key" ON "VocabularyItem"("level", "lemma", "partOfSpeech");

-- CreateIndex
CREATE INDEX "VocabularyItem_level_active_frequencyRank_idx" ON "VocabularyItem"("level", "active", "frequencyRank");

-- CreateIndex
CREATE INDEX "VocabularyItem_categoryId_active_idx" ON "VocabularyItem"("categoryId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyVariant_vocabularyItemId_surfaceForm_key" ON "VocabularyVariant"("vocabularyItemId", "surfaceForm");

-- CreateIndex
CREATE INDEX "VocabularyVariant_surfaceForm_idx" ON "VocabularyVariant"("surfaceForm");

-- CreateIndex
CREATE UNIQUE INDEX "ExpressionVocabularyMatch_expressionId_vocabularyItemId_key" ON "ExpressionVocabularyMatch"("expressionId", "vocabularyItemId");

-- CreateIndex
CREATE INDEX "ExpressionVocabularyMatch_vocabularyItemId_idx" ON "ExpressionVocabularyMatch"("vocabularyItemId");

-- CreateIndex
CREATE UNIQUE INDEX "UserVocabularyProgress_userId_vocabularyItemId_key" ON "UserVocabularyProgress"("userId", "vocabularyItemId");

-- CreateIndex
CREATE INDEX "UserVocabularyProgress_userId_status_idx" ON "UserVocabularyProgress"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyGoal_level_key" ON "VocabularyGoal"("level");

-- AddForeignKey
ALTER TABLE "PatternTemplate" ADD CONSTRAINT "PatternTemplate_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "PatternCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpressionPatternMatch" ADD CONSTRAINT "ExpressionPatternMatch_expressionId_fkey"
FOREIGN KEY ("expressionId") REFERENCES "Expression"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpressionPatternMatch" ADD CONSTRAINT "ExpressionPatternMatch_patternTemplateId_fkey"
FOREIGN KEY ("patternTemplateId") REFERENCES "PatternTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPatternProgress" ADD CONSTRAINT "UserPatternProgress_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPatternProgress" ADD CONSTRAINT "UserPatternProgress_patternTemplateId_fkey"
FOREIGN KEY ("patternTemplateId") REFERENCES "PatternTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyItem" ADD CONSTRAINT "VocabularyItem_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "VocabularyCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyVariant" ADD CONSTRAINT "VocabularyVariant_vocabularyItemId_fkey"
FOREIGN KEY ("vocabularyItemId") REFERENCES "VocabularyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpressionVocabularyMatch" ADD CONSTRAINT "ExpressionVocabularyMatch_expressionId_fkey"
FOREIGN KEY ("expressionId") REFERENCES "Expression"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpressionVocabularyMatch" ADD CONSTRAINT "ExpressionVocabularyMatch_vocabularyItemId_fkey"
FOREIGN KEY ("vocabularyItemId") REFERENCES "VocabularyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVocabularyProgress" ADD CONSTRAINT "UserVocabularyProgress_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVocabularyProgress" ADD CONSTRAINT "UserVocabularyProgress_vocabularyItemId_fkey"
FOREIGN KEY ("vocabularyItemId") REFERENCES "VocabularyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
