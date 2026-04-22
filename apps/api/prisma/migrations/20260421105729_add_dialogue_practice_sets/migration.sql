-- CreateTable
CREATE TABLE "DialoguePracticeSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationSessionId" TEXT,
    "title" TEXT NOT NULL,
    "topic" TEXT,
    "scenario" TEXT,
    "source" TEXT DEFAULT 'ai_conversation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DialoguePracticeSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DialoguePracticeTurn" (
    "id" TEXT NOT NULL,
    "practiceSetId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "aiPrompt" TEXT NOT NULL,
    "aiPromptTtsKey" TEXT,
    "expectedUserAnswer" TEXT NOT NULL,
    "expectedUserAnswerAlt" TEXT,
    "hint" TEXT,
    "explanation" TEXT,
    "expressionId" TEXT,
    "sourceConversationTurnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DialoguePracticeTurn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DialoguePracticeSet_userId_createdAt_idx" ON "DialoguePracticeSet"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DialoguePracticeSet_conversationSessionId_idx" ON "DialoguePracticeSet"("conversationSessionId");

-- CreateIndex
CREATE INDEX "DialoguePracticeTurn_sourceConversationTurnId_idx" ON "DialoguePracticeTurn"("sourceConversationTurnId");

-- CreateIndex
CREATE UNIQUE INDEX "DialoguePracticeTurn_practiceSetId_sequence_key" ON "DialoguePracticeTurn"("practiceSetId", "sequence");

-- AddForeignKey
ALTER TABLE "DialoguePracticeSet" ADD CONSTRAINT "DialoguePracticeSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialoguePracticeSet" ADD CONSTRAINT "DialoguePracticeSet_conversationSessionId_fkey" FOREIGN KEY ("conversationSessionId") REFERENCES "ConversationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialoguePracticeTurn" ADD CONSTRAINT "DialoguePracticeTurn_practiceSetId_fkey" FOREIGN KEY ("practiceSetId") REFERENCES "DialoguePracticeSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialoguePracticeTurn" ADD CONSTRAINT "DialoguePracticeTurn_expressionId_fkey" FOREIGN KEY ("expressionId") REFERENCES "Expression"("id") ON DELETE SET NULL ON UPDATE CASCADE;
