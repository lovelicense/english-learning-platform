-- CreateTable
CREATE TABLE "SavedSentenceParticipant" (
    "id" TEXT NOT NULL,
    "savedSentenceId" TEXT NOT NULL,
    "personProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSentenceParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedSentenceParticipant_savedSentenceId_personProfileId_key" ON "SavedSentenceParticipant"("savedSentenceId", "personProfileId");

-- AddForeignKey
ALTER TABLE "SavedSentenceParticipant" ADD CONSTRAINT "SavedSentenceParticipant_savedSentenceId_fkey" FOREIGN KEY ("savedSentenceId") REFERENCES "SavedSentence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSentenceParticipant" ADD CONSTRAINT "SavedSentenceParticipant_personProfileId_fkey" FOREIGN KEY ("personProfileId") REFERENCES "PersonProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
